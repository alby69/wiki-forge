import type { JobDef } from './jobStore';
import type { SchedulerEvent, TriggerEvent } from './scheduler';

/**
 * F6 — debounced event triggers.
 *
 * Events come from the webhook endpoint or from the in-app note-creation
 * watcher. Several notes created in rapid succession collapse into a single
 * run per job: the timer is a sliding quiet period (default 5 minutes) and
 * events for the same path are deduplicated.
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
}

interface PendingBucket {
  job: JobDef;
  events: TriggerEvent[];
  handle: unknown;
  fireAt: string;
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
  private readonly pending = new Map<string, PendingBucket>();

  constructor(options: EventTriggerOptions) {
    this.jobs = options.jobs;
    this.onTrigger = options.onTrigger;
    this.onEvent = options.onEvent;
    this.now = options.now ?? (() => new Date());
    this.setTimeoutFn = options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));
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
      if (!events.some((item) => item.path && item.path === normalised.path)) {
        events.push(normalised);
      }
      if (existing) this.clearTimeoutFn(existing.handle);

      const fireAt = new Date(this.now().getTime() + job.debounceSeconds * 1_000).toISOString();
      const handle = this.setTimeoutFn(() => {
        this.pending.delete(key);
        void Promise.resolve(this.onTrigger(job.id, normalised, events)).catch((err) => {
          this.onEvent?.({
            type: 'job_skipped',
            jobId: job.id,
            reason: `event trigger failed: ${err instanceof Error ? err.message : String(err)}`,
            at: this.now().toISOString(),
          });
        });
      }, job.debounceSeconds * 1_000);

      this.pending.set(key, { job, events, handle, fireAt });
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
      this.pending.delete(key);
    }
  }

  /** Cancel all quiet-period timers (used on scheduler shutdown). */
  public stop(): void {
    for (const bucket of this.pending.values()) this.clearTimeoutFn(bucket.handle);
    this.pending.clear();
  }
}
