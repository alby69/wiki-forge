/**
 * Scheduler domain module — F3 status/runs/run SSE plus F5/F6 policy,
 * approval and event-trigger endpoints.
 *
 * Migrated verbatim from the inline `AgentServer` handlers: payloads arrive
 * already merged (path params, query, JSON body) and every envelope, status
 * code and SSE frame is preserved. The only HTTP touchpoint is the injected
 * `addScheduleClient` used by the long-lived status stream.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { error, json, sse, type ApiResult } from '../api/http';
import type { CommandContext, DomainModule, MessageBus } from '../bus/messageBus';
import type { ApprovalStatus } from '../scheduler/approvalStore';
import { isSupportedTriggerEvent } from '../scheduler/eventTriggers';
import type { TriggerEvent } from '../scheduler/scheduler';
import type { DomainServices, JsonObject } from './services';

type Payload = Record<string, unknown>;
/** `onClose` is supplied by the HTTP gateway (added to CommandContext by the migration). */
type CloseContext = CommandContext & { onClose?: (handler: () => void) => void };

const SUPPORTED_TRIGGER_EVENTS = ['note.created', 'note.modified', 'note.deleted'];
const APPROVAL_STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'failed'];

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export class SchedulerModule implements DomainModule {
  readonly name = 'scheduler';

  constructor(private readonly services: DomainServices) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('schedule.status', () => this.status());
    bus.register<Payload>('schedule.events', (_payload, context) => this.events(context as CloseContext));
    bus.register<Payload>('schedule.runs', (payload, context) => this.runs(payload, context));
    bus.register<Payload>('schedule.run', (payload, context) => this.run(payload, context as CloseContext));
    bus.register<Payload>('schedule.cancel', (payload) => this.cancel(payload));
    bus.register<Payload>('schedule.patch', (payload) => this.patch(payload));
    bus.register<Payload>('schedule.decisions', (payload) => this.decisions(payload));
    bus.register<Payload>('schedule.approvals', (payload) => this.approvals(payload));
    bus.register<Payload>('schedule.trigger', (payload) => this.trigger(payload));
    bus.register<Payload>('schedule.approvalDecision', (payload) => this.approvalDecision(payload));
  }

  private status(): ApiResult {
    return json({
      success: true,
      config: this.services.getSchedulerConfig() ?? null,
      errors: this.services.getScheduleErrors(),
      snapshot: this.services.snapshotStatus(),
    });
  }

  private events(context: CloseContext): ApiResult {
    return sse((res) => {
      const removeClient = this.services.addScheduleClient(res);
      context.onClose?.(removeClient);
      res.write(`data: ${JSON.stringify({ type: 'snapshot', snapshot: this.services.snapshotStatus() })}\n\n`);
    });
  }

  private async runs(payload: Payload, context: CommandContext): Promise<ApiResult> {
    const config = this.services.getSchedulerConfig();
    const logDir = typeof config?.logDir === 'string' ? config.logDir : 'output/scheduler';
    try {
      const text = await fs.readFile(path.resolve(context.rootDir, logDir, 'audit.jsonl'), 'utf-8');
      const jobId = asString(payload.jobId);
      const requestedLimit = Number(payload.limit ?? 100);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(Math.floor(requestedLimit), 1_000))
        : 100;
      let runs = text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as JsonObject);
      if (jobId) runs = runs.filter((run) => run.job === jobId);
      runs = runs.slice(-limit).reverse();
      return json({ success: true, runs });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return json({ success: true, runs: [] });
      }
      return error(String(err), 500);
    }
  }

  private run(payload: Payload, context: CloseContext): ApiResult {
    const jobId = asString(payload.jobId) ?? '';
    const scheduler = this.services.getScheduler();
    if (!scheduler) return error('Scheduler is not running', 503);
    if (!scheduler.getStatus().jobs.some((entry) => entry.job.id === jobId)) {
      return error(`Unknown scheduler job '${jobId}'`, 404);
    }
    if (scheduler.getStatus().activeJobs.includes(jobId)) {
      return error(`Job '${jobId}' is already running`, 409);
    }

    return sse(async (res) => {
      let finished = false;
      const closeRun = (): void => {
        if (finished) return;
        finished = true;
        unsubscribe();
      };
      const unsubscribe = scheduler.subscribe((event) => {
        if (finished || !('jobId' in event) || event.jobId !== jobId) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.type === 'job_finished') {
          res.write('data: [DONE]\n\n');
          res.end();
          unsubscribe();
          finished = true;
        }
      });
      context.onClose?.(closeRun);

      try {
        await scheduler.runJobNow(jobId);
      } catch (err) {
        if (!finished) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          closeRun();
        }
      }
    });
  }

  private cancel(payload: Payload): ApiResult {
    const jobId = asString(payload.jobId) ?? '';
    const cancelled = this.services.getScheduler()?.cancelJob(jobId) ?? false;
    return json(
      {
        success: cancelled,
        error: cancelled ? undefined : `No active run for job '${jobId}'`,
      },
      cancelled ? 200 : 409,
    );
  }

  private async patch(payload: Payload): Promise<ApiResult> {
    const jobId = asString(payload.jobId) ?? '';
    const scheduler = this.services.getScheduler();
    if (!scheduler) return error('Scheduler is not running', 503);
    try {
      if (!scheduler.getStatus().jobs.some((entry) => entry.job.id === jobId)) {
        return error(`Unknown scheduler job '${jobId}'`, 404);
      }
      if (typeof payload.enabled === 'boolean') {
        await scheduler.setJobEnabled(jobId, payload.enabled);
      }
      if (typeof payload.schedule === 'string') {
        await scheduler.setJobSchedule(jobId, payload.schedule);
      }
      const job = scheduler.getStatus().jobs.find((entry) => entry.job.id === jobId)!;
      return json({ success: true, job });
    } catch (err) {
      return error(String(err), 400);
    }
  }

  private async decisions(payload: Payload): Promise<ApiResult> {
    const limit = Number.parseInt(asString(payload.limit) || '50', 10);
    const decisions = await this.services.readDecisionLog({
      jobId: asString(payload.jobId) || undefined,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return json({ success: true, decisions });
  }

  private async approvals(payload: Payload): Promise<ApiResult> {
    const rawStatus = asString(payload.status);
    const status = rawStatus && APPROVAL_STATUSES.includes(rawStatus as ApprovalStatus)
      ? rawStatus as ApprovalStatus
      : undefined;
    const store = this.services.getApprovalStore();
    const approvals = store
      ? await store.list({ jobId: asString(payload.jobId) || undefined, status })
      : [];
    return json({
      success: true,
      approvals,
      pending: this.services.getEventBus()?.getPending() ?? [],
    });
  }

  private trigger(payload: Payload): ApiResult {
    if (!isSupportedTriggerEvent(payload.event)) {
      return error(
        `event must be one of: ${SUPPORTED_TRIGGER_EVENTS.join(', ')}`,
        400,
      );
    }
    const event: TriggerEvent = {
      type: payload.event,
      project: typeof payload.project === 'string' && payload.project ? payload.project : 'default',
      path: typeof payload.path === 'string' ? payload.path : undefined,
      source: 'webhook',
    };
    const eventBus = this.services.getEventBus();
    const queued = eventBus?.publish(event) ?? [];
    return json({ success: true, queued, pending: eventBus?.getPending() ?? [] });
  }

  private async approvalDecision(payload: Payload): Promise<ApiResult> {
    const approvalId = asString(payload.id) ?? '';
    const action = asString(payload.action) === 'reject' ? 'reject' : 'approve';
    const rawReviewer = asString(payload.reviewer);
    const reviewer = rawReviewer?.trim() ? rawReviewer.trim() : 'human';
    const result = await this.services.decideApproval(
      approvalId,
      action === 'approve' ? 'approved' : 'rejected',
      reviewer,
      asString(payload.reason),
    );
    const status = result.error && !result.approval ? 404 : result.error ? 500 : 200;
    return json({ success: !result.error, ...result }, status);
  }
}

export function createSchedulerModule(services: DomainServices): SchedulerModule {
  return new SchedulerModule(services);
}
