import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CustomizeUiModal } from '@frontend/components/ui/CustomizeUiModal';
import { appStore } from '@frontend/store/appStore';
import { resetUiAccess } from '@frontend/core/uiAccess';
import { registerShortcut, unregisterShortcut } from '@frontend/core/shortcuts';
import { defaultUiPreferences } from '@shared/auth/uiPreferences';
import type { AuthIdentityDto, UiAccessDto } from '@shared/api/types';

/** F4 — declarative customizer: RBAC filtering happens after preference merge. */

interface MockEl {
  innerHTML: string;
  className: string;
  textContent: string;
  isConnected: boolean;
  listeners: Map<string, Array<(event: unknown) => void>>;
  addEventListener: (type: string, cb: (event: unknown) => void) => void;
  appendChild: (child: MockEl) => void;
  setAttribute: (key: string, value: string) => void;
  querySelector: (selector: string) => MockEl | null;
  focus: () => void;
  remove: () => void;
}

function createDom(): { overlay: MockEl; html: () => string } {
  let overlay: MockEl | null = null;
  const makeEl = (): MockEl => {
    const listeners = new Map<string, Array<(event: unknown) => void>>();
    return {
      innerHTML: '',
      className: '',
      textContent: '',
      isConnected: true,
      listeners,
      addEventListener(type, cb) {
        listeners.set(type, [...(listeners.get(type) ?? []), cb]);
      },
      setAttribute() {},
      appendChild() {},
      querySelector: () => makeEl(),
      focus() {},
      remove() { this.isConnected = false; },
    };
  };
  (globalThis as any).window = { setTimeout: () => 0 };
  (globalThis as any).HTMLElement = class {};
  (globalThis as any).document = {
    activeElement: null,
    body: { appendChild: (element: MockEl) => { overlay = element; } },
    createElement: () => makeEl(),
  };
  return {
    get overlay() { return overlay!; },
    html: () => overlay!.innerHTML,
  };
}

function fire(el: MockEl, type: string, event: unknown): void {
  for (const cb of el.listeners.get(type) ?? []) cb(event);
}

const READER: AuthIdentityDto = {
  actor: 'human:reader',
  roles: ['Reader'],
  source: 'local',
  authenticated: true,
  rbacEnabled: true,
  strict: false,
  idpConfigured: false,
  userStoreConfigured: true,
};

const READER_ACCESS: UiAccessDto = {
  ...READER,
  visibleProjects: ['default'],
  projectRoles: { default: ['Reader'] },
  actions: ['global:projects', 'global:research', 'global:help', 'global:customize'],
  operations: [
    'auth.me', 'ui.access', 'ui.preferences.get', 'ui.preferences.put',
    'wiki.folders.list', 'wiki.notes.list', 'graph.status',
  ],
};

describe('F4 — CustomizeUiModal', () => {
  beforeEach(() => {
    createDom();
    resetUiAccess();
    appStore.setAuth('local-token', READER);
    appStore.setUiAccess(READER_ACCESS, 'server');
    appStore.applyUiPreferences(defaultUiPreferences());
  });

  afterEach(() => {
    appStore.setAuth('', undefined);
    resetUiAccess();
    unregisterShortcut('test:visible-shortcut');
    unregisterShortcut('action:global:users');
  });

  it('disabilita i pannelli e i pin non consentiti dal ruolo', () => {
    const modal = new CustomizeUiModal();
    modal.open();
    const markup = modal['overlay']?.innerHTML ?? '';
    assert.match(markup, /id="ui-panel-chat"[^>]*disabled/, 'chat requires Contributor');
    assert.match(markup, /id="ui-panel-files"/, 'files panel is available to a Reader');
    assert.doesNotMatch(markup, /data-pin="global:users"/, 'admin actions are not pinnable');
    assert.match(markup, /data-pin="global:customize"/, 'Reader action is pinnable');
    modal.close();
  });

  it('applica i cambiamenti allo store senza ampliare i permessi', () => {
    const dom = createDom();
    const modal = new CustomizeUiModal();
    modal.open();

    fire(dom.overlay, 'change', { target: { dataset: { panel: 'graph' }, checked: false } });
    assert.ok(appStore.getState().preferences.hiddenPanels.includes('graph'));

    fire(dom.overlay, 'change', { target: { dataset: { pref: 'density' }, value: 'compact' } });
    assert.equal(appStore.getState().density, 'compact');

    fire(dom.overlay, 'change', { target: { dataset: { pin: 'global:users' }, checked: true } });
    assert.equal(appStore.getState().pinnedActionIds.includes('global:users'), false);
    modal.close();
  });

  it('mostra solo le scorciatoie effettivamente registrate e consentite', () => {
    registerShortcut('test:visible-shortcut', 'Ctrl+Alt+Z', () => {});
    registerShortcut('action:global:users', 'Ctrl+Alt+Y', () => {});
    const modal = new CustomizeUiModal();
    modal.open();
    const markup = modal['overlay']?.innerHTML ?? '';
    assert.match(markup, /Ctrl\+Alt\+Z/);
    assert.doesNotMatch(markup, /Ctrl\+Alt\+Y/, 'admin shortcut is hidden from a Reader');
    modal.close();
  });
});
