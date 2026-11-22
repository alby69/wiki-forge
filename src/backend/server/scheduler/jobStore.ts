import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as toml from 'smol-toml';
import { GENERATED_SCRIPT_REGISTRY } from '../generated/scriptRegistry.generated';
import { isValidTimezone, parseSchedule, ParsedSchedule } from './cron';
import {
  isBlockedScript,
  isMutatingScript,
  isSchedulableScript,
  resolveScriptArgs,
} from './scriptSafety';

export interface SchedulerConfig {
  enabled: boolean;
  timezone: string;
  maxConcurrency: number;
  defaultTimeoutSeconds: number;
  logDir: string;
  /** F5: run the advisory LLM policy layer before every job. */
  policyEnabled: boolean;
}

export interface UseCaseRegistryEntry {
  id: string;
  steps: unknown[];
  /** Optional human-readable title, used by scheduler logs and the F3 API. */
  title?: string;
}

/** S1: a job either runs a Use Case or a single generated script step. */
export type JobKind = 'use_case' | 'script';

/** Namespace that keeps generated Use Cases separate from the KE catalog. */
export const SCRIPT_USE_CASE_PREFIX = '__script__:';

export function scriptUseCaseId(scriptId: string): string {
  return `${SCRIPT_USE_CASE_PREFIX}${scriptId}`;
}

export interface SyntheticScriptStep {
  stepNumber: number;
  title: string;
  description: string;
  scriptId: string;
  defaultArgs: Record<string, unknown>;
}

export interface SyntheticUseCaseEntry extends UseCaseRegistryEntry {
  title: string;
  role: 'Knowledge Engineer';
  category: string;
  summary: string;
  objective: string;
  steps: SyntheticScriptStep[];
}

export interface JobDef {
  id: string;
  role: string;
  /** S1: `script` for UI-generated jobs; absent means the original `use_case`. */
  jobKind?: JobKind;
  /** Always populated: script jobs point to a synthetic Use Case. */
  useCaseId: string;
  /** Present only for `script` jobs. */
  scriptId?: string;
  schedule: ParsedSchedule;
  enabled: boolean;
  project: string;
  args: Record<string, unknown>;
  steps?: number[];
  autoApply: boolean;
  maxRetries: number;
  /** F6: event type (e.g. `note.created`) that can trigger this job. */
  eventTrigger?: string;
  /** F6: quiet-period in seconds before an event-triggered run. */
  debounceSeconds: number;
}

export interface ScheduleConfigResult {
  config: SchedulerConfig;
  jobs: JobDef[];
  errors: string[];
}

export interface ParseScheduleOptions {
  /** Label used in diagnostics when the same parser reads the script job file. */
  source?: string;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: false,
  timezone: 'UTC',
  maxConcurrency: 1,
  defaultTimeoutSeconds: 900,
  logDir: 'output/scheduler',
  policyEnabled: false,
};

export const DEFAULT_EVENT_DEBOUNCE_SECONDS = 300;

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
  useCases: Record<string, UseCaseRegistryEntry>,
  options: ParseScheduleOptions = {}
): ScheduleConfigResult {
  const errors: string[] = [];
  const root = asRecord(raw);
  const agent = root ? asRecord(root.agent) : null;
  const section = agent ? asRecord(agent.scheduler) : null;
  const source = options.source ?? 'agent_schedule.toml';

  if (!section) {
    return {
      config: { ...DEFAULT_SCHEDULER_CONFIG },
      jobs: [],
      errors: [`Missing [agent.scheduler] section in ${source}`],
    };
  }

  const config: SchedulerConfig = {
    enabled: asBoolean(section.enabled, DEFAULT_SCHEDULER_CONFIG.enabled),
    timezone: asString(section.timezone, DEFAULT_SCHEDULER_CONFIG.timezone),
    maxConcurrency: asInteger(section.max_concurrency, 1, 1, 10),
    defaultTimeoutSeconds: asInteger(section.default_timeout_seconds, 900, 1, 86_400),
    logDir: asString(section.log_dir, DEFAULT_SCHEDULER_CONFIG.logDir),
    policyEnabled: asBoolean(agent && asRecord(agent.policy)?.enabled, false),
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

    const rawUseCaseId = asString(job.use_case, '');
    const scriptId = asString(job.script, '');
    if (Boolean(rawUseCaseId) === Boolean(scriptId)) {
      errors.push(`Job '${id}' must define exactly one of use_case or script`);
      return;
    }

    let jobKind: JobKind;
    let useCaseId: string;
    let args = asRecord(job.args) ?? {};
    let defaultSchedule = '';
    let defaultRole = 'Knowledge Engineer';
    let defaultEnabled = true;

    if (scriptId) {
      jobKind = 'script';
      const scriptDef = GENERATED_SCRIPT_REGISTRY[scriptId];
      if (!scriptDef?.automation) {
        errors.push(`Job '${id}' references unknown script '${scriptId}'`);
        return;
      }
      if (!isSchedulableScript(scriptId) || isBlockedScript(scriptId)) {
        errors.push(`Job '${id}': script '${scriptId}' is not schedulable`);
        return;
      }
      useCaseId = scriptUseCaseId(scriptId);
      defaultSchedule = scriptDef.automation.defaultSchedule;
      defaultRole = 'Script Automation';
      defaultEnabled = scriptDef.automation.enabledDefault;
      // The F5 policy must see the same values the runner will use.
      args = resolveScriptArgs(scriptId, args);
    } else {
      jobKind = 'use_case';
      useCaseId = rawUseCaseId;
      if (!useCases[useCaseId]) {
        errors.push(`Job '${id}' references unknown use_case '${useCaseId}'`);
        return;
      }
    }

    let schedule: ParsedSchedule;
    try {
      schedule = parseSchedule(asString(job.schedule, defaultSchedule), config.timezone);
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
        job.steps.every((step) =>
          typeof step === 'number' &&
          Number.isInteger(step) &&
          step >= 0 &&
          step < (scriptId ? 1 : (useCases[useCaseId]?.steps.length ?? 0))
        );
      if (!validSteps) {
        errors.push(
          scriptId
            ? `Job '${id}': script jobs have a single step (use steps=[0] or omit it)`
            : `Job '${id}': steps must be 0-based indices in 0..${useCases[useCaseId]?.steps.length - 1}`
        );
        return;
      }
      steps = job.steps as number[];
    }
    if (scriptId) steps = steps ?? [0];

    if (job.args !== undefined && !asRecord(job.args)) {
      errors.push(`Job '${id}': args must be a table`);
      return;
    }

    const eventTriggerValue = asString(job.event_trigger, '');
    const eventTrigger = eventTriggerValue || undefined;
    if (eventTrigger && !/^[a-z][a-z0-9._-]*$/i.test(eventTrigger)) {
      errors.push(`Job '${id}': invalid event_trigger '${eventTrigger}'`);
      return;
    }

    let autoApply = asBoolean(job.auto_apply, false);
    if (autoApply) {
      errors.push(`Job '${id}': auto_apply=true is not supported; forcing false`);
      autoApply = false;
    }

    let enabled = asBoolean(job.enabled, defaultEnabled);
    if (scriptId && enabled && isMutatingScript(scriptId, args)) {
      errors.push(
        `Job '${id}': script '${scriptId}' is mutating for the resolved args; forcing enabled=false (F6 approval required)`
      );
      enabled = false;
    }

    jobs.push({
      id,
      role: asString(job.role, defaultRole),
      jobKind,
      useCaseId,
      ...(scriptId ? { scriptId } : {}),
      schedule,
      enabled,
      project: asString(job.project, 'default'),
      args,
      steps,
      autoApply,
      maxRetries: asInteger(job.max_retries, 2, 0, 5),
      eventTrigger,
      debounceSeconds: asInteger(
        job.debounce_seconds,
        DEFAULT_EVENT_DEBOUNCE_SECONDS,
        1,
        3_600
      ),
    });
  });

  return { config, jobs, errors };
}

