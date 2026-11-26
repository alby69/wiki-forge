import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ApiStorage } from '@frontend/storage/ApiStorage';
import { ApiClientError } from '@frontend/api/client';
import { api, apiBus, createStorageApi } from '@frontend/core/apiFacade';
import { eventBus } from '@frontend/core/events';

describe('ApiStorage: single facade and explicit failures', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('createStorageApi returns the shared bus and storage dispatches through it', async () => {
    assert.strictEqual(api, apiBus);
    assert.strictEqual(createStorageApi('http://example.test'), apiBus);

    const calls: Array<{ id: string; options: unknown }> = [];
    const originalDispatch = apiBus.dispatch;
    (apiBus as any).dispatch = async (
      id: string,
      _req: unknown,
      _projectId: string | undefined,
      options: unknown,
    ) => {
      calls.push({ id, options });
      return { success: true, notes: [], graph: { nodes: [], links: [] } };
    };

    try {
      const storage = new ApiStorage('http://example.test');
      await storage.getAllNotes();
    } finally {
      (apiBus as any).dispatch = originalDispatch;
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, 'wiki.notes.list');
    assert.deepEqual(calls[0].options, { scopeQuery: true, baseUrl: 'http://example.test' });
  });

  test('GGUF helpers dispatch typed operations through the shared bus', async () => {
    const calls: Array<{ id: string; req: any }> = [];
    const originalDispatch = apiBus.dispatch;
    const model = {
      id: 'model-1', name: 'tiny.gguf', path: '/models/tiny.gguf', relativePath: 'models/tiny.gguf',
      size: 32, checksumSha256: 'a'.repeat(64), registeredAt: '2026-01-01T00:00:00.000Z', active: true,
    };
    (apiBus as any).dispatch = async (id: string, req: any) => {
      calls.push({ id, req });
      if (id === 'projects.gguf.list') return { success: true, models: [model], activeModelPath: model.relativePath };
      if (id === 'projects.gguf.uploadStart') return { success: true, uploadId: 'upload-1' };
      if (id === 'projects.gguf.uploadChunk') return { success: true, received: true, receivedChunks: 1 };
      if (id === 'projects.gguf.uploadFinalize') return { success: true, model };
      if (id === 'projects.gguf.activate') return { success: true, model, config: { llm: {}, agent: {} } };
      if (id === 'projects.gguf.deactivate') {
        return { success: true, activeModelPath: '', provider: 'opencode', config: { llm: {}, agent: {} } };
      }
      throw new Error(`unexpected operation ${id}`);
    };

    try {
      const storage = new ApiStorage('http://example.test');
      assert.equal((await storage.listLocalModels('proj')).models.length, 1);
      assert.equal(await storage.startGgufUpload('tiny.gguf', 32, 1, 'proj'), 'upload-1');
      assert.equal(await storage.uploadGgufChunk('upload-1', 0, 'R0dVRg==', 'proj'), 1);
      assert.equal((await storage.finalizeGgufUpload('upload-1', 'proj')).id, 'model-1');
      assert.equal((await storage.activateLocalModel('model-1', 'proj')).model.id, 'model-1');
      assert.equal((await storage.deactivateLocalModel('proj')).provider, 'opencode');
    } finally {
      (apiBus as any).dispatch = originalDispatch;
    }

    assert.deepEqual(calls.map((call) => call.id), [
      'projects.gguf.list',
      'projects.gguf.uploadStart',
      'projects.gguf.uploadChunk',
      'projects.gguf.uploadFinalize',
      'projects.gguf.activate',
      'projects.gguf.deactivate',
    ]);
    assert.deepEqual(calls[1].req.body, { fileName: 'tiny.gguf', size: 32, chunkCount: 1 });
    assert.deepEqual(calls[4].req.body, { modelId: 'model-1' });
  });

  test('failed API calls reject without a local filesystem fallback', async () => {
    const storage = new ApiStorage('http://storage.test');
    const seen: string[] = [];
    const offRequest = eventBus.on('api:request', ({ id }) => seen.push(`request:${id}`));
    const offError = eventBus.on('api:error', ({ id }) => seen.push(`error:${id}`));
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;

    try {
      const operations: Array<() => Promise<unknown>> = [
        () => storage.getAllNotes(),
        () => storage.saveNote({ id: 'note', content: '# note' }),
        () => storage.attachNote({ content: '# note' }),
        () => storage.createFolder('wiki/x'),
        () => storage.createFile('wiki', 'note.md', '# note'),
        () => storage.renameItem('wiki/note.md', 'new.md'),
        () => storage.moveItem('wiki/note.md', 'wiki/x'),
        () => storage.uploadFile('wiki', 'note.md', '# note'),
      ];

      for (const operation of operations) {
        await assert.rejects(operation(), (err: unknown) =>
          err instanceof ApiClientError && err.status === 0 && /offline/.test(err.message));
      }

      assert.ok(seen.includes('request:wiki.notes.list'));
      assert.ok(seen.includes('error:wiki.notes.list'));

      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => ({ success: false, error: 'denied' }),
      })) as unknown as typeof fetch;

      await assert.rejects(storage.createFile('wiki', 'note.md', '# note'), (err: unknown) =>
        err instanceof ApiClientError && err.status === 200 && err.message === 'denied');
    } finally {
      offRequest();
      offError();
    }

    const source = await readFile('src/frontend/storage/ApiStorage.ts', 'utf-8');
    assert.doesNotMatch(source, /FileStorage/);
    assert.doesNotMatch(source, /this\.fallback/);
  });
});
