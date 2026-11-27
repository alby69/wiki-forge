import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import type { Principal } from '@backend/server/bus/messageBus';

/**
 * Phase 95 — OKF line-anchor citations.
 *
 * Acceptance:
 *  - a note pointing to deleted source rows cannot be verified;
 *  - valid anchor / changed source / out-of-range rows are all reported.
 */

interface Harness {
  agentServer: AgentServer;
  tmpDir: string;
  close: () => Promise<void>;
}

const ALL_ROLES = ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin'];
const human = (id: string): Principal => ({ actor: `human:${id}`, roles: ALL_ROLES, source: 'idp' });

function body(result: any): any {
  return result?.body ?? result;
}

const SOURCE = `# Fonte

Riga due della fonte.
Riga tre della fonte.
`;

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-citations-'));
  for (const dir of ['config', 'wiki', 'raw', 'output', '.wiki-forge', 'docs/help']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(
    path.join(tmpDir, 'config', 'config.toml'),
    '[enterprise]\nenable_rbac = false\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(tmpDir, 'wiki', 'index.md'),
    '---\nokf_version: "0.2"\n---\n# Index\n',
    'utf-8',
  );
  await fs.writeFile(path.join(tmpDir, 'raw', 'paper.md'), SOURCE, 'utf-8');
  const agentServer = new AgentServer(tmpDir);
  return {
    agentServer,
    tmpDir,
    close: async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function writeNote(
  h: Harness,
  id: string,
  anchor: string,
  claim = 'Il mercato del lavoro cresce secondo la fonte citata.',
): Promise<void> {
  await fs.writeFile(
    path.join(h.tmpDir, 'wiki', `${id}.md`),
    [
      '---',
      `title: ${id}`,
      'status: draft',
      'sources:',
      '  - id: paper',
      '    resource: raw/paper.md',
      '---',
      `# ${id}`,
      '',
      `${claim}${anchor}`,
      '',
    ].join('\n'),
    'utf-8',
  );
}

describe('Citazioni OKF per affermazione (Phase 95)', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness();
  });

  after(async () => {
    await h.close();
  });

  it('ancora valida: check ok e verifica stable registrata', async () => {
    await writeNote(h, 'cited-ok', '[^src:paper#L2-L3]');

    const check = await h.agentServer.checkNoteCitations('cited-ok', 'default');
    assert.strictEqual(check.success, true);
    assert.strictEqual(check.report?.anchors, 1);
    assert.strictEqual(check.report?.ok, true);
    assert.strictEqual(check.report?.coverage, 1);
    assert.deepStrictEqual(check.report?.issues, []);

    const result = await h.agentServer.recordHumanVerification({
      noteRef: 'cited-ok',
      reviewer: 'alice',
      setStable: true,
      projectId: 'default',
      principal: human('alice'),
    });
    assert.strictEqual(result.success, true);
    const content = await fs.readFile(path.join(h.tmpDir, 'wiki', 'cited-ok.md'), 'utf-8');
    assert.ok(content.includes('status: stable'));
    assert.ok(content.includes('sha256: '), 'sha256 baseline must be recorded on verify');
  });

  it('fonte modificata dopo la verifica: stable bloccata da citation gate', async () => {
    await writeNote(h, 'cited-changed', '[^src:paper#L2-L3]');

    const first = await h.agentServer.recordHumanVerification({
      noteRef: 'cited-changed',
      reviewer: 'alice',
      setStable: true,
      projectId: 'default',
      principal: human('alice'),
    });
    assert.strictEqual(first.success, true);

    await fs.writeFile(
      path.join(h.tmpDir, 'raw', 'paper.md'),
      `${SOURCE}\nRiga aggiunta a mano.\n`,
      'utf-8',
    );

    const second = await h.agentServer.recordHumanVerification({
      noteRef: 'cited-changed',
      reviewer: 'alice',
      setStable: true,
      projectId: 'default',
      principal: human('alice'),
    });
    assert.strictEqual(second.success, false);
    assert.strictEqual(second.error, 'citation-source-changed');
    assert.ok(second.citation?.issues.some(issue => issue.kind === 'hash'));

    const check = await h.agentServer.checkNoteCitations('cited-changed', 'default');
    assert.strictEqual(check.report?.ok, true, 'hash issues stay advisory for the report');
    assert.ok(check.report?.issues.some(issue => issue.kind === 'hash'));

    await fs.writeFile(path.join(h.tmpDir, 'raw', 'paper.md'), SOURCE, 'utf-8');
  });

  it('riga inesistente e ancora orfana bloccano ogni verifica', async () => {
    await writeNote(h, 'cited-range', '[^src:paper#L9-L12]');

    const check = await h.agentServer.checkNoteCitations('cited-range', 'default');
    assert.strictEqual(check.success, true);
    assert.strictEqual(check.report?.ok, false);
    assert.ok(check.report?.issues.some(issue => issue.kind === 'range'));

    const result = await h.agentServer.recordHumanVerification({
      noteRef: 'cited-range',
      reviewer: 'alice',
      setStable: false,
      projectId: 'default',
      principal: human('alice'),
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'citation-gate-failed');
    const content = await fs.readFile(path.join(h.tmpDir, 'wiki', 'cited-range.md'), 'utf-8');
    assert.ok(!content.includes('verified:'), 'a failing citation gate must not write the event');

    await writeNote(h, 'cited-orphan', '[^src:ghost#L1-L2]');
    const orphan = await h.agentServer.checkNoteCitations('cited-orphan', 'default');
    assert.strictEqual(orphan.report?.ok, false);
    assert.ok(orphan.report?.issues.some(issue => issue.kind === 'orphan'));
  });

  it('la route review.citations espone lo stesso report sul bus', async () => {
    const bus = h.agentServer.getBus();
    const result = body(await bus.dispatch('review.citations', {
      note: 'cited-ok',
      semantic: false,
    }, { projectId: 'default', principal: human('alice') }));
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.note?.path, 'wiki/cited-ok.md');
    assert.strictEqual(result.report?.anchors, 1);
    assert.strictEqual(typeof result.report?.coverage, 'number');
  });

  it('lo slash verify-citations produce un report markdown deterministico', async () => {
    const notes = await h.agentServer.readAllWikiNotes('default');
    const markdown = await h.agentServer.executeVerifyCitationsWorkflow('cited-range', notes, 'default');
    assert.ok(markdown.includes('cited-range'));
    assert.ok(markdown.includes('range'));
    assert.ok(markdown.includes('### 🧾 Verifica citazioni'));
  });
});
