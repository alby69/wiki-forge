/**
 * Projects domain module — project registry lifecycle behind the bus.
 *
 * Replaces the inline `/api/projects*` handlers of `AgentServer`. Every state
 * change is delegated to the injected ProjectService; this module only maps
 * payloads to results and never sees an HTTP request or response.
 */

import { binary, error, json, type ApiResult } from '../api/http';
import type { CommandContext, DomainModule, MessageBus } from '../bus/messageBus';
import type { CloneInclude, ProjectBundle, ProjectDeleteMode } from '../projectService';
import type { ProjectsPort } from '../../app/ports';

type Payload = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Payload | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : undefined;
}

/** Legacy clone/rename handlers normalised body fields with `String(x ?? '')`. */
function legacyString(value: unknown): string {
  return String(value ?? '');
}

/** Path params are decoded strings; tolerate nested params from other adapters. */
function pathId(payload: Payload): string {
  return asString(payload.id)
    ?? asString(asRecord(payload.params)?.id)
    ?? asString(asRecord(payload.pathParams)?.id)
    ?? '';
}

function zipFileName(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'project';
  return `${clean}-wiki.zip`;
}

function failure(err: unknown): ApiResult {
  const status = (err as { status?: number } | null | undefined)?.status;
  return error(String(err), status || 500);
}

function bodyExcept(payload: Payload, ...keys: string[]): Payload {
  const source = asRecord(payload.body) ?? payload;
  const body: Payload = { ...source };
  for (const key of keys) delete body[key];
  return body;
}

export class ProjectsModule implements DomainModule {
  readonly name = 'projects';

