import { apiBus } from '@frontend/core/apiBus';
import { eventBus } from '@frontend/core/events';
import { ApiClientError } from '@frontend/api/client';
import { getActiveProjectId, resolveApiBaseUrl, type ProjectInfo } from '@frontend/storage/ApiStorage';
import type { EndpointId, EndpointRequest, EndpointResponse } from '@shared/api/contracts';

/** A registry entry as returned by the backend (archived entries opt-in). */
export interface ProjectInfoExtended extends ProjectInfo {
  archived?: boolean;
  createdAt?: string;
  sourceProjectId?: string;
}

/** Tolerant view of the numbers returned by GET /api/projects/:id/stats. */
export interface ProjectStats {
  notes?: number;
  sources?: number;
  assets?: number;
  bytes?: number;
  totalBytes?: number;
  [key: string]: unknown;
}

/** Optional sub-trees copied by POST /api/projects/:id/clone. */
export interface CloneInclude {
  wiki?: boolean;
  raw?: boolean;
  sources?: boolean;
  notes?: boolean;
  output?: boolean;
  config?: boolean;
}

export interface CloneProjectOptions {
  id: string;
  name: string;
  include?: CloneInclude;
}

export type ProjectDeleteMode = 'unregister' | 'trash' | 'permanent';

/** JSON bundle accepted by GET /api/projects/:id/export and POST /api/projects/import. */
export interface ProjectBundle {
  manifest: {
    id: string;
    name: string;
    format?: string;
    version?: number;
    exportedAt?: string;
    files?: Array<{ path: string; encoding?: string }>;
    [key: string]: unknown;
  };
  files: Record<string, string>;
  [key: string]: unknown;
}

type Envelope<T> = T & { success?: boolean; error?: string };

/**
 * Thin client for the project lifecycle endpoints. It never changes the active
 * project: callers own that decision and react to `project:changed` as needed.
 */
export class ProjectService {
  /** Kept for constructor compatibility; transport is now the generated client
   * reached through `apiBus`, where the base URL is configured. */
  private readonly baseUrl: string;

  constructor(baseUrl: string = resolveApiBaseUrl()) {
    this.baseUrl = baseUrl || resolveApiBaseUrl();
  }

  public async list(includeArchived = true): Promise<ProjectInfoExtended[]> {
    const json = await this.request(
      'projects.list',
      { query: { includeArchived } },
      getActiveProjectId()
    );
    return (json.projects ?? []) as unknown as ProjectInfoExtended[];
  }

  public async create(id: string, name: string): Promise<ProjectInfoExtended> {
    const json = await this.request(
      'projects.create',
      { body: { id, name } },
      getActiveProjectId()
    );
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async rename(id: string, name: string): Promise<ProjectInfoExtended> {
    const json = await this.request(
      'projects.rename',
      { params: { id }, body: { name } },
      id
    );
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async clone(sourceId: string, options: CloneProjectOptions): Promise<ProjectInfoExtended> {
    const json = await this.request(
      'projects.clone',
      {
        params: { id: sourceId },
        body: {
          id: options.id,
          name: options.name,
          include: options.include as unknown as Record<string, unknown> | undefined,
        },
      },
      sourceId
    );
    const project = this.requireProject(json.project, options.id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async archive(id: string): Promise<ProjectInfoExtended> {
    const json = await this.request('projects.archive', { params: { id } }, id);
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async restore(id: string): Promise<ProjectInfoExtended> {
    const json = await this.request('projects.restore', { params: { id } }, id);
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async remove(id: string, mode: ProjectDeleteMode = 'trash', confirm?: string): Promise<void> {
    await this.request(
      'projects.delete',
      { params: { id }, query: { mode, confirm } },
      id
    );
    eventBus.emit('project:changed', { id });
  }

  public async exportBundle(id: string): Promise<ProjectBundle> {
    const json = await this.request('projects.export', { params: { id } }, id);
    if (!json.bundle) throw new Error(`Missing export bundle for project ${id}`);
    return json.bundle as unknown as ProjectBundle;
  }

  public async importBundle(bundle: unknown): Promise<ProjectInfoExtended> {
    const json = await this.request(
      'projects.import',
      { body: { bundle } as unknown as EndpointRequest<'projects.import'>['body'] },
      getActiveProjectId()
    );
    const project = this.requireProject(json.project, '');
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async stats(id: string): Promise<ProjectStats> {
    const json = await this.request('projects.stats', { params: { id } }, id);
    return (json.stats ?? {}) as ProjectStats;
  }

  private requireProject(project: unknown, fallbackId: string): ProjectInfoExtended {
    if (!project) throw new Error(`Missing project in response${fallbackId ? ` (${fallbackId})` : ''}`);
    return project as ProjectInfoExtended;
  }

  /** Single transport entry point: catalogue id + typed request through the bus. */
  private async request<K extends EndpointId>(
    id: K,
    req: EndpointRequest<K> = {} as EndpointRequest<K>,
    projectId?: string,
  ): Promise<EndpointResponse<K>> {
    let response: EndpointResponse<K>;
    try {
      response = await apiBus.dispatch(id, req, projectId);
    } catch (err) {
      throw this.toError(err);
    }

    // The generated client rejects non-2xx responses; keep the legacy
    // rejection of 2xx responses carrying an error envelope as well.
    const envelope = response as unknown as Envelope<Record<string, unknown>> | null;
    if (envelope?.success === false) {
      throw new Error(envelope.error || 'API request failed');
    }
    return response;
  }

  /** Preserve the legacy plain-Error messages (body.error, then statusText). */
  private toError(err: unknown): Error {
    if (err instanceof ApiClientError) {
      const body = err.body;
      if (body && typeof body === 'object' && 'error' in body) {
        const message = (body as { error?: unknown }).error;
        if (typeof message === 'string' && message) return new Error(message);
      }
      const prefix = `HTTP ${err.status}`;
      if (err.message.startsWith(`${prefix} `)) {
        return new Error(err.message.slice(prefix.length + 1) || err.message);
      }
      return new Error(err.message);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
