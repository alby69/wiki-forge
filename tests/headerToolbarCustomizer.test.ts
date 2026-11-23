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

    // The more button must stay visible even when many actions are pinned:
    // it sits outside the scrollable action strip and uses CSS dots.
    const actionsMatch = markup.match(/<div class="wf-header__actions">([\s\S]*)<\/div>\s*<div class="wf-header__menu">/);
    assert.ok(actionsMatch, 'wrapping action strip is rendered');
    assert.ok(!actionsMatch![1].includes('header-more-btn'), 'more button is outside the action strip');
    assert.ok(!markup.includes('wf-header__scroll'), 'horizontal scrolling removed');
    assert.ok(markup.includes('class="wf-menu__dots"'), 'dots do not depend on a font glyph');

    // Editor / Note / Grafo / Divisione are fixed in the first row,
    // before the customisable action strip. Overflow is a centred second row.
    const beforeActions = markup.split('<div class="wf-header__group wf-header__group--actions">')[0];
    for (const id of ['view-mode-editor', 'view-mode-scratchpad', 'view-mode-graph', 'view-mode-split']) {
      assert.ok(beforeActions.includes(`id="${id}"`), `${id} stays in the fixed first-row group`);
      assert.ok(!actionsMatch![1].includes(`id="${id}"`), `${id} is not in the overflowing action strip`);
    }
    assert.ok(markup.includes('<div class="wf-header__overflow" id="wf-header-overflow" hidden>'), 'centred overflow row is rendered');

    const scratchButton = markup.match(/<button id="view-mode-scratchpad"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
    assert.ok(scratchButton, 'scratchpad view button is rendered');
    assert.ok(!scratchButton.includes('Note rapide'), 'old label is gone');
    assert.match(scratchButton, />\s*Note\s*<\/button>/, 'the segment is labelled Note');

    // File is the first segment of the same bordered control as Editor etc.
    assert.ok(beforeActions.includes('id="header-files-btn"'), 'File toggle stays in the fixed first-row group');
    const segStart = markup.indexOf('<div class="seg-control"');
    const editorStart = markup.indexOf('id="view-mode-editor"');
    assert.ok(
      !markup.slice(0, segStart).includes('id="header-files-btn"'),
      'File toggle is not outside the segmented control'
    );
    assert.ok(
      markup.slice(segStart, editorStart).includes('id="header-files-btn"'),
      'File toggle is inside the bordered segmented control, before Editor'
    );

    // Template is a first-class entry in the "..." menu and can be pinned.
    assert.ok(markup.includes('id="menu-item-global-template"'), 'Template item is in the ⋯ menu');
    assert.ok(markup.includes('data-pin-action="global:template"'), 'Template can be pinned to the bar');

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

  it('keeps Docs Wiki visible and hides its customizer flag in Focus Mode', () => {
    const dom = createDom();
    const header = new Header({ container: dom.container });
    appStore.setAdvancedMode(false);

    const markup = dom.html();
    assert.ok(!markup.includes('data-pin-action="global:docsWiki"'));
    assert.ok(markup.includes('header-docs-wiki-btn'));

    header.destroy();
  });

  it('keeps view pills on row one and moves overflowing actions to the centred row', () => {
    const elements = new Map<string, any>();
    const widths: Record<string, number> = {
      '#header-projects-btn': 90,
      '#header-research-btn': 80,
      '#header-study-btn': 70,
      '#header-docs-wiki-btn': 90,
      '#header-export-wiki-zip-btn': 70,
      '#chat-toggle-header-btn': 70,
      '#header-help-btn': 30,
    };
    const makeEl = (selector: string): any => {
      const existing = elements.get(selector);
      if (existing) return existing;
      const el: any = {
        selector,
        hidden: false,
        checked: false,
        value: 'default',
        children: [],
        _listeners: new Map<string, Array<() => void>>(),
        addEventListener(type: string, cb: () => void) {
          el._listeners.set(type, [...(el._listeners.get(type) ?? []), cb]);
        },
        setAttribute(key: string) { if (key === 'hidden') el.hidden = true; },
        removeAttribute(key: string) { if (key === 'hidden') el.hidden = false; },
        focus() {},
        getBoundingClientRect: () => ({ width: widths[selector] ?? 0 }),
        replaceChildren(...children: any[]) { el.children = children; },
      };
      if (selector === '.wf-header__actions') el.clientWidth = 180;
      elements.set(selector, el);
      return el;
    };
    const container = {
      set innerHTML(_value: string) {},
      querySelector: makeEl,
      contains: () => true,
    } as unknown as HTMLElement;

    const windowListeners = new Map<string, Array<() => void>>();
    (globalThis as any).window = {
      addEventListener: (type: string, cb: () => void) => {
        windowListeners.set(type, [...(windowListeners.get(type) ?? []), cb]);
      },
      removeEventListener: (type: string, cb: () => void) => {
        windowListeners.set(type, (windowListeners.get(type) ?? []).filter(listener => listener !== cb));
      },
    };

    const header = new Header({ container });
    const actions = elements.get('.wf-header__actions');
    const overflow = elements.get('#wf-header-overflow');
    const selectors = (els: any[]) => els.map(el => el.selector);

    // 90 + 8 + 80 = 178 fits; the next 70 does not.
    assert.deepEqual(selectors(actions.children), ['#header-projects-btn', '#header-research-btn']);
    assert.deepEqual(selectors(overflow.children), [
      '#header-study-btn',
      '#header-export-wiki-zip-btn',
      '#header-docs-wiki-btn',
      '#chat-toggle-header-btn',
      '#header-help-btn',
    ]);
    assert.equal(overflow.hidden, false, 'centred second row is visible');
    assert.equal(elements.get('#header-actions-divider').hidden, false);

    // Widening the window puts every action back in the first row.
    actions.clientWidth = 600;
    for (const cb of windowListeners.get('resize') ?? []) cb();
    assert.equal(selectors(actions.children).length, 7);
    assert.equal(overflow.hidden, true, 'empty second row is hidden');

    header.destroy();
  });

  it('the File button toggles the file pane', () => {
    const dom = createDom();
    let toggled = 0;
    const header = new Header({
      container: dom.container,
      onToggleFiles: () => { toggled += 1; },
    });

    fire(dom.elements.get('#header-files-btn')!, 'click');
    assert.equal(toggled, 1);

    header.destroy();
  });
});
