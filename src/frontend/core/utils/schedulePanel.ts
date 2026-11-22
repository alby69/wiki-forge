/**
 * Frontend-only view models for the "Agenti & Schedule" tab. Everything here
 * is pure so the SSE/status mapping can be tested without a DOM. The shape
 * mirrors the F3 REST payloads but does not import backend types into the UI.
 */

export type ScheduleJobStatus =
  | 'idle'
  | 'scheduled'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface ScheduleJobView {
  id: string;
  role: string;
  useCaseId: string;
  /** S3/S4: script jobs are one-step synthetic Use Cases, not KE Use Cases. */
  jobKind?: 'use_case' | 'script';
  scriptId?: string;
  args?: Record<string, unknown>;
  description: string;
  expression: string;
  timezone: string;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  lastStatus: ScheduleJobStatus;
  lastError?: string;
  consecutiveFailures: number;
  steps?: number[];
  active: boolean;
}

export interface ScheduleSnapshotView {
  enabled: boolean;
  running: boolean;
  lockHeld: boolean;
  activeJobs: string[];
  jobs: ScheduleJobView[];
}

export interface ScheduleRunView {
  job: string;
  useCase: string;
  status: ScheduleJobStatus;
  startedAt: string;
  error?: string;
}

/** F5 — a grounded policy decision shown with its rationale and sources. */
export interface PolicyDecisionView {
  id: string;
  jobId: string;
  action: 'allow' | 'skip' | 'require_approval';
  origin: 'llm' | 'fallback';
  rationale: string;
  sources: string[];
  steps: number[];
  mutatingSteps: number[];
  at: string;
}

/** F6 — a mutating step withheld until a human decides. */
export interface ApprovalView {
  id: string;
  jobId: string;
  stepIndex: number;
  /** S2: script-job approvals are labelled differently from Use Case steps. */
  jobKind?: 'use_case' | 'script';
  scriptId?: string;
  scriptArgs?: Record<string, unknown>;
  title?: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  rationale: string;
  sources: string[];
  createdAt: string;
  decidedBy?: string;
  error?: string;
}

export interface ScheduleLogLine {
  type: 'start' | 'stdout' | 'stderr' | 'exit' | 'info';
  text: string;
  timestamp: string;
}

const STATUS_META: Record<ScheduleJobStatus, { label: string; color: string; icon: string }> = {
  idle: { label: 'Mai eseguito', color: '#94a3b8', icon: '○' },
  scheduled: { label: 'In attesa', color: '#818cf8', icon: '◷' },
  running: { label: 'In corso', color: '#60a5fa', icon: '▶' },
  success: { label: 'Riuscito', color: '#34d399', icon: '✓' },
  failed: { label: 'Fallito', color: '#f87171', icon: '✗' },
  skipped: { label: 'Saltato', color: '#fbbf24', icon: '⏭' },
  cancelled: { label: 'Annullato', color: '#f472b6', icon: '⏹' },
};

function asRecord(value: unknown): Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asStatus(value: unknown): ScheduleJobStatus {
  return typeof value === 'string' && value in STATUS_META
    ? (value as ScheduleJobStatus)
    : 'idle';
}

