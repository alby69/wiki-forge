import type { StateEntry, StateStore } from './types';
import { StateConflictError } from './types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createMemoryStateStore(): StateStore {
  const values = new Map<string, StateEntry>();
  const events = new Map<string, unknown[]>();

  return {
    name: 'memory',

    async get<T>(key: string): Promise<StateEntry<T> | null> {
      const entry = values.get(key);
      return entry ? clone(entry) as StateEntry<T> : null;
    },

    async put<T>(key: string, value: T, expectedVersion?: number): Promise<StateEntry<T>> {
      const current = values.get(key);
      const actualVersion = current?.version ?? 0;
      if (expectedVersion !== undefined && expectedVersion !== actualVersion) {
        throw new StateConflictError(key, expectedVersion, actualVersion);
      }
      const entry: StateEntry<T> = {
        value: clone(value),
        version: actualVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      values.set(key, entry);
      return clone(entry);
    },

    async remove(key: string, expectedVersion?: number): Promise<boolean> {
      const current = values.get(key);
      if (!current) return false;
      if (expectedVersion !== undefined && expectedVersion !== current.version) {
        throw new StateConflictError(key, expectedVersion, current.version);
      }
      values.delete(key);
      return true;
    },

    async append<T>(key: string, event: T): Promise<void> {
      const list = events.get(key) ?? [];
      list.push(clone(event));
      events.set(key, list);
    },

    async readAll<T>(key: string): Promise<T[]> {
      return clone(events.get(key) ?? []) as T[];
    },
  };
}