  constructor(private readonly services: ProjectsPort) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('projects.list', (payload, context) => this.list(payload, context));
    bus.register<Payload>('projects.create', (payload) => this.create(payload));
    bus.register<Payload>('projects.import', (payload) => this.importBundle(payload));
    bus.register<Payload>('projects.clone', (payload) => this.clone(payload));
    bus.register<Payload>('projects.archive', (payload) => this.archive(payload));
    bus.register<Payload>('projects.restore', (payload) => this.restore(payload));
    bus.register<Payload>('projects.export', (payload) => this.exportBundle(payload));
    bus.register<Payload>('projects.exportMarkdownZip', (payload, context) => this.exportWikiMarkdownZip(payload, context));
    bus.register<Payload>('projects.stats', (payload) => this.stats(payload));
    bus.register<Payload>('projects.config.get', (payload) => this.configGet(payload));
    bus.register<Payload>('projects.config.put', (payload) => this.configPut(payload));
    bus.register<Payload>('projects.rename', (payload) => this.rename(payload));
    bus.register<Payload>('projects.delete', (payload) => this.remove(payload));
  }

  private async list(payload: Payload, context: CommandContext): Promise<ApiResult> {
    try {
      let projects = await this.services.projects.list({
        includeArchived: asString(payload.includeArchived) === 'true',
      });
      // B3: enumerate only projects visible to the caller. With RBAC off the
      // decision is absent and the full list is returned exactly as before.
      const visible = context.rbac?.visibleProjects;
      if (visible) projects = projects.filter((project) => visible.includes(project.id));
      return json({ success: true, projects });
    } catch (err) {
      return failure(err);
    }
  }

  private async create(payload: Payload): Promise<ApiResult> {
    try {
      const project = await this.services.projects.create(payload.id as string, payload.name as string);
      return json({ success: true, project });
    } catch (err) {
      return failure(err);
    }
  }

  private async importBundle(payload: Payload): Promise<ApiResult> {
    try {
      const bundle = payload.bundle ?? bodyExcept(payload, 'projectId', 'X-Project-Id', 'x-project-id');
      const project = await this.services.projects.import(bundle as ProjectBundle | string);
      return json({ success: true, project });
    } catch (err) {
      return failure(err);
    }
  }

  private async clone(payload: Payload): Promise<ApiResult> {
    try {
      const nested = asRecord(payload.body);
      const sourceParam = asString(payload.sourceId)
        ?? asString(asRecord(payload.params)?.id)
        ?? asString(asRecord(payload.pathParams)?.id);
      const sourceId = sourceParam ?? legacyString(payload.id);
      const project = await this.services.projects.clone(sourceId, {
        id: legacyString(payload.newId ?? nested?.id ?? payload.id),
        name: legacyString(payload.name ?? nested?.name),
        include: (payload.include ?? nested?.include) as Partial<CloneInclude> | undefined,
      });
      return json({ success: true, project });
    } catch (err) {
      return failure(err);
    }
  }

  private async archive(payload: Payload): Promise<ApiResult> {
    try {
      const result = await this.services.projects.archive(pathId(payload));
      return json({ success: true, project: result.project, trashed: result.entry });
    } catch (err) {
      return failure(err);
    }
  }

  private async restore(payload: Payload): Promise<ApiResult> {
    try {
      const project = await this.services.projects.restore(pathId(payload));
      return json({ success: true, project });
    } catch (err) {
      return failure(err);
    }
  }

  private async exportBundle(payload: Payload): Promise<ApiResult> {
    try {
      const bundle = JSON.parse(await this.services.projects.export(pathId(payload))) as ProjectBundle;
      return json({ success: true, bundle });
    } catch (err) {
      return failure(err);
    }
  }

  private async exportWikiMarkdownZip(payload: Payload, context: CommandContext): Promise<ApiResult> {
    const source = (context.principal as { source?: string } | undefined)?.source;
    if (source !== 'local' && source !== 'idp') return error('Authentication required', 401);
    try {
      const projectId = pathId(payload);
      const archive = await this.services.projects.exportWikiMarkdownZip(projectId);
      return binary(archive, 'application/zip', {
        'Content-Disposition': `attachment; filename="${zipFileName(projectId)}"`,
      });
    } catch (err) {
      return failure(err);
    }
  }

  private async stats(payload: Payload): Promise<ApiResult> {
    try {
      const stats = await this.services.projects.stats(pathId(payload));
      return json({ success: true, stats });
    } catch (err) {
      return failure(err);
    }
  }

  private async configGet(payload: Payload): Promise<ApiResult> {
    try {
      const config = await this.services.projects.readProjectConfig(pathId(payload));
      return json({ success: true, config });
    } catch (err) {
      return failure(err);
    }
  }

  private async configPut(payload: Payload): Promise<ApiResult> {
    try {
      const patch = bodyExcept(payload, 'id', 'params', 'pathParams', 'projectId', 'X-Project-Id', 'x-project-id');
      const config = await this.services.projects.mergeProjectConfig(pathId(payload), patch);
      return json({ success: true, config });
    } catch (err) {
      return failure(err);
    }
  }

  private async rename(payload: Payload): Promise<ApiResult> {
    try {
      const project = await this.services.projects.rename(pathId(payload), legacyString(payload.name));
      return json({ success: true, project });
    } catch (err) {
      return failure(err);
    }
  }

  private async remove(payload: Payload): Promise<ApiResult> {
    try {
      const explicitMode = asString(payload.mode);
      const legacyFlag = asString(payload.deleteFolder);
      const mode: ProjectDeleteMode = explicitMode
        ? explicitMode as ProjectDeleteMode
        : legacyFlag === 'true'
          ? 'trash'
          : legacyFlag === 'false'
            ? 'unregister'
            : 'trash';
      const headerToken = asString(payload['X-Confirm-Token']) ?? asString(payload['x-confirm-token']);
      const confirm = payload.confirm === undefined || payload.confirm === null
        ? headerToken
        : asString(payload.confirm);
      const result = await this.services.projects.remove(pathId(payload), mode, confirm ?? undefined);
      return json({ success: true, mode: result.mode, trashed: result.trashed });
    } catch (err) {
      return failure(err);
    }
  }
}

export function createProjectsModule(services: ProjectsPort): ProjectsModule {
  return new ProjectsModule(services);
}
