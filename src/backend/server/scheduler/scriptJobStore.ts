/**
 * S3 — atomic persistence for UI-created script jobs.
 *
 * `config/script_schedules.toml` stays the single persisted source for script
 * jobs. This module only reads/writes the `[[script_jobs]]` array and delegates
 * every rule (script existence, safety, cron, duplicate ids) to the existing
 * `parseScriptScheduleConfig()` validator. No second catalogue is introduced.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as toml from 'smol-toml';
import { atomicWriteFile } from '../safeFs';
import {
  parseScriptScheduleConfig,
  type JobDef,
  type UseCaseRegistryEntry,
} from './jobStore';
import { getScriptAutomation, isMutatingScript } from './scriptSafety';

type JsonObject = Record<string, unknown>;

/** HTTP-mapped failure raised by the store; modules turn `status` into a response. */
export class ScriptScheduleError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'ScriptScheduleError';
  }
}

export interface ScriptScheduleCreateInput {
  id: string;
  scriptId: string;
  schedule?: string;
  args?: JsonObject;
  project?: string;
  role?: string;
  enabled?: boolean;
  eventTrigger?: string;
  debounceSeconds?: number;
  maxRetries?: number;
}

export interface ScriptJobCreateResult {
  table: JsonObject;
  job: JobDef;
  warnings: string[];
}

export interface ScriptJobDeleteResult {
  removed: boolean;
}

export interface ScriptJobTables {
  header: string;
  tables: JsonObject[];
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DEFAULT_HEADER = [
  '# Job script generati da POST /api/scripts/schedule (S3).',
  '# Il parser legge solo `script_jobs`; orari e policy restano in config/agent_schedule.toml.',
  '# Ogni job diventa un Use Case sintetico a 1 step (__script__:<scriptId>).',
  '',
].join('\n');

export function getScriptSchedulePath(rootDir: string): string {
  return path.join(rootDir, 'config', 'script_schedules.toml');
}

/** Keep the human-authored preamble before the first `[[script_jobs]]` block. */
export async function readScriptJobTables(rootDir: string): Promise<ScriptJobTables> {
  const filePath = getScriptSchedulePath(rootDir);
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { header: DEFAULT_HEADER, tables: [] };
    }
    throw new ScriptScheduleError(`Failed to read ${filePath}: ${String(err)}`, 500);
  }

  const match = /^\s*\[\[script_jobs\]\]\s*$/m.exec(text);
  const preamble = match ? text.slice(0, match.index) : text;
  const header = preamble.trim() ? `${preamble.trimEnd()}\n\n` : DEFAULT_HEADER;

  let raw: unknown;
  try {
    raw = toml.parse(text) as unknown;
  } catch (err) {
    throw new ScriptScheduleError(`Failed to parse ${filePath}: ${String(err)}`, 500);
  }
  const root = asObject(raw);
  const scriptJobs = root?.script_jobs;
  // A header-only file is a valid empty registry; the rewritten file will add
  // the array. A present but non-array value is a real corruption.
  if (scriptJobs === undefined) return { header, tables: [] };
  if (!Array.isArray(scriptJobs)) {
    throw new ScriptScheduleError(`${filePath}: script_jobs must be an array`, 500);
  }
  return {
    header,
    tables: scriptJobs.map((entry, index) => {
      const table = asObject(entry);
      if (!table) {
        throw new ScriptScheduleError(`${filePath}: script_jobs[${index}] is not a table`, 500);
      }
      return table;
    }),
  };
}

/** Serialise the full array so unrelated tables keep their order and comments header. */
export async function writeScriptJobTables(
  rootDir: string,
  header: string,
  tables: JsonObject[]
): Promise<void> {
  const content = `${header.trimEnd()}\n\n${toml.stringify({ script_jobs: tables })}`;
  try {
    await atomicWriteFile(getScriptSchedulePath(rootDir), content, 'utf-8');
  } catch (err) {
    throw new ScriptScheduleError(`Failed to write script schedule config: ${String(err)}`, 500);
  }
}

/** Job ids owned by `agent_schedule.toml` must never be reused by the API. */
export async function readMainJobIds(rootDir: string): Promise<Set<string>> {
  const filePath = path.join(rootDir, 'config', 'agent_schedule.toml');
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw new ScriptScheduleError(`Failed to read ${filePath}: ${String(err)}`, 500);
  }
  let raw: unknown;
  try {
    raw = toml.parse(text) as unknown;
  } catch (err) {
    throw new ScriptScheduleError(`Failed to parse ${filePath}: ${String(err)}`, 500);
  }
  const jobs = asObject(asObject(raw)?.agent)?.scheduler;
  const rawJobs = asObject(jobs)?.jobs;
  const ids = new Set<string>();
  if (Array.isArray(rawJobs)) {
    for (const entry of rawJobs) {
      const id = asObject(entry)?.id;
      if (typeof id === 'string' && id) ids.add(id);
    }
  }
  return ids;
}

