/**
 * Vault domain module: wiki notes, folders, scratchpad, trash and uploads.
 *
 * Replaces the inline `/api/wiki/*` handlers. Every command calls the injected
 * `DomainServices` and returns an HTTP-neutral `ApiResult`; the legacy field
 * names, response envelopes and error statuses are kept intact, including the
 * contract-to-legacy payload aliases used by the generated API client.
 */

import * as path from 'node:path';
import { error, json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import type { DomainServices, JsonObject, ProjectId } from './services';

type Payload = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Legacy handlers propagate an `err.status` (e.g. 400/409) when present. */
function errorStatus(err: unknown): number {
  return (err as { status?: number }).status || 500;
}

export class VaultModule implements DomainModule {
  readonly name = 'vault';

  constructor(private readonly services: DomainServices) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('wiki.notes.list', (_payload, context) => this.notes(context.projectId));
    bus.register<Payload>('wiki.folders.list', (_payload, context) => this.folders(context.projectId));
    bus.register<Payload>('wiki.scratchpad.list', (_payload, context) => this.scratchpad(context.projectId));
    bus.register<Payload>('wiki.scratchpad.delete', (payload, context) => this.deleteScratchpad(payload, context.projectId));
    bus.register<Payload>('wiki.note.save', (payload, context) => this.saveNote(payload, context.projectId));
    bus.register<Payload>('wiki.note.applyEdit', (payload, context) => this.applyEdit(payload, context.projectId));
    bus.register<Payload>('wiki.note.attach', (payload, context) => this.attach(payload, context.projectId));
    bus.register<Payload>('wiki.folder.create', (payload, context) => this.createFolder(payload, context.projectId));
    bus.register<Payload>('wiki.file.create', (payload, context) => this.createFile(payload, context.projectId));
    bus.register<Payload>('wiki.rename', (payload, context) => this.rename(payload, context.projectId));
    bus.register<Payload>('wiki.move', (payload, context) => this.move(payload, context.projectId));
    bus.register<Payload>('wiki.delete', (payload, context) => this.remove(payload, context.projectId));
    bus.register<Payload>('wiki.trash.list', (_payload, context) => this.trashList(context.projectId));
    bus.register<Payload>('wiki.trash.restore', (payload, context) => this.trashRestore(payload, context.projectId));
    bus.register<Payload>('wiki.upload', (payload, context) => this.upload(payload, context.projectId));
    bus.register<Payload>('wiki.ingest', (payload, context) => this.ingest(payload, context.projectId));
  }

  private async notes(projectId: ProjectId): Promise<ApiResult> {
    try {
      const notes = await this.services.readAllWikiNotes(projectId);
      return json({ success: true, notes });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async folders(projectId: ProjectId): Promise<ApiResult> {
    try {
      const folders = await this.services.getAllFolders(projectId);
      return json({ success: true, folders });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async scratchpad(projectId: ProjectId): Promise<ApiResult> {
    try {
      const entries = await this.services.readScratchpadEntries(projectId);
      return json({ success: true, entries });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async deleteScratchpad(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const ok = await this.services.deleteScratchpadEntry(asString(payload.id) ?? '', projectId);
      return json({ success: ok }, ok ? 200 : 404);
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async saveNote(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.saveWikiNote(payload, projectId);
      return json({ success: true, note: result });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async applyEdit(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.applyWikiEdit(payload, projectId);
      return json({ success: true, note: result });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async attach(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.attachToNote(payload, projectId);
      return json({ success: true, note: result });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async createFolder(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const data: JsonObject = {
        ...payload,
        folderPath: asString(payload.folderPath) || asString(payload.path) || '',
      };
      const result = await this.services.createFolderHandler(data, projectId);
      return json({ success: true, folder: result });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async createFile(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const data: JsonObject = {
        ...payload,
        folderPath: asString(payload.folderPath) || asString(payload.folder) || '',
        fileName: asString(payload.fileName) || asString(payload.name) || '',
      };
      const result = await this.services.createFileHandler(data, projectId);
      return json({ success: true, note: result });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async rename(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const data: JsonObject = { ...payload };
      const oldPath = asString(payload.oldPath) || asString(payload.from);
      if (oldPath !== undefined) data.oldPath = oldPath;
      // Keep the legacy distinction between a human title and a raw file name.
      // The contract's `to` is a path, so it maps to the raw `newName` field.
      const legacyTitle = asString(payload.newTitle);
      const legacyName = asString(payload.newName);
      const contractTo = asString(payload.to);
      if (!legacyTitle && !legacyName && contractTo) data.newName = contractTo;
      const result = await this.services.renameHandler(data, projectId);
      return json(result);
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async move(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const data: JsonObject = {
        ...payload,
        sourcePath: asString(payload.sourcePath) || asString(payload.from) || '',
        targetFolder: asString(payload.targetFolder) || asString(payload.to) || '',
      };
      const result = await this.services.moveHandler(data, projectId);
      return json(result);
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async remove(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const data: JsonObject = {
        ...payload,
        targetPath: asString(payload.targetPath) || asString(payload.path) || '',
      };
      const entry = await this.services.deleteHandler(data, projectId);
      return json({ success: true, trashed: entry });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async trashList(projectId: ProjectId): Promise<ApiResult> {
    try {
      const entries = await this.services.listTrash(projectId);
      return json({ success: true, entries });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async trashRestore(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const id = asString(payload.id);
      if (!id) throw new Error('A trash entry id is required');
      const originalPath = await this.services.restoreTrash(id, projectId);
      return json({ success: true, originalPath });
    } catch (err) {
      return error(String(err), 400);
    }
  }

  private async upload(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const contractPath = asString(payload.path) || '';
      const data: JsonObject = {
        ...payload,
        folderPath: asString(payload.folderPath) || (contractPath ? path.dirname(contractPath) : ''),
        fileName: asString(payload.fileName) || (contractPath ? path.basename(contractPath) : ''),
        content: asString(payload.content) || '',
        isBase64: asString(payload.encoding) === 'base64' || asBool(payload.isBase64) === true,
      };
      await this.services.uploadHandler(data, projectId);
      return json({ success: true });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }

  private async ingest(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const data: JsonObject = {
        ...payload,
        fileName: asString(payload.fileName) || '',
        content: asString(payload.content) || '',
        targetFolder: asString(payload.targetFolder) || asString(payload.folder),
        isBase64: asString(payload.encoding) === 'base64' || asBool(payload.isBase64) === true,
      };
      const result = await this.services.ingestMarkdownHandler(data, projectId);
      return json({ success: true, ...result });
    } catch (err) {
      return error(String(err), errorStatus(err));
    }
  }
}

export function createVaultModule(services: DomainServices): VaultModule {
  return new VaultModule(services);
}
