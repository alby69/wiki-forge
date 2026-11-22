/**
 * Files domain module — project file downloads behind the bus.
 *
 * Replaces the inline `/api/files/download` handler. The injected service owns
 * project-root resolution and path containment; this module only validates the
 * requested path and adapts the returned bytes to a binary `ApiResult`.
 */

import * as path from 'node:path';
import { binary, error, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import type { DomainServices, ProjectId } from './services';

type Payload = Record<string, unknown>;

export class FilesModule implements DomainModule {
  readonly name = 'files';

  constructor(private readonly services: DomainServices) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('files.download', (payload, context) => this.download(payload, context.projectId));
  }

  private async download(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const filePath = typeof payload.path === 'string' ? payload.path : '';
    if (!filePath) return error('Missing path parameter', 400);
    try {
      const projectRoot = await this.services.resolveRoot(projectId);
      const absPath = path.resolve(projectRoot, filePath);
      const rel = path.relative(projectRoot, absPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return error('Access denied', 400);
      const { filename, data } = await this.services.downloadFile(filePath, projectId);
      return binary(data, 'application/octet-stream', {
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
    } catch {
      return error('File not found', 404);
    }
  }
}

export function createFilesModule(services: DomainServices): FilesModule {
  return new FilesModule(services);
}
