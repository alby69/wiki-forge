import * as os from 'node:os';
import { LockHeldError, type LockInfo, type ProcessLock } from '../scheduler/lock';
import type { StateStore } from './types';
import { StateConflictError } from './types';

export const DEFAULT_LEASE_MS = 30_000;

export interface StateLease {
  owner: string;
  pid: number;
  hostname: string;
  token: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface StateLockOptions {
  key?: string;
  owner?: string;
  pid?: number;
  hostname?: string;
  leaseMs?: number;
  now?: () => Date;
  retryMs?: number;
}

export interface StateLock extends ProcessLock {
  lease(): Promise<StateLease | null>;
  renew(): Promise<boolean>;
}

function isExpired(lease: StateLease, now: Date): boolean {
  const expiresAt = Date.parse(lease.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

function toLockInfo(lease: StateLease): LockInfo {
  return { pid: lease.pid, hostname: lease.hostname, acquiredAt: lease.acquiredAt };
}

export function createStateLock(store: StateStore, options: StateLockOptions = {}): StateLock {
  const key = options.key ?? 'locks/scheduler';
  const owner = options.owner ?? `worker:${process.pid}`;
  const pid = options.pid ?? process.pid;
  const hostname = options.hostname ?? os.hostname();
  const leaseMs = Math.max(100, options.leaseMs ?? DEFAULT_LEASE_MS);
  const now = options.now ?? (() => new Date());
  const retryMs = Math.max(1, options.retryMs ?? 50);
  let held = false;
  let token = '';

  const readLease = async (): Promise<StateLease | null> => {
    const entry = await store.get<StateLease>(key);
    return entry?.value ?? null;
  };

  return {
    filePath: key,
    isHeld: () => held,

    async lease() {
      return readLease();
    },

    async read() {
      const lease = await readLease();
      return lease ? toLockInfo(lease) : null;
    },

    async acquire() {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const entry = await store.get<StateLease>(key);
        const current = entry?.value ?? null;
        const at = now();
        if (current && !isExpired(current, at) && current.token !== token) {
          throw new LockHeldError(toLockInfo(current));
        }
        token = `${owner}-${at.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
        const lease: StateLease = {
          owner,
          pid,
          hostname,
          token,
          acquiredAt: at.toISOString(),
          expiresAt: new Date(at.getTime() + leaseMs).toISOString(),
        };
        try {
          await store.put(key, lease, entry?.version ?? 0);
          held = true;
          return toLockInfo(lease);
        } catch (err) {
          if (!(err instanceof StateConflictError)) throw err;
          if (attempt === 4) throw new LockHeldError(toLockInfo(current ?? lease));
          await new Promise((resolve) => setTimeout(resolve, retryMs));
        }
      }
      throw new LockHeldError({ pid, hostname, acquiredAt: now().toISOString() });
    },

    async renew() {
      if (!held || !token) return false;
      const entry = await store.get<StateLease>(key);
      if (!entry || entry.value.token !== token) {
        held = false;
        return false;
      }
      const expiresAt = new Date(now().getTime() + leaseMs).toISOString();
      try {
        await store.put(key, { ...entry.value, expiresAt }, entry.version);
        return true;
      } catch (err) {
        if (!(err instanceof StateConflictError)) throw err;
        held = false;
        return false;
      }
    },

    async release() {
      if (!held || !token) return;
      const entry = await store.get<StateLease>(key);
      if (entry && entry.value.token === token) {
        await store.remove(key, entry.version);
      }
      held = false;
      token = '';
    },
  };
}

export interface AcquireRetryOptions {
  timeoutMs?: number;
  retryMs?: number;
}

export async function acquireWithRetry(
  lock: ProcessLock,
  options: AcquireRetryOptions = {},
): Promise<LockInfo> {
  const timeoutMs = Math.max(1, options.timeoutMs ?? 5_000);
  const retryMs = Math.max(1, options.retryMs ?? 50);
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() <= deadline) {
    try {
      return await lock.acquire();
    } catch (err) {
      if (!(err instanceof LockHeldError)) throw err;
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }
  throw lastError ?? new LockHeldError({ pid: 0, hostname: 'unknown', acquiredAt: '' });
}

export interface WithLockOptions extends StateLockOptions, AcquireRetryOptions {}

export async function withLock<T>(
  store: StateStore,
  key: string,
  task: () => Promise<T>,
  options: WithLockOptions = {},
): Promise<T> {
  const lock = createStateLock(store, { ...options, key });
  await acquireWithRetry(lock, options);
  const heartbeatMs = Math.max(25, Math.floor(Math.max(100, options.leaseMs ?? DEFAULT_LEASE_MS) / 3));
  const heartbeat = setInterval(() => {
    void lock.renew().catch(() => undefined);
  }, heartbeatMs);
  heartbeat.unref?.();
  try {
    return await task();
  } finally {
    clearInterval(heartbeat);
    await lock.release();
  }
}
