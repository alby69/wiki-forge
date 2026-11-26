import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { LocalModelDto } from '@shared/api/types';
import { atomicWriteFile } from '../safeFs';
import type { ProjectService } from '../projectService';

export const LOCAL_MODEL_LIMITS = {
  maxBytes: 16 * 1024 * 1024 * 1024,
  maxChunkBytes: 8 * 1024 * 1024,
  maxChunks: 4096,
  chunkBytes: 4 * 1024 * 1024,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GGUF_MAGIC = Buffer.from('GGUF', 'utf8');

interface UploadSession {
  uploadId: string;
  fileName: string;
  safeName: string;
  size: number;
  chunkCount: number;
  received: number[];
  createdAt: string;
}

interface ModelRegistry {
  version: 1;
  models: LocalModelDto[];
  activeId?: string;
}

export interface LocalModelDependencies {
  rootDir: string;
  projects: ProjectService;
  invalidateLlmClient(): void;
}

function statusError(message: string, status: number): Error {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function validateFileName(raw: unknown): { fileName: string; safeName: string } {
  if (typeof raw !== 'string' || !raw.trim()) throw statusError('fileName is required', 400);
  const fileName = path.basename(raw.trim());
  if (fileName !== raw.trim()) throw statusError('fileName must be a basename', 400);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.gguf$/i.test(fileName)) {
    throw statusError('fileName must end with .gguf and contain only safe characters', 400);
  }
  if (fileName.length > 180) throw statusError('fileName is too long', 400);
  return { fileName, safeName: fileName };
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw statusError('Access denied: path traversal detected', 400);
  }
}

function decodeBase64Strict(raw: unknown): Buffer {
  if (typeof raw !== 'string' || !raw) throw statusError('contentBase64 is required', 400);
  if (raw.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
    throw statusError('Invalid base64 chunk payload', 400);
  }
  const data = Buffer.from(raw, 'base64');
  if (data.toString('base64') !== raw) throw statusError('Invalid base64 chunk payload', 400);
  if (data.byteLength > LOCAL_MODEL_LIMITS.maxChunkBytes) {
    throw statusError(`Chunk exceeds ${LOCAL_MODEL_LIMITS.maxChunkBytes} bytes`, 413);
  }
  return data;
}

export class LocalModelService {
  private readonly modelsDir: string;
  private readonly stateDir: string;
  private readonly registryPath: string;
  private readonly uploadsDir: string;

  constructor(private readonly deps: LocalModelDependencies) {
    this.modelsDir = path.resolve(deps.rootDir, 'models');
    this.stateDir = path.resolve(deps.rootDir, '.wiki-forge/llm');
    this.registryPath = path.join(this.stateDir, 'models.json');
    this.uploadsDir = path.join(this.stateDir, 'uploads');
  }

  public async list(): Promise<{ models: LocalModelDto[]; activeModelPath: string }> {
    const registry = await this.readRegistry();
    const activeModelPath = await this.readActiveModelPath();
    const models = registry.models.map((model) => ({
      ...model,
      active: model.relativePath === activeModelPath,
    }));
    return { models, activeModelPath };
  }

  public async startUpload(fileNameRaw: unknown, sizeRaw: unknown, chunkCountRaw: unknown): Promise<{ uploadId: string }> {
    const { fileName, safeName } = validateFileName(fileNameRaw);
    const size = Number(sizeRaw);
    const chunkCount = Number(chunkCountRaw);
    if (!Number.isSafeInteger(size) || size <= 0 || size > LOCAL_MODEL_LIMITS.maxBytes) {
      throw statusError(`size must be between 1 and ${LOCAL_MODEL_LIMITS.maxBytes} bytes`, 400);
    }
    if (!Number.isSafeInteger(chunkCount) || chunkCount <= 0 || chunkCount > LOCAL_MODEL_LIMITS.maxChunks) {
      throw statusError(`chunkCount must be between 1 and ${LOCAL_MODEL_LIMITS.maxChunks}`, 400);
    }

    await this.cleanupStaleUploads();
    const uploadId = randomUUID();
    const uploadDir = this.uploadDir(uploadId);
    await fs.mkdir(uploadDir, { recursive: true });
    const session: UploadSession = {
      uploadId, fileName, safeName, size, chunkCount, received: [], createdAt: new Date().toISOString(),
    };
    await this.writeSession(session);
    return { uploadId };
  }

