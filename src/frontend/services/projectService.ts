import { eventBus } from '@frontend/core/events';
import { getActiveProjectId, resolveApiBaseUrl, type ProjectInfo } from '@frontend/storage/ApiStorage';

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
  private readonly baseUrl: string;

  constructor(baseUrl: string = resolveApiBaseUrl()) {
    this.baseUrl = baseUrl || resolveApiBaseUrl();
  }

  public async list(includeArchived = true): Promise<ProjectInfoExtended[]> {
    const json = await this.request<Envelope<{ projects?: ProjectInfoExtended[] }>>(
      `/api/projects?includeArchived=${includeArchived ? 'true' : 'false'}`
    );
    return json.projects ?? [];
  }

  public async create(id: string, name: string): Promise<ProjectInfoExtended> {
    const json = await this.request<Envelope<{ project?: ProjectInfoExtended }>>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ id, name }),
    });
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async rename(id: string, name: string): Promise<ProjectInfoExtended> {
    const json = await this.request<Envelope<{ project?: ProjectInfoExtended }>>(
      `/api/projects/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ name }) },
      id
    );
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async clone(sourceId: string, options: CloneProjectOptions): Promise<ProjectInfoExtended> {
    const json = await this.request<Envelope<{ project?: ProjectInfoExtended }>>(
      `/api/projects/${encodeURIComponent(sourceId)}/clone`,
      {
        method: 'POST',
        body: JSON.stringify({ id: options.id, name: options.name, include: options.include }),
      },
      sourceId
    );
    const project = this.requireProject(json.project, options.id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async archive(id: string): Promise<ProjectInfoExtended> {
    const json = await this.request<Envelope<{ project?: ProjectInfoExtended }>>(
      `/api/projects/${encodeURIComponent(id)}/archive`,
      { method: 'POST' },
      id
    );
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async restore(id: string): Promise<ProjectInfoExtended> {
    const json = await this.request<Envelope<{ project?: ProjectInfoExtended }>>(
      `/api/projects/${encodeURIComponent(id)}/restore`,
      { method: 'POST' },
      id
    );
    const project = this.requireProject(json.project, id);
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async remove(id: string, mode: ProjectDeleteMode = 'trash', confirm?: string): Promise<void> {
    const query = new URLSearchParams({ mode });
    if (confirm !== undefined) query.set('confirm', confirm);
    await this.request<Envelope<Record<string, unknown>>>(
      `/api/projects/${encodeURIComponent(id)}?${query.toString()}`,
      { method: 'DELETE' },
      id
    );
    eventBus.emit('project:changed', { id });
  }

  public async exportBundle(id: string): Promise<ProjectBundle> {
    const json = await this.request<Envelope<{ bundle?: ProjectBundle }>>(
      `/api/projects/${encodeURIComponent(id)}/export`,
      {},
      id
    );
    if (!json.bundle) throw new Error(`Missing export bundle for project ${id}`);
    return json.bundle;
  }

  public async importBundle(bundle: unknown): Promise<ProjectInfoExtended> {
    const json = await this.request<Envelope<{ project?: ProjectInfoExtended }>>('/api/projects/import', {
      method: 'POST',
      body: JSON.stringify({ bundle }),
    });
    const project = this.requireProject(json.project, '');
    eventBus.emit('project:changed', { id: project.id });
    return project;
  }

  public async stats(id: string): Promise<ProjectStats> {
    const json = await this.request<Envelope<{ stats?: ProjectStats }>>(
      `/api/projects/${encodeURIComponent(id)}/stats`,
      {},
      id
    );
    return (json.stats ?? {}) as ProjectStats;
  }

  private requireProject(project: ProjectInfoExtended | undefined, fallbackId: string): ProjectInfoExtended {
    if (!project) throw new Error(`Missing project in response${fallbackId ? ` (${fallbackId})` : ''}`);
    return project;
  }

  private async request<T>(path: string, init: RequestInit = {}, projectId?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Project-Id': projectId ?? getActiveProjectId(),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }

    let json: Envelope<Record<string, unknown>> | null = null;
    try {
      json = (await response.json()) as Envelope<Record<string, unknown>> | null;
    } catch (_err) {
      // Non-JSON errors still need a useful message.
    }
    if (!response.ok || json?.success === false) {
      throw new Error(json?.error || response.statusText || `HTTP ${response.status}`);
    }
    return (json ?? {}) as T;
  }
}
