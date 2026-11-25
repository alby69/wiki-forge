import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, apiBus } from '@frontend/core/apiFacade';
import { eventBus } from '@frontend/core/events';
import { BUILT_IN_TEMPLATES, loadCanonicalTemplates } from '@frontend/services/templateService';

test('built-in template fallback is explicit through the shared bus api:error', async () => {
  assert.strictEqual(api, apiBus);

  const originalFetch = globalThis.fetch;
  const errors: Array<{ id: string; error: string }> = [];
  const off = eventBus.on('api:error', payload => errors.push(payload));
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as typeof fetch;

  try {
    const templates = await loadCanonicalTemplates();
    assert.deepEqual(templates, BUILT_IN_TEMPLATES);
    assert.ok(errors.some(({ id, error }) => id === 'templates.list' && error.includes('offline')));
  } finally {
    off();
    globalThis.fetch = originalFetch;
  }
});
