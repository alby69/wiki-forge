import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { parseWorkerArgs } from '@backend/app/workerCli';
import { runWorker, workerConcurrency } from '@backend/app/worker';
import { WorkerPool } from '@backend/server/process/workerPool';
import {
  buildAllowedEnv,
  DEFAULT_ENV_ALLOWLIST,
  runScript,
  spawnManaged,
} from '@backend/server/process/scriptRunner';
import { LockHeldError } from '@backend/server/scheduler/lock';
import { createStateStoreFromEnv, readStateStoreConfig } from '@backend/server/state';
import { createFileSystemStateStore } from '@backend/server/state/fileStore';
import { createHttpStateStore } from '@backend/server/state/httpStore';
import { acquireWithRetry, createStateLock, withLock } from '@backend/server/state/lock';
import { createMemoryStateStore } from '@backend/server/state/memoryStore';
import { ApprovalOutbox, APPROVAL_OUTBOX_KEY } from '@backend/server/state/outbox';
import { createStateRuntimeStore } from '@backend/server/state/runtimeAdapter';
import { StateConflictError } from '@backend/server/state/types';

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(process.cwd(), 'tests', 'tmp-phase6-'));
  tempDirs.push(dir);
  return dir;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('state store', () => {
  const factories = [
    ['memory', () => createMemoryStateStore()],
    ['file', async () => {
      const dir = await makeTempDir();
      return createFileSystemStateStore(dir);
    }],
  ] as const;

  for (const [name, factory] of factories) {
    it(`${name} applies compare-and-set versions`, async () => {
      const store = await factory();
      const created = await store.put('session:one', { user: 'a' }, 0);
      assert.equal(created.version, 1);
      const loaded = await store.get<{ user: string }>('session:one');
      assert.deepEqual(loaded?.value, { user: 'a' });
      await assert.rejects(
        () => store.put('session:one', { user: 'b' }, 0),
        StateConflictError,
      );
      const updated = await store.put('session:one', { user: 'b' }, 1);
      assert.equal(updated.version, 2);
      assert.equal(await store.remove('session:one', 1).catch(() => false), false);
      assert.equal(await store.remove('session:one', 2), true);
      assert.equal(await store.get('session:one'), null);
    });

    it(`${name} keeps append-only streams`, async () => {
      const store = await factory();
      await store.append('stream', { n: 1 });
      await store.append('stream', { n: 2 });
      assert.deepEqual(await store.readAll('stream'), [{ n: 1 }, { n: 2 }]);
    });
  }

  it('filesystem streams survive a new store instance', async () => {
    const dir = await makeTempDir();
    const first = createFileSystemStateStore(dir);
    await first.append('events', { id: 1 });
    await first.put('locks/leader', { owner: 'a' }, 0);
    const second = createFileSystemStateStore(dir);
    assert.deepEqual(await second.readAll('events'), [{ id: 1 }]);
    assert.equal((await second.get<{ owner: string }>('locks/leader'))?.value.owner, 'a');
  });

  it('selects a backend from the environment', () => {
    const configured = readStateStoreConfig({
      WIKIFORGE_STATE_BACKEND: 'postgres',
      WIKIFORGE_STATE_POSTGRES_URL: 'http://127.0.0.1:9999/state',
    }, '/tmp');
    assert.equal(configured.backend, 'postgres');
    assert.equal(configured.url, 'http://127.0.0.1:9999/state');
    assert.throws(
      () => createStateStoreFromEnv({ WIKIFORGE_STATE_BACKEND: 'redis' }, '/tmp'),
      /WIKIFORGE_STATE_REDIS_URL/,
    );
    const store = createStateStoreFromEnv({
      WIKIFORGE_STATE_BACKEND: 'redis',
      WIKIFORGE_STATE_REDIS_URL: 'http://127.0.0.1:9999/state',
    }, '/tmp');
    assert.equal(store.name, 'redis');
    assert.equal(createStateStoreFromEnv({}, '/tmp').name, 'file');
  });

  it('speaks the HTTP adapter contract', async () => {
    const value = new Map<string, { version: number; updatedAt: string; value: unknown }>();
    const events: unknown[] = [];
    const fetchFn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      const key = decodeURIComponent(url.pathname.split('/')[2] ?? '');
      const isEvents = url.pathname.endsWith('/events');
      if (isEvents && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { event: unknown };
        events.push(body.event);
        return new Response(JSON.stringify({ ok: true }), { status: 201 });
      }
      if (isEvents) return new Response(JSON.stringify({ events }));
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { value: unknown; expectedVersion: number | null };
        const current = value.get(key);
        if (body.expectedVersion !== null && body.expectedVersion !== (current?.version ?? 0)) {
          return new Response(JSON.stringify({ actualVersion: current?.version ?? 0 }), { status: 409 });
        }
        const entry = { version: (current?.version ?? 0) + 1, updatedAt: new Date().toISOString(), value: body.value };
        value.set(key, entry);
        return new Response(JSON.stringify({ entry }));
      }
      if (init?.method === 'DELETE') {
        return new Response(JSON.stringify({ removed: value.delete(key) }));
      }
      const entry = value.get(key);
      return entry
        ? new Response(JSON.stringify({ entry }))
        : new Response(JSON.stringify({ entry: null }), { status: 404 });
    };
    const store = createHttpStateStore({ baseUrl: 'http://state.local/', name: 'postgres', fetchFn });
    const entry = await store.put('session:http', { token: 'x' }, 0);
    assert.equal(entry.version, 1);
    await assert.rejects(() => store.put('session:http', { token: 'y' }, 0), StateConflictError);
    await store.append('session:http', { type: 'decided' });
    assert.deepEqual(await store.readAll('session:http'), [{ type: 'decided' }]);
    assert.equal(await store.remove('session:http', 1), true);
    assert.equal(await store.get('session:http'), null);
  });

  it('adapts state entries to the scheduler runtime store', async () => {
    const store = createMemoryStateStore();
    const runtime = createStateRuntimeStore(store);
    const state = await runtime.load();
    state.jobs.nightly = {
      last_status: 'success',
      next_run_at: '2026-11-25T00:00:00.000Z',
      consecutive_failures: 0,
      retry_count: 0,
    };
    await runtime.save(state);
    assert.deepEqual((await createStateRuntimeStore(store).load()).jobs.nightly, state.jobs.nightly);
  });
});

