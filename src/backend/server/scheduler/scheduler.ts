import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { UseCaseEvent } from '../useCaseRunner';
import { describeSchedule, nextRunAt, parseSchedule } from './cron';
import { JobDef, SchedulerConfig, UseCaseRegistryEntry } from './jobStore';
import { createPidLock, ProcessLock } from './lock';
import {
  createFileRuntimeStateStore,
  emptyState,
  JobRuntimeState,
  JobStatus,
  RuntimeStateStore,
  SchedulerStateFile,
} from './runtimeState';

export const DEFAULT_TICK_MS = 30_000;
/** Backoff for attempt 1, attempt 2, ... (capped at the last value). */
export const DEFAULT_RETRY_BACKOFF_MS = [60_000, 300_000];

type TimerFn = (fn: () => void, ms: number) => unknown;
type ClearTimerFn = (handle: unknown) => void;

export type JobTrigger = 'cron' | 'manual' | 'event';

/** F6 — normalised event published by the webhook or the in-app note watcher. */
export interface TriggerEvent {
  type: string;
  project: string;
  path?: string;
  source: 'webhook' | 'watcher' | 'api';
  at?: string;
}

export interface JobExecutionContext {
  job: JobDef;
  useCase: UseCaseRegistryEntry;
  /** 1-based: 1 is the first attempt, 2 the first retry. */
  attempt: number;
  trigger: JobTrigger;
  event?: TriggerEvent;
  /** F5 preflight can narrow the step list before the runner is invoked. */
  steps?: number[];
  signal: AbortSignal;
  onOutput: (chunk: string) => void;
  /** Forward the original UseCaseEvent stream (used by the manual-run SSE). */
  onRunnerEvent: (event: UseCaseEvent) => void;
  /** Let F5/F6 preflight emit status events to SSE subscribers. */
  notify: (event: SchedulerEvent) => void;
}

/** F5 — advisory preflight result; it can only narrow the step set. */
export interface PreflightResult {
  run: boolean;
  steps?: number[];
  reason?: string;
}

export interface JobExecutionResult {
  failedSteps: number[];
  exitCodes: number[];
}

export type SchedulerEvent =
  | { type: 'lock_acquired'; at: string }
  | { type: 'state_loaded'; at: string; recoveredRuns: string[] }
  | { type: 'tick'; at: string }
  | { type: 'job_started'; jobId: string; attempt: number; at: string }
  | { type: 'job_output'; jobId: string; text: string }
  | { type: 'use_case_event'; jobId: string; event: UseCaseEvent }
  | { type: 'job_skipped'; jobId: string; reason: string; at: string }
  | {
      type: 'policy_decision';
      jobId: string;
      action: 'allow' | 'skip' | 'require_approval';
      rationale: string;
      sources: string[];
      at: string;
    }
  | {
      type: 'approval_required';
      jobId: string;
      approvalIds: string[];
      steps: number[];
      rationale: string;
      sources: string[];
      at: string;
    }
  | { type: 'event_queued'; jobId: string; event: TriggerEvent; fireAt: string }
  | { type: 'event_triggered'; jobId: string; event: TriggerEvent; at: string }
  | {
      type: 'job_retry';
      jobId: string;
      attempt: number;
      nextRunAt: string;
      reason: string;
    }
  | {
      type: 'job_finished';
      jobId: string;
      status: JobStatus;
      at: string;
      durationMs: number;
    }
  | { type: 'stopped'; at: string };

export interface SchedulerOptions {
  config: SchedulerConfig;
  jobs: JobDef[];
  useCases: Record<string, UseCaseRegistryEntry>;
  /** Production adapter calls `runUseCase()`; tests inject a fake runner. */
  executeJob: (ctx: JobExecutionContext) => Promise<JobExecutionResult>;
  /** F5/F6: optional advisory gate, invoked after `job_started`. */
  preflight?: (ctx: JobExecutionContext) => Promise<PreflightResult>;
  rootDir: string;
  now?: () => Date;
  stateStore?: RuntimeStateStore;
  lock?: ProcessLock;
  tickMs?: number;
  retryBackoffMs?: number[];
  onEvent?: (event: SchedulerEvent) => void;
  /** Injectable timers so timeout tests never wait real minutes. */
  setTimeoutFn?: TimerFn;
  clearTimeoutFn?: ClearTimerFn;
}

export interface SchedulerSnapshot {
  enabled: boolean;
  running: boolean;
  lockHeld: boolean;
  activeJobs: string[];
  jobs: Array<{
    job: JobDef;
    state: JobRuntimeState;
    description: string;
  }>;
}

