import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StateEntry, StateStore } from './types';
import { StateConflictError, StateStoreError } from './types';

const STALE_LOCK_MS = 10_000;
const LOCK_WAIT_MS = 5_000;

function safeName(key: string): string {
  const digest = createHash('sha256').update(key).digest('hex').slice(0, 16);
  const prefix = key.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 64) || 'key';
  return `${prefix}__${digest}`;
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}

export function createFileSystemStateStore(rootDir: string): StateStore {
  const dataDir = path.join(rootDir, 'data');
  const eventsDir = path.join(rootDir, 'events');
  const lockDir = path.join(rootDir, '.locks');

  const ensureDirs = async (): Promise<void> => {
    await Promise.all([
      fs.mkdir(dataDir, { recursive: true }),
      fs.mkdir(eventsDir, { recursive: true }),
      fs.mkdir(lockDir, { recursive: true }),
    ]);
  };

  const withKeyLock = async <T>(key: string, task: () => Promise<T>): Promise<T> => {
    await ensureDirs();
    const lockPath = path.join(lockDir, `${safeName(key)}.lock`);
    const deadline = Date.now() + LOCK_WAIT_MS;
    let acquired = false;
    while (!acquired) {
      try {
        const handle = await fs.open(lockPath, 'wx');
        await handle.close();
        acquired = true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        const stat = await fs.stat(lockPath).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
          await fs.unlink(lockPath).catch(() => undefined);
        }
        if (Date.now() > deadline) {
          throw new StateStoreError(`Timed out waiting for state lock on '${key}'`);
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    try {
      return await task();
    } finally {
      await fs.unlink(lockPath).catch(() => undefined);
    }
  };

  const dataPath = (key: string): string => path.join(dataDir, `${safeName(key)}.json`);
  const eventsPath = (key: string): string => path.join(eventsDir, `${safeName(key)}.jsonl`);

  const readEntry = async <T>(key: string): Promise<StateEntry<T> | null> => {
    try {
      const text = await fs.readFile(dataPath(key), 'utf-8');
      const entry = JSON.parse(text) as StateEntry<T>;
      if (!entry || typeof entry.version !== 'number' || typeof entry.updatedAt !== 'string') {
        throw new StateStoreError(`Corrupt state entry for '${key}'`);
      }
      return entry;
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  };

  return {
    name: 'file',

    async get<T>(key: string): Promise<StateEntry<T> | null> {
      return readEntry<T>(key);
    },

    async put<T>(key: string, value: T, expectedVersion?: number): Promise<StateEntry<T>> {
      return withKeyLock(key, async () => {
        const current = await readEntry(key);
        const actualVersion = current?.version ?? 0;
        if (expectedVersion !== undefined && expectedVersion !== actualVersion) {
          throw new StateConflictError(key, expectedVersion, actualVersion);
        }
        const entry: StateEntry<T> = {
          value,
          version: actualVersion + 1,
          updatedAt: new Date().toISOString(),
        };
        const file = dataPath(key);
        const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
        await fs.writeFile(temp, JSON.stringify(entry), 'utf-8');
        await fs.rename(temp, file);
        return entry;
      });
    },

    async remove(key: string, expectedVersion?: number): Promise<boolean> {
      return withKeyLock(key, async () => {
        const current = await readEntry(key);
        if (!current) return false;
        if (expectedVersion !== undefined && expectedVersion !== current.version) {
          throw new StateConflictError(key, expectedVersion, current.version);
        }
        await fs.unlink(dataPath(key));
        return true;
      });
    },

    async append<T>(key: string, event: T): Promise<void> {
      await ensureDirs();
      await fs.appendFile(eventsPath(key), `${JSON.stringify(event)}\n`, 'utf-8');
    },

    async readAll<T>(key: string): Promise<T[]> {
      await ensureDirs();
      try {
        const text = await fs.readFile(eventsPath(key), 'utf-8');
        return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
      } catch (err) {
        if (isMissing(err)) return [];
        throw err;
      }
    },
  };
}