describe('approval outbox', () => {
  it('appends only immutable events and filters reads', async () => {
    const dir = await makeTempDir();
    const store = createFileSystemStateStore(dir);
    const outbox = new ApprovalOutbox(store, APPROVAL_OUTBOX_KEY, () => new Date('2026-11-25T10:00:00.000Z'));
    await outbox.append({
      type: 'approval.staged',
      approvalId: 'a1',
      jobId: 'nightly',
      useCaseId: 'validation',
      project: 'default',
      at: '',
    });
    await outbox.append({
      type: 'approval.decided',
      approvalId: 'a1',
      jobId: 'nightly',
      status: 'approved',
      decidedBy: 'human:reviewer',
      at: '',
    });
    await outbox.append({
      type: 'approval.staged',
      approvalId: 'a2',
      jobId: 'other',
      useCaseId: 'validation',
      project: 'default',
      at: '',
    });
    const reopened = new ApprovalOutbox(createFileSystemStateStore(dir));
    const all = await reopened.readAll();
    assert.equal(all.length, 3);
    assert.equal(all[0].at, '2026-11-25T10:00:00.000Z');
    assert.deepEqual((await reopened.readAll({ jobId: 'nightly' })).map((event) => event.type), [
      'approval.staged',
      'approval.decided',
    ]);
    assert.equal((await reopened.readAll({ type: 'approval.decided' })).length, 1);
  });
});

describe('distributed lock', () => {
  it('grants one lease at a time and releases safely', async () => {
    const store = createMemoryStateStore();
    const first = createStateLock(store, { key: 'locks/test', owner: 'a', pid: 1, hostname: 'h1', leaseMs: 200 });
    const second = createStateLock(store, { key: 'locks/test', owner: 'b', pid: 2, hostname: 'h2', leaseMs: 200 });
    const info = await first.acquire();
    assert.equal(info.pid, 1);
    assert.equal(first.isHeld(), true);
    await assert.rejects(() => second.acquire(), LockHeldError);
    assert.equal(await first.renew(), true);
    await first.release();
    assert.equal(first.isHeld(), false);
    const takeover = await second.acquire();
    assert.equal(takeover.pid, 2);
    await second.release();
  });

  it('takes over an expired lease', async () => {
    const store = createMemoryStateStore();
    const first = createStateLock(store, { owner: 'a', leaseMs: 40 });
    const second = createStateLock(store, { owner: 'b', leaseMs: 200 });
    await first.acquire();
    await sleep(60);
    const info = await acquireWithRetry(second, { timeoutMs: 200, retryMs: 10 });
    assert.equal(info.pid, process.pid);
    await second.release();
  });

  it('serialises critical sections with withLock', async () => {
    const store = createMemoryStateStore();
    let active = 0;
    let maxActive = 0;
    let completed = 0;
    const task = (): Promise<void> => withLock(store, 'locks/critical', async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(20);
      completed += 1;
      active -= 1;
    }, { leaseMs: 500, timeoutMs: 2_000, retryMs: 10 });
    await Promise.all([task(), task(), task()]);
    assert.equal(maxActive, 1);
    assert.equal(completed, 3);
  });
});