export async function createScriptJob(
  rootDir: string,
  input: ScriptScheduleCreateInput,
  useCases: Record<string, UseCaseRegistryEntry>,
  timezone = 'UTC'
): Promise<ScriptJobCreateResult> {
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  const scriptId = typeof input.scriptId === 'string' ? input.scriptId.trim() : '';
  if (!ID_PATTERN.test(id)) {
    throw new ScriptScheduleError('id must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  }
  if (!scriptId) throw new ScriptScheduleError('scriptId is required');
  if (input.args !== undefined && !asObject(input.args)) {
    throw new ScriptScheduleError('args must be an object');
  }

  const { header, tables } = await readScriptJobTables(rootDir);
  const mainIds = await readMainJobIds(rootDir);
  if (tables.some((table) => table.id === id) || mainIds.has(id)) {
    throw new ScriptScheduleError(`Job id '${id}' is already in use`, 409);
  }

  const automation = getScriptAutomation(scriptId);
  const args = asObject(input.args) ?? {};
  const requestedEnabled = input.enabled ?? automation?.enabledDefault ?? true;
  const mutating = isMutatingScript(scriptId, args);
  const table: JsonObject = {
    id,
    role: input.role?.trim() || 'Script Automation',
    script: scriptId,
    schedule: input.schedule?.trim() || automation?.defaultSchedule || '',
    enabled: mutating ? false : requestedEnabled,
    project: input.project?.trim() || 'default',
    auto_apply: false,
    max_retries: clampInteger(input.maxRetries, 1, 0, 5),
  };
  if (Object.keys(args).length > 0) table.args = args;
  if (input.eventTrigger?.trim()) table.event_trigger = input.eventTrigger.trim();
  if (input.debounceSeconds !== undefined) {
    table.debounce_seconds = clampInteger(input.debounceSeconds, 300, 1, 3_600);
  }

  // Reuse the S1 parser instead of duplicating safety/cron/args validation.
  const validated = parseScriptScheduleConfig(
    { script_jobs: [table] },
    useCases,
    timezone
  );
  if (validated.errors.length > 0) {
    throw new ScriptScheduleError(validated.errors.join('; '));
  }
  const job = validated.jobs.find((candidate) => candidate.id === id && candidate.jobKind === 'script');
  if (!job) throw new ScriptScheduleError(`Job '${id}' was not accepted as a script job`);

  await writeScriptJobTables(rootDir, header, [...tables, table]);
  const warnings: string[] = [];
  if (mutating) {
    warnings.push(
      `Script '${scriptId}' richiede approvazione F6: job '${id}' creato con enabled=false.`
    );
  }
  return { table, job, warnings };
}

export async function deleteScriptJob(
  rootDir: string,
  jobId: string,
  useCases: Record<string, UseCaseRegistryEntry>,
  timezone = 'UTC'
): Promise<ScriptJobDeleteResult> {
  const { header, tables } = await readScriptJobTables(rootDir);
  let target = -1;
  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index];
    const rawId = typeof table.id === 'string' ? table.id : '';
    const validated = parseScriptScheduleConfig(
      { script_jobs: [table] },
      useCases,
      timezone
    );
    const job = validated.jobs[0];
    if (job?.id === jobId) {
      if (job.jobKind !== 'script') {
        throw new ScriptScheduleError(`Job '${jobId}' is not a script job`);
      }
      target = index;
      break;
    }
    if (rawId === jobId) {
      const detail = validated.errors.join('; ') || 'invalid script job definition';
      throw new ScriptScheduleError(`Cannot remove invalid job '${jobId}': ${detail}`);
    }
  }

  if (target < 0) {
    const mainIds = await readMainJobIds(rootDir);
    if (mainIds.has(jobId)) {
      throw new ScriptScheduleError(`Job '${jobId}' belongs to agent_schedule.toml and cannot be removed here`);
    }
    throw new ScriptScheduleError(`Unknown script job '${jobId}'`, 404);
  }

  tables.splice(target, 1);
  await writeScriptJobTables(rootDir, header, tables);
  return { removed: true };
}

function asObject(value: unknown): JsonObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as JsonObject;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