  public async writeChunk(
    uploadIdRaw: unknown,
    chunkIndexRaw: unknown,
    contentBase64: unknown,
  ): Promise<{ received: boolean; receivedChunks: number }> {
    const uploadId = this.validateUploadId(uploadIdRaw);
    const chunkIndex = Number(chunkIndexRaw);
    const session = await this.readSession(uploadId);
    if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.chunkCount) {
      throw statusError(`chunkIndex must be between 0 and ${session.chunkCount - 1}`, 400);
    }
    if (session.received.includes(chunkIndex)) {
      return { received: false, receivedChunks: session.received.length };
    }

    const data = decodeBase64Strict(contentBase64);
    await atomicWriteFile(this.chunkPath(uploadId, chunkIndex), data);
    session.received = [...session.received, chunkIndex].sort((a, b) => a - b);
    await this.writeSession(session);
    return { received: true, receivedChunks: session.received.length };
  }

  public async finalizeUpload(uploadIdRaw: unknown): Promise<{ model: LocalModelDto }> {
    const uploadId = this.validateUploadId(uploadIdRaw);
    const session = await this.readSession(uploadId);
    if (session.received.length !== session.chunkCount) {
      throw statusError(
        `Upload incomplete: ${session.received.length}/${session.chunkCount} chunks received`,
        409,
      );
    }

    await fs.mkdir(this.modelsDir, { recursive: true });
    const target = path.join(this.modelsDir, session.safeName);
    assertInside(this.modelsDir, target);
    const temp = path.join(this.modelsDir, `.${session.safeName}.${uploadId}.tmp`);
    await fs.rm(temp, { force: true });

    const hash = createHash('sha256');
    let bytes = 0;
    await fs.writeFile(temp, Buffer.alloc(0));
    try {
      for (let index = 0; index < session.chunkCount; index += 1) {
        const data = await fs.readFile(this.chunkPath(uploadId, index));
        hash.update(data);
        bytes += data.byteLength;
        if (bytes > session.size) throw statusError('Uploaded bytes exceed declared size', 400);
        await fs.appendFile(temp, data);
      }
      if (bytes !== session.size) {
        throw statusError(`Uploaded ${bytes} bytes but declared ${session.size}`, 400);
      }

      const magic = Buffer.alloc(4);
      const handle = await fs.open(temp, 'r');
      try {
        const { bytesRead } = await handle.read(magic, 0, 4, 0);
        if (bytesRead !== 4 || !magic.equals(GGUF_MAGIC)) {
          throw statusError('Uploaded file is not a valid GGUF model (missing GGUF magic)', 400);
        }
      } finally {
        await handle.close();
      }

      await fs.rename(temp, target);
    } catch (error) {
      await fs.rm(temp, { force: true }).catch(() => undefined);
      throw error;
    }

    const registry = await this.readRegistry();
    const relativePath = `models/${session.safeName}`;
    const previous = registry.models.find((model) => model.relativePath === relativePath);
    const wasActive = registry.activeId === previous?.id;
    const model: LocalModelDto = {
      id: randomUUID(),
      name: session.fileName,
      path: target,
      relativePath,
      size: session.size,
      checksumSha256: hash.digest('hex'),
      registeredAt: new Date().toISOString(),
      active: wasActive,
    };
    registry.models = [model, ...registry.models.filter((entry) => entry.relativePath !== relativePath)];
    if (wasActive) registry.activeId = model.id;
    await this.writeRegistry(registry);
    await this.cleanupUpload(uploadId);
    return { model: { ...model, active: await this.isActive(model) } };
  }

  public async activate(idRaw: unknown): Promise<{ model: LocalModelDto; config: Record<string, unknown> }> {
    if (typeof idRaw !== 'string' || !UUID_RE.test(idRaw)) throw statusError('Invalid model id', 400);
    const registry = await this.readRegistry();
    const model = registry.models.find((entry) => entry.id === idRaw);
    if (!model) throw statusError(`GGUF model '${idRaw}' not found`, 404);

    const absolute = path.resolve(this.deps.rootDir, model.relativePath);
    assertInside(this.deps.rootDir, absolute);
    assertInside(this.modelsDir, absolute);
    await fs.access(absolute);

    const config = await this.deps.projects.mergeProjectConfig('default', {
      llm: { local: { enabled: true, model_path: model.relativePath } },
      agent: { llm: { provider: 'local' } },
    });
    registry.activeId = model.id;
    registry.models = registry.models.map((entry) => ({ ...entry, active: entry.id === model.id }));
    await this.writeRegistry(registry);
    this.deps.invalidateLlmClient();

    return {
      model: { ...model, active: true },
      config: {
        llm: (config.llm ?? {}) as Record<string, unknown>,
        agent: (config.agent ?? {}) as Record<string, unknown>,
      },
    };
  }

  private validateUploadId(raw: unknown): string {
    if (typeof raw !== 'string' || !UUID_RE.test(raw)) throw statusError('Invalid uploadId', 400);
    return raw;
  }

  private uploadDir(uploadId: string): string {
    return path.join(this.uploadsDir, uploadId);
  }

  private sessionPath(uploadId: string): string {
    return path.join(this.uploadDir(uploadId), 'session.json');
  }

  private chunkPath(uploadId: string, chunkIndex: number): string {
    return path.join(this.uploadDir(uploadId), `${String(chunkIndex).padStart(6, '0')}.bin`);
  }

  private async readSession(uploadId: string): Promise<UploadSession> {
    try {
      const raw = await fs.readFile(this.sessionPath(uploadId), 'utf8');
      const parsed = JSON.parse(raw) as UploadSession;
      if (parsed.uploadId !== uploadId || !Array.isArray(parsed.received)) {
        throw statusError('Invalid upload session', 500);
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw statusError(`Upload '${uploadId}' not found`, 404);
      }
      throw error;
    }
  }

  private async writeSession(session: UploadSession): Promise<void> {
    await atomicWriteFile(this.sessionPath(session.uploadId), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  }

  private async readRegistry(): Promise<ModelRegistry> {
    try {
      const raw = await fs.readFile(this.registryPath, 'utf8');
      const parsed = JSON.parse(raw) as ModelRegistry;
      if (parsed.version !== 1 || !Array.isArray(parsed.models)) {
        throw statusError('Invalid local model registry', 500);
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, models: [] };
      throw error;
    }
  }

  private async writeRegistry(registry: ModelRegistry): Promise<void> {
    await atomicWriteFile(this.registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  }

  private async readActiveModelPath(): Promise<string> {
    const config = await this.deps.projects.readProjectConfig('default');
    const local = config.llm as Record<string, unknown> | undefined;
    const modelPath = local?.local as Record<string, unknown> | undefined;
    return typeof modelPath?.model_path === 'string' ? modelPath.model_path : '';
  }

  private async isActive(model: LocalModelDto): Promise<boolean> {
    return (await this.readActiveModelPath()) === model.relativePath;
  }

  private async cleanupUpload(uploadId: string): Promise<void> {
    await fs.rm(this.uploadDir(uploadId), { recursive: true, force: true }).catch(() => undefined);
  }

  private async cleanupStaleUploads(): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(this.uploadsDir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await Promise.all(entries.map(async (entry) => {
      if (!entry.isDirectory()) return;
      const dir = path.join(this.uploadsDir, entry.name);
      const stat = await fs.stat(dir).catch(() => undefined);
      if (stat && stat.mtimeMs < cutoff) await this.cleanupUpload(entry.name);
    }));
  }
}
