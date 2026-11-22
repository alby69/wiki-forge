import type { JobDef } from './jobStore';
import type { SchedulerEvent, TriggerEvent } from './scheduler';
import { EventQueue, type QueuedEventRecord } from './eventQueue';

/**
 * F6 — debounced event triggers, with A2 persistent queue and dedupe.
 *
 * Events come from the webhook endpoint or from the in-app note write hooks.
 * Several notes changed in rapid succession collapse into a single run per
 * job: the timer is a sliding quiet period (default 5 minutes) and events for
 * the same path are deduplicated. Since A2 the buckets are mirrored to
 * `.wiki-forge/event-queue.jsonl` and re-armed on construction, so an event
 * queued before a restart is still consumed afterwards and a duplicate can
 * never start a second run.
 */

export interface PendingEventTrigger {
  jobId: string;
  project: string;
  events: TriggerEvent[];
  fireAt: string;
}

export interface EventTriggerOptions {
  jobs: JobDef[];
  onTrigger: (jobId: string, event: TriggerEvent, events: TriggerEvent[]) => Promise<void> | void;
  onEvent?: (event: SchedulerEvent) => void;
  now?: () => Date;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  /** A2: when supplied, pending buckets survive a restart. */
  queue?: EventQueue;
}

interface PendingBucket {
  job: JobDef;
  events: TriggerEvent[];
  handle: unknown;
  fireAt: string;
  queueIds: string[];
}

export const SUPPORTED_TRIGGER_EVENTS = [
  'note.created',
  'note.modified',
  'note.deleted',
] as const;

export function isSupportedTriggerEvent(value: unknown): value is TriggerEvent['type'] {
  return typeof value === 'string' && (SUPPORTED_TRIGGER_EVENTS as readonly string[]).includes(value);
}

export class EventTriggerBus {
  private readonly jobs: JobDef[];
  private readonly onTrigger: EventTriggerOptions['onTrigger'];
  private readonly onEvent?: (event: SchedulerEvent) => void;
  private readonly now: () => Date;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => unknown;
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly queue?: EventQueue;
  private readonly pending = new Map<string, PendingBucket>();

  constructor(options: EventTriggerOptions) {
    this.jobs = options.jobs;
    this.onTrigger = options.onTrigger;
    this.onEvent = options.onEvent;
    this.now = options.now ?? (() => new Date());
    this.setTimeoutFn = options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));
    this.queue = options.queue;
    if (this.queue) this.restore();
  }

  /** Queue an event for every job subscribed to its type/project. */
  public publish(event: TriggerEvent): string[] {
    const at = event.at ?? this.now().toISOString();
    const normalised: TriggerEvent = { ...event, at };
    const queued: string[] = [];

    for (const job of this.jobs) {
      if (!job.enabled || job.eventTrigger !== normalised.type) continue;
      if (job.project !== '*' && job.project !== normalised.project) continue;

      const key = `${job.id}|${normalised.project}`;
      const existing = this.pending.get(key);
      const events = existing ? existing.events : [];
      const queueIds = existing ? [...existing.queueIds] : [];
      let added = false;
      if (!events.some((item) => item.path && item.path === normalised.path)) {
        events.push(normalised);
        added = true;
      }
      if (existing) this.clearTimeoutFn(existing.handle);

      const fireAt = new Date(this.now().getTime() + job.debounceSeconds * 1_000).toISOString();
      if (this.queue) {
        if (added) {
          const record = this.queue.enqueue({
            jobId: job.id,
            project: normalised.project,
            event: normalised,
            fireAt,
          });
          queueIds.push(record.id);
        }
        // A duplicate restarts the quiet period for the whole persisted bucket.
        this.queue.reschedule(job.id, normalised.project, fireAt);
      }

      const handle = this.setTimeoutFn(() => {
        this.fire(key, job, normalised, events, queueIds);
      }, job.debounceSeconds * 1_000);

      this.pending.set(key, { job, events, handle, fireAt, queueIds });
      queued.push(job.id);
      this.onEvent?.({ type: 'event_queued', jobId: job.id, event: normalised, fireAt });
    }
    return queued;
  }

  public getPending(): PendingEventTrigger[] {
    return [...this.pending.entries()].map(([key, bucket]) => ({
      jobId: bucket.job.id,
      project: key.split('|').slice(1).join('|'),
      events: [...bucket.events],
      fireAt: bucket.fireAt,
    }));
  }

  /** S3: drop pending debounce buckets for a job removed by the schedule API. */
  public cancelJob(jobId: string): void {
    for (const [key, bucket] of [...this.pending.entries()]) {
      if (bucket.job.id !== jobId) continue;
      this.clearTimeoutFn(bucket.handle);
      this.queue?.markConsumed(bucket.queueIds);
      this.pending.delete(key);
    }
  }

  /** Cancel all quiet-period timers (used on scheduler shutdown).
   *  Persisted records are intentionally left pending: the next bus restores them. */
  public stop(): void {
    for (const bucket of this.pending.values()) this.clearTimeoutFn(bucket.handle);
    this.pending.clear();
  }

  /** Fire one bucket exactly once and close its records in the durable queue. */
  private fire(
    key: string,
    job: JobDef,
    event: TriggerEvent,
    events: TriggerEvent[],
    queueIds: string[],
  ): void {
    this.pending.delete(key);
    this.queue?.markConsumed(queueIds);
    void Promise.resolve(this.onTrigger(job.id, event, events)).catch((err) => {
      this.onEvent?.({
        type: 'job_skipped',
        jobId: job.id,
        reason: `event trigger failed: ${err instanceof Error ? err.message : String(err)}`,
        at: this.now().toISOString(),
      });
    });
  }

  /** A2: re-arm buckets whose records were queued before a restart. */
  private restore(): void {
    if (!this.queue) return;
    const grouped = new Map<string, QueuedEventRecord[]>();
    for (const record of this.queue.loadPending()) {
      const job = this.jobs.find((candidate) => candidate.id === record.jobId);
      if (!job || !job.enabled || job.eventTrigger !== record.event.type) continue;
      if (job.project !== '*' && job.project !== record.project) continue;
      const key = `${job.id}|${record.project}`;
      const group = grouped.get(key);
      if (group) group.push(record);
      else grouped.set(key, [record]);
    }

    for (const [key, records] of grouped) {
      const job = this.jobs.find((candidate) => candidate.id === records[0].jobId);
      if (!job) continue;
      const events: TriggerEvent[] = [];
      for (const record of records) {
        if (!events.some((item) => item.path && item.path === record.event.path)) {
          events.push(record.event);
        }
      }
      const fireAt = records.reduce(
        (latest, record) => (record.fireAt > latest ? record.fireAt : latest),
        records[0].fireAt,
      );
      const delay = Math.max(0, new Date(fireAt).getTime() - this.now().getTime());
      const queueIds = records.map((record) => record.id);
      const handle = this.setTimeoutFn(() => {
        this.fire(key, job, events[events.length - 1], events, queueIds);
      }, delay);
      this.pending.set(key, { job, events, handle, fireAt, queueIds });
    }
  }
}
