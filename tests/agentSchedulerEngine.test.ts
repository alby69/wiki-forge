import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseSchedule } from '@backend/server/scheduler/cron';
import { JobDef, SchedulerConfig } from '@backend/server/scheduler/jobStore';
import { createPidLock, LockHeldError } from '@backend/server/scheduler/lock';
import { createFileRuntimeStateStore } from '@backend/server/scheduler/runtimeState';
import {
  JobExecutionContext,
  JobExecutionResult,
  redactSecrets,
  Scheduler,
  SchedulerEvent,
  SchedulerOptions,
} from '@backend/server/scheduler/scheduler';

const baseConfig: SchedulerConfig = {
  enabled: true,
  timezone: 'UTC',
  maxConcurrency: 1,
  defaultTimeoutSeconds: 0,
  logDir: 'output/scheduler',
  policyEnabled: false,
};

let tmpDir: string;
let currentTime: Date;

function makeJob(overrides: Partial<JobDef> = {}): JobDef {
  return {
    id: 'nightly-validation',
    role: 'Ontology Guardian',
    useCaseId: 'ke_ontological_validation',
    schedule: parseSchedule('0 2 * * *', 'UTC'),
    enabled: true,
    project: 'default',
    args: {},
    autoApply: false,
    maxRetries: 0,
    debounceSeconds: 300,
    ...overrides,
  };
}

interface TimerRecord {
  id: number;
  fn: () => void;
  ms: number;
  cleared: boolean;
}

interface Harness {
  scheduler: Scheduler;
  events: SchedulerEvent[];
  attempts: Array<{ jobId: string; attempt: number }>;
  timers: TimerRecord[];
  fireTimeouts: () => void;
}