export interface AuditEntry {
  job: string;
  useCase: string;
  attempt: number;
  startedAt: string;
  endedAt: string;
  status: JobStatus;
  exitCodes: number[];
  failedSteps: number[];
  error?: string;
  logFile?: string;
  actor: 'scheduler' | 'human';
  trigger?: JobTrigger;
  triggerEvent?: TriggerEvent;
  policyDecisionId?: string;
  approvalId?: string;
  approvedBy?: string;
  steps?: number[];
}

/** Remove API keys and tokens from anything written to disk. */
export function redactSecrets(text: string): string {
  return text
    .replace(
      /((?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?)([^\s"',;}\]]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/(--(?:api-key|token|secret|password)\s+)([^\s]+)/gi, '$1[REDACTED]');
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactValue(item)])
    );
  }
  return value;
}

/**
 * Deterministic scheduler engine. No timers per job: a single tick compares
 * `now` against each job's persisted `next_run_at`. All I/O boundaries (clock,
 * state, lock, timers, executor) are injected so F2 can be tested without
 * waiting for real cron times or spawning Python.
 */
export class Scheduler {
  private readonly config: SchedulerConfig;
  private readonly jobs: JobDef[];
  private readonly useCases: Record<string, UseCaseRegistryEntry>;
  private readonly executeJob: (ctx: JobExecutionContext) => Promise<JobExecutionResult>;
  private readonly preflight?: (ctx: JobExecutionContext) => Promise<PreflightResult>;
  private readonly now: () => Date;
  private readonly stateStore: RuntimeStateStore;
  private readonly lock: ProcessLock;
  private readonly tickMs: number;
  private readonly retryBackoffMs: number[];
  private readonly onEvent: (event: SchedulerEvent) => void;
  private readonly setTimeoutFn: TimerFn;
  private readonly clearTimeoutFn: ClearTimerFn;
  private readonly logDir: string;
  private readonly auditPath: string;

