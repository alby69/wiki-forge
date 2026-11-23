import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Header } from '@frontend/components/ui/Header';
import { UserManagerModal } from '@frontend/components/users/UserManagerModal';
import { bindActionHandler } from '@frontend/core/actions';
import { apiBus } from '@frontend/core/apiBus';
import { setLanguage } from '@frontend/core/i18n/strings';
import { notifications } from '@frontend/services/notificationService';
import { appStore, DEFAULT_PINNED_ACTION_IDS } from '@frontend/store/appStore';
import type { AuthIdentityDto, ManagedUserDto } from '@shared/api/types';

type MockEl = {
  hidden: boolean;
  checked: boolean;
  value: string;
  textContent: string;
  dataset: Record<string, string>;
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
    const dataset: Record<string, string> = {};
    for (const match of selector.matchAll(/data-([a-z-]+)="([^"]+)"/g)) {
      const key = match[1].replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      dataset[key] = match[2];
    }
    const listeners = new Map<string, Array<() => void>>();
    const el: MockEl = {
      hidden: false,
      checked: false,
      value: '',
      textContent: '',
      dataset,
      _listeners: listeners,
      addEventListener(type, cb) { listeners.set(type, [...(listeners.get(type) ?? []), cb]); },
      setAttribute() {},
      focus() {},
    };
    elements.set(selector, el);
    return el;
  };
  const container = {
    set innerHTML(value: string) {
      html = value;
      for (const key of [...elements.keys()]) {
        if (key.startsWith('[data-user-')) elements.delete(key);
      }
      for (const match of value.matchAll(/data-user-(edit|delete)="([^"]+)"/g)) {
        makeEl(`[data-user-${match[1]}="${match[2]}"]`);
      }
    },
    get innerHTML(): string { return html; },
    querySelector: (selector: string) => makeEl(selector),
    querySelectorAll: (selector: string) => {
      const prefix = selector.endsWith(']') ? selector.slice(0, -1) : selector;
      return [...elements.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, el]) => el);
    },
    contains: () => true,
  } as unknown as HTMLElement;
  return { container, elements, html: () => html, query: (selector: string) => makeEl(selector) };
}

function fire(el: MockEl | undefined, type: string): void {
  for (const cb of el?._listeners.get(type) ?? []) cb();
}

async function tick(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

function identity(overrides: Partial<AuthIdentityDto> = {}): AuthIdentityDto {
  return {
    actor: 'process:api-token', roles: [], source: 'legacy-token',
    authenticated: false, rbacEnabled: false, strict: false, idpConfigured: false,
    ...overrides,
  };
}

describe('Focus and Developer header', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    (globalThis as any).window = { addEventListener: () => {}, removeEventListener: () => {} };
    (globalThis as any).document = { addEventListener: () => {}, removeEventListener: () => {} };
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    };
    setLanguage('it');
    appStore.setAuth('', undefined);
    appStore.setPinnedActionIds([...DEFAULT_PINNED_ACTION_IDS]);
    appStore.setAdvancedMode(false);
  });

  afterEach(() => {
    appStore.setAuth('', undefined);
    appStore.setPinnedActionIds([...DEFAULT_PINNED_ACTION_IDS]);
    appStore.setAdvancedMode(false);
  });

  it('renders only the Focus controls and binds Carica, Compila and Chiedi', () => {
    const fired: string[] = [];
    bindActionHandler('focus:upload', () => fired.push('upload'));
    bindActionHandler('focus:compile', () => fired.push('compile'));
    bindActionHandler('focus:ask', () => fired.push('ask'));

    const dom = createDom();
    const header = new Header({ container: dom.container });
    const markup = dom.html();

    for (const needle of [
      'Wiki-Forge', '🌱 Modalità Focus', 'Progetto:', 'Wiki-Forge Docs', 'Lingua:', '🇮🇹 IT',
      '🗂️', '📝', '📒', '🕸️', '◧', '📁', '🔎', '📚', '💬',
      'Carica', 'Compila', 'Chiedi',
    ]) {
      assert.ok(markup.includes(needle), `Focus header includes ${needle}`);
    }
    assert.ok(!markup.includes('header-more-btn'), 'three-dot menu hidden in Focus');
    assert.ok(!markup.includes('wf-identity'), 'identity tools hidden in Focus');
    assert.ok(!markup.includes('header-config-btn'), 'developer tools hidden in Focus');
    assert.ok(!markup.includes('header-users-btn'), 'user manager hidden in Focus');
    assert.ok(!markup.includes('header-export-wiki-zip-btn'), 'ZIP export hidden in Focus');
    assert.ok(!markup.includes('focus-upload-btn" class="wf-btn wf-btn--sm"'), 'focus actions use their own style');

    fire(dom.elements.get('#focus-upload-btn'), 'click');
    fire(dom.elements.get('#focus-compile-btn'), 'click');
    fire(dom.elements.get('#focus-ask-btn'), 'click');
    assert.deepEqual(fired, ['upload', 'compile', 'ask']);

    header.destroy();
  });

  it('hides Focus write actions from a Reader', () => {
    appStore.setAuth('local-token', identity({
      actor: 'human:reader', roles: ['Reader'], source: 'local', authenticated: true,
    }));

    const dom = createDom();
    const header = new Header({ container: dom.container });
    const markup = dom.html();
    assert.ok(markup.includes('header-projects-btn'), 'projects stay visible');
    assert.ok(markup.includes('header-docs-wiki-btn'), 'docs stay visible');
    assert.ok(!markup.includes('focus-upload-btn'), 'upload requires Contributor');
    assert.ok(!markup.includes('focus-compile-btn'), 'compile requires Contributor');
    assert.ok(!markup.includes('focus-ask-btn'), 'chat requires Contributor');
    assert.ok(!markup.includes('chat-toggle-header-btn'), 'chat button requires Contributor');
    assert.ok(!markup.includes('header-study-btn'), 'study requires Contributor');

    header.destroy();
  });

  it('exposes developer tools, local sign-in and role-gated user management', () => {
    appStore.setAdvancedMode(true);
    appStore.setAuth('', identity({ userStoreConfigured: true }));

    const dom = createDom();
    const header = new Header({ container: dom.container });
    const anonymous = dom.html();
    assert.ok(anonymous.includes('header-more-btn'), 'Developer Mode has the three-dot menu');
    assert.ok(anonymous.includes('menu-item-global-users'), 'user management is in the menu');
    assert.ok(anonymous.includes('header-export-wiki-zip-btn'), 'ZIP export is pinned in Developer Mode');
    assert.ok(anonymous.includes('menu-item-global-exportWikiZip'), 'ZIP export is in the Developer Mode menu');
    assert.ok(anonymous.includes('wf-user-signin-btn'), 'local sign-in is offered');
    assert.ok(anonymous.includes('id="wf-username-input"'));
    assert.ok(anonymous.includes('id="wf-password-input"'));
    assert.ok(!anonymous.includes('focus-upload-btn'), 'focus quick actions hidden in Developer Mode');

    appStore.setAuth('local-token', identity({
      actor: 'human:bob', roles: ['Reader'], source: 'local',
      authenticated: true, userStoreConfigured: true,
    }));
    assert.ok(!dom.html().includes('menu-item-global-users'), 'Reader cannot see user management');

    appStore.setAuth('local-token', identity({
      actor: 'human:admin', roles: ['Admin'], source: 'local',
      authenticated: true, userStoreConfigured: true,
    }));
    const admin = dom.html();
    assert.ok(admin.includes('menu-item-global-users'), 'Admin can see user management');
    assert.ok(admin.includes('header-export-wiki-zip-btn'), 'ZIP export stays available to local Admin');
    assert.ok(admin.includes('human:admin'), 'local actor is visible');
    assert.ok(admin.includes('id="wf-signout-btn"'), 'local session can be closed');

    header.destroy();
  });
});

