import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import type { LlmClient, LlmCompletionParams } from '@backend/server/llmClient';

const SCHEDULE_TOML = `
[agent.policy]
enabled = true

[agent.scheduler]
enabled = true
timezone = "UTC"
max_concurrency = 1
default_timeout_seconds = 60
log_dir = "output/scheduler"

[[agent.scheduler.jobs]]
id = "program-change-review"
role = "Documentation Auditor"
use_case = "ke_wiki_program_change"
steps = [0, 1]
schedule = "0 7 * * 1"
event_trigger = "note.created"
debounce_seconds = 1
enabled = true
project = "default"
args = { proposal = "output/program-changes/proposal.json", stage_dir = "output/program-changes" }
auto_apply = false
max_retries = 0
`;

const TARGET_REL = 'docs/program-change-target.md';
const ORIGINAL = '# Target\n\nValore iniziale.\n\nFine.\n';

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  tmpDir: string;
  llmCalls: LlmCompletionParams[];
  close: () => Promise<void>;
}

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-program-change-'));
  for (const dir of ['wiki', 'raw', 'output', 'config', 'docs']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.cp(path.join(process.cwd(), 'scripts'), path.join(tmpDir, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, 'config', 'agent_schedule.toml'), SCHEDULE_TOML, 'utf-8');
  await fs.writeFile(path.join(tmpDir, TARGET_REL), ORIGINAL, 'utf-8');

  const proposal = {
    title: 'Aggiorna valore documentato',
    rationale: 'La wiki di wiki-forge documenta il nuovo valore approvato.',
    sources: ['docs/standard/SELF_WIKI.md', 'projects/wikiforge/wiki/index.md'],
    project: 'wikiforge',
    edits: [{ file: TARGET_REL, find: 'Valore iniziale.', replace: 'Valore finale.' }],
  };
  await fs.mkdir(path.join(tmpDir, 'output', 'program-changes'), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'output', 'program-changes', 'proposal.json'),
    JSON.stringify(proposal, null, 2),
    'utf-8'
  );

  const llmCalls: LlmCompletionParams[] = [];
  const llmClient: LlmClient = {
    complete: async (params) => {
      llmCalls.push(params);
      return JSON.stringify({
        action: 'require_approval',
        steps: [0],
        rationale: 'Lo step di apply è mutante: richiede approvazione umana F6.',
        sources: ['config/agent_schedule.toml', 'docs/standard/SELF_WIKI.md'],
      });
    },
  };

  const agentServer = new AgentServer(tmpDir, llmClient);
  const server = http.createServer(async (req, res) => {
    const handled = await agentServer.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  await agentServer.startScheduler();

  return {
    agentServer,
    llmCalls,
    tmpDir,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await agentServer.stopScheduler();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function json(url: string, options?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, options);
  return { status: res.status, body: await res.json() as any };
}

async function waitFor<T>(read: () => Promise<T | undefined>, label: string, timeoutMs = 10_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout waiting for ${label}`);
}

describe('Fase 76 — wiki-to-program-change bridge (F5 withholding + F6 approval)', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness();
  });

  after(async () => {
    await h.close();
  });

  it('stages the mutating apply step instead of running it', async () => {
    const trigger = await json(`${h.baseUrl}/api/ke/schedule/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'note.created', project: 'default', path: 'wiki/new-note.md' }),
    });
    assert.strictEqual(trigger.status, 200);
    assert.deepStrictEqual(trigger.body.queued, ['program-change-review']);

    const approval = await waitFor(async () => {
      const pending = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
      const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=program-change-review`);
      return pending.body.approvals.length > 0 && runs.body.runs.length > 0
        ? pending.body.approvals[0]
        : undefined;
    }, 'pending program-change approval');

    assert.strictEqual(approval.stepIndex, 1);
    assert.strictEqual(approval.scriptId, 'wiki_program_change_apply');
    assert.strictEqual(approval.status, 'pending');
    assert.ok(approval.rationale && approval.sources.length > 0);

    const decisions = await json(`${h.baseUrl}/api/ke/schedule/decisions`);
    const decision = decisions.body.decisions[0];
    assert.deepStrictEqual(decision.mutatingSteps, [1]);
    assert.deepStrictEqual(decision.steps, [0], 'read-only stage step ran, apply is withheld');

    const before = await fs.readFile(path.join(h.tmpDir, TARGET_REL), 'utf-8');
    assert.strictEqual(before, ORIGINAL, 'no mutation before F6 approval');
  });

  it('applies the change only after human approval, with snapshot and audit', async () => {
    const pending = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
    const id = pending.body.approvals[0].id;

    const approved = await json(`${h.baseUrl}/api/ke/schedule/approvals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: 'mario' }),
    });
    assert.strictEqual(approved.status, 200, approved.body.error ?? '');
    assert.strictEqual(approved.body.approval.status, 'approved');
    assert.strictEqual(approved.body.approval.decidedBy, 'human:local');

    const after = await fs.readFile(path.join(h.tmpDir, TARGET_REL), 'utf-8');
    assert.ok(after.includes('Valore finale.'), 'F6 approval wrote the program change');

    const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=program-change-review`);
    const humanRun = runs.body.runs.find((run: any) => run.actor === 'human');
    assert.ok(humanRun, 'human-authorised step is audited separately');
    assert.strictEqual(humanRun.approvalId, id);
    assert.deepStrictEqual(humanRun.steps, [1]);

    const audit = await fs.readFile(path.join(h.tmpDir, 'output', 'program-changes', 'audit.jsonl'), 'utf-8');
    const entries = audit.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].actor, 'human');
    assert.strictEqual(entries[0].reviewer, 'human:local');

    const snapshots = await fs.readdir(path.join(h.tmpDir, '.wiki-forge', 'program-change-snapshots'));
    assert.ok(snapshots.length > 0, 'target file was snapshotted before mutation');
  });

  it('does not apply a change from a direct execution, even with injected approval flags', async () => {
    // The apply step requires --confirm and a human reviewer. Neither the Use
    // Case endpoint nor the Script Panel may supply them: only decideApproval
    // after F6 approval injects the flags, so a direct run exits non-zero.
    for (const [url, body] of [
      [`${h.baseUrl}/api/ke/use-cases/execute`, { useCaseId: 'ke_wiki_program_change', stepIndex: 1 }],
      [`${h.baseUrl}/api/scripts/execute`, { scriptId: 'wiki_program_change_apply' }],
    ] as const) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, args: { confirm: true, reviewer: 'human:attacker' } }),
      });
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert.ok(text.includes('[DONE]'));
      assert.ok(
        text.includes('--confirm is required'),
        'approval flags injected via a generic endpoint are stripped'
      );
    }

    const after = await fs.readFile(path.join(h.tmpDir, TARGET_REL), 'utf-8');
    assert.ok(after.includes('Valore finale.'));
    assert.ok(!after.includes('Valore iniziale.'), 'direct execution did not reintroduce the old value');
  });
});
