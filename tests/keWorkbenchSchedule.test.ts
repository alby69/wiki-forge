import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KEWorkbenchModal } from '@frontend/components/ke/KEWorkbenchModal';

const SNAPSHOT = {
  enabled: true,
  running: true,
  lockHeld: true,
  activeJobs: [],
  jobs: [
    {
      job: {
        id: 'nightly-validation',
        role: 'Ontology Guardian',
        useCaseId: 'ke_ontological_validation',
        schedule: { expression: '0 2 * * *', timezone: 'Europe/Rome' },
        enabled: true,
        steps: [0, 1],
      },
      state: {
        last_status: 'success',
        next_run_at: '2026-11-20T02:00:00.000Z',
        last_run_at: '2026-11-19T02:00:00.000Z',
        consecutive_failures: 0,
      },
      description: 'ogni giorno alle 02:00 (Europe/Rome)',
    },
  ],
};

interface MockElement {
  id: string;
  style: Record<string, string>;
  innerHTML: string;
  attrs: Record<string, string>;
  children: unknown[];
  selectors: Map<string, MockElement>;
  appendChild: (child: MockElement) => void;
  querySelector: (selector: string) => MockElement;
  querySelectorAll: (selector: string) => MockElement[];
  addEventListener: () => void;
  setAttribute: (key: string, value: string) => void;
  getAttribute: (key: string) => string | null;
  getBoundingClientRect: () => { height: number; bottom: number; top: number };
}

describe('KE Workbench schedule tab (F4)', () => {
  let calls: string[];

  beforeEach(() => {
    const registry = new Map<string, MockElement>();

    const makeElement = (tag: string): MockElement => {
      const element: MockElement = {
        id: '',
        style: {},
        innerHTML: '',
        attrs: {},
        children: [],
        selectors: new Map(),
        appendChild(child) {
          element.children.push(child);
          if (child.id) registry.set(child.id, child);
        },
        querySelector(selector) {
          if (!element.selectors.has(selector)) {
            element.selectors.set(selector, makeElement('div'));
          }
          return element.selectors.get(selector)!;
        },
        querySelectorAll() {
          return [];
        },
        addEventListener() {},
        setAttribute(key, value) {
          element.attrs[key] = value;
        },
        getAttribute(key) {
          return element.attrs[key] ?? null;
        },
        getBoundingClientRect() {
          return { height: 0, bottom: 0, top: 0 };
        },
      };
      void tag;
      return element;
    };

    (global as any).document = {
      createElement: makeElement,
      getElementById: (id: string) => registry.get(id) ?? null,
      addEventListener: () => {},
      body: {
        appendChild: (child: MockElement) => {
          if (child.id) registry.set(child.id, child);
        },
      },
    };
    (global as any).window = { addEventListener: () => {} };
    (global as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
    (global as any).HTMLElement = class {};

    calls = [];
    (global as any).fetch = async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const jsonResponse = (payload: unknown) => ({
        ok: true,
        status: 200,
        json: async () => payload,
      });
      if (url.includes('/api/ke/use-cases')) {
        return jsonResponse({ success: true, useCases: [] });
      }
      if (url.includes('/api/ke/schedule/events')) {
        return {
          ok: true,
          status: 200,
          body: {
            getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
          },
        };
      }
      if (url.includes('/api/ke/schedule/runs')) {
        return jsonResponse({ success: true, runs: [] });
      }
      if (url.includes('/api/ke/schedule')) {
        return jsonResponse({ success: true, config: null, errors: [], snapshot: SNAPSHOT });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
  });

  it('renders both workbench tabs and the schedule pane', () => {
    const modal = new KEWorkbenchModal();
    const root = document.getElementById('ke-workbench-modal-root') as unknown as MockElement;
    assert.ok(root);
    assert.match(root.innerHTML, /data-tab="usecases"/);
    assert.match(root.innerHTML, /data-tab="schedule"/);
    assert.match(root.innerHTML, /id="ke-schedule-container"/);
    assert.match(root.innerHTML, /id="ke-schedule-history"/);
    assert.strictEqual(modal.getActiveTab(), 'usecases');
    modal.close();
  });

  it('loads the agent snapshot and opens the live stream when the tab is selected', async () => {
    const modal = new KEWorkbenchModal();
    await modal.open();
    assert.ok(calls.some((url) => url.includes('/api/ke/schedule')));
    assert.strictEqual(modal.getActiveTab(), 'usecases');

    calls = [];
    modal.setTab('schedule');
    assert.strictEqual(modal.getActiveTab(), 'schedule');
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.ok(calls.some((url) => url.endsWith('/api/ke/schedule')), 'snapshot refreshed');
    assert.ok(calls.some((url) => url.includes('/api/ke/schedule/runs')), 'history refreshed');
    assert.ok(calls.some((url) => url.includes('/api/ke/schedule/events')), 'live SSE opened');

    const root = document.getElementById('ke-workbench-modal-root') as unknown as MockElement;
    const pane = root.querySelector('#ke-schedule-container');
    assert.match(pane.innerHTML, /Ontology Guardian/);
    assert.match(pane.innerHTML, /ke_ontological_validation/);
    assert.match(pane.innerHTML, /Esegui ora/);
    assert.match(pane.innerHTML, /20\/11\/2026, 02:00:00 UTC/);
    modal.close();
  });
});