describe('subprocess runner', () => {
  it('applies the environment allowlist', () => {
    const env = buildAllowedEnv(
      [...DEFAULT_ENV_ALLOWLIST],
      { INJECTED: 'yes' },
      { PATH: '/bin', WIKIFORGE_X: '1', AWS_SECRET_ACCESS_KEY: 'leak', HOME: '/home/test' },
    );
    assert.equal(env.PATH, '/bin');
    assert.equal(env.WIKIFORGE_X, '1');
    assert.equal(env.HOME, '/home/test');
    assert.equal(env.INJECTED, 'yes');
    assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  });

  it('captures stdout and enforces the output limit', async () => {
    const result = await runScript({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("x".repeat(5000))'],
      envAllowlist: [],
      maxOutputBytes: 100,
    });
    assert.equal(result.code, 0);
    assert.equal(result.stdout.length, 100);
    assert.equal(result.truncated, true);
  });

  it('kills a child that exceeds its timeout', async () => {
    const result = await runScript({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      envAllowlist: [],
      timeoutMs: 50,
    });
    assert.equal(result.timedOut, true);
    assert.notEqual(result.code, 0);
  });

  it('streams chunks through the managed process handle', async () => {
    const chunks: string[] = [];
    const managed = spawnManaged({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("a"); process.stderr.write("b")'],
      envAllowlist: [],
      onStdout: (text) => chunks.push(text),
      onStderr: (text) => chunks.push(text),
    });
    const result = await managed.done;
    assert.deepEqual(chunks.sort(), ['a', 'b']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, 'a');
    assert.equal(result.stderr, 'b');
  });
});

describe('worker pool', () => {
  it('limits concurrent script tasks', async () => {
    const pool = new WorkerPool(2);
    let active = 0;
    let maxActive = 0;
    const task = async (): Promise<number> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(20);
      active -= 1;
      return active;
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => pool.run(task)));
    assert.equal(results.length, 5);
    assert.equal(maxActive, 2);
    assert.deepEqual(pool.stats, { concurrency: 2, active: 0, pending: 0 });
  });

  it('reads concurrency and CLI flags from the environment contract', () => {
    assert.equal(workerConcurrency('4'), 4);
    assert.equal(workerConcurrency(Number.NaN), 2);
    assert.deepEqual(parseWorkerArgs(['--root', '/tmp', '--concurrency', '3', '--lease-ms', '1000']), {
      root: '/tmp',
      concurrency: 3,
      leaseMs: 1_000,
    });
  });

  it('acquires the leader lease and starts the scheduler', async () => {
    const dir = await makeTempDir();
    await fs.mkdir(path.join(dir, 'config'), { recursive: true });
    await fs.writeFile(path.join(dir, 'config', 'agent_schedule.toml'), [
      '[agent.scheduler]',
      'enabled = true',
      'timezone = "UTC"',
      'max_concurrency = 1',
      'default_timeout_seconds = 0',
      'log_dir = "output/scheduler"',
      'policy_enabled = false',
      '',
      '[[agent.scheduler.jobs]]',
      'id = "nightly-test"',
      'use_case = "ke_ontological_validation"',
      'schedule = "0 2 * * *"',
      'enabled = true',
      'project = "default"',
      'auto_apply = false',
      '',
    ].join('\n'), 'utf-8');

    let resolveShutdown: () => void = () => undefined;
    const shutdown = new Promise<void>((resolve) => { resolveShutdown = resolve; });
    const events: string[] = [];
    const worker = await runWorker({
      rootDir: dir,
      store: createMemoryStateStore(),
      concurrency: 3,
      leaseMs: 2_000,
      tickMs: 3_600_000,
      shutdown,
      onEvent: (event) => events.push(event.type),
      executeJob: async () => ({ failedSteps: [], exitCodes: [0] }),
    });

    assert.equal(worker.scheduler.getStatus().lockHeld, true);
    assert.equal(worker.pool.concurrency, 3);
    assert.equal((await worker.lock.lease())?.owner, `worker:${process.pid}`);
    resolveShutdown();
    await worker.done;
    assert.equal(worker.scheduler.getStatus().lockHeld, false);
    assert.equal(events.at(-1), 'stopped');
  });
});