/** Convert a `GET /api/ke/schedule` snapshot into render-ready job cards. */
export function toScheduleSnapshotView(raw: unknown): ScheduleSnapshotView | null {
  const snapshot = asRecord(raw);
  if (!Array.isArray(snapshot.jobs)) return null;

  const activeJobs: string[] = Array.isArray(snapshot.activeJobs)
    ? snapshot.activeJobs.filter((id): id is string => typeof id === 'string')
    : [];

  return {
    enabled: snapshot.enabled === true,
    running: snapshot.running === true,
    lockHeld: snapshot.lockHeld === true,
    activeJobs,
    jobs: snapshot.jobs.map((entry: unknown) => {
      const item = asRecord(entry);
      const job = asRecord(item.job);
      const state = asRecord(item.state);
      const schedule = asRecord(job.schedule);
      return {
        id: typeof job.id === 'string' ? job.id : '',
        role: typeof job.role === 'string' ? job.role : job.id ?? '',
        useCaseId: typeof job.useCaseId === 'string' ? job.useCaseId : '',
        jobKind: job.jobKind === 'script' || job.jobKind === 'use_case' ? job.jobKind : undefined,
        scriptId: typeof job.scriptId === 'string'
          ? job.scriptId
          : typeof job.useCaseId === 'string' && job.useCaseId.startsWith('__script__:')
            ? job.useCaseId.slice('__script__:'.length)
            : undefined,
        args: argRecord(job.args),
        description: typeof item.description === 'string' ? item.description : '',
        expression: typeof schedule.expression === 'string' ? schedule.expression : '',
        timezone: typeof schedule.timezone === 'string' ? schedule.timezone : 'UTC',
        enabled: job.enabled === true,
        nextRunAt: typeof state.next_run_at === 'string' ? state.next_run_at : '',
        lastRunAt: typeof state.last_run_at === 'string' ? state.last_run_at : undefined,
        lastStatus: asStatus(state.last_status),
        lastError: typeof state.last_error === 'string' ? state.last_error : undefined,
        consecutiveFailures:
          typeof state.consecutive_failures === 'number' ? state.consecutive_failures : 0,
        steps: Array.isArray(job.steps)
          ? job.steps.filter((index): index is number => typeof index === 'number')
          : undefined,
        active: activeJobs.includes(typeof job.id === 'string' ? job.id : ''),
      };
    }),
  };
}

/** Convert audit entries from `GET /api/ke/schedule/runs` into view models. */
export function toScheduleRunViews(raw: unknown): ScheduleRunView[] {
  const payload = asRecord(raw);
  if (!Array.isArray(payload.runs)) return [];
  return payload.runs.map((entry: unknown) => {
    const run = asRecord(entry);
    return {
      job: typeof run.job === 'string' ? run.job : '',
      useCase: typeof run.useCase === 'string' ? run.useCase : '',
      status: asStatus(run.status),
      startedAt: typeof run.startedAt === 'string' ? run.startedAt : '',
      error: typeof run.error === 'string' ? run.error : undefined,
    };
  });
}

const POLICY_ACTIONS = ['allow', 'skip', 'require_approval'] as const;
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'failed'] as const;

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function numberList(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item))
    : [];
}

