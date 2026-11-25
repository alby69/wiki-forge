import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer, withoutApprovalFlags } from '@backend/server/agentServer';
import { canonicalActor, isCanonicalActor } from '@backend/server/auth/actor';
import type { Principal } from '@backend/server/bus/messageBus';

/**
 * B5 — provenance bound to the server-derived Principal.
 *
 * Legacy mode (`enable_rbac=false`) keeps the old raw-reviewer behaviour;
 * strict mode ignores every client-supplied actor field and writes only
 * canonical `human:<id>` / `process:<id>` values.
 */

interface Harness {
  agentServer: AgentServer;
  tmpDir: string;
  close: () => Promise<void>;
}

const ALL_ROLES = ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin'];

const STRICT_CONFIG = `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
`;

const LEGACY_CONFIG = `
[enterprise]
enable_rbac = false
`;

const SCHEDULE_TOML = `
[agent.scheduler]
enabled = true
timezone = "UTC"
max_concurrency = 1
log_dir = "output/scheduler"

[[agent.scheduler.jobs]]
id = "provenance-probe"
use_case = "ke_semantic_export"
steps = [1]
schedule = "0 3 1 * *"
enabled = true
project = "default"
auto_apply = false
`;

async function createHarness(enableRbac: boolean, withApprovals = false): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-provenance-'));
  for (const dir of ['config', 'wiki', 'raw', 'output', '.wiki-forge', 'docs/help']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(
    path.join(tmpDir, 'config', 'config.toml'),
    enableRbac ? STRICT_CONFIG : LEGACY_CONFIG,
    'utf-8',
  );
  await fs.writeFile(path.join(tmpDir, 'wiki', 'index.md'), '---\nokf_version: "0.2"\n---\n# Index\n', 'utf-8');
  if (withApprovals) {
    await fs.writeFile(
      path.join(tmpDir, '.wiki-forge', 'scheduler-approvals.json'),
      JSON.stringify([{
        id: 'approval-b5',
        jobId: 'provenance-probe',
        useCaseId: 'ke_semantic_export',
        project: 'default',
        stepIndex: 1,
        trigger: 'manual',
        rationale: 'probe',
        sources: [],
        createdAt: '2026-11-22T10:00:00Z',
        status: 'pending',
      }], null, 2),
      'utf-8',
    );
    await fs.writeFile(path.join(tmpDir, 'config', 'agent_schedule.toml'), SCHEDULE_TOML, 'utf-8');
  }

  const agentServer = new AgentServer(tmpDir);
  if (withApprovals) await agentServer.startScheduler();
  return {
    agentServer,
    tmpDir,
    close: async () => {
      if (withApprovals) await agentServer.stopScheduler();
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

const human = (id: string): Principal => ({ actor: `human:${id}`, roles: ALL_ROLES, source: 'idp' });
const processPrincipal = (): Principal => ({ actor: 'process:api-token', roles: ALL_ROLES, source: 'legacy-token' });

function body(result: any): any {
  return result?.body ?? result;
}

async function writeNote(tmpDir: string, id: string): Promise<void> {
  await fs.writeFile(
    path.join(tmpDir, 'wiki', `${id}.md`),
    `---\ntitle: ${id}\nstatus: draft\n---\n# ${id}\n\nBody.\n`,
    'utf-8',
  );
}

describe('Regola attore canonica condivisa (B5)', () => {
  it('accetta human, process e producer, rifiuta id grezzi', () => {
    assert.strictEqual(isCanonicalActor('human:alice'), true);
    assert.strictEqual(isCanonicalActor('process:api-token'), true);
    assert.strictEqual(isCanonicalActor('wikiforge/1.0'), true);
    assert.strictEqual(isCanonicalActor('mario'), false);
    assert.strictEqual(isCanonicalActor('human:bad id'), false);
  });

  it('normalizza un attore server-derived senza inventare identità umane', () => {
    assert.strictEqual(canonicalActor('human:alice'), 'human:alice');
    assert.strictEqual(canonicalActor('process:api token'), 'process:api-token');
    assert.strictEqual(canonicalActor('mario'), 'process:api-token');
    assert.strictEqual(canonicalActor(undefined), 'process:api-token');
  });
});

describe('Binding della provenance (B5)', () => {
  let strict: Harness;
  let legacy: Harness;
  let approvals: Harness;

  before(async () => {
    strict = await createHarness(true);
    legacy = await createHarness(false);
    approvals = await createHarness(true, true);
  });

  after(async () => {
    await strict.close();
    await legacy.close();
    await approvals.close();
  });

  it('l\'attore deriva sempre dal principal, anche in legacy', () => {
    assert.strictEqual(strict.agentServer.isStrictProvenance(), true);
    assert.strictEqual(legacy.agentServer.isStrictProvenance(), false);
    assert.strictEqual(
      strict.agentServer.provenanceActorFor(human('alice'), 'human:spoof'),
      'human:alice',
    );
    assert.strictEqual(
      legacy.agentServer.provenanceActorFor(human('alice'), 'human:raw'),
      'human:alice',
    );
    assert.strictEqual(strict.agentServer.provenanceActorFor(undefined), 'process:api-token');
  });

  it('verify strict scrive human:<principal> e non il reviewer del body', async () => {
    await writeNote(strict.tmpDir, 'verify-human');
    const result = await strict.agentServer.recordHumanVerification({
      noteRef: 'verify-human',
      reviewer: 'spoof',
      setStable: true,
      projectId: 'default',
      principal: human('alice'),
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.actor, 'human:alice');
    const content = await fs.readFile(path.join(strict.tmpDir, 'wiki', 'verify-human.md'), 'utf-8');
    assert.ok(content.includes('by: human:alice'));
    assert.ok(!content.includes('by: human:spoof'));
    assert.ok(content.includes('status: stable'));
  });

  it('verify strict vieta stable a un principal di processo (Rule 3)', async () => {
    await writeNote(strict.tmpDir, 'verify-process');
    const result = await strict.agentServer.recordHumanVerification({
      noteRef: 'verify-process',
      reviewer: 'spoof',
      setStable: true,
      projectId: 'default',
      principal: processPrincipal(),
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'stable-requires-human-actor');
    const content = await fs.readFile(path.join(strict.tmpDir, 'wiki', 'verify-process.md'), 'utf-8');
    assert.ok(!content.includes('status: stable'));
    assert.ok(!content.includes('verified:'));
  });

  it('verify legacy usa il principal e ignora il reviewer del body', async () => {
    await writeNote(legacy.tmpDir, 'verify-legacy');
    const result = await legacy.agentServer.recordHumanVerification({
      noteRef: 'verify-legacy',
      reviewer: 'studente',
      setStable: true,
      projectId: 'default',
      principal: processPrincipal(),
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.actor, 'human:local');
    const content = await fs.readFile(path.join(legacy.tmpDir, 'wiki', 'verify-legacy.md'), 'utf-8');
    assert.ok(content.includes('by: human:local'));
    assert.ok(!content.includes('by: human:studente'));
  });

  it('changeset strict registra actor su stage/apply e rejected_by su reject', async () => {
    const bus = strict.agentServer.getBus();
    const context = { projectId: 'default', principal: human('alice') };

    const staged = await bus.dispatch('changesets.stage', {
      description: 'B5 changeset',
      author: 'agent',
      edits: [{ file: 'wiki/generated.md', action: 'create', proposed_content: 'hello\n' }],
      actor: 'human:spoof',
    }, context) as any;
    const stagedBody = body(staged);
    assert.strictEqual(stagedBody.success, true);
    const id = stagedBody.changeset.id as string;
    assert.strictEqual(stagedBody.changeset.actor, 'human:alice');

    const applied = body(await bus.dispatch('changesets.apply', { id }, context) as any);
    assert.strictEqual(applied.success, true);
    const stored = JSON.parse(
      await fs.readFile(path.join(strict.tmpDir, '.wiki-forge', 'changesets', `${id}.json`), 'utf-8'),
    );
    assert.strictEqual(stored.actor, 'human:alice');
    assert.strictEqual(stored.applied_by, 'human:alice');

    const second = await bus.dispatch('changesets.stage', {
      description: 'B5 reject',
      edits: [{ file: 'wiki/other.md', action: 'create', proposed_content: 'x\n' }],
    }, context) as any;
    const rejected = body(await bus.dispatch(
      'changesets.reject',
      { id: body(second).changeset.id, reason: 'no' },
      { projectId: 'default', principal: processPrincipal() },
    ) as any);
    assert.strictEqual(rejected.success, true);
    assert.strictEqual(rejected.changeset.rejected_by, 'process:api-token');
  });

  it('changeset legacy non scrive campi di provenance additivi', async () => {
    const bus = legacy.agentServer.getBus();
    const staged = await bus.dispatch('changesets.stage', {
      description: 'legacy changeset',
      edits: [{ file: 'wiki/legacy-generated.md', action: 'create', proposed_content: 'x\n' }],
      actor: 'human:spoof',
    }, { projectId: 'default', principal: human('alice') }) as any;
    const stagedBody = body(staged);
    assert.strictEqual(stagedBody.success, true);
    assert.strictEqual(stagedBody.changeset.actor, undefined);
    assert.strictEqual(stagedBody.changeset.applied_by, undefined);
    assert.strictEqual(stagedBody.changeset.rejected_by, undefined);
  });

  it('approval strict lega decidedBy al principal, non al reviewer del body', async () => {
    const result = await approvals.agentServer.decideApproval(
      'approval-b5',
      'rejected',
      'human:spoof',
      'strict binding',
      processPrincipal(),
    );
    assert.ok(result.approval);
    assert.strictEqual(result.approval.decidedBy, 'process:api-token');
  });

  it('i flag F6-only includono il nuovo flag di attore processo', () => {
    assert.deepStrictEqual(
      withoutApprovalFlags({ proposal: 'p.json', reviewer: 'human:a', confirm: true, allow_process_actor: true }),
      { proposal: 'p.json' },
    );
  });
});
