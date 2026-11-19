import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Runtime status of a scheduled job. Persisted to
 * `.wiki-forge/scheduler-state.json` so a restart can resume instead of
 * forgetting when a job last ran or that it was interrupted mid-flight.
 */
export type JobStatus =
  | 'idle'
  | 'scheduled'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface JobRuntimeState {
  last_run_at?: string;
  last_status: JobStatus;
  last_duration_ms?: number;
  next_run_at: string;
  consecutive_failures: number;
  /** Number of retries already consumed for the current run (0 = first attempt). */
  retry_count: number;
  last_error?: string;
  last_log?: string;
}

/**
 * Runtime-only overrides applied by `PATCH /api/ke/schedule/:id`. TOML stays
 * the source of truth; overrides are persisted here so a UI toggle survives a
 * restart without rewriting (and reformatting) the versioned config file.
 */
export interface JobOverride {
  enabled?: boolean;
  schedule?: string;
}

export interface SchedulerStateFile {
  version: 1;
  jobs: Record<string, JobRuntimeState>;
  overrides?: Record<string, JobOverride>;
}

export interface RuntimeStateStore {
  load(): Promise<SchedulerStateFile>;
  save(state: SchedulerStateFile): Promise<void>;
}

export function emptyState(): SchedulerStateFile {
  return { version: 1, jobs: {}, overrides: {} };
}

/**
 * File-backed state store. Writes are atomic (write temp + rename) so a crash
 * in the middle of a save never leaves a half-written JSON file. A missing or
 * corrupt file is treated as a fresh state: the configuration is the source of
 * truth for which jobs exist, and bad state must never block startup.
 */
export function createFileRuntimeStateStore(statePath: string): RuntimeStateStore {
  return {
    async load() {
      try {
        const text = await fs.readFile(statePath, 'utf-8');
        const parsed = JSON.parse(text) as Partial<SchedulerStateFile>;
        if (
          !parsed ||
          parsed.version !== 1 ||
          typeof parsed.jobs !== 'object' ||
          parsed.jobs === null ||
          Array.isArray(parsed.jobs)
        ) {
          return emptyState();
        }
        return {
          version: 1,
          jobs: parsed.jobs as Record<string, JobRuntimeState>,
          overrides: parsed.overrides ?? {},
        };
      } catch {
        // Missing or corrupt state is rebuilt from config. Startup must never
        // fail because a local cache file is unreadable.
        return emptyState();
      }
    },
    async save(state) {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      const tmp = `${statePath}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
      await fs.rename(tmp, statePath);
    },
  };
}

/** In-memory store used by tests and by the API layer for ephemeral runs. */
export function createMemoryRuntimeStateStore(
  initial: SchedulerStateFile = emptyState()
): RuntimeStateStore {
  let current = initial;
  return {
    async load() {
      return {
        version: 1,
        jobs: { ...current.jobs },
        overrides: { ...(current.overrides ?? {}) },
      };
    },
    async save(state) {
      current = {
        version: 1,
        jobs: { ...state.jobs },
        overrides: { ...(state.overrides ?? {}) },
      };
    },
  };
}
