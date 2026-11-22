import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TriggerEvent } from './scheduler';

/**
 * A2 — persistent backing store for F6 event triggers.
 *
 * The debounce buckets used to live only in `EventTriggerBus`, so a restart
 * dropped every queued event. This store keeps one JSON line per queued event
 * under `<root>/.wiki-forge/event-queue.jsonl`. Lines are appended on publish,
 * rewritten with `state: 'consumed'` when the bucket fires, and reloaded on
 * construction. It is deliberately synchronous: `publish()` is a synchronous
 * observer hook called from many write paths, and each record is tiny.
 *
 * Nothing here executes a job: the store only records what is pending and what
 * was already consumed, exactly like `ApprovalStore` does for human decisions.
 */

export type QueuedEventState = 'pending' | 'consumed';

export interface QueuedEventRecord {
  id: string;
  jobId: string;
  project: string;
  event: TriggerEvent;
  enqueuedAt: string;
  fireAt: string;
  state: QueuedEventState;
}

export type NewQueuedEvent = Omit<QueuedEventRecord, 'id' | 'enqueuedAt' | 'state'>;

export interface EventQueueOptions {
  filePath: string;
  now?: () => Date;
}

export class EventQueue {
  private readonly filePath: string;
  private readonly now: () => Date;

  constructor(options: EventQueueOptions) {
    this.filePath = options.filePath;
    this.now = options.now ?? (() => new Date());
  }

  /** Append one pending record. Corrupt or missing files never break a write. */
  public enqueue(input: NewQueuedEvent): QueuedEventRecord {
    const enqueuedAt = this.now().toISOString();
    const record: QueuedEventRecord = {
      ...input,
      id: `evt-${enqueuedAt}-${Math.random().toString(36).slice(2, 8)}`,
      enqueuedAt,
      state: 'pending',
    };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, 'utf-8');
    return record;
  }

  /** Pending records to re-arm on startup; consumed ones stay on disk as audit. */
  public loadPending(): QueuedEventRecord[] {
    return this.readAll().filter((record) => record.state === 'pending');
  }

  /** A duplicate publish restarts the quiet period for the whole bucket. */
  public reschedule(jobId: string, project: string, fireAt: string): void {
    const records = this.readAll();
    let changed = false;
    for (const record of records) {
      if (record.state === 'pending' && record.jobId === jobId && record.project === project) {
        record.fireAt = fireAt;
        changed = true;
      }
    }
    if (changed) this.writeAll(records);
  }

  /** Mark the records of a fired bucket so a later restart cannot replay them. */
  public markConsumed(ids: string[]): void {
    if (ids.length === 0) return;
    const consumed = new Set(ids);
    const records = this.readAll();
    let changed = false;
    for (const record of records) {
      if (consumed.has(record.id) && record.state === 'pending') {
        record.state = 'consumed';
        changed = true;
      }
    }
    if (changed) this.writeAll(records);
  }

  private readAll(): QueuedEventRecord[] {
    let text: string;
    try {
      text = fs.readFileSync(this.filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      return [];
    }
    const records: QueuedEventRecord[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as QueuedEventRecord;
        if (parsed && typeof parsed.id === 'string' && parsed.event && parsed.state) {
          records.push(parsed);
        }
      } catch {
        // Skip a torn line: the remaining records are still valid.
      }
    }
    return records;
  }

  private writeAll(records: QueuedEventRecord[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.tmp`;
    const body = records.map((record) => JSON.stringify(record)).join('\n');
    fs.writeFileSync(temp, body ? `${body}\n` : '', 'utf-8');
    fs.renameSync(temp, this.filePath);
  }
}
