import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiStorage } from '@frontend/storage/ApiStorage';
import { Header } from '@frontend/components/ui/Header';
import { appStore } from '@frontend/store/appStore';

interface CapturedCall {
  url: string;
  init?: RequestInit;
}

function installFetch(calls: CapturedCall[]): void {
  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: true,
      json: async () => ({ success: true, results: [], notes: [{}] }),
    };
  };
}

function headerOf(call: CapturedCall): Record<string, string> {
  return (call.init?.headers ?? {}) as Record<string, string>;
}

test('ApiStorage scopes research requests to an explicit project', async () => {
  const calls: CapturedCall[] = [];
  installFetch(calls);
  const storage = new ApiStorage('');

  await storage.researchSearch('architettura', 30, 'wikiforge');
  const search = calls[calls.length - 1];
  assert.ok(search.url.includes('/api/notes/research/search'));
  assert.ok(search.url.includes('q=architettura'));
  assert.ok(search.url.includes('projectId=wikiforge'));
  assert.equal(headerOf(search)['X-Project-Id'], 'wikiforge');

  await storage.researchBacklinks('guida/tutorial', 'wikiforge');
  assert.ok(calls[calls.length - 1].url.includes('projectId=wikiforge'));
  assert.equal(headerOf(calls[calls.length - 1])['X-Project-Id'], 'wikiforge');

  await storage.researchRelated('guida/tutorial', 12, 'wikiforge');
  assert.ok(calls[calls.length - 1].url.includes('projectId=wikiforge'));
  assert.equal(headerOf(calls[calls.length - 1])['X-Project-Id'], 'wikiforge');

  await storage.researchTrace('scheduler', 'wikiforge');
  assert.ok(calls[calls.length - 1].url.includes('projectId=wikiforge'));
  assert.equal(headerOf(calls[calls.length - 1])['X-Project-Id'], 'wikiforge');

  await storage.researchConsult('Come funziona il policy agent?', 'wikiforge');
  const consult = calls[calls.length - 1];
  assert.ok(consult.url.includes('/api/notes/research/consult?projectId=wikiforge'));
  assert.equal(consult.init?.method, 'POST');
  assert.equal(headerOf(consult)['X-Project-Id'], 'wikiforge');

  await storage.researchDeepResearch('OKF v0.2', 'wikiforge');
  const deep = calls[calls.length - 1];
  assert.ok(deep.url.includes('/api/notes/research/deep-research?projectId=wikiforge'));
  assert.equal(deep.init?.method, 'POST');
  assert.equal(headerOf(deep)['X-Project-Id'], 'wikiforge');

  await storage.getAllNotes('wikiforge');
  const notes = calls[calls.length - 1];
  assert.ok(notes.url.includes('/api/wiki/notes?projectId=wikiforge'));
  assert.equal(headerOf(notes)['X-Project-Id'], 'wikiforge');
});

test('ApiStorage explicit scope overrides the active project header', async () => {
  const calls: CapturedCall[] = [];
  installFetch(calls);
  const storage = new ApiStorage('');
  storage.setActiveProjectId('tesi');

  await storage.researchSearch('q', 30, 'wikiforge');
  assert.equal(headerOf(calls[calls.length - 1])['X-Project-Id'], 'wikiforge');

  await storage.researchSearch('q');
  const unscoped = calls[calls.length - 1];
  assert.ok(!unscoped.url.includes('projectId='));
  assert.equal(headerOf(unscoped)['X-Project-Id'], 'tesi');
});

test('Header renders the Docs Wiki button in Developer Mode and fires the callback', () => {
  (globalThis as any).window = { addEventListener: () => {} };
  appStore.setAdvancedMode(true);

  const listeners = new Map<string, Array<() => void>>();
  let html = '';
  const makeEl = (selector: string) => ({
    value: 'default',
    addEventListener: (type: string, cb: () => void) => {
      const key = `${selector}:${type}`;
      listeners.set(key, [...(listeners.get(key) ?? []), cb]);
    },
  });
  const container = {
    set innerHTML(value: string) {
      html = value;
    },
    get innerHTML(): string {
      return html;
    },
    querySelector: (selector: string) => makeEl(selector),
  } as unknown as HTMLElement;

  let opened = 0;
  const header = new Header({
    container,
    onOpenDocsWiki: () => {
      opened += 1;
    },
  });

  assert.ok(html.includes('header-docs-wiki-btn'), 'Docs Wiki button is rendered in Dev Mode');
  assert.ok(html.includes('📚 Wiki Docs'));
  for (const cb of listeners.get('#header-docs-wiki-btn:click') ?? []) cb();
  assert.equal(opened, 1);

  header.destroy();
  appStore.setAdvancedMode(false);
});
