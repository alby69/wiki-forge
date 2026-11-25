import type { ApprovalEvent, ApprovalOutbox, ApprovalOutboxFilter } from './outbox';
import { StateConflictError, type StateStore } from './types';

export interface ApprovalOutboxRelayOptions {
  store: StateStore;
  cursorKey?: string;
  filter?: ApprovalOutboxFilter | ((event: ApprovalEvent) => boolean);
  onError?: (error: unknown) => void;
}

export interface ApprovalOutboxRelay {
  readonly cursorKey: string;
  poll(): Promise<number>;
  run(): Promise<number>;
  consume(): Promise<number>;
  cursor(): Promise<number>;
  start(intervalMs?: number): void;
  stop(): void;
}

export function createApprovalOutboxRelay(
  outbox: ApprovalOutbox,
  handler: (event: ApprovalEvent) => void | Promise<void>,
  options: ApprovalOutboxRelayOptions,
): ApprovalOutboxRelay {
  const cursorKey = options.cursorKey ?? `${outbox.key}/cursor`;
  let timer: ReturnType<typeof setInterval> | undefined;
  let chain: Promise<unknown> = Promise.resolve();

  async function readCursor(): Promise<{ value: number; version?: number }> {
    const entry = await options.store.get<number>(cursorKey);
    const raw = entry?.value;
    const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    return { value, version: entry?.version };
  }

  async function writeCursor(value: number): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await readCursor();
      if (current.value >= value) return;
      try {
        await options.store.put(cursorKey, value, current.version);
        return;
      } catch (err) {
        if (!(err instanceof StateConflictError) || attempt === 2) throw err;
      }
    }
  }

  function matches(event: ApprovalEvent): boolean {
    if (!options.filter) return true;
    if (typeof options.filter === 'function') return options.filter(event);
    const filter: ApprovalOutboxFilter = options.filter;
    return (!filter.jobId || event.jobId === filter.jobId)
      && (!filter.type || event.type === filter.type);
  }

  async function pollOnce(): Promise<number> {
    const events = await outbox.readAll();
    const { value } = await readCursor();
    let handled = 0;
    for (let index = value; index < events.length; index += 1) {
      const event = events[index];
      if (matches(event)) await handler(event);
      await writeCursor(index + 1);
      handled += 1;
    }
    return handled;
  }

  function poll(): Promise<number> {
    const next = chain.then(() => pollOnce());
    chain = next.then(() => undefined, () => undefined);
    return next;
  }

  const fail = (error: unknown): void => { options.onError?.(error); };

  return {
    cursorKey,

    poll,
    run: poll,
    consume: poll,

    async cursor() {
      return (await readCursor()).value;
    },

    start(intervalMs = 500) {
      if (timer) return;
      timer = setInterval(() => { void poll().catch(fail); }, Math.max(25, intervalMs));
      timer.unref?.();
      void poll().catch(fail);
    },

    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
    },
  };
}
