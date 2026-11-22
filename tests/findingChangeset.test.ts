import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer } from '@backend/server/agentServer';
import { ChangesetStore } from '@backend/server/changesetStore';
import {
  findingToStageInput,
  parseFindingsEnvelope,
  stageFindingChangesets,
  type FindingsEnvelope,
} from '@backend/server/findingChangeset';

const ORIGINAL = '---\ntitle: Target\ntype: note\n---\n\n# Target\n\nTesto originale.\n';

function envelope(
  targetPath: string,
  findingId = 'knowledge_gap-target-a1b2c3d4e5f6',
  kind = 'knowledge_gap',
): FindingsEnvelope {
  return {
    schema: 'wikiforge.finding/v1',
    count: 1,
    findings: [{
      findingId,
      kind,
      confidence: 0.9,
      evidence: ['cq=CQ-01', 'status=UNCOVERED', 'question=Qual è il processo?'],
      targetPath,
      proposedAction: 'deep-research',
    }],
  };
}

describe('A3 — Finding → changeset (propose)', () => {
  let tmpDir: string;
  let baseUrl: string;
  let server: http.Server;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-finding-changeset-'));
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'wiki', 'target.md'), ORIGINAL, 'utf-8');
    const agentServer = new AgentServer(tmpDir);
    server = http.createServer((req, res) => {
      void agentServer.handleRequest(req, res).then((handled) => {
        if (!handled) { res.writeHead(404); res.end(); }
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function post<T = any>(url: string, body?: unknown): Promise<{ status: number; body: T }> {
    const res = await fetch(baseUrl + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as T };
  }

  async function stage(
    findingId?: string,
    targetPath = 'wiki/target.md',
    kind = 'knowledge_gap',
  ): Promise<any> {
    const finding = envelope(targetPath, findingId, kind).findings[0];
    const input = await findingToStageInput(finding, tmpDir);
    const staged = await post('/api/v1/changesets', input);
    assert.equal(staged.status, 201, JSON.stringify(staged.body));
    return (staged.body as any).changeset;
  }

  it('validates the A1 envelope and rejects unknown schemas/kinds', () => {
    const valid = parseFindingsEnvelope(envelope('wiki/target.md'));
    assert.equal(valid.findings[0].findingId, 'knowledge_gap-target-a1b2c3d4e5f6');

    assert.throws(() => parseFindingsEnvelope({ ...envelope('wiki/target.md'), schema: 'other/v9' }), /schema/);
    assert.throws(() => parseFindingsEnvelope({
      ...envelope('wiki/target.md'),
      findings: [{ ...envelope('wiki/target.md').findings[0], kind: 'unknown' }],
    }), /kind/);
    assert.throws(() => parseFindingsEnvelope({ ...envelope('wiki/target.md'), count: 7 }), /count/);
  });

  it('stages a gap finding without writing any wiki file', async () => {
    const changeset = await stage();
    assert.match(changeset.id, /^cs-/);
    assert.equal(changeset.status, 'pending');
    assert.equal(changeset.finding.findingId, 'knowledge_gap-target-a1b2c3d4e5f6');
    assert.equal(changeset.finding.kind, 'knowledge_gap');
    assert.deepEqual(changeset.finding.evidence, ['cq=CQ-01', 'status=UNCOVERED', 'question=Qual è il processo?']);
    assert.deepEqual(changeset.sources, changeset.finding.evidence);
    assert.equal(changeset.edits[0].file, 'wiki/target.md');
    assert.equal(changeset.edits[0].requireOriginal, true);
    assert.match(changeset.rationale, /deep-research/);

    // Only the changeset JSON exists: the note is byte-identical.
    assert.equal(await fs.readFile(path.join(tmpDir, 'wiki', 'target.md'), 'utf-8'), ORIGINAL);
    await assert.rejects(() => fs.stat(path.join(tmpDir, 'wiki', 'proposte')), /ENOENT/);

    const listed = await (await fetch(`${baseUrl}/api/v1/changesets?status=pending`)).json() as any;
    assert.equal(listed.changesets.length, 1);
    assert.equal(listed.changesets[0].finding.findingId, changeset.finding.findingId);
  });

  it('approve writes the proposal plus a snapshot; rollback restores the original bytes', async () => {
    const changeset = await stage();
    const applied = await post(`/api/v1/changesets/${changeset.id}/apply`);
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.deepEqual((applied.body as any).appliedFiles, ['wiki/target.md']);

    const written = await fs.readFile(path.join(tmpDir, 'wiki', 'target.md'), 'utf-8');
    assert.ok(written.includes('## Proposta A3 — knowledge_gap'));
    assert.ok(written.includes('knowledge_gap-target-a1b2c3d4e5f6'));

    const snapshotDir = path.join(tmpDir, '.wiki-forge', 'snapshots', 'target');
    const sidecars = (await fs.readdir(snapshotDir)).filter((name) => name.endsWith('.json'));
    assert.ok(sidecars.length > 0, 'apply must leave a pre-write snapshot');
    const reasons = await Promise.all(sidecars.map(async (name) =>
      JSON.parse(await fs.readFile(path.join(snapshotDir, name), 'utf-8')).reason as string));
    assert.ok(reasons.some((reason) => reason.includes(changeset.id)), JSON.stringify(reasons));

    const rolled = await new ChangesetStore(tmpDir).rollback(changeset.id, 'human');
    assert.equal(rolled.status, 'rejected');
    assert.equal(rolled.rejected_reason, 'rollback A3');
    assert.equal(rolled.rolled_back_by, 'human');
    assert.equal(await fs.readFile(path.join(tmpDir, 'wiki', 'target.md'), 'utf-8'), ORIGINAL);
  });

  it('reject writes no file, including for a missing target (staged as a new proposal note)', async () => {
    const changeset = await stage('orphan_node-missing-note-111111111111', 'wiki/missing.md', 'orphan_node');
    assert.equal(changeset.edits[0].action, 'create');
    assert.equal(changeset.edits[0].file, 'wiki/proposte/orphan-node-missing-note-111111111111.md');
    assert.match(changeset.edits[0].proposed_content, /^---\ntitle: "Proposta A3 — orphan_node"/);

    const rejected = await post(`/api/v1/changesets/${changeset.id}/reject`, { reason: 'not grounded' });
    assert.equal(rejected.status, 200);
    assert.equal((rejected.body as any).changeset.status, 'rejected');
    await assert.rejects(() => fs.stat(path.join(tmpDir, 'wiki', 'proposte')), /ENOENT/);
    assert.equal(await fs.readFile(path.join(tmpDir, 'wiki', 'target.md'), 'utf-8'), ORIGINAL);
  });

  it('refuses to apply a stale proposal after the target note changed', async () => {
    const changeset = await stage();
    await fs.writeFile(path.join(tmpDir, 'wiki', 'target.md'), `${ORIGINAL}\nModifica umana.\n`, 'utf-8');
    const applied = await post(`/api/v1/changesets/${changeset.id}/apply`);
    assert.equal(applied.status, 400);
    assert.match((applied.body as any).error, /stale/);
    assert.ok((await fs.readFile(path.join(tmpDir, 'wiki', 'target.md'), 'utf-8')).includes('Modifica umana.'));
  });

  it('stageFindingChangesets is idempotent across repeated scans', async () => {
    const store = new ChangesetStore(tmpDir);
    const first = await stageFindingChangesets(store, envelope('wiki/target.md'), tmpDir);
    assert.equal(first.created.length, 1);
    assert.equal(first.skipped.length, 0);

    const second = await stageFindingChangesets(store, envelope('wiki/target.md'), tmpDir);
    assert.equal(second.created.length, 0);
    assert.deepEqual(second.skipped, ['knowledge_gap-target-a1b2c3d4e5f6']);
    assert.equal((await store.list()).length, 1);
    assert.equal(await fs.readFile(path.join(tmpDir, 'wiki', 'target.md'), 'utf-8'), ORIGINAL);
  });
});