  private state: SchedulerStateFile = emptyState();
  private readonly runningJobs = new Set<string>();
  private readonly activeRuns = new Map<string, Promise<void>>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly cancelReasons = new Map<string, 'manual' | 'shutdown'>();
  private readonly listeners = new Set<(event: SchedulerEvent) => void>();
  private timer: unknown = null;
  private running = false;
  private started = false;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(options: SchedulerOptions) {
    this.config = options.config;
    this.jobs = options.jobs;
    this.useCases = options.useCases;
    this.executeJob = options.executeJob;
    this.preflight = options.preflight;
    this.now = options.now ?? (() => new Date());
    this.stateStore = options.stateStore ?? createFileRuntimeStateStore(
      path.join(options.rootDir, '.wiki-forge', 'scheduler-state.json')
    );
    this.lock = options.lock ?? createPidLock(
      path.join(options.rootDir, '.wiki-forge', 'scheduler.lock'),
      { now: this.now }
    );
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.onEvent = options.onEvent ?? (() => undefined);
    this.setTimeoutFn =
      options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn =
      options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));
    this.logDir = path.resolve(options.rootDir, this.config.logDir);
    this.auditPath = path.join(this.logDir, 'audit.jsonl');
  }

  /**
   * Subscribe to live scheduler events (SSE endpoint in F3). Returns an
   * unsubscribe function; listeners are called synchronously on emit.
   */
  subscribe(listener: (event: SchedulerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Snapshot consumed by the F3 REST API and the F4 UI cards. */
  getStatus(): SchedulerSnapshot {
    return {
      enabled: this.config.enabled,
      running: this.running,
      lockHeld: this.lock.isHeld(),
      activeJobs: [...this.runningJobs],
      jobs: this.jobs.map((job) => ({
        job,
        state: this.state.jobs[job.id] ?? this.defaultState(job),
        description: describeSchedule(job.schedule),
      })),
    };
  }

  /**
   * Acquire the PID lock, load persisted state, repair interrupted runs and
   * start the single tick timer. When `enabled = false` state is still loaded
   * (so the UI can show last results) but no timer and no lock are used.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.state = await this.stateStore.load();
    this.applyOverrides();
    // Pin the first slot once at startup. Without this, a job with no persisted
    // state would recompute `next_run_at` from the current time on every tick
    // and never become due (a sliding window).
    for (const job of this.jobs) {
      if (!this.state.jobs[job.id]) this.state.jobs[job.id] = this.defaultState(job);
    }
    const recoveredRuns = this.recoverInterruptedRuns();
    await this.persist();
    this.emit({ type: 'state_loaded', at: this.now().toISOString(), recoveredRuns });

    if (!this.config.enabled) return;

    await this.lock.acquire();
    this.emit({ type: 'lock_acquired', at: this.now().toISOString() });
    this.running = true;
    this.scheduleNextTick();
  }

  /**
   * Stop the loop and release the lock. With `cancelActive`, in-flight jobs are
   * aborted; otherwise the method waits for them to finish (bounded by their
   * own timeout) before returning.
   */
  async stop(options: { cancelActive?: boolean } = {}): Promise<void> {
    if (!this.running && !this.started) return;
    this.running = false;

    if (this.timer !== null) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }

    if (options.cancelActive) {
      for (const [jobId, controller] of this.controllers) {
        this.cancelReasons.set(jobId, 'shutdown');
        controller.abort(new Error('scheduler shutdown'));
      }
    }

    await Promise.allSettled([...this.activeRuns.values()]);
    this.activeRuns.clear();
    if (this.lock.isHeld()) await this.lock.release();
    this.emit({ type: 'stopped', at: this.now().toISOString() });
  }

  /**
   * One scheduler cycle. Public so tests can drive it with an injected clock,
   * and so F3 can offer a manual "tick" without waiting for the timer.
   */
  async tick(): Promise<void> {
    const at = this.now();
    this.emit({ type: 'tick', at: at.toISOString() });
    if (!this.running) return;

    let hasSkips = false;
    const started: Promise<void>[] = [];

    for (const job of this.jobs) {
      if (!job.enabled) continue;

      if (this.runningJobs.has(job.id)) {
        // Single-flight: never launch a second copy of the same job. The run
        // that is in flight will compute the next regular slot on completion.
        const skippedAt = this.now().toISOString();
        this.updateState(job.id, (state) => ({
          ...state,
          last_status: 'skipped',
          next_run_at: nextRunAt(job.schedule, this.now()).toISOString(),
        }));
        this.emit({
          type: 'job_finished',
          jobId: job.id,
          status: 'skipped',
          at: skippedAt,
          durationMs: 0,
        });
        hasSkips = true;
        continue;
      }

      if (this.runningJobs.size >= this.config.maxConcurrency) continue;

      const state = this.state.jobs[job.id] ?? this.defaultState(job);
      if (at.getTime() < Date.parse(state.next_run_at)) continue;

      // `runJob` registers the job in `runningJobs` synchronously, before its
      // first await, so the concurrency cap is enforced across this loop.
      started.push(this.runJob(job, (state.retry_count ?? 0) + 1, 'cron'));
    }

    await Promise.all(started);
    if (hasSkips) await this.persist();
  }

  /** Run a job immediately: F3 manual run or F6 debounced event trigger. */
  async runJobNow(
    jobId: string,
    trigger: JobTrigger = 'manual',
    event?: TriggerEvent
  ): Promise<void> {
    const job = this.jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown scheduler job '${jobId}'`);
    if (this.runningJobs.has(jobId)) {
      throw new Error(`Job '${jobId}' is already running`);
    }
    this.updateState(job.id, (state) => ({ ...state, retry_count: 0 }));
    await this.runJob(job, 1, trigger, event);
  }

  /** F6: expose the active job set so the event bus can avoid overlapping runs. */
  public isRunning(jobId: string): boolean {
    return this.runningJobs.has(jobId);
  }

  /** F6: audit a mutating step executed after explicit human approval. */
  public async recordApprovalRun(entry: AuditEntry): Promise<void> {
    await this.appendAudit({ ...entry, actor: 'human' });
  }

  /** `PATCH /api/ke/schedule/:id` — enable/disable a job at runtime. */
  async setJobEnabled(jobId: string, enabled: boolean): Promise<void> {
    const job = this.jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown scheduler job '${jobId}'`);
    job.enabled = enabled;
    this.state.overrides = { ...(this.state.overrides ?? {}), [jobId]: {
      ...(this.state.overrides?.[jobId] ?? {}),
      enabled,
    } };
    await this.persist();
  }

  /** `PATCH /api/ke/schedule/:id` — change a job's cron/interval at runtime. */
  async setJobSchedule(jobId: string, expression: string): Promise<void> {
    const job = this.jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown scheduler job '${jobId}'`);
    const schedule = parseSchedule(expression, this.config.timezone);
    job.schedule = schedule;
    this.updateState(job.id, (state) => ({
      ...state,
      next_run_at: nextRunAt(schedule, this.now()).toISOString(),
      retry_count: 0,
    }));
    this.state.overrides = { ...(this.state.overrides ?? {}), [jobId]: {
      ...(this.state.overrides?.[jobId] ?? {}),
      schedule: expression,
    } };
    await this.persist();
  }

  /** `POST /api/ke/schedule/:id/cancel` — abort the active run, if any. */
  cancelJob(jobId: string): boolean {
    const controller = this.controllers.get(jobId);
    if (!controller) return false;
    this.cancelReasons.set(jobId, 'manual');
    controller.abort(new Error('cancelled by user'));
    return true;
  }

  // ---------------------------------------------------------------- private

  private scheduleNextTick(): void {
    if (!this.running) return;
    this.timer = this.setTimeoutFn(() => {
      void this.tick().finally(() => this.scheduleNextTick());
    }, this.tickMs);
  }

  /** Reapply UI toggles persisted by F3 without modifying agent_schedule.toml. */
  private applyOverrides(): void {
    for (const job of this.jobs) {
      const override = this.state.overrides?.[job.id];
      if (!override) continue;
      if (typeof override.enabled === 'boolean') job.enabled = override.enabled;
      if (typeof override.schedule === 'string') {
        try {
          job.schedule = parseSchedule(override.schedule, this.config.timezone);
          const state = this.state.jobs[job.id];
          if (state) {
            state.next_run_at = nextRunAt(job.schedule, this.now()).toISOString();
          }
        } catch {
          // A corrupt override must not prevent startup; keep the TOML cron.
        }
      }
    }
  }

  private defaultState(job: JobDef): JobRuntimeState {
    return {
      last_status: 'scheduled',
      next_run_at: nextRunAt(job.schedule, this.now()).toISOString(),
      consecutive_failures: 0,
      retry_count: 0,
    };
  }

  private updateState(jobId: string, update: (state: JobRuntimeState) => JobRuntimeState): void {
    const current = this.state.jobs[jobId] ?? {
      last_status: 'scheduled' as JobStatus,
      next_run_at: this.now().toISOString(),
      consecutive_failures: 0,
      retry_count: 0,
    };
    this.state.jobs[jobId] = update(current);
  }

  /** Runs after a restart: a `running` state means the previous process died. */
  private recoverInterruptedRuns(): string[] {
    const recovered: string[] = [];
    for (const job of this.jobs) {
      const state = this.state.jobs[job.id];
      if (!state || state.last_status !== 'running') continue;
      this.updateState(job.id, (current) => ({
        ...current,
        last_status: 'failed',
        last_error: 'interrupted by scheduler restart',
        consecutive_failures: current.consecutive_failures + 1,
        retry_count: Math.min(current.retry_count + 1, job.maxRetries),
        // Due immediately: the restart catch-up reruns the interrupted job.
        next_run_at: this.now().toISOString(),
      }));
      recovered.push(job.id);
    }
    return recovered;
  }

  private persist(): Promise<void> {
    this.persistChain = this.persistChain.then(() => this.stateStore.save(this.state));
    return this.persistChain;
  }

  private emit(event: SchedulerEvent): void {
    this.onEvent(event);
    for (const listener of this.listeners) listener(event);
  }

  private async runJob(
    job: JobDef,
    attempt: number,
    trigger: JobTrigger = 'cron',
    event?: TriggerEvent
  ): Promise<void> {
    const useCase = this.useCases[job.useCaseId];
    if (!useCase) return; // Validated at config load; defensive for hand-built jobs.

    const startedAt = this.now();
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    this.runningJobs.add(job.id);
    this.updateState(job.id, (state) => ({
      ...state,
      last_status: 'running',
      last_run_at: startedAt.toISOString(),
      retry_count: attempt - 1,
      last_error: undefined,
    }));
    await this.persist();
    this.emit({
      type: 'job_started',
      jobId: job.id,
      attempt,
      at: startedAt.toISOString(),
    });

    const chunks: string[] = [];
    let timeoutHandle: unknown = null;
    if (this.config.defaultTimeoutSeconds > 0) {
      timeoutHandle = this.setTimeoutFn(() => {
        controller.abort(new Error('job timeout'));
      }, this.config.defaultTimeoutSeconds * 1_000);
    }

    const run = (async (): Promise<void> => {
      let status: JobStatus = 'success';
      let error: string | undefined;
      let result: JobExecutionResult = { failedSteps: [], exitCodes: [] };

      try {
        const ctx: JobExecutionContext = {
          job,
          useCase,
          attempt,
          trigger,
          event,
          signal: controller.signal,
          onOutput: (chunk) => {
            chunks.push(chunk);
            this.emit({ type: 'job_output', jobId: job.id, text: chunk });
          },
          onRunnerEvent: (runnerEvent) => {
            this.emit({ type: 'use_case_event', jobId: job.id, event: runnerEvent });
          },
          notify: (schedulerEvent) => this.emit(schedulerEvent),
        };
        let steps = job.steps;
        if (this.preflight) {
          const decision = await this.preflight(ctx);
          if (!decision.run) {
            status = 'skipped';
            error = decision.reason ?? 'skipped by policy';
            chunks.push(`[policy] ${error}\n`);
            this.emit({
              type: 'job_skipped',
              jobId: job.id,
              reason: error,
              at: this.now().toISOString(),
            });
          } else if (Array.isArray(decision.steps) && decision.steps.length > 0) {
            steps = decision.steps;
          }
        }
        if (status === 'success') {
          result = await this.executeJob({ ...ctx, steps });
          if (controller.signal.aborted) {
            status = 'cancelled';
            error = 'aborted (timeout, cancel or shutdown)';
          } else if (result.failedSteps.length > 0) {
            status = 'failed';
            error = `failed steps: ${result.failedSteps.join(', ')}`;
          }
        }
      } catch (err) {
        status = 'failed';
        error = err instanceof Error ? err.message : String(err);
      } finally {
        if (timeoutHandle !== null) this.clearTimeoutFn(timeoutHandle);
        this.controllers.delete(job.id);
        this.runningJobs.delete(job.id);
      }

      const endedAt = this.now();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      const succeeded = status === 'success';
      const cancelReason = this.cancelReasons.get(job.id);
      this.cancelReasons.delete(job.id);
      // A manual cancellation goes back to the regular cron slot; a shutdown
      // cancellation is retried immediately when the process comes back.
      const canRetry =
        !succeeded && status !== 'cancelled' && attempt <= job.maxRetries;
      const backoff =
        this.retryBackoffMs[attempt - 1] ??
        this.retryBackoffMs[this.retryBackoffMs.length - 1] ??
        0;
      const nextRun = canRetry
        ? new Date(endedAt.getTime() + backoff)
        : status === 'cancelled' && cancelReason === 'shutdown'
          ? endedAt
          : nextRunAt(job.schedule, endedAt);

      this.updateState(job.id, (state) => ({
        ...state,
        last_status: status,
        last_run_at: startedAt.toISOString(),
        last_duration_ms: durationMs,
        last_error: error,
        consecutive_failures: succeeded ? 0 : state.consecutive_failures + 1,
        retry_count: succeeded || !canRetry ? 0 : attempt,
        next_run_at: nextRun.toISOString(),
      }));
      await this.persist();

      const logFile = await this.writeRunLog(job.id, startedAt, chunks);
      this.updateState(job.id, (state) => ({ ...state, last_log: logFile }));
      await this.persist();

      await this.appendAudit({
        job: job.id,
        useCase: job.useCaseId,
        attempt,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        status,
        exitCodes: result.exitCodes,
        failedSteps: result.failedSteps,
        error,
        logFile,
        actor: 'scheduler',
        trigger,
        triggerEvent: event,
      });

      if (canRetry) {
        this.emit({
          type: 'job_retry',
          jobId: job.id,
          attempt,
          nextRunAt: nextRun.toISOString(),
          reason: error ?? 'unknown failure',
        });
      }
      this.emit({
        type: 'job_finished',
        jobId: job.id,
        status,
        at: endedAt.toISOString(),
        durationMs,
      });
    })();

    this.activeRuns.set(job.id, run);
    try {
      await run;
    } finally {
      if (this.activeRuns.get(job.id) === run) this.activeRuns.delete(job.id);
    }
  }

  private async writeRunLog(jobId: string, startedAt: Date, chunks: string[]): Promise<string> {
    await fs.mkdir(this.logDir, { recursive: true });
    const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
    const file = path.join(this.logDir, `${jobId}-${stamp}.log`);
    await fs.writeFile(file, chunks.map(redactSecrets).join(''), 'utf-8');
    return file;
  }

  private async appendAudit(entry: AuditEntry): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
    const safe = redactValue(entry) as AuditEntry;
    await fs.appendFile(this.auditPath, `${JSON.stringify(safe)}\n`, 'utf-8');
  }
}