function makeScheduler(options: Partial<SchedulerOptions> = {}): Harness {
  const events: SchedulerEvent[] = [];
  const attempts: Harness['attempts'] = [];
  const timers: TimerRecord[] = [];
  let timerId = 0;

  const store = createFileRuntimeStateStore(
    path.join(tmpDir, '.wiki-forge', 'scheduler-state.json')
  );
  const lock = createPidLock(path.join(tmpDir, '.wiki-forge', 'scheduler.lock'), {
    pid: 900_000 + Math.floor(Math.random() * 100_000),
    hostname: 'test-host',
    now: () => currentTime,
  });

  const scheduler = new Scheduler({
    config: baseConfig,
    jobs: [makeJob()],
    useCases: {
      ke_ontological_validation: {
        id: 'ke_ontological_validation',
        title: 'Ontological Validation',
        steps: [{}],
      },
    },
    executeJob: async (ctx) => {
      attempts.push({ jobId: ctx.job.id, attempt: ctx.attempt });
      ctx.onOutput('fake output\n');
      return { failedSteps: [], exitCodes: [0] };
    },
    rootDir: tmpDir,
    now: () => currentTime,
    stateStore: store,
    lock,
    tickMs: 3_600_000, // effectively disabled; tests drive tick() directly
    onEvent: (event) => events.push(event),
    setTimeoutFn: (fn, ms) => {
      const id = ++timerId;
      timers.push({ id, fn, ms, cleared: false });
      return id;
    },
    clearTimeoutFn: (handle) => {
      const timer = timers.find((entry) => entry.id === handle);
      if (timer) timer.cleared = true;
    },
    ...options,
  });

  return {
    scheduler,
    events,
    attempts,
    timers,
    fireTimeouts: () => {
      for (const timer of timers.filter((entry) => !entry.cleared)) timer.fn();
    },
  };
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  // State persistence uses real fs I/O; yield with a timed wait so the libuv
  // thread pool can complete it instead of spinning in the microtask queue.
  for (let i = 0; i < 100 && !predicate(); i += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(predicate(), `timed out waiting for ${label}`);
}

async function readState(jobId: string): Promise<Record<string, any>> {
  const text = await fs.readFile(
    path.join(tmpDir, '.wiki-forge', 'scheduler-state.json'),
    'utf-8'
  );
  return JSON.parse(text).jobs[jobId];
}

describe('Scheduler engine (F2)', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-scheduler-engine-'));
    currentTime = new Date('2026-11-19T01:59:00.000Z');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs a due job exactly once per slot across three consecutive days', async () => {
    const h = makeScheduler();
    await h.scheduler.start();

    await h.scheduler.tick();
    assert.strictEqual(h.attempts.length, 0, 'nothing runs before 02:00');

    for (const day of [19, 20, 21]) {
      currentTime = new Date(`2026-11-${day}T02:00:30.000Z`);
      await h.scheduler.tick();
      // A second tick inside the same slot must not duplicate the run.
      await h.scheduler.tick();
    }

    assert.strictEqual(h.attempts.length, 3);
    const state = await readState('nightly-validation');
    assert.strictEqual(state.last_status, 'success');
    assert.strictEqual(state.consecutive_failures, 0);
    assert.strictEqual(state.next_run_at, '2026-11-22T02:00:00.000Z');
    await h.scheduler.stop();
  });

  it('skips a job that is already running instead of launching it twice', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    const h = makeScheduler({
      executeJob: async () => {
        started += 1;
        await gate;
        return { failedSteps: [], exitCodes: [0] };
      },
    });

    await h.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    const first = h.scheduler.tick();
    await waitFor(() => started === 1, 'executor start');

    const second = h.scheduler.tick();
    await second;

    assert.strictEqual(started, 1);
    assert.ok(
      h.events.some((event) => event.type === 'job_finished' && event.status === 'skipped')
    );

    release();
    await first;
    assert.strictEqual(started, 1);
    await h.scheduler.stop();
  });

  it('persists state across restarts and recovers a run interrupted by a crash', async () => {
    const first = makeScheduler();
    await first.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    await first.scheduler.tick();
    await first.scheduler.stop();

    const second = makeScheduler();
    await second.scheduler.start();
    const status = second.scheduler.getStatus();
    assert.strictEqual(status.jobs[0].state.last_status, 'success');
    assert.strictEqual(status.jobs[0].state.next_run_at, '2026-11-20T02:00:00.000Z');
    assert.strictEqual(second.attempts.length, 0, 'no catch-up before the next slot');
    await second.scheduler.stop();

    // Simulate a process dying while the job was marked as running.
    const statePath = path.join(tmpDir, '.wiki-forge', 'scheduler-state.json');
    const persisted = JSON.parse(await fs.readFile(statePath, 'utf-8'));
    persisted.jobs['nightly-validation'].last_status = 'running';
    await fs.writeFile(statePath, JSON.stringify(persisted, null, 2), 'utf-8');

    const third = makeScheduler();
    await third.scheduler.start();
    const loaded = third.events.find((event) => event.type === 'state_loaded');
    assert.ok(loaded && loaded.type === 'state_loaded');
    assert.deepStrictEqual(loaded.recoveredRuns, ['nightly-validation']);

    const recovered = third.scheduler.getStatus().jobs[0].state;
    assert.strictEqual(recovered.last_status, 'failed');
    assert.strictEqual(recovered.last_error, 'interrupted by scheduler restart');
    assert.strictEqual(recovered.consecutive_failures, 1);

    currentTime = new Date('2026-11-19T02:00:31.000Z');
    await third.scheduler.tick();
    assert.strictEqual(third.attempts.length, 1, 'interrupted job is retried immediately');
    await third.scheduler.stop();
  });

  it('rejects a second live instance but takes over a stale PID lock', async () => {
    const lockPath = path.join(tmpDir, '.wiki-forge', 'scheduler.lock');
    const owner = createPidLock(lockPath, {
      pid: process.pid,
      hostname: 'owner',
      now: () => currentTime,
    });
    await owner.acquire();

    const intruder = createPidLock(lockPath, {
      pid: 999_999,
      hostname: 'intruder',
      now: () => currentTime,
    });
    await assert.rejects(() => intruder.acquire(), LockHeldError);

    // PID 999999 does not exist: the lock is stale and may be taken over.
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: 999_999, hostname: 'dead', acquiredAt: currentTime.toISOString() }),
      'utf-8'
    );
    await intruder.acquire();
    assert.strictEqual(intruder.isHeld(), true);

    // A release must not delete a lock that now belongs to another PID.
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: 123_456, hostname: 'new-owner', acquiredAt: currentTime.toISOString() }),
      'utf-8'
    );
    await intruder.release();
    const remaining = JSON.parse(await fs.readFile(lockPath, 'utf-8'));
    assert.strictEqual(remaining.pid, 123_456);
    assert.strictEqual(intruder.isHeld(), false);
  });

  it('retries with 1m then 5m backoff and resets after success', async () => {
    const attempts: number[] = [];
    const h = makeScheduler({
      jobs: [makeJob({ maxRetries: 2 })],
      executeJob: async (ctx) => {
        attempts.push(ctx.attempt);
        const failed = ctx.attempt < 3;
        return { failedSteps: failed ? [1] : [], exitCodes: [failed ? 1 : 0] };
      },
    });

    await h.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    await h.scheduler.tick();
    let state = h.scheduler.getStatus().jobs[0].state;
    assert.strictEqual(state.last_status, 'failed');
    assert.strictEqual(state.retry_count, 1);
    assert.strictEqual(state.next_run_at, '2026-11-19T02:01:30.000Z');

    currentTime = new Date('2026-11-19T02:01:30.000Z');
    await h.scheduler.tick();
    state = h.scheduler.getStatus().jobs[0].state;
    assert.strictEqual(state.retry_count, 2);
    assert.strictEqual(state.next_run_at, '2026-11-19T02:06:30.000Z');

    currentTime = new Date('2026-11-19T02:06:30.000Z');
    await h.scheduler.tick();
    state = h.scheduler.getStatus().jobs[0].state;
    assert.strictEqual(state.last_status, 'success');
    assert.strictEqual(state.retry_count, 0);
    assert.strictEqual(state.consecutive_failures, 0);
    assert.strictEqual(state.next_run_at, '2026-11-20T02:00:00.000Z');
    assert.deepStrictEqual(attempts, [1, 2, 3]);
    assert.strictEqual(h.events.filter((event) => event.type === 'job_retry').length, 2);
    await h.scheduler.stop();
  });

  it('gives up after max_retries and returns to the regular cron slot', async () => {
    const attempts: number[] = [];
    const h = makeScheduler({
      jobs: [makeJob({ maxRetries: 1 })],
      executeJob: async (ctx) => {
        attempts.push(ctx.attempt);
        return { failedSteps: [1], exitCodes: [1] };
      },
    });

    await h.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    await h.scheduler.tick();
    currentTime = new Date('2026-11-19T02:01:30.000Z');
    await h.scheduler.tick();

    const state = h.scheduler.getStatus().jobs[0].state;
    assert.deepStrictEqual(attempts, [1, 2]);
    assert.strictEqual(state.retry_count, 0);
    assert.strictEqual(state.consecutive_failures, 2);
    assert.strictEqual(state.next_run_at, '2026-11-20T02:00:00.000Z');
    assert.strictEqual(h.events.filter((event) => event.type === 'job_retry').length, 1);
    await h.scheduler.stop();
  });

  it('aborts a timed-out job, marks it cancelled and clears the timer', async () => {
    const h = makeScheduler({
      config: { ...baseConfig, defaultTimeoutSeconds: 1 },
      executeJob: ({ signal }) =>
        new Promise<JobExecutionResult>((resolve) => {
          signal.addEventListener('abort', () =>
            resolve({ failedSteps: [1], exitCodes: [124] })
          );
        }),
    });

    await h.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    const ticking = h.scheduler.tick();
    await waitFor(() => h.timers.some((timer) => timer.ms === 1_000), 'timeout timer');

    const timeoutTimer = h.timers.find((timer) => timer.ms === 1_000);
    assert.ok(timeoutTimer);
    timeoutTimer!.fn();
    await ticking;

    const state = h.scheduler.getStatus().jobs[0].state;
    assert.strictEqual(state.last_status, 'cancelled');
    assert.ok(state.last_error?.includes('aborted'));
    assert.strictEqual(timeoutTimer!.cleared, true);

    const auditText = await fs.readFile(
      path.join(tmpDir, 'output', 'scheduler', 'audit.jsonl'),
      'utf-8'
    );
    const audit = JSON.parse(auditText.trim());
    assert.strictEqual(audit.status, 'cancelled');
    assert.strictEqual(audit.actor, 'scheduler');
    await h.scheduler.stop();
  });

  it('returns a manually cancelled job to its cron slot but retries a shutdown cancellation immediately', async () => {
    let manualExecutorStarted = false;
    let shutdownExecutorStarted = false;
    const abortableExecutor = (mode: 'manual' | 'shutdown') =>
      ({ signal }: JobExecutionContext): Promise<JobExecutionResult> => {
        if (mode === 'manual') manualExecutorStarted = true;
        else shutdownExecutorStarted = true;
        return new Promise<JobExecutionResult>((resolve) => {
          const finish = () => resolve({ failedSteps: [], exitCodes: [124] });
          // The abort may arrive before the listener is attached.
          if (signal.aborted) finish();
          else signal.addEventListener('abort', finish, { once: true });
        });
      };

    // Manual cancel: back to the regular cron slot.
    const manual = makeScheduler({ executeJob: abortableExecutor('manual') });
    await manual.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    const manualTick = manual.scheduler.tick();
    await waitFor(() => manualExecutorStarted, 'manual executor start');
    assert.strictEqual(manual.scheduler.cancelJob('nightly-validation'), true);
    await manualTick;
    assert.strictEqual(manual.scheduler.cancelJob('nightly-validation'), false);
    const manualState = manual.scheduler.getStatus().jobs[0].state;
    assert.strictEqual(manualState.last_status, 'cancelled');
    assert.strictEqual(manualState.next_run_at, '2026-11-20T02:00:00.000Z');
    await manual.scheduler.stop();

    // Fresh state/clock: the manual run left a future next_run_at on disk.
    await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-scheduler-engine-'));
    currentTime = new Date('2026-11-19T01:59:00.000Z');

    // Shutdown cancel: retried as soon as the process comes back.
    const shutdown = makeScheduler({ executeJob: abortableExecutor('shutdown') });
    await shutdown.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    const shutdownTick = shutdown.scheduler.tick();
    await waitFor(() => shutdownExecutorStarted, 'shutdown executor start');
    await shutdown.scheduler.stop({ cancelActive: true });
    await shutdownTick;
    const shutdownState = shutdown.scheduler.getStatus().jobs[0].state;
    assert.strictEqual(shutdownState.last_status, 'cancelled');
    assert.strictEqual(shutdownState.next_run_at, '2026-11-19T02:00:30.000Z');
  });

  it('honours max_concurrency when several jobs are due', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started: string[] = [];
    const h = makeScheduler({
      jobs: [makeJob({ id: 'job-a' }), makeJob({ id: 'job-b' })],
      executeJob: async (ctx: JobExecutionContext) => {
        started.push(ctx.job.id);
        await gate;
        return { failedSteps: [], exitCodes: [0] };
      },
    });

    await h.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    const ticking = h.scheduler.tick();
    await waitFor(() => started.length === 1, 'first job start');
    assert.deepStrictEqual(started, ['job-a']);

    release();
    await ticking;

    currentTime = new Date('2026-11-19T02:00:31.000Z');
    await h.scheduler.tick();
    assert.deepStrictEqual(started, ['job-a', 'job-b']);
    await h.scheduler.stop();
  });

  it('writes redacted logs and an audit trail for every run', async () => {
    const h = makeScheduler({
      executeJob: async (ctx) => {
        ctx.onOutput('token=supersecret\n--api-key abc123xyz\nall good\n');
        return { failedSteps: [], exitCodes: [0] };
      },
    });

    await h.scheduler.start();
    currentTime = new Date('2026-11-19T02:00:30.000Z');
    await h.scheduler.tick();

    const logDir = path.join(tmpDir, 'output', 'scheduler');
    const logFile = (await fs.readdir(logDir)).find(
      (name) => name.endsWith('.log') && name !== 'audit.jsonl'
    );
    assert.ok(logFile, 'a per-run log file is written');
    const logText = await fs.readFile(path.join(logDir, logFile!), 'utf-8');
    assert.ok(logText.includes('[REDACTED]'));
    assert.ok(!logText.includes('supersecret'));
    assert.ok(!logText.includes('abc123xyz'));

    const audit = JSON.parse(
      (await fs.readFile(path.join(logDir, 'audit.jsonl'), 'utf-8')).trim()
    );
    assert.strictEqual(audit.actor, 'scheduler');
    assert.strictEqual(audit.job, 'nightly-validation');
    assert.strictEqual(audit.useCase, 'ke_ontological_validation');
    assert.strictEqual(audit.status, 'success');
    assert.deepStrictEqual(audit.exitCodes, [0]);
    assert.strictEqual(redactSecrets('api_key: leaked'), 'api_key: [REDACTED]');
    await h.scheduler.stop();
  });

  it('does not start the loop or take the lock when disabled', async () => {
    const h = makeScheduler({ config: { ...baseConfig, enabled: false } });
    await h.scheduler.start();
    const status = h.scheduler.getStatus();
    assert.strictEqual(status.running, false);
    assert.strictEqual(status.lockHeld, false);

    currentTime = new Date('2026-11-19T02:00:30.000Z');
    await h.scheduler.tick();
    assert.strictEqual(h.attempts.length, 0);
    await h.scheduler.stop();
  });
});
