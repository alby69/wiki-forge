import type { RuntimeStateStore, SchedulerStateFile } from '../scheduler/runtimeState';
import { emptyState } from '../scheduler/runtimeState';
import type { StateStore } from './types';

export const DEFAULT_RUNTIME_STATE_KEY = 'scheduler/runtime-state';

export function createStateRuntimeStore(
  store: StateStore,
  key: string = DEFAULT_RUNTIME_STATE_KEY,
): RuntimeStateStore {
  return {
    async load() {
      const entry = await store.get<SchedulerStateFile>(key);
      const value = entry?.value;
      if (!value || value.version !== 1 || typeof value.jobs !== 'object' || value.jobs === null) {
        return emptyState();
      }
      return { ...value, jobs: { ...value.jobs }, overrides: { ...(value.overrides ?? {}) } };
    },
    async save(state) {
      await store.put(key, state);
    },
  };
}
