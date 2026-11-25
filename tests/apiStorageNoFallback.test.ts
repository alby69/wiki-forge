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
