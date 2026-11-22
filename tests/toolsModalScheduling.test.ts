import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ToolsModal } from '@frontend/components/tools/ToolsModal';
import { eventBus } from '@frontend/core/events';

/** Minimal DOM double: the components only need id lookup and innerHTML. */
interface MockElement {
  id: string;
  style: Record<string, string>;
  innerHTML: string;
  textContent: string;
  className: string;
  attrs: Record<string, string>;
  children: unknown[];
  selectors: Map<string, MockElement>;
  listeners: Map<string, Array<() => void>>;
  appendChild: (child: MockElement) => void;
  removeChild: (child: MockElement) => void;
  querySelector: (selector: string) => MockElement;
  querySelectorAll: (selector: string) => MockElement[];
  addEventListener: (type: string, listener: () => void) => void;
  fire: (type: string) => void;
  setAttribute: (key: string, value: string) => void;
  getAttribute: (key: string) => string | null;
}

const REGISTRY = {
  lint: {
    id: 'okf_lint',
    path: 'scripts/okf_lint.py',
    displayName: 'OKF Lint',
    category: 'OKF Maintenance',
    description: 'Controllo link e frontmatter',
    parameters: [
      { name: 'message', label: 'Messaggio', type: 'text', default: 'default-msg', required: false },
      { name: 'type', label: 'Tipo', type: 'select', options: ['Update', 'Note'], default: 'Update' },
    ],
    automation: {
      safety: 'read-only',
      schedulable: true,
      enabledDefault: false,
      defaultSchedule: '0 2 * * *',
      defaultArgs: {},
      requires: [],
      notes: 'nessuna scrittura',
    },
  },
  wizard: {
    id: 'wizard',
    path: 'scripts/wizard.py',
    displayName: 'Wizard',
    category: 'Wizard',
    description: 'Procedura interattiva',
    parameters: [],
    automation: {
      safety: 'blocked',
      schedulable: false,
      enabledDefault: false,
      defaultSchedule: '',
      defaultArgs: {},
      requires: ['tty'],
      notes: 'mai automatico',
    },
  },
};

describe('ToolsModal scheduling (S4)', () => {
  let calls: string[];
  let fetchInits: Array<RequestInit | undefined>;
  let firstScript: 'lint' | 'wizard';

  const wait = () => new Promise((resolve) => setTimeout(resolve, 20));

  beforeEach(() => {
    const registry = new Map<string, MockElement>();
    const makeElement = (): MockElement => {
      const element: MockElement = {
        id: '',
        style: {},
        innerHTML: '',
        textContent: '',
        className: '',
        attrs: {},
        children: [],
        selectors: new Map(),
        listeners: new Map(),
        appendChild(child) {
          element.children.push(child);
          if (child.id) registry.set(child.id, child);
        },
        removeChild(child) {
          element.children = element.children.filter((item) => item !== child);
        },
        querySelector(selector) {
          if (!element.selectors.has(selector)) {
            element.selectors.set(selector, makeElement());
          }
          return element.selectors.get(selector)!;
        },
        querySelectorAll() {
          return [];
        },
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
      };
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
        removeChild: () => {},
      },
    };
    (global as any).window = { addEventListener: () => {} };
    (global as any).localStorage = { getItem: () => null, setItem: () => {} };
    (global as any).HTMLElement = class {};
    // The form is a DOM double, so provide the two values the mock form holds.
    (global as any).FormData = class {
      private readonly values: Record<string, string> = {
        message: 'valore dal form',
        type: 'Note',
      };
      public has(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.values, name);
      }
      public get(name: string): string | null {
        return this.values[name] ?? null;
      }
    };

    firstScript = 'lint';
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
      if (url.includes('/api/scripts/registry')) {
        const ordered = firstScript === 'lint'
          ? { okf_lint: REGISTRY.lint, wizard: REGISTRY.wizard }
          : { wizard: REGISTRY.wizard, okf_lint: REGISTRY.lint };
        return jsonResponse({ success: true, registry: ordered });
      }
      if (url.includes('/api/scripts/schedule')) {
        return jsonResponse({
          success: true,
          job: { id: 'job', jobKind: 'script' },
          errors: [],
          warnings: ['⚠ job mutante disabilitato fino ad approvazione F6'],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
  });

  it('shows the safety badge and schedules with resolved args via apiBus', async () => {
    const changed: Array<{ projectId?: string }> = [];
    const off = eventBus.on('schedule:changed', (payload) => changed.push(payload));
    const modal = new ToolsModal(() => {}, () => 'project-alpha');
    await modal.open();

    const root = document.getElementById('tools-modal-root') as unknown as MockElement;
    const formHost = root.querySelector('#tool-form-container');
    const buttonTag = formHost.innerHTML.match(/<button id="schedule-tool-btn"[^>]*>/)?.[0] ?? '';
    assert.ok(buttonTag.includes('type="button"'), 'schedule button is present');
    assert.match(formHost.innerHTML, /🕒 Schedula/);
    assert.ok(!buttonTag.includes('disabled'), 'read-only scripts are schedulable');
    assert.match(formHost.innerHTML, /data-safety="read-only"/);
    assert.match(formHost.innerHTML, /🟢 read-only/);

    calls = [];
    fetchInits = [];
    formHost.querySelector('#schedule-tool-btn').fire('click');
    await wait();

    const scheduleIndex = calls.findIndex((url) => url.endsWith('/api/scripts/schedule'));
    assert.ok(scheduleIndex >= 0, 'POST /api/scripts/schedule was dispatched via the bus');
    assert.strictEqual(fetchInits[scheduleIndex]?.method, 'POST');
    const headers = fetchInits[scheduleIndex]?.headers as Record<string, string>;
    assert.strictEqual(headers['Content-Type'], 'application/json');
    assert.strictEqual(headers['X-Project-Id'], 'project-alpha');
    const body = JSON.parse(String(fetchInits[scheduleIndex]?.body));
    assert.match(body.id, /^script-okf_lint-\d+$/);
    assert.strictEqual(body.scriptId, 'okf_lint');
    assert.strictEqual(body.schedule, '0 2 * * *');
    assert.deepStrictEqual(body.args, { message: 'valore dal form', type: 'Note' });
    assert.strictEqual(body.project, 'project-alpha');

    // F6 warnings are surfaced and the other component is notified via eventBus.
    const logBody = root.querySelector('#tools-log-console-root').querySelector('#log-body');
    const logText = logBody.children
      .map((child) => (child as MockElement).textContent)
      .join('\n');
    assert.match(logText, /⚠ job mutante disabilitato/);
    assert.deepStrictEqual(changed, [{ projectId: 'project-alpha' }]);

    modal.close();
    off();
  });

  it('disables scheduling for blocked scripts', async () => {
    firstScript = 'wizard';
    const modal = new ToolsModal(() => {}, () => 'project-alpha');
    await modal.open();

    const root = document.getElementById('tools-modal-root') as unknown as MockElement;
    const formHost = root.querySelector('#tool-form-container');
    const buttonTag = formHost.innerHTML.match(/<button id="schedule-tool-btn"[^>]*>/)?.[0] ?? '';
    assert.ok(buttonTag.includes('disabled'), 'blocked scripts cannot be scheduled from the UI');
    assert.match(formHost.innerHTML, /data-safety="blocked"/);
    assert.match(formHost.innerHTML, /🔴 blocked/);

    calls = [];
    formHost.querySelector('#schedule-tool-btn').fire('click');
    await wait();
    assert.ok(!calls.some((url) => url.endsWith('/api/scripts/schedule')), 'no API call for blocked scripts');

    modal.close();
  });
});
