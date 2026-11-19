import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as toml from 'smol-toml';
import { isValidTimezone, parseSchedule, ParsedSchedule } from './cron';

export interface SchedulerConfig {
  enabled: boolean;
  timezone: string;
  maxConcurrency: number;
  defaultTimeoutSeconds: number;
  logDir: string;
}

export interface UseCaseRegistryEntry {
  id: string;
  steps: unknown[];
  /** Optional human-readable title, used by scheduler logs and the F3 API. */
  title?: string;
}

export interface JobDef {
  id: string;
  role: string;
  useCaseId: string;
  schedule: ParsedSchedule;
  enabled: boolean;
  project: string;
  args: Record<string, unknown>;
  steps?: number[];
  autoApply: boolean;
  maxRetries: number;
}

export interface ScheduleConfigResult {
  config: SchedulerConfig;
  jobs: JobDef[];
  errors: string[];
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: false,
  timezone: 'UTC',
  maxConcurrency: 1,
  defaultTimeoutSeconds: 900,
  logDir: 'output/scheduler',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Date) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Validate a parsed TOML document. Invalid jobs are skipped (the others still
 * run) and every problem is returned as an error string so the API/UI can
 * surface it later instead of failing silently at startup.
 */
export function parseScheduleConfig(
  raw: unknown,
  useCases: Record<string, UseCaseRegistryEntry>
): ScheduleConfigResult {
  const errors: string[] = [];
  const root = asRecord(raw);
  const agent = root ? asRecord(root.agent) : null;
  const section = agent ? asRecord(agent.scheduler) : null;

  if (!section) {
    return {
      config: { ...DEFAULT_SCHEDULER_CONFIG },
      jobs: [],
      errors: ['Missing [agent.scheduler] section in agent_schedule.toml'],
    };
  }

  const config: SchedulerConfig = {
    enabled: asBoolean(section.enabled, DEFAULT_SCHEDULER_CONFIG.enabled),
    timezone: asString(section.timezone, DEFAULT_SCHEDULER_CONFIG.timezone),
    maxConcurrency: asInteger(section.max_concurrency, 1, 1, 10),
    defaultTimeoutSeconds: asInteger(section.default_timeout_seconds, 900, 1, 86_400),
    logDir: asString(section.log_dir, DEFAULT_SCHEDULER_CONFIG.logDir),
  };
  if (!isValidTimezone(config.timezone)) {
    errors.push(`Invalid timezone '${config.timezone}': falling back to UTC`);
    config.timezone = 'UTC';
  }

  const rawJobs = section.jobs;
  if (!Array.isArray(rawJobs)) {
    return { config, jobs: [], errors: [...errors, 'agent.scheduler.jobs must be an array'] };
  }

  const jobs: JobDef[] = [];
  const seenIds = new Set<string>();

  rawJobs.forEach((entry, index) => {
    const job = asRecord(entry);
    if (!job) {
      errors.push(`Job #${index + 1} is not a table`);
      return;
    }

    const id = asString(job.id, '');
    const label = id || `#${index + 1}`;
    if (!id) {
      errors.push(`Job ${label} has no id`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`Duplicate job id '${id}'`);
      return;
    }
    seenIds.add(id);

    const useCaseId = asString(job.use_case, '');
    const useCase = useCases[useCaseId];
    if (!useCase) {
      errors.push(`Job '${id}' references unknown use_case '${useCaseId}'`);
      return;
    }

    let schedule: ParsedSchedule;
    try {
      schedule = parseSchedule(asString(job.schedule, ''), config.timezone);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      errors.push(`Job '${id}': ${detail}`);
      return;
    }

    let steps: number[] | undefined;
    if (job.steps !== undefined) {
      const validSteps =
        Array.isArray(job.steps) &&
        job.steps.length > 0 &&
        job.steps.every(
          (s) => typeof s === 'number' && Number.isInteger(s) && s >= 0 && s < useCase.steps.length
        );
      if (!validSteps) {
        errors.push(
          `Job '${id}': steps must be 0-based indices in 0..${useCase.steps.length - 1}`
        );
        return;
      }
      steps = job.steps as number[];
    }

    if (job.args !== undefined && !asRecord(job.args)) {
      errors.push(`Job '${id}': args must be a table`);
      return;
    }

    let autoApply = asBoolean(job.auto_apply, false);
    if (autoApply) {
      errors.push(`Job '${id}': auto_apply=true is not supported; forcing false`);
      autoApply = false;
    }

    jobs.push({
      id,
      role: asString(job.role, 'Knowledge Engineer'),
      useCaseId,
      schedule,
      enabled: asBoolean(job.enabled, true),
      project: asString(job.project, 'default'),
      args: asRecord(job.args) ?? {},
      steps,
      autoApply,
      maxRetries: asInteger(job.max_retries, 2, 0, 5),
    });
  });

  return { config, jobs, errors };
}

/** Load and validate `<rootDir>/config/agent_schedule.toml`. */
export async function loadScheduleConfig(
  rootDir: string,
  useCases: Record<string, UseCaseRegistryEntry>
): Promise<ScheduleConfigResult> {
  const filePath = path.join(rootDir, 'config', 'agent_schedule.toml');
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    return parseScheduleConfig(toml.parse(text) as unknown, useCases);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        config: { ...DEFAULT_SCHEDULER_CONFIG },
        jobs: [],
        errors: [`Schedule config not found: ${filePath}`],
      };
    }
    return {
      config: { ...DEFAULT_SCHEDULER_CONFIG },
      jobs: [],
      errors: [`Failed to load schedule config ${filePath}: ${detail}`],
    };
  }
}
