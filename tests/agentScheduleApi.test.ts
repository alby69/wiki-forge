import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';

const SCHEDULE_TOML = `
[agent.scheduler]
enabled = true
timezone = "UTC"
max_concurrency = 1
default_timeout_seconds = 60
log_dir = "output/scheduler"

[[agent.scheduler.jobs]]
id = "test-nightly"
role = "Ontology Guardian"
use_case = "ke_schema_modeling"
steps = [0]
schedule = "0 3 1 * *"
enabled = true
project = "default"
auto_apply = false
max_retries = 0
`;

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  tmpDir: string;
  close: () => Promise<void>;
}

async function createHarness(scheduleToml: string): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-schedule-api-'));
  await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'raw'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'output'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
  // The scheduler spawns real Python scripts relative to rootDir, so the temp
  // project needs the same scripts/ tree the shipped server has.
  await fs.cp(path.join(process.cwd(), 'scripts'), path.join(tmpDir, 'scripts'), {
    recursive: true,
  });
  await fs.writeFile(path.join(tmpDir, 'config', 'agent_schedule.toml'), scheduleToml, 'utf-8');

  const agentServer = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    const handled = await agentServer.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
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

describe('KE Agent Schedule API (F3)', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness(SCHEDULE_TOML);
  });

  after(async () => {
    await h.close();
  });

  it('GET /api/ke/schedule reports config, snapshot and validation errors', async () => {
    const res = await fetch(`${h.baseUrl}/api/ke/schedule`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.success, true);
    assert.deepStrictEqual(data.errors, []);
    assert.strictEqual(data.config.timezone, 'UTC');
    assert.strictEqual(data.snapshot.running, true);
    assert.strictEqual(data.snapshot.lockHeld, true);
    assert.strictEqual(data.snapshot.jobs.length, 1);
    assert.strictEqual(data.snapshot.jobs[0].job.id, 'test-nightly');
    assert.strictEqual(data.snapshot.jobs[0].description, 'il giorno 1 del mese alle 03:00 (UTC)');
  });

  it('PATCH toggles a job at runtime and reports the updated job', async () => {
    const res = await fetch(`${h.baseUrl}/api/ke/schedule/test-nightly`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.job.job.enabled, false);

    const snapshot = await (await fetch(`${h.baseUrl}/api/ke/schedule`)).json() as any;
    assert.strictEqual(snapshot.snapshot.jobs[0].job.enabled, false);

    const restore = await fetch(`${h.baseUrl}/api/ke/schedule/test-nightly`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, schedule: '0 4 1 * *' }),
    });
    assert.strictEqual(restore.status, 200);
    const restored = await restore.json() as any;
    assert.strictEqual(restored.job.job.enabled, true);
    assert.strictEqual(restored.job.job.schedule.expression, '0 4 1 * *');
  });

  it('PATCH rejects an invalid cron expression with 400', async () => {
    const res = await fetch(`${h.baseUrl}/api/ke/schedule/test-nightly`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: 'not a cron' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json() as any;
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Invalid cron expression'));
  });

  it('POST /api/ke/schedule/:id/run streams the Use Case events via SSE', async () => {
    const res = await fetch(`${h.baseUrl}/api/ke/schedule/test-nightly/run`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 200);
    assert.ok((res.headers.get('content-type') ?? '').includes('text/event-stream'));
    const body = await res.text();

    assert.ok(body.includes('"type":"job_started"'), 'scheduler start event');
    assert.ok(body.includes('"type":"use_case_event"'), 'original Use Case events forwarded');
    assert.ok(body.includes('"type":"start"'), 'Use Case start event');
    assert.ok(body.includes('"type":"step_start"'), 'step progress event');
    assert.ok(body.includes('"type":"job_finished"'), 'scheduler finish event');
    assert.ok(body.includes('data: [DONE]'), 'SSE terminator');
  });

  it('GET /api/ke/schedule/runs returns the audited run with a job filter', async () => {
    const res = await fetch(`${h.baseUrl}/api/ke/schedule/runs?jobId=test-nightly`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.success, true);
    assert.ok(data.runs.length >= 1);
    assert.strictEqual(data.runs[0].actor, 'scheduler');
    assert.strictEqual(data.runs[0].job, 'test-nightly');
    assert.strictEqual(data.runs[0].useCase, 'ke_schema_modeling');
    assert.strictEqual(data.runs[0].status, 'success');
    assert.ok(data.runs[0].logFile);

    const other = await (await fetch(`${h.baseUrl}/api/ke/schedule/runs?jobId=nope`)).json() as any;
    assert.deepStrictEqual(other.runs, []);
  });

  it('GET /api/ke/schedule/events opens an SSE stream with an initial snapshot', async () => {
    const controller = new AbortController();
    const res = await fetch(`${h.baseUrl}/api/ke/schedule/events`, {
      signal: controller.signal,
    });
    assert.strictEqual(res.status, 200);
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    assert.ok(chunk.includes('"type":"snapshot"'));
    controller.abort();
  });

  it('returns 404 for unknown jobs and 409 when cancelling an idle job', async () => {
    const missing = await fetch(`${h.baseUrl}/api/ke/schedule/unknown/run`, { method: 'POST' });
    assert.strictEqual(missing.status, 404);

    const cancel = await fetch(`${h.baseUrl}/api/ke/schedule/test-nightly/cancel`, {
      method: 'POST',
    });
    assert.strictEqual(cancel.status, 409);
    const data = await cancel.json() as any;
    assert.strictEqual(data.success, false);
  });
});

describe('KE Agent Schedule API — invalid config (F3)', () => {
  it('surfaces validation errors instead of starting a scheduler', async () => {
    const broken = await createHarness(`
[agent.scheduler]
enabled = true
timezone = "UTC"
jobs = [{ id = "bad", use_case = "does_not_exist", schedule = "0 2 * * *" }]
`);
    try {
      const res = await fetch(`${broken.baseUrl}/api/ke/schedule`);
      const data = await res.json() as any;
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.snapshot, null);
      assert.ok(data.errors.some((error: string) => error.includes('unknown use_case')));
    } finally {
      await broken.close();
    }
  });
});