/** Wrap `[[script_jobs]]` in the shape shared with the Use Case job parser. */
export function parseScriptScheduleConfig(
  raw: unknown,
  useCases: Record<string, UseCaseRegistryEntry>,
  timezone: string
): ScheduleConfigResult {
  const root = asRecord(raw);
  const scriptJobs = root?.script_jobs;
  if (!Array.isArray(scriptJobs)) {
    return {
      config: { ...DEFAULT_SCHEDULER_CONFIG, timezone },
      jobs: [],
      errors: ['script_schedules.toml: script_jobs must be an array'],
    };
  }
  return parseScheduleConfig(
    {
      agent: {
        scheduler: { jobs: scriptJobs, timezone },
      },
    },
    useCases,
    { source: 'script_schedules.toml' }
  );
}

/**
 * One script job becomes one Use Case with exactly one step, so the existing
 * Scheduler, F5 preflight and UseCaseRunner stay untouched.
 */
export function buildSyntheticUseCases(
  jobs: JobDef[]
): Record<string, SyntheticUseCaseEntry> {
  const useCases: Record<string, SyntheticUseCaseEntry> = {};
  for (const job of jobs) {
    if (job.jobKind !== 'script' || !job.scriptId) continue;
    const id = scriptUseCaseId(job.scriptId);
    const args = resolveScriptArgs(job.scriptId, job.args);
    useCases[id] = {
      id,
      title: `Script: ${job.scriptId}`,
      role: 'Knowledge Engineer',
      category: 'Script Automation',
      summary: `Job script '${job.id}' generato da config/script_schedules.toml.`,
      objective: 'Eseguire un solo script con gli argomenti risolti dal catalogo e dal job.',
      steps: [
        {
          stepNumber: 1,
          title: `Esegui ${job.scriptId}`,
          description: `Step sintetico per il job script '${job.id}'.`,
          scriptId: job.scriptId,
          defaultArgs: args,
        },
      ],
    };
  }
  return useCases;
}

/** Load and validate both job files, rejecting ids duplicated across them. */
export async function loadScheduleConfig(
  rootDir: string,
  useCases: Record<string, UseCaseRegistryEntry>
): Promise<ScheduleConfigResult> {
  const filePath = path.join(rootDir, 'config', 'agent_schedule.toml');
  let mainResult: ScheduleConfigResult;
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    mainResult = parseScheduleConfig(toml.parse(text) as unknown, useCases);
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

  const scriptPath = path.join(rootDir, 'config', 'script_schedules.toml');
  let scriptText: string;
  try {
    scriptText = await fs.readFile(scriptPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return mainResult;
    const detail = err instanceof Error ? err.message : String(err);
    mainResult.errors.push(`Failed to load script schedule config ${scriptPath}: ${detail}`);
    return mainResult;
  }

  try {
    const scriptResult = parseScriptScheduleConfig(
      toml.parse(scriptText) as unknown,
      useCases,
      mainResult.config.timezone
    );
    mainResult.errors.push(...scriptResult.errors);
    const ids = new Set(mainResult.jobs.map((job) => job.id));
    for (const job of scriptResult.jobs) {
      if (ids.has(job.id)) {
        mainResult.errors.push(
          `Duplicate job id '${job.id}' across agent_schedule.toml and script_schedules.toml`
        );
        continue;
      }
      ids.add(job.id);
      mainResult.jobs.push(job);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    mainResult.errors.push(`Failed to parse script schedule config ${scriptPath}: ${detail}`);
  }

  return mainResult;
}
