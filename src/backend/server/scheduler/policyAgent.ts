import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LlmClient } from '../llmClient';
import { isMutatingScript as isMutatingFromRegistry } from './scriptSafety';
import type { JobStatus } from './runtimeState';

export { MUTATING_SCRIPT_IDS } from './scriptSafety';

/**
 * F5 — LLM Policy Agent.
 *
 * The agent is advisory only: it decides which *read-only* steps a job may run,
 * which mutating steps must wait for a human, or that the job must be skipped.
 * Every decision is appended to a JSONL log with a rationale and sources. An
 * invalid/unavailable LLM answer never widens permissions — it falls back to
 * the deterministic "read-only + approval" policy and is logged with its error.
 */

export type PolicyTrigger = 'cron' | 'manual' | 'event';

export interface PolicyStep {
  index: number;
  scriptId?: string;
  title?: string;
  mutating: boolean;
}

export interface PolicyContext {
  jobId: string;
  role: string;
  useCaseId: string;
  project: string;
  trigger: PolicyTrigger;
  steps: PolicyStep[];
  lastStatus?: JobStatus;
  lastError?: string;
  consecutiveFailures: number;
  event?: string;
}

export type PolicyAction = 'allow' | 'skip' | 'require_approval';

export interface PolicyDecision {
  action: PolicyAction;
  /** Read-only step indices that may run now. */
  steps: number[];
  /** Mutating step indices that must be staged for human approval. */
  mutatingSteps: number[];
  rationale: string;
  sources: string[];
  origin: 'llm' | 'fallback';
  model?: string;
  error?: string;
  at: string;
}

export interface DecisionLogEntry extends PolicyDecision {
  id: string;
  jobId: string;
  useCaseId: string;
  project: string;
  trigger: PolicyTrigger;
  event?: string;
}

export interface PolicyAgentOptions {
  /** Lazy provider: reuses the AgentServer LLM client (and its configuration). */
  getClient: () => Promise<LlmClient>;
  logPath: string;
  now?: () => Date;
  model?: string;
}

/** Derived from SCRIPT_SCHEMAS; see scheduler/scriptSafety.ts. */
export function isMutatingScript(scriptId: string | undefined): boolean {
  return isMutatingFromRegistry(scriptId);
}

const BASELINE_SOURCES = ['config/agent_schedule.toml', 'output/scheduler/audit.jsonl'];

