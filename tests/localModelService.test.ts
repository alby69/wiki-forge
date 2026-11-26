import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ProjectService } from '@backend/server/projectService';
import { LocalModelService } from '@backend/server/services/localModelService';

function split(base64: string, parts: number): string[] {
  const bytes = Buffer.from(base64, 'base64');
  const size = Math.ceil(bytes.byteLength / parts);
  const chunks: string[] = [];
  for (let index = 0; index < bytes.byteLength; index += size) {
    chunks.push(bytes.subarray(index, index + size).toString('base64'));
  }
  return chunks;
}

describe('Local GGUF model registry', () => {
  let rootDir: string;
  let projects: ProjectService;
  let invalidations: number;
  let models: LocalModelService;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-local-gguf-'));
    projects = new ProjectService(rootDir);
    invalidations = 0;
    models = new LocalModelService({
      rootDir,
      projects,
      invalidateLlmClient: () => { invalidations += 1; },
    });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  async function upload(payload: Buffer, fileName = 'tiny.Q4_K_M.gguf') {
    const chunks = split(payload.toString('base64'), 2);
    const { uploadId } = await models.startUpload(fileName, payload.byteLength, chunks.length);
    for (let index = 0; index < chunks.length; index += 1) {
      await models.writeChunk(uploadId, index, chunks[index]);
    }
    return models.finalizeUpload(uploadId);
  }

  it('assembles chunked uploads, validates GGUF magic and registers the model', async () => {
    const payload = Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(28, 7)]);
    const { model } = await upload(payload);

    assert.equal(model.name, 'tiny.Q4_K_M.gguf');
    assert.equal(model.relativePath, 'models/tiny.Q4_K_M.gguf');
    assert.equal(model.size, payload.byteLength);
    assert.match(model.checksumSha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(await fs.readFile(path.join(rootDir, model.relativePath)), payload);

    const listed = await models.list();
    assert.equal(listed.models.length, 1);
    assert.equal(listed.models[0].id, model.id);
  });

  it('rejects non-GGUF payloads without registering anything', async () => {
    await assert.rejects(
      () => upload(Buffer.concat([Buffer.from('NOPE'), Buffer.alloc(28, 1)])),
      /not a valid GGUF/,
    );
    const listed = await models.list();
    assert.equal(listed.models.length, 0);
  });

  it('rejects path traversal in file names and incomplete uploads', async () => {
    await assert.rejects(
      () => models.startUpload('../../evil.gguf', 4, 1),
      /basename|safe characters/,
    );

    const { uploadId } = await models.startUpload('partial.gguf', 8, 2);
    await models.writeChunk(uploadId, 0, Buffer.from('GGUF').toString('base64'));
    await assert.rejects(() => models.finalizeUpload(uploadId), /Upload incomplete/);
  });

  it('activates the model, rewrites root config and invalidates the cached LLM client', async () => {
    const { model } = await upload(Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(12, 3)]), 'activated.gguf');

    const result = await models.activate(model.id);
    assert.equal(result.model.active, true);
    assert.equal(invalidations, 1);

    const config = await projects.readProjectConfig('default');
    assert.deepEqual(config.agent, { llm: { provider: 'local' } });
    assert.deepEqual(config.llm, { local: { enabled: true, model_path: 'models/activated.gguf' } });

    const listed = await models.list();
    assert.equal(listed.activeModelPath, 'models/activated.gguf');
    assert.equal(listed.models[0].active, true);
  });
});