function argRecord(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

export type ScriptSafetyClass = 'read-only' | 'report' | 'workspace' | 'wiki-write' | 'blocked';

export interface ScriptSafetyView {
  key: ScriptSafetyClass | 'unknown';
  icon: string;
  label: string;
  color: string;
  description: string;
  /** Mirrors the generated catalog; the backend still decides what may run. */
  schedulable: boolean;
  defaultSchedule?: string;
  notes?: string;
}

/** Labels mirrored from `SCRIPT_AUTOMATION_REFERENCE.md` (generated from Python SSOT). */
export const SCRIPT_SAFETY_META: Record<
  ScriptSafetyClass | 'unknown',
  { icon: string; label: string; color: string; description: string }
> = {
  'read-only': { icon: '🟢', label: 'read-only', color: '#68d391', description: 'nessuna scrittura rilevante' },
  report: { icon: '🔵', label: 'report', color: '#63b3ed', description: 'scrive solo in output/' },
  workspace: { icon: '🟡', label: 'workspace', color: '#f6e05e', description: 'scrive in raw/, sources/ o docs/' },
  'wiki-write': { icon: '🟠', label: 'wiki-write', color: '#f6ad55', description: 'scrive nella wiki' },
  blocked: { icon: '🔴', label: 'blocked', color: '#fc8181', description: 'mai automatico' },
  unknown: { icon: '⚪', label: 'sconosciuta', color: '#94a3b8', description: 'metadati di automazione assenti' },
};

/** Display-only projection of `ScriptDef.automation`; never a second classifier. */
export function scriptSafetyBadge(automation: unknown): ScriptSafetyView {
  const record = asRecord(automation);
  const safety = record.safety;
  const keys: ScriptSafetyClass[] = ['read-only', 'report', 'workspace', 'wiki-write', 'blocked'];
  const key = keys.find((candidate) => candidate === safety) ?? 'unknown';
  return {
    key,
    ...SCRIPT_SAFETY_META[key],
    schedulable: key !== 'unknown' && key !== 'blocked' && record.schedulable === true,
    defaultSchedule: typeof record.defaultSchedule === 'string' ? record.defaultSchedule : undefined,
    notes: typeof record.notes === 'string' ? record.notes : undefined,
  };
}

/** Convert `GET /api/ke/schedule/decisions` into render-ready policy cards. */
export function toPolicyDecisionViews(raw: unknown, limit = 5): PolicyDecisionView[] {
  const payload = asRecord(raw);
  if (!Array.isArray(payload.decisions)) return [];
  return payload.decisions.slice(0, Math.max(limit, 0)).map((entry: unknown) => {
    const item = asRecord(entry);
    const action = POLICY_ACTIONS.find(candidate => candidate === item.action) ?? 'allow';
    return {
      id: typeof item.id === 'string' ? item.id : '',
      jobId: typeof item.jobId === 'string' ? item.jobId : '',
      action,
      origin: item.origin === 'llm' ? 'llm' : 'fallback',
      rationale: typeof item.rationale === 'string' ? item.rationale : '',
      sources: stringList(item.sources),
      steps: numberList(item.steps),
      mutatingSteps: numberList(item.mutatingSteps),
      at: typeof item.at === 'string' ? item.at : '',
    };
  });
}

/** Convert `GET /api/ke/schedule/approvals` into render-ready approval cards. */
export function toApprovalViews(raw: unknown): ApprovalView[] {
  const payload = asRecord(raw);
  if (!Array.isArray(payload.approvals)) return [];
  return payload.approvals.map((entry: unknown) => {
    const item = asRecord(entry);
    const status = APPROVAL_STATUSES.find(candidate => candidate === item.status) ?? 'pending';
    return {
      id: typeof item.id === 'string' ? item.id : '',
      jobId: typeof item.jobId === 'string' ? item.jobId : '',
      stepIndex: typeof item.stepIndex === 'number' ? item.stepIndex : -1,
      jobKind: item.jobKind === 'script' || item.jobKind === 'use_case' ? item.jobKind : undefined,
      scriptId: typeof item.scriptId === 'string' ? item.scriptId : undefined,
      scriptArgs: argRecord(item.scriptArgs),
      title: typeof item.title === 'string' ? item.title : undefined,
      status,
      rationale: typeof item.rationale === 'string' ? item.rationale : '',
      sources: stringList(item.sources),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
      decidedBy: typeof item.decidedBy === 'string' ? item.decidedBy : undefined,
      error: typeof item.error === 'string' ? item.error : undefined,
    };
  });
}

export const POLICY_ACTION_META: Record<PolicyDecisionView['action'], { label: string; color: string; icon: string }> = {
  allow: { label: 'Consentito', color: '#34d399', icon: '✓' },
  skip: { label: 'Saltato', color: '#fbbf24', icon: '⏭' },
  require_approval: { label: 'Approvazione richiesta', color: '#a5b4fc', icon: '⏸' },
};

export function statusLabel(status: ScheduleJobStatus): { label: string; color: string; icon: string } {
  return STATUS_META[status] ?? STATUS_META.idle;
}

/** Stable UTC rendering: the Workbench must not depend on the browser locale/TZ. */
export function formatScheduleTime(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('it-IT', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' UTC';
}

export function formatDuration(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  return `${Math.round(ms / 1_000)} s`;
}

/**
 * Split an SSE byte chunk into complete `data:` frames. Keepalive comments and
 * malformed JSON are ignored; `[DONE]` is reported so callers can end the read.
 */
export function parseSseEvents(
  chunk: string,
  buffer: string
): { events: unknown[]; rest: string; done: boolean } {
  const combined = buffer + chunk;
  const frames = combined.split(/\r?\n\r?\n/);
  const rest = frames.pop() ?? '';
  const events: unknown[] = [];
  let done = false;

  for (const frame of frames) {
    for (const line of frame.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') {
        done = true;
      } else if (payload) {
        try {
          events.push(JSON.parse(payload));
        } catch {
          // Ignore malformed frames instead of breaking the whole stream.
        }
      }
    }
  }
  return { events, rest, done };
}

function runnerEventToLine(event: unknown, timestamp: string): ScheduleLogLine | null {
  const item = asRecord(event);
  switch (item.type) {
    case 'start':
      return { type: 'start', text: `★ ${item.objective ?? 'Use Case avviato'}`, timestamp };
    case 'step_start':
      return {
        type: 'start',
        text: `[Step ${item.stepNumber}] ${item.title ?? ''} ($ ${item.cmd ?? ''})`,
        timestamp,
      };
    case 'stdout':
    case 'stderr':
      return { type: item.type, text: String(item.text ?? ''), timestamp };
    case 'step_end':
      return {
        type: 'exit',
        text: `✓ Step ${item.stepNumber} completato con codice ${item.code}`,
        timestamp,
      };
    case 'exit':
      return { type: 'info', text: String(item.message ?? ''), timestamp };
    default:
      return null;
  }
}

/** Map a scheduler SSE event to a line for the shared LogConsole. */
export function schedulerEventToLogLine(event: unknown, timestamp: string): ScheduleLogLine | null {
  const item = asRecord(event);
  switch (item.type) {
    case 'job_started':
      return {
        type: 'start',
        text: `▶ Job '${item.jobId}' avviato (tentativo ${item.attempt})`,
        timestamp,
      };
    case 'job_output':
      return { type: 'stdout', text: String(item.text ?? ''), timestamp };
    case 'use_case_event':
      return runnerEventToLine(item.event, timestamp);
    case 'job_retry':
      return {
        type: 'stderr',
        text: `⚠ Job '${item.jobId}' riproverà (tentativo ${item.attempt}): ${item.reason ?? ''}`,
        timestamp,
      };
    case 'job_skipped':
      return {
        type: 'stderr',
        text: `⏭ Job '${item.jobId}' saltato: ${item.reason ?? ''}`,
        timestamp,
      };
    case 'policy_decision': {
      const meta = POLICY_ACTION_META[item.action as PolicyDecisionView['action']] ?? POLICY_ACTION_META.allow;
      return {
        type: 'info',
        text: `🧠 Policy ${meta.icon} ${meta.label} per '${item.jobId}': ${item.rationale ?? ''}`,
        timestamp,
      };
    }
    case 'approval_required': {
      const scripts = stringList(item.scriptIds);
      const target = scripts.length > 0 ? `script ${scripts.join(', ')}` : `step ${numberList(item.steps).join(', ')}`;
      const kind = item.jobKind === 'script' ? ' · job script' : '';
      return {
        type: 'info',
        text: `⏸ Approvazione richiesta per '${item.jobId}'${kind} (${target}): ${item.rationale ?? ''}`,
        timestamp,
      };
    }
    case 'event_queued': {
      const event = asRecord(item.event);
      return {
        type: 'info',
        text: `📥 Evento '${event.type ?? ''}' accodato per '${item.jobId}' → esecuzione ${formatScheduleTime(typeof item.fireAt === 'string' ? item.fireAt : undefined)}`,
        timestamp,
      };
    }
    case 'event_triggered': {
      const event = asRecord(item.event);
      return {
        type: 'start',
        text: `⚡ Job '${item.jobId}' attivato da '${event.type ?? ''}'${event.path ? ` (${event.path})` : ''}`,
        timestamp,
      };
    }
    case 'jobs_changed': {
      const added = stringList(item.added);
      const removed = stringList(item.removed);
      return {
        type: 'info',
        text: `🔄 Scheduler aggiornato: +${added.length} job${added.length ? ` (${added.join(', ')})` : ''}, -${removed.length}${removed.length ? ` (${removed.join(', ')})` : ''}`,
        timestamp,
      };
    }
    case 'job_finished': {
      const status = asStatus(item.status);
      const meta = statusLabel(status);
      return {
        type: 'exit',
        text: `${meta.icon} Job '${item.jobId}' ${meta.label.toLowerCase()} in ${formatDuration(item.durationMs)}`,
        timestamp,
      };
    }
    case 'error':
      return { type: 'stderr', text: String(item.error ?? 'Errore sconosciuto'), timestamp };
    default:
      return null;
  }
}
