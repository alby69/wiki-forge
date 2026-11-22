/**
 * Changesets domain module — staged proposals (plan -> review -> apply).
 *
 * Owns the `/api/v1/changesets*` routes previously handled inline by
 * `AgentServer`. Stores are obtained per active project from the injected
 * service surface; error envelopes and status codes match the legacy handlers.
 */

import { error, json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import type { ChangesetStatus, ChangesetStore, StageChangesetInput } from '../changesetStore';
import type { DomainServices, ProjectId } from './services';

type Payload = Record<string, unknown>;

const STATUSES: ChangesetStatus[] = ['pending', 'applied', 'rejected'];

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Payload | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : undefined;
}

function pathId(payload: Payload): string {
  return asString(payload.id)
    ?? asString(asRecord(payload.params)?.id)
    ?? asString(asRecord(payload.pathParams)?.id)
    ?? '';
}

export class ChangesetsModule implements DomainModule {
  readonly name = 'changesets';

  constructor(private readonly services: DomainServices) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('changesets.list', (payload, context) => this.list(payload, context.projectId));
    bus.register<Payload>('changesets.stage', (payload, context) => this.stage(payload, context.projectId));
    bus.register<Payload>('changesets.get', (payload, context) => this.get(payload, context.projectId));
    bus.register<Payload>('changesets.apply', (payload, context) => this.apply(payload, context.projectId));
    bus.register<Payload>('changesets.reject', (payload, context) => this.reject(payload, context.projectId));
  }

  private async store(projectId: ProjectId): Promise<ChangesetStore> {
    return this.services.changesets(projectId);
  }

  private async list(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const raw = asString(payload.status);
      const status = raw && STATUSES.includes(raw as ChangesetStatus) ? raw as ChangesetStatus : undefined;
      const changesets = await (await this.store(projectId)).list(status);
      return json({ success: true, changesets });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async stage(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const changeset = await (await this.store(projectId)).stage(payload as unknown as StageChangesetInput);
      return json({ success: true, changeset }, 201);
    } catch (err) {
      return error(String(err), 400);
    }
  }

  private async get(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const changeset = await (await this.store(projectId)).get(pathId(payload));
      return json({ success: true, changeset });
    } catch (err) {
      return error(String(err), 404);
    }
  }

  private async apply(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await (await this.store(projectId)).apply(pathId(payload));
      return json({ success: true, ...result });
    } catch (err) {
      return error(String(err), 400);
    }
  }

  private async reject(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const reason = asString(payload.reason) ?? '';
      const changeset = await (await this.store(projectId)).reject(pathId(payload), reason);
      return json({ success: true, changeset });
    } catch (err) {
      return error(String(err), 400);
    }
  }
}

export function createChangesetsModule(services: DomainServices): ChangesetsModule {
  return new ChangesetsModule(services);
}