describe('User manager modal', () => {
  let originalDispatch: typeof apiBus.dispatch;
  let originalConfirm: typeof notifications.confirm;

  beforeEach(() => {
    setLanguage('it');
    originalDispatch = apiBus.dispatch;
    originalConfirm = notifications.confirm;
  });

  afterEach(() => {
    (apiBus as any).dispatch = originalDispatch;
    (notifications as any).confirm = originalConfirm;
  });

  it('lists users and dispatches create and delete through the typed bus', async () => {
    const users: ManagedUserDto[] = [{
      id: 'u1', username: 'admin', roles: ['Admin'], active: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }];
    const calls: Array<{ id: string; request: Record<string, unknown> }> = [];
    (apiBus as any).dispatch = async (id: string, request: Record<string, unknown> = {}) => {
      calls.push({ id, request });
      if (id === 'users.list') return { success: true, users };
      if (id === 'users.create') return { success: true, user: users[0] };
      if (id === 'users.delete') return { success: true };
      return { success: false };
    };
    let confirmCalls = 0;
    (notifications as any).confirm = async () => { confirmCalls += 1; return true; };

    const dom = createDom();
    const modal = new UserManagerModal({ container: dom.container });
    await modal.open();
    assert.ok(dom.html().includes('admin'), 'existing user is listed');
    assert.equal(calls[0].id, 'users.list');

    dom.query('#user-username').value = 'alice';
    dom.query('#user-password').value = 'alice-password';
    dom.query('#user-active').checked = true;
    dom.query('[data-user-role="Reader"]').checked = true;
    fire(dom.query('#user-save'), 'click');
    await tick();

    const create = calls.find(call => call.id === 'users.create');
    assert.ok(create, 'create was dispatched');
    assert.deepStrictEqual(create!.request, {
      body: { username: 'alice', password: 'alice-password', roles: ['Reader'], active: true },
    });

    const deleteButton = dom.query('[data-user-delete="u1"]');
    assert.deepStrictEqual(deleteButton.dataset, { userDelete: 'u1' });
    assert.ok((deleteButton._listeners.get('click') ?? []).length > 0, 'delete has a listener');
    fire(deleteButton, 'click');
    await tick();
    assert.equal(confirmCalls, 1);
    assert.deepStrictEqual(calls.find(call => call.id === 'users.delete')?.request, { params: { id: 'u1' } });

    modal.close();
  });
});
