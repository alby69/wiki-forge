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
    {
      job: {
        id: 'api-log-job',
        role: 'Script Automation',
        jobKind: 'script',
        scriptId: 'okf_log',
        useCaseId: '__script__:okf_log',
        args: { message: 'Job S4', type: 'Update' },
        schedule: { expression: '0 6 * * *', timezone: 'UTC' },
        enabled: false,
        steps: [0],
      },
      state: { last_status: 'idle' },
      description: 'ogni giorno alle 06:00 (UTC)',
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
  listeners: Map<string, Array<() => void>>;
  appendChild: (child: MockElement) => void;
  querySelector: (selector: string) => MockElement;
  querySelectorAll: (selector: string) => MockElement[];
  addEventListener: (type: string, listener: () => void) => void;
  fire: (type: string) => void;
  setAttribute: (key: string, value: string) => void;
  getAttribute: (key: string) => string | null;
  getBoundingClientRect: () => { height: number; bottom: number; top: number };
}

describe('KE Workbench schedule tab (F4)', () => {
  let calls: string[];
  let fetchInits: Array<RequestInit | undefined>;

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
        listeners: new Map<string, Array<() => void>>(),
        addEventListener(type, listener) {
          const list = element.listeners.get(type) ?? [];
          list.push(listener);
          element.listeners.set(type, list);
        },
        fire(type) {
          for (const listener of element.listeners.get(type) ?? []) listener();
        },
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
    fetchInits = [];
    (global as any).fetch = async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      fetchInits.push(init);
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
      if (url.includes('/api/ke/schedule/decisions')) {
        return jsonResponse({
          success: true,
          decisions: [
            {
              id: 'dec-1',
              jobId: 'nightly-validation',
              action: 'require_approval',
              origin: 'llm',
              rationale: 'Indice rimandato all’approvazione umana.',
              sources: ['config/agent_schedule.toml'],
              steps: [0],
              mutatingSteps: [1],
              at: '2026-11-19T02:00:00.000Z',
            },
          ],
        });
      }
      if (url.includes('/api/ke/schedule/approvals')) {
        return jsonResponse({
          success: true,
          approvals: [
            {
              id: 'appr-1',
              jobId: 'nightly-validation',
              stepIndex: 1,
              scriptId: 'okf_reindex',
              status: 'pending',
              rationale: 'Step mutante richiede approvazione.',
              sources: ['output/scheduler/audit.jsonl'],
              createdAt: '2026-11-19T02:00:00.000Z',
            },
            {
              id: 'appr-2',
              jobId: 'script-log-job',
              stepIndex: 0,
              jobKind: 'script',
              scriptId: 'okf_log',
              scriptArgs: { message: 'Approvazione S2 di prova', type: 'Update' },
              status: 'pending',
              rationale: 'Script mutante richiede approvazione.',
              sources: ['docs/SCRIPT_AUTOMATION_REFERENCE.md'],
              createdAt: '2026-11-19T02:05:00.000Z',
            },
          ],
          pending: [],
        });
      }
      if (url.includes('/api/scripts/schedule/')) {
        assert.strictEqual(init?.method, 'DELETE');
        return jsonResponse({ success: true, removed: true, errors: [] });
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

  it('sends the selected wiki on every KE request', async () => {
    (global as any).localStorage = {
      getItem: () => 'wikiforge',
      setItem: () => {},
    };
    const modal = new KEWorkbenchModal();
    await modal.open();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.ok(fetchInits.length > 0, 'expected at least one KE request');
    for (const init of fetchInits) {
      const headers = init?.headers as Record<string, string> | undefined;
      assert.strictEqual(headers?.['X-Project-Id'], 'wikiforge');
    }
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
    assert.ok(calls.some((url) => url.includes('/api/ke/schedule/decisions')), 'decisions fetched');
    assert.ok(calls.some((url) => url.includes('/api/ke/schedule/approvals')), 'approvals fetched');
    assert.ok(calls.some((url) => url.includes('/api/ke/schedule/events')), 'live SSE opened');

    const root = document.getElementById('ke-workbench-modal-root') as unknown as MockElement;
    const pane = root.querySelector('#ke-schedule-container');
    assert.match(pane.innerHTML, /Ontology Guardian/);
    assert.match(pane.innerHTML, /ke_ontological_validation/);
    assert.match(pane.innerHTML, /Esegui ora/);
    assert.match(pane.innerHTML, /20\/11\/2026, 02:00:00 UTC/);
    // F5: rationale and sources are always visible for each decision.
    assert.match(pane.innerHTML, /ke-policy-section/);
    assert.match(pane.innerHTML, /Indice rimandato all’approvazione umana\./);
    assert.match(pane.innerHTML, /config\/agent_schedule\.toml/);
    // F6: the mutating step is shown with explicit approve/reject controls.
    assert.match(pane.innerHTML, /ke-approval-card/);
    assert.match(pane.innerHTML, /okf_reindex/);
    assert.match(pane.innerHTML, /ke-approve-appr-1/);
    assert.match(pane.innerHTML, /ke-reject-appr-1/);
    // S2: script-job approvals are labelled and show the resolved arguments.
    assert.match(pane.innerHTML, /job script/);
    assert.match(pane.innerHTML, /use case/);
    assert.match(pane.innerHTML, /Args risolti/);
    assert.match(pane.innerHTML, /Approvazione S2 di prova/);
    assert.match(pane.innerHTML, /ke-approve-appr-2/);
    modal.close();
  });

  it('marks script jobs and removes them via apiBus (S4)', async () => {
    const modal = new KEWorkbenchModal();
    await modal.open();
    modal.setTab('schedule');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const root = document.getElementById('ke-workbench-modal-root') as unknown as MockElement;
    const pane = root.querySelector('#ke-schedule-container');
    assert.match(pane.innerHTML, /🕒 job script/);
    assert.match(pane.innerHTML, /okf_log/);
    assert.match(pane.innerHTML, /Args risolti/);
    assert.match(pane.innerHTML, /Job S4/);
    assert.match(pane.innerHTML, /id="ke-job-delete-api-log-job"/);
    assert.ok(!pane.innerHTML.includes('ke-job-delete-nightly_validation'), 'Use Case jobs have no remove control');

    calls = [];
    fetchInits = [];
    pane.querySelector('#ke-job-delete-api-log-job').fire('click');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(calls.some((url) => url.endsWith('/api/scripts/schedule/api-log-job')), 'DELETE was dispatched');
    assert.ok(fetchInits.some((init) => init?.method === 'DELETE'));
    modal.close();
  });
});
