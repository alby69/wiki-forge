import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MainLayout } from '@frontend/components/ui/MainLayout';

type MockEl = {
  style: Record<string, string>;
  classList: {
    add: (...classes: string[]) => void;
    remove: (...classes: string[]) => void;
    contains: (name: string) => boolean;
    toggle: (name: string, force?: boolean) => boolean;
  };
  _listeners: Map<string, Array<() => void>>;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
  setAttribute: () => void;
  focus: () => void;
  innerHTML: string;
};

function createDom() {
  const elements = new Map<string, MockEl>();
  let html = '';
  const makeEl = (selector: string): MockEl => {
    const existing = elements.get(selector);
    if (existing) return existing;
    const listeners = new Map<string, Array<() => void>>();
    const classes = new Set<string>();
    const el: MockEl = {
      style: {},
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle: (name, force) => {
          const on = force ?? !classes.has(name);
          if (on) classes.add(name);
          else classes.delete(name);
          return on;
        },
      },
      _listeners: listeners,
      addEventListener(type, cb) {
        listeners.set(type, [...(listeners.get(type) ?? []), cb]);
      },
      removeEventListener(type, cb) {
        listeners.set(type, (listeners.get(type) ?? []).filter(listener => listener !== cb));
      },
      setAttribute() {},
      focus() {},
      innerHTML: '',
    };
    elements.set(selector, el);
    return el;
  };
  const container = {
    set innerHTML(value: string) { html = value; },
    get innerHTML(): string { return html; },
    querySelector: (selector: string) => makeEl(selector),
    contains: () => true,
  } as unknown as HTMLElement;
  return { container, elements, html: () => html };
}

describe('Node Info panel visibility', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      innerHeight: 800,
    };
    (globalThis as any).document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      body: { style: {} },
    };
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    };
  });

  it('starts hidden and toggles with setContextVisible', () => {
    const dom = createDom();
    const layout = new MainLayout(dom.container);

    assert.match(dom.html(), /id="context-root"[^>]*display: none/, 'context host is hidden in the initial markup');
    assert.match(dom.html(), /id="context-resizer"[^>]*display: none/, 'context resizer is hidden too');

    layout.setContextVisible(true);
    assert.equal(dom.elements.get('#context-root')!.style.display, 'block');
    assert.equal(dom.elements.get('#context-resizer')!.style.display, 'block');

    layout.setContextVisible(false);
    assert.equal(dom.elements.get('#context-root')!.style.display, 'none');
    assert.equal(dom.elements.get('#context-resizer')!.style.display, 'none');
  });
});
