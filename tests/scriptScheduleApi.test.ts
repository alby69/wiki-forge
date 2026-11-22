import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { getScriptSchedulePath } from '@backend/server/scheduler/scriptJobStore';

const HEADER = '# Header S3 preservato\n# Seconda riga di commento\n';

const SCHEDULE_TOML = `
[agent.scheduler]
enabled = true
timezone = "UTC"
max_concurrency = 1
default_timeout_seconds = 60
log_dir = "output/scheduler"

[[agent.scheduler.jobs]]
id = "existing-use-case"
role = "Knowledge Engineer"
use_case = "ke_semantic_export"
schedule = "0 1 * * *"
enabled = false
project = "default"
auto_apply = false
max_retries = 0
`;

const SCRIPT_TOML = `${HEADER}
[[script_jobs]]
id = "seed-disabled"
role = "Script Automation"
script = "okf_lint"
schedule = "0 0 1 * *"
enabled = false
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

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-script-schedule-'));
  for (const dir of ['wiki', 'raw', 'output', 'config']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(path.join(tmpDir, 'config', 'agent_schedule.toml'), SCHEDULE_TOML, 'utf-8');
  await fs.writeFile(getScriptSchedulePath(tmpDir), SCRIPT_TOML, 'utf-8');

  const agentServer = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    if (!(await agentServer.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  await agentServer.startScheduler();

  return {
    agentServer,
    tmpDir,
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await agentServer.stopScheduler();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function request(method: string, url: string, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function snapshot(h: Harness): Promise<any> {
  const res = await request('GET', `${h.baseUrl}/api/ke/schedule`);
  assert.strictEqual(res.status, 200);
  // Keep validation errors on the returned object so tests can assert them.
  return { ...res.body.snapshot, errors: res.body.errors };
}

describe('Script schedule API (S3)', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness();
  });

  after(async () => {
    await h.close();
  });

  it('creates a read-only script job, persists the TOML header and hot-reloads the scheduler', async () => {
    const events: any[] = [];
    const unsubscribe = h.agentServer.getScheduler()!.subscribe((event) => events.push(event));
    const res = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-created-lint',
      scriptId: 'okf_lint',
      schedule: '0 5 * * *',
      project: 'default',
    });
    unsubscribe();

    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.deepStrictEqual(res.body.errors, []);
    assert.deepStrictEqual(res.body.warnings, []);
    assert.strictEqual(res.body.job.id, 'api-created-lint');
    assert.strictEqual(res.body.job.jobKind, 'script');
    assert.strictEqual(res.body.job.scriptId, 'okf_lint');
    assert.strictEqual(res.body.job.enabled, true);

    const current = await snapshot(h);
    assert.deepStrictEqual(current.errors, []);
    const ids = current.jobs.map((entry: any) => entry.job.id);
    assert.ok(ids.includes('existing-use-case'));
    assert.ok(ids.includes('seed-disabled'));
    assert.ok(ids.includes('api-created-lint'));

    const changed = events.find((event) => event.type === 'jobs_changed');
    assert.ok(changed, 'live listeners see a jobs_changed event');
    assert.deepStrictEqual(changed.added, ['api-created-lint']);

    const text = await fs.readFile(getScriptSchedulePath(h.tmpDir), 'utf-8');
    assert.ok(text.startsWith(HEADER), 'the human-authored header is preserved');
    assert.match(text, /\[\[script_jobs\]\]/);
    assert.match(text, /id = "api-created-lint"/);
    assert.match(text, /schedule = "0 5 \* \* \*"/);
  });

  it('forces mutating jobs to disabled instead of rejecting them', async () => {
    const res = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-mutating-log',
      scriptId: 'okf_log',
      enabled: true,
      args: { message: 'S3 mutante', type: 'Update' },
    });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.job.enabled, false);
    assert.strictEqual(res.body.job.jobKind, 'script');
    assert.strictEqual(res.body.warnings.length, 1);
    assert.match(res.body.warnings[0], /approvazione F6/);

    const current = await snapshot(h);
    const job = current.jobs.find((entry: any) => entry.job.id === 'api-mutating-log').job;
    assert.strictEqual(job.enabled, false);
    assert.deepStrictEqual(job.args, { wiki_dir: 'wiki', message: 'S3 mutante', type: 'Update' });

    const text = await fs.readFile(getScriptSchedulePath(h.tmpDir), 'utf-8');
    assert.match(text, /enabled = false/);
    assert.match(text, /message = "S3 mutante"/);
  });

  it('rejects duplicates, blocked scripts, unknown scripts and invalid cron', async () => {
    const duplicate = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-created-lint', scriptId: 'okf_lint',
    });
    assert.strictEqual(duplicate.status, 409, JSON.stringify(duplicate.body));
    assert.match(duplicate.body.error, /already in use/);

    const useCaseId = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'existing-use-case', scriptId: 'okf_lint',
    });
    assert.strictEqual(useCaseId.status, 409);

    const blocked = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-blocked', scriptId: 'migrate_to_okf',
    });
    assert.strictEqual(blocked.status, 400, JSON.stringify(blocked.body));
    assert.match(blocked.body.error, /not schedulable/);

    const unknown = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-unknown', scriptId: 'does_not_exist',
    });
    assert.strictEqual(unknown.status, 400);
    assert.match(unknown.body.error, /unknown script/);

    const badCron = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-bad-cron', scriptId: 'okf_lint', schedule: 'not a cron',
    });
    assert.strictEqual(badCron.status, 400);
    assert.match(badCron.body.error, /cron/i);
  });

  it('hot-reloads the event bus and cancels pending triggers on deletion', async () => {
    const created = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-event-job',
      scriptId: 'okf_lint',
      eventTrigger: 'note.created',
      project: '*',
      debounceSeconds: 3600,
    });
    assert.strictEqual(created.status, 200, JSON.stringify(created.body));

    const queued = await request('POST', `${h.baseUrl}/api/ke/schedule/trigger`, {
      event: 'note.created', project: 'default', path: 'wiki/test.md',
    });
    assert.strictEqual(queued.status, 200);
    assert.ok(queued.body.queued.includes('api-event-job'));

    const approvals = await request('GET', `${h.baseUrl}/api/ke/schedule/approvals`);
    assert.ok(approvals.body.pending.some((item: any) => item.jobId === 'api-event-job'));

    const events: any[] = [];
    const unsubscribe = h.agentServer.getScheduler()!.subscribe((event) => events.push(event));
    const removed = await request('DELETE', `${h.baseUrl}/api/scripts/schedule/api-event-job`);
    unsubscribe();
    assert.strictEqual(removed.status, 200, JSON.stringify(removed.body));
    assert.strictEqual(removed.body.removed, true);
    assert.ok(events.some((event) => event.type === 'jobs_changed' && event.removed.includes('api-event-job')));

    const afterDelete = await request('GET', `${h.baseUrl}/api/ke/schedule/approvals`);
    assert.ok(!afterDelete.body.pending.some((item: any) => item.jobId === 'api-event-job'));
    const requeued = await request('POST', `${h.baseUrl}/api/ke/schedule/trigger`, {
      event: 'note.created', project: 'default', path: 'wiki/test.md',
    });
    assert.ok(!requeued.body.queued.includes('api-event-job'));
  });

  it('refuses to delete Use Case jobs and unknown jobs', async () => {
    const useCase = await request('DELETE', `${h.baseUrl}/api/scripts/schedule/existing-use-case`);
    assert.strictEqual(useCase.status, 400, JSON.stringify(useCase.body));
    assert.match(useCase.body.error, /not a script job|agent_schedule\.toml/);

    const unknown = await request('DELETE', `${h.baseUrl}/api/scripts/schedule/api-missing`);
    assert.strictEqual(unknown.status, 404);
    assert.match(unknown.body.error, /Unknown script job/);
  });

  it('survives a scheduler restart because the TOML is the source of truth', async () => {
    const created = await request('POST', `${h.baseUrl}/api/scripts/schedule`, {
      id: 'api-restart-job', scriptId: 'okf_lint', schedule: '0 6 * * *',
    });
    assert.strictEqual(created.status, 200, JSON.stringify(created.body));

    await h.agentServer.stopScheduler();
    await h.agentServer.startScheduler();

    const current = await snapshot(h);
    assert.deepStrictEqual(current.errors, []);
    assert.ok(current.jobs.some((entry: any) => entry.job.id === 'api-restart-job'));
  });
});
