import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiStorage } from '@frontend/storage/ApiStorage';
import { ReviewStudio } from '@frontend/components/review/ReviewStudio';

interface MockElement {
  id: string;
  style: Record<string, string>;
  classList: { add: (name: string) => void; remove: (name: string) => void; contains: (name: string) => boolean };
  innerHTML: string;
  attrs: Record<string, string>;
  children: unknown[];
  selectors: Map<string, MockElement>;
  listeners: Map<string, Array<() => void>>;
  appendChild: (child: MockElement) => void;
  querySelector: (selector: string) => MockElement;
  querySelectorAll: (selector: string) => MockElement[];
  addEventListener: (type: string, listener: () => void) => void;
  setAttribute: (key: string, value: string) => void;
  getAttribute: (key: string) => string | null;
}

const PROPOSAL = {
  id: 'cs-1763800000000-a1b2c3d',
  description: '[A3] knowledge_gap — wiki/target.md',
  status: 'pending',
  rationale: 'Finding knowledge_gap-target-a1b2c3d4e5f6 (confidenza 0.9). Azione proposta: deep-research.',
  sources: ['cq=CQ-01', 'status=UNCOVERED'],
  finding: {
    findingId: 'knowledge_gap-target-a1b2c3d4e5f6',
    kind: 'knowledge_gap',
    confidence: 0.9,
    evidence: ['cq=CQ-01', 'status=UNCOVERED'],
    targetPath: 'wiki/target.md',
    proposedAction: 'deep-research',
  },
  edits: [{ file: 'wiki/target.md', action: 'modify', snapshotId: '2026-11-22T10-00-00-000Z' }],
};

describe('A3 — Review Studio proposte via apiBus', () => {
  let calls: string[];

  beforeEach(() => {
    const registry = new Map<string, MockElement>();
    const makeElement = (): MockElement => {
      const element: MockElement = {
        id: '',
        style: {},
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false,
        },
        innerHTML: '',
        attrs: {},
        children: [],
        selectors: new Map(),
        listeners: new Map(),
        appendChild(child) {
          element.children.push(child);
          if (child.id) registry.set(child.id, child);
        },
        querySelector(selector) {
          if (!element.selectors.has(selector)) element.selectors.set(selector, makeElement());
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
        style: {},
        appendChild: (child: MockElement) => {
          if (child.id) registry.set(child.id, child);
        },
      },
    };
    (global as any).window = { addEventListener: () => {} };
    (global as any).localStorage = { getItem: () => null, setItem: () => {} };
    (global as any).HTMLElement = class {};

    calls = [];
    (global as any).fetch = async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || 'GET'} ${url}`);
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, changesets: [PROPOSAL] }),
      };
    };
  });

  it('shows a staged finding in the Proposte tab using the typed changeset route', async () => {
    const studio = new ReviewStudio(new ApiStorage());
    studio.open('target', 'proposte');
    // Let the async apiBus dispatch resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(
      calls.some((call) => call.startsWith('GET ') && call.includes('/api/v1/changesets')),
      `expected a changesets.list call, got ${JSON.stringify(calls)}`,
    );
    const body = (global as any).document.getElementById('wf-review-studio').querySelector('#wf-rs-body').innerHTML;
    assert.match(body, /Proposte da finding \(1\)/);
    assert.match(body, /knowledge_gap-target-a1b2c3d4e5f6/);
    assert.match(body, /wiki\/target\.md/);
    assert.match(body, /deep-research/);
    assert.match(body, /status=UNCOVERED/);
    assert.match(body, /nessun file viene scritto prima dell'approvazione umana/);
  });
});
