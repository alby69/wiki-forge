import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Header } from '@frontend/components/ui/Header';
import { getActions } from '@frontend/core/actions';
import { appStore, DEFAULT_PINNED_ACTION_IDS } from '@frontend/store/appStore';

type MockEl = {
  hidden: boolean;
  checked: boolean;
  value: string;
  _listeners: Map<string, Array<() => void>>;
  addEventListener: (type: string, cb: () => void) => void;
  setAttribute: (key: string, value: string) => void;
  focus: () => void;
};

function createDom() {
  const elements = new Map<string, MockEl>();
  let html = '';
  const makeEl = (selector: string): MockEl => {
    const existing = elements.get(selector);
    if (existing) return existing;
    const listeners = new Map<string, Array<() => void>>();
    const el: MockEl = {
      hidden: true,
      checked: false,
      value: 'default',
      _listeners: listeners,
      addEventListener(type, cb) {
        listeners.set(type, [...(listeners.get(type) ?? []), cb]);
      },
      setAttribute() {},
      focus() {},
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

function fire(el: MockEl, type: string): void {
  for (const cb of el._listeners.get(type) ?? []) cb();
}

describe('Header toolbar customizer', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    (globalThis as any).window = { addEventListener: () => {} };
    (globalThis as any).document = {
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    };
    appStore.setPinnedActionIds([...DEFAULT_PINNED_ACTION_IDS]);
    appStore.setAdvancedMode(true);
  });

  afterEach(() => {
    appStore.setPinnedActionIds([...DEFAULT_PINNED_ACTION_IDS]);
    appStore.setAdvancedMode(false);
  });

  it('shows one flag per global action with the historical defaults checked', () => {
    const dom = createDom();
    const header = new Header({ container: dom.container });

    const markup = dom.html();
    assert.ok(markup.includes('Personalizza barra'), 'customizer section is rendered');
    assert.ok(markup.includes('data-pin-action="global:review"'), 'pinnable action has a flag');
    assert.ok(/id="pin-global-projects"[^>]*checked/.test(markup), 'projects pinned by default');
    assert.ok(markup.includes('header-projects-btn'), 'projects button in the toolbar');
    assert.ok(markup.includes('header-docs-wiki-btn'), 'docs wiki pinned in Developer Mode');
    assert.ok(markup.includes('chat-toggle-header-btn'), 'chat pinned by default');
    assert.ok(!markup.includes('header-review-btn'), 'review not pinned by default');

    // A single row per action: the old second, duplicated button list is gone.
    for (const action of getActions({ group: 'global', menu: true })) {
      const needle = `<button id="menu-item-${action.id.replace(':', '-')}"`;
      assert.equal(markup.split(needle).length - 1, 1, `${action.id} appears once in the menu`);
      assert.ok(markup.includes(`data-pin-action="${action.id}"`), `${action.id} has a flag`);
    }
    assert.ok(!markup.includes('wf-menu__toggle'), 'legacy duplicate list removed');

    header.destroy();
  });

  it('checking a flag adds the button to the bar and keeps the menu open', () => {
    const dom = createDom();
    const header = new Header({ container: dom.container });

    fire(dom.elements.get('#header-more-btn')!, 'click');
    assert.equal(dom.elements.get('#header-more-menu')!.hidden, false, 'menu opened');

    const reviewFlag = dom.elements.get('#pin-global-review')!;
    reviewFlag.checked = true;
    fire(reviewFlag, 'change');

    assert.ok(dom.html().includes('header-review-btn'), 'review button appears in the bar');
    assert.equal(dom.elements.get('#header-more-menu')!.hidden, false, 'menu stays open');
    assert.ok(appStore.getState().pinnedActionIds.includes('global:review'));

    header.destroy();
  });

  it('unchecking a flag removes the button and persists the layout', () => {
    const dom = createDom();
    const header = new Header({ container: dom.container });
    assert.ok(dom.html().includes('header-projects-btn'));

    const projectsFlag = dom.elements.get('#pin-global-projects')!;
    projectsFlag.checked = false;
    fire(projectsFlag, 'change');

    assert.ok(!dom.html().includes('header-projects-btn'), 'button removed from the bar');
    const stored = JSON.parse(storage.get('wiki-forge:pinned-actions') ?? '[]') as string[];
    assert.ok(!stored.includes('global:projects'), 'preference persisted');

    header.destroy();
  });

  it('hides the Docs Wiki flag and button in Focus Mode', () => {
    const dom = createDom();
    const header = new Header({ container: dom.container });
    appStore.setAdvancedMode(false);

    const markup = dom.html();
    assert.ok(!markup.includes('data-pin-action="global:docsWiki"'));
    assert.ok(!markup.includes('header-docs-wiki-btn'));

    header.destroy();
  });
});
