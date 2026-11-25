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
id = "event-review"
role = "Semantic Publisher"
use_case = "ke_semantic_export"
steps = [0, 1]
schedule = "0 3 1 * *"
event_trigger = "note.created"
debounce_seconds = 1
enabled = true
project = "default"
auto_apply = false
max_retries = 0
`;

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  tmpDir: string;
  llmCalls: LlmCompletionParams[];
  close: () => Promise<void>;
}

async function createHarness(scheduleToml = SCHEDULE_TOML): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-schedule-f5f6-'));
  for (const dir of ['wiki', 'raw', 'output', 'config']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.cp(path.join(process.cwd(), 'scripts'), path.join(tmpDir, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, 'config', 'agent_schedule.toml'), scheduleToml, 'utf-8');

  const llmCalls: LlmCompletionParams[] = [];
  const llmClient: LlmClient = {
    complete: async (params) => {
      llmCalls.push(params);
      return JSON.stringify({
        action: 'allow',
        steps: [0],
        rationale: 'Export disponibile; reindex richiede approvazione umana.',
        sources: ['config/agent_schedule.toml', 'output/scheduler/audit.jsonl'],
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

describe('KE scheduler F5/F6 — policy, events and approvals', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness();
  });

  after(async () => {
    await h.close();
  });

  it('validates webhook events', async () => {
    const bad = await json(`${h.baseUrl}/api/ke/schedule/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'something.else' }),
    });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.body.success, false);
  });

  it('queues a note.created event and runs the job after the debounce', async () => {
    const trigger = await json(`${h.baseUrl}/api/ke/schedule/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'note.created', project: 'default', path: 'wiki/new-note.md' }),
    });
    assert.strictEqual(trigger.status, 200);
    assert.deepStrictEqual(trigger.body.queued, ['event-review']);
    assert.strictEqual(trigger.body.pending.length, 1);

    await waitFor(async () => {
      const pending = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
      const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
      return pending.body.approvals.length > 0 && runs.body.runs.length > 0
        ? pending.body.approvals[0]
        : undefined;
    }, 'first pending approval and audited run');

    // Regression: the policy withheld step 1 (okf_reindex). The scheduler must
    // honour the narrowed step set — the mutating step may not run before a
    // human approves it, otherwise wiki/index.md would already exist here.
    await assert.rejects(
      () => fs.access(path.join(h.tmpDir, 'wiki', 'index.md')),
      /ENOENT/,
      'withheld mutating step must not run during the scheduled job'
    );

    const decisions = await json(`${h.baseUrl}/api/ke/schedule/decisions`);
    assert.strictEqual(decisions.status, 200);
    assert.strictEqual(decisions.body.decisions.length, 1);
    const decision = decisions.body.decisions[0];
    assert.strictEqual(decision.jobId, 'event-review');
    assert.strictEqual(decision.trigger, 'event');
    assert.ok(decision.rationale.length > 0, 'rationale present');
    assert.ok(decision.sources.length > 0, 'sources present');
    assert.deepStrictEqual(decision.mutatingSteps, [1]);
    assert.deepStrictEqual(decision.steps, [0], 'mutating step withheld');

    const approvals = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
    assert.strictEqual(approvals.status, 200);
    assert.strictEqual(approvals.body.approvals.length, 1);
    const approval = approvals.body.approvals[0];
    assert.strictEqual(approval.stepIndex, 1);
    assert.strictEqual(approval.scriptId, 'okf_reindex');
    assert.strictEqual(approval.status, 'pending');
    assert.ok(approval.rationale && approval.sources.length > 0);

    const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
    assert.ok(runs.body.runs.length >= 1);
    assert.strictEqual(runs.body.runs[0].actor, 'scheduler');
    assert.strictEqual(runs.body.runs[0].trigger, 'event');
    assert.strictEqual(runs.body.runs[0].triggerEvent.type, 'note.created');
    assert.strictEqual(runs.body.runs[0].status, 'success', 'read-only steps ran normally');

    assert.strictEqual(h.llmCalls.length, 1, 'policy consulted the LLM');
    assert.match(h.llmCalls[0].systemPrompt, /rationale/);
    assert.match(h.llmCalls[0].systemPrompt, /sources/);
  });

  it('rejects a mutating step without executing it', async () => {
    const before = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
    const pending = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
    const id = pending.body.approvals[0].id;

    const rejected = await json(`${h.baseUrl}/api/ke/schedule/approvals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: 'qa', reason: 'non necessario' }),
    });
    assert.strictEqual(rejected.status, 200);
    assert.strictEqual(rejected.body.approval.status, 'rejected');
    assert.strictEqual(rejected.body.approval.decidedBy, 'human:local');

    const after = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
    assert.strictEqual(after.body.runs.length, before.body.runs.length, 'no human audit added on reject');
  });

  it('executes a mutating step only after explicit approval', async () => {
    const trigger = await json(`${h.baseUrl}/api/ke/schedule/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'note.created', project: 'default', path: 'wiki/second-note.md' }),
    });
    assert.strictEqual(trigger.status, 200);
    const nextApproval = await waitFor(async () => {
      const pending = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
      const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
      return pending.body.approvals.length > 0 && runs.body.runs.length >= 2
        ? pending.body.approvals[0]
        : undefined;
    }, 'second pending approval and audited run');
    const id = nextApproval.id;

    const approved = await json(`${h.baseUrl}/api/ke/schedule/approvals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: 'mario' }),
    });
    assert.strictEqual(approved.status, 200, approved.body.error ?? '');
    assert.strictEqual(approved.body.approval.status, 'approved');
    assert.strictEqual(approved.body.approval.decidedBy, 'human:local');

    const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
    const humanRun = runs.body.runs.find((run: any) => run.actor === 'human');
    assert.ok(humanRun, 'human-authorised step is audited separately');
    assert.strictEqual(humanRun.approvalId, id);
    assert.deepStrictEqual(humanRun.steps, [1]);
    assert.strictEqual(humanRun.status, 'success');

    const index = await fs.readFile(path.join(h.tmpDir, 'wiki', 'index.md'), 'utf-8');
    assert.ok(index.length > 0, 'approved mutating step wrote wiki/index.md');
  });

  it('returns 404 for an unknown approval id', async () => {
    const missing = await json(`${h.baseUrl}/api/ke/schedule/approvals/appr-nope/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.strictEqual(missing.status, 404);
  });
});

/** A2 — a queued event survives a scheduler restart and fires exactly once. */
const RESTART_TOML = SCHEDULE_TOML.replace('debounce_seconds = 1', 'debounce_seconds = 2');

describe('A2 — persistent event queue', () => {
  it('consumes an event queued before a restart, exactly once', async () => {
    const harness = await createHarness(RESTART_TOML);
    try {
      const trigger = await json(`${harness.baseUrl}/api/ke/schedule/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'note.created', project: 'default', path: 'wiki/before-restart.md' }),
      });
      assert.strictEqual(trigger.status, 200);
      assert.deepStrictEqual(trigger.body.queued, ['event-review']);

      const queuePath = path.join(harness.tmpDir, '.wiki-forge', 'event-queue.jsonl');
      const queuedText = await fs.readFile(queuePath, 'utf-8');
      assert.match(queuedText, /wiki\/before-restart\.md/);

      await harness.agentServer.stopScheduler();
      // Let the debounce elapse while stopped: the restored bucket must fire
      // immediately on startup rather than dropping the event.
      await new Promise((resolve) => setTimeout(resolve, 2_200));
      await harness.agentServer.startScheduler();

      await waitFor(async () => {
        const runs = await json(`${harness.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
        return runs.body.runs.length > 0 ? runs.body.runs : undefined;
      }, 'event run after restart');

      await new Promise((resolve) => setTimeout(resolve, 400));
      const runs = await json(`${harness.baseUrl}/api/ke/schedule/runs?jobId=event-review`);
      const matching = runs.body.runs.filter(
        (run: any) => run.triggerEvent?.path === 'wiki/before-restart.md',
      );
      assert.strictEqual(matching.length, 1, 'the persisted event fired once, not twice');

      const records = (await fs.readFile(queuePath, 'utf-8'))
        .trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
      assert.ok(records.length >= 1);
      assert.ok(records.every((record: any) => record.state === 'consumed'));
    } finally {
      await harness.close();
    }
  });

  it('emits note.modified and note.deleted from API writes', async () => {
    const writeToml = `
[agent.policy]
enabled = false

[agent.scheduler]
enabled = true
timezone = "UTC"
max_concurrency = 1
default_timeout_seconds = 60
log_dir = "output/scheduler"

[[agent.scheduler.jobs]]
id = "modified-review"
role = "Semantic Publisher"
use_case = "ke_semantic_export"
steps = [0]
schedule = "0 3 1 * *"
event_trigger = "note.modified"
debounce_seconds = 1
enabled = true
project = "default"
auto_apply = false
max_retries = 0

[[agent.scheduler.jobs]]
id = "deleted-review"
role = "Semantic Publisher"
use_case = "ke_semantic_export"
steps = [0]
schedule = "0 4 1 * *"
event_trigger = "note.deleted"
debounce_seconds = 1
enabled = true
project = "default"
auto_apply = false
max_retries = 0
`;
    const harness = await createHarness(writeToml);
    try {
      await fs.writeFile(
        path.join(harness.tmpDir, 'wiki', 'modify-me.md'),
        '# Modify\n\nvecchio contenuto\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(harness.tmpDir, 'wiki', 'delete-me.md'),
        '# Delete\n',
        'utf-8',
      );

      const saved = await json(`${harness.baseUrl}/api/wiki/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'modify-me', title: 'Modify', folder: 'wiki', content: '# Modify\n\nnuovo contenuto\n',
        }),
      });
      assert.strictEqual(saved.status, 200);

      const deleted = await json(`${harness.baseUrl}/api/wiki/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: 'wiki/delete-me.md' }),
      });
      assert.strictEqual(deleted.status, 200);

      await waitFor(async () => {
        const runs = await json(`${harness.baseUrl}/api/ke/schedule/runs`);
        const types = new Set(runs.body.runs.map((run: any) => run.triggerEvent?.type));
        return types.has('note.modified') && types.has('note.deleted') ? runs.body.runs : undefined;
      }, 'note.modified and note.deleted runs');

      const runs = await json(`${harness.baseUrl}/api/ke/schedule/runs`);
      const modified = runs.body.runs.find(
        (run: any) => run.triggerEvent?.type === 'note.modified',
      );
      const removed = runs.body.runs.find(
        (run: any) => run.triggerEvent?.type === 'note.deleted',
      );
      assert.strictEqual(modified.job, 'modified-review');
      assert.strictEqual(modified.triggerEvent.path, 'wiki/modify-me.md');
      assert.strictEqual(modified.trigger, 'event');
      assert.strictEqual(removed.job, 'deleted-review');
      assert.strictEqual(removed.triggerEvent.path, 'wiki/delete-me.md');
      assert.strictEqual(removed.trigger, 'event');
    } finally {
      await harness.close();
    }
  });
});
