import * as path from 'node:path';
import {
  buildCliArgs,
  KE_USE_CASES,
  PYTHON_CMD,
  SCRIPT_REGISTRY,
} from '../server/agentServerCatalogs';
import { WorkerPool } from '../server/process/workerPool';
import {
  buildSyntheticUseCases,
  loadScheduleConfig,
} from '../server/scheduler/jobStore';
import {
  Scheduler,
  type SchedulerEvent,
  type SchedulerOptions,
} from '../server/scheduler/scheduler';
import { runUseCase } from '../server/useCaseRunner';
import { createStateStoreFromEnv } from '../server/state';
import {
  acquireWithRetry,
  createStateLock,
  DEFAULT_LEASE_MS,
  type StateLock,
} from '../server/state/lock';
import { ApprovalOutbox } from '../server/state/outbox';
import { createApprovalOutboxRelay } from '../server/state/outboxRelay';
import { createStateRuntimeStore } from '../server/state/runtimeAdapter';
import type { StateStore } from '../server/state/types';

export interface WorkerOptions {
  rootDir: string;
  store?: StateStore;
  concurrency?: number;
  leaseMs?: number;
  owner?: string;
  hostname?: string;
  tickMs?: number;
  shutdown?: Promise<unknown>;
  outbox?: ApprovalOutbox;
  executeJob?: SchedulerOptions['executeJob'];
  resolveProjectRoot?: (projectId: string) => Promise<string>;
  onEvent?: (event: SchedulerEvent) => void;
  onHeartbeatError?: (error: unknown) => void;
  onOutboxError?: (error: unknown) => void;
}

export interface WorkerHandle {
  scheduler: Scheduler;
  lock: StateLock;
  pool: WorkerPool;
  done: Promise<void>;
  stop(options?: { cancelActive?: boolean }): Promise<void>;
}

export function workerConcurrency(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 2;
  return Math.min(32, Math.floor(parsed));
}

function defaultProjectRoot(rootDir: string, projectId: string): string {
  return projectId && projectId !== 'default' ? path.join(rootDir, 'projects', projectId) : rootDir;
}

export async function runWorker(options: WorkerOptions): Promise<WorkerHandle> {
  const concurrency = workerConcurrency(options.concurrency ?? 2);
  const leaseMs = Number.isFinite(options.leaseMs)
    ? Math.max(1_000, options.leaseMs as number)
    : DEFAULT_LEASE_MS;
  const rootDir = options.rootDir;
  const store = options.store ?? createStateStoreFromEnv(process.env, rootDir);
  const lock = createStateLock(store, {
    key: 'leader/scheduler',
    leaseMs,
    owner: options.owner ?? `worker:${process.pid}`,
    hostname: options.hostname,
  });
  const pool = new WorkerPool(concurrency);
  const outbox = options.outbox ?? new ApprovalOutbox(store);
  const relay = createApprovalOutboxRelay(outbox, (event) => {
    if (event.type !== 'approval.required') return;
    options.onEvent?.({
      type: 'approval_required',
      jobId: event.jobId,
      approvalIds: event.approvalIds,
      steps: event.steps ?? [],
      ...(event.jobKind ? { jobKind: event.jobKind } : {}),
      ...(event.scriptIds ? { scriptIds: event.scriptIds } : {}),
      rationale: event.rationale,
      sources: event.sources,
      at: event.at,
    });
  }, {
    store,
    filter: { type: 'approval.required' },
    onError: options.onOutboxError,
  });
  await acquireWithRetry(lock, { timeoutMs: leaseMs * 2, retryMs: 100 });
  relay.start();

  const heartbeat = setInterval(() => {
    const lost = (): void => { void stop().catch((err) => options.onHeartbeatError?.(err)); };
    void lock.renew().then((renewed) => { if (!renewed) lost(); }, lost);
  }, Math.max(250, Math.floor(leaseMs / 3)));
  heartbeat.unref?.();

  const emit = (event: SchedulerEvent): void => {
    if (event.type === 'approval_required') {
      void outbox.append({
        type: 'approval.required',
        jobId: event.jobId,
        approvalIds: event.approvalIds,
        steps: event.steps,
        jobKind: event.jobKind,
        scriptIds: event.scriptIds,
        rationale: event.rationale,
        sources: event.sources,
        at: event.at,
      }).then(
        () => relay.poll().catch((err) => options.onOutboxError?.(err)),
        (err) => {
          options.onOutboxError?.(err);
          options.onEvent?.(event);
        },
      );
      return;
    }
    options.onEvent?.(event);
  };

  const loaded = await loadScheduleConfig(rootDir, KE_USE_CASES);
  const config = {
    ...loaded.config,
    enabled: true,
    maxConcurrency: Math.max(1, Math.min(loaded.config.maxConcurrency || 1, concurrency)),
  };
  const useCases = { ...KE_USE_CASES, ...buildSyntheticUseCases(loaded.jobs) };
  const resolveRoot = options.resolveProjectRoot ??
    (async (projectId: string) => defaultProjectRoot(rootDir, projectId));
  const executeJob: SchedulerOptions['executeJob'] = options.executeJob ?? ((ctx) => pool.run(async () => {
    const projectRoot = await resolveRoot(ctx.job.project);
    const result = await runUseCase({
      useCase: ctx.useCase as Parameters<typeof runUseCase>[0]['useCase'],
      stepIndices: ctx.steps ?? ctx.job.steps,
      args: ctx.job.args,
      signal: ctx.signal,
      onEvent: (event) => {
        ctx.onRunnerEvent(event);
        if (event.type === 'stdout' || event.type === 'stderr') ctx.onOutput(event.text);
        if (event.type === 'step_start') {
          ctx.onOutput(`\n[step ${event.stepNumber}] ${event.title} (${event.script})\n$ ${event.cmd}\n`);
        }
      },
      rootDir,
      projectRoot,
      projectId: ctx.job.project,
      pythonCmd: PYTHON_CMD,
      scriptRegistry: SCRIPT_REGISTRY,
      buildCliArgs,
    });
    return {
      failedSteps: result.failedSteps,
      exitCodes: result.failedSteps.length > 0 ? [1] : [0],
    };
  }));

  const scheduler = new Scheduler({
    config,
    jobs: loaded.jobs,
    useCases,
    rootDir,
    executeJob,
    lock,
    stateStore: createStateRuntimeStore(store),
    tickMs: options.tickMs,
    onEvent: emit,
  });

  try {
    await scheduler.start();
  } catch (err) {
    clearInterval(heartbeat);
    relay.stop();
    await lock.release();
    throw err;
  }

  let stopping: Promise<void> | undefined;
  const stop = (stopOptions: { cancelActive?: boolean } = {}): Promise<void> => {
    if (!stopping) {
      stopping = (async () => {
        clearInterval(heartbeat);
        relay.stop();
        await scheduler.stop({ cancelActive: stopOptions.cancelActive ?? true });
        await lock.release();
      })();
    }
    return stopping;
  };

  const done = Promise.resolve(options.shutdown ?? new Promise<void>(() => undefined))
    .then(() => stop(), () => stop())
    .catch((err) => options.onHeartbeatError?.(err));

  return { scheduler, lock, pool, done, stop };
}