function redact(text: string): string {
  return text
    .replace(
      /((?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?)([^\s"',;}\]]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/(--(?:api-key|token|secret|password)\s+)([^\s]+)/gi, '$1[REDACTED]');
}

function firstJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
    : [];
}

function asAction(value: unknown): PolicyAction | null {
  return value === 'allow' || value === 'skip' || value === 'require_approval' ? value : null;
}

export class PolicyAgent {
  private readonly getClient: () => Promise<LlmClient>;
  private readonly logPath: string;
  private readonly now: () => Date;
  private readonly model?: string;

  constructor(options: PolicyAgentOptions) {
    this.getClient = options.getClient;
    this.logPath = options.logPath;
    this.now = options.now ?? (() => new Date());
    this.model = options.model;
  }

  /** Evaluate a job. Always returns a logged, fully grounded decision. */
  public async decide(context: PolicyContext): Promise<DecisionLogEntry> {
    const at = this.now().toISOString();
    const readOnly = context.steps.filter(step => !step.mutating).map(step => step.index);
    const mutating = context.steps.filter(step => step.mutating).map(step => step.index);
    const fallbackReason = mutating.length > 0
      ? 'mutating steps are always staged for human approval (auto_apply=false)'
      : 'deterministic read-only policy';

    let decision: Omit<DecisionLogEntry, 'id' | 'at' | 'jobId' | 'useCaseId' | 'project' | 'trigger' | 'event'>;
    try {
      const client = await this.getClient();
      const raw = await client.complete({
        systemPrompt: [
          'You are the Policy Agent of a knowledge-engineering scheduler.',
          'You are ADVISORY ONLY: you must never ask for automatic wiki mutations.',
          'Return ONE JSON object, with no prose outside it, in this exact shape:',
          '{"action":"allow|skip|require_approval","steps":[0],"rationale":"...","sources":["config/agent_schedule.toml"]}',
          'rules:',
          '- "steps" may contain ONLY the read-only step indices from the context; mutating indices must never appear there.',
          '- "rationale" is mandatory: explain the decision in Italian, citing evidence.',
          '- "sources" is a non-empty list of file paths, note ids or audit entries backing the rationale.',
          '- Choose "skip" when repeated failures or a stale/unsafe context make the run pointless.',
          '- Choose "require_approval" when the job contains mutating steps.',
        ].join('\n'),
        userMessage: JSON.stringify({
          job: {
            id: context.jobId,
            role: context.role,
            useCaseId: context.useCaseId,
            project: context.project,
            trigger: context.trigger,
            event: context.event,
          },
          steps: context.steps,
          lastStatus: context.lastStatus,
          lastError: context.lastError,
          consecutiveFailures: context.consecutiveFailures,
          availableSources: BASELINE_SOURCES,
        }),
      });
      const parsed = firstJsonObject(raw) as Record<string, unknown> | null;
      const action = parsed ? asAction(parsed.action) : null;
      const rationale = typeof parsed?.rationale === 'string' ? parsed.rationale.trim() : '';
      const sources = asStringArray(parsed?.sources);
      if (!action || !rationale || sources.length === 0) {
        throw new Error('LLM decision missing a valid action, rationale or sources');
      }
      const requested = Array.isArray(parsed?.steps)
        ? parsed.steps.filter((index): index is number => typeof index === 'number' && Number.isInteger(index))
        : [];
      const allowedSteps = readOnly.filter(index => requested.includes(index));
      const movedToApproval = mutating.filter(index => requested.includes(index));
      decision = {
        action: action === 'skip' ? 'skip' : readOnly.length === 0 ? 'require_approval' : action,
        steps: action === 'skip' ? [] : allowedSteps,
        mutatingSteps: mutating,
        rationale: movedToApproval.length > 0
          ? `${rationale} (step mutanti ${movedToApproval.join(', ')} spostati in approvazione dalla guardia di policy)`
          : rationale,
        sources,
        origin: 'llm',
        model: this.model,
      };
    } catch (err) {
      decision = {
        action: mutating.length > 0 ? 'require_approval' : 'allow',
        steps: readOnly,
        mutatingSteps: mutating,
        rationale: `Decisione deterministica di fallback: ${fallbackReason}. ${err instanceof Error ? err.message : String(err)}`,
        sources: [...BASELINE_SOURCES],
        origin: 'fallback',
        model: this.model,
        error: redact(err instanceof Error ? err.message : String(err)),
      };
    }

    // Fail-closed invariant: mutating steps never leave this method as runnable.
    decision.steps = decision.steps.filter(index => readOnly.includes(index));
    decision.mutatingSteps = mutating;
    if (!decision.rationale.trim()) decision.rationale = `Decisione senza motivazione; applicata la regola: ${fallbackReason}`;
    if (decision.sources.length === 0) decision.sources = [...BASELINE_SOURCES];
    if (mutating.length > 0 && decision.action === 'allow' && decision.steps.length === 0) {
      decision.action = 'require_approval';
    }

    const entry: DecisionLogEntry = {
      id: `dec-${at.replace(/[:.-]/g, '')}-${Math.random().toString(36).slice(2, 8)}`,
      at,
      jobId: context.jobId,
      useCaseId: context.useCaseId,
      project: context.project,
      trigger: context.trigger,
      event: context.event,
      ...decision,
      rationale: redact(decision.rationale),
      sources: decision.sources.map(redact),
    };
    await this.append(entry);
    return entry;
  }

  /** Read the decision log, newest first. */
  public async readDecisions(options: { jobId?: string; limit?: number } = {}): Promise<DecisionLogEntry[]> {
    let lines: string[];
    try {
      lines = (await fs.readFile(this.logPath, 'utf-8')).split(/\r?\n/).filter(Boolean);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const entries: DecisionLogEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as DecisionLogEntry;
        if (options.jobId && entry.jobId !== options.jobId) continue;
        entries.push(entry);
      } catch {
        // A truncated last line must not hide the rest of the log.
      }
    }
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    return entries.reverse().slice(0, limit);
  }

  private async append(entry: DecisionLogEntry): Promise<void> {
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });
    await fs.appendFile(this.logPath, `${JSON.stringify(entry)}\n`, 'utf-8');
  }
}
