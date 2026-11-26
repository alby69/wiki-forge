import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import type { LlmClient } from '@backend/server/llmClient';

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
id = "test-script-job"
role = "Script Automation"
script = "okf_lint"
schedule = "0 3 1 * *"
enabled = true
project = "default"
auto_apply = false
max_retries = 0

[[agent.scheduler.jobs]]
id = "test-script-log"
role = "Script Automation"
script = "okf_log"
schedule = "0 4 1 * *"
enabled = true
project = "default"
auto_apply = false
max_retries = 0

[agent.scheduler.jobs.args]
message = "Approvazione S2 di prova"
type = "Update"
`;

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  tmpDir: string;
  close: () => Promise<void>;
}

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-script-job-'));
  for (const dir of ['wiki', 'raw', 'output', 'config']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.cp(path.join(process.cwd(), 'scripts'), path.join(tmpDir, 'scripts'), {
    recursive: true,
  });
  await fs.writeFile(path.join(tmpDir, 'config', 'agent_schedule.toml'), SCHEDULE_TOML, 'utf-8');

  const llmClient: LlmClient = {
    complete: async () => JSON.stringify({
      action: 'allow',
      steps: [0],
      rationale: 'Script in sola lettura: nessuna approvazione richiesta.',
      sources: ['config/agent_schedule.toml', 'docs/riferimenti/SCRIPT_AUTOMATION_REFERENCE.md'],
    }),
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
    tmpDir,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await agentServer.stopScheduler();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function json(url: string): Promise<any> {
  const res = await fetch(url);
  assert.strictEqual(res.status, 200);
  return res.json();
}

describe('Script jobs end-to-end (S1)', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness();
  });

  after(async () => {
    await h.close();
  });

  it('exposes the script job and its synthetic Use Case through the scheduler API', async () => {
    const data = await json(`${h.baseUrl}/api/ke/schedule`);
    assert.deepStrictEqual(data.errors, [
      "Job 'test-script-log': script 'okf_log' is mutating for the resolved args; forcing enabled=false (F6 approval required)",
    ]);
    assert.strictEqual(data.snapshot.jobs.length, 2);
    const job = data.snapshot.jobs.find((entry: any) => entry.job.id === 'test-script-job').job;
    assert.strictEqual(job.scriptId, 'okf_lint');
    assert.strictEqual(job.useCaseId, '__script__:okf_lint');

    // S2: a mutating script job is kept visible but forced disabled, so it can
    // only run after an explicit human approval.
    const logJob = data.snapshot.jobs.find((entry: any) => entry.job.id === 'test-script-log').job;
    assert.strictEqual(logJob.scriptId, 'okf_log');
    assert.strictEqual(logJob.enabled, false);
    assert.strictEqual(logJob.useCaseId, '__script__:okf_log');
  });

  it('runs the generated one-step Use Case without staging an approval', async () => {
    const res = await fetch(`${h.baseUrl}/api/ke/schedule/test-script-job/run`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('"type":"job_finished"'), body.slice(0, 500));

    const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=test-script-job`);
    assert.ok(runs.runs.length >= 1);
    assert.strictEqual(runs.runs[0].useCase, '__script__:okf_lint');
    assert.strictEqual(runs.runs[0].status, 'success');

    const decisions = await json(`${h.baseUrl}/api/ke/schedule/decisions?jobId=test-script-job`);
    assert.strictEqual(decisions.decisions.length, 1);
    assert.deepStrictEqual(decisions.decisions[0].mutatingSteps, []);
    assert.deepStrictEqual(decisions.decisions[0].steps, [0]);

    const approvals = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
    assert.deepStrictEqual(approvals.approvals, []);
  });

  it('stages, approves and audits a mutating script job (S2)', async () => {
    // A disabled mutating job can still be started manually; F6 withholds it.
    const run = await fetch(`${h.baseUrl}/api/ke/schedule/test-script-log/run`, { method: 'POST' });
    assert.strictEqual(run.status, 200);
    await run.text();

    const approvals = await json(`${h.baseUrl}/api/ke/schedule/approvals?status=pending`);
    assert.strictEqual(approvals.approvals.length, 1);
    const approval = approvals.approvals[0];
    assert.strictEqual(approval.jobId, 'test-script-log');
    assert.strictEqual(approval.useCaseId, '__script__:okf_log');
    assert.strictEqual(approval.jobKind, 'script');
    assert.strictEqual(approval.scriptId, 'okf_log');
    assert.strictEqual(approval.scriptArgs.message, 'Approvazione S2 di prova');
    assert.strictEqual(approval.scriptArgs.type, 'Update');

    // Regression: before S2 the log line was empty (no script args on the view)
    // and `decideApproval()` could not resolve the synthetic Use Case at all.
    const approved = await fetch(`${h.baseUrl}/api/ke/schedule/approvals/${approval.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: 'mario' }),
    });
    const approvedBody = await approved.json();
    assert.strictEqual(approved.status, 200, JSON.stringify(approvedBody));
    assert.strictEqual(approvedBody.approval.status, 'approved');
    assert.strictEqual(approvedBody.approval.decidedBy, 'human:local');

    const log = await fs.readFile(path.join(h.tmpDir, 'wiki', 'log.md'), 'utf-8');
    assert.match(log, /Approvazione S2 di prova/);

    const runs = await json(`${h.baseUrl}/api/ke/schedule/runs?jobId=test-script-log`);
    const humanRun = runs.runs.find((entry: any) => entry.actor === 'human');
    assert.ok(humanRun, 'the human-authorised script execution is audited');
    assert.strictEqual(humanRun.jobKind, 'script');
    assert.strictEqual(humanRun.scriptId, 'okf_log');
    assert.strictEqual(humanRun.approvalId, approval.id);
    assert.strictEqual(humanRun.status, 'success');
  });
});
