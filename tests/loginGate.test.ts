import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LoginModal } from '@frontend/components/auth/LoginModal';
import { apiBus } from '@frontend/core/apiBus';
import { setLanguage } from '@frontend/core/i18n/strings';
import { appStore } from '@frontend/store/appStore';
import type { AuthIdentityDto } from '@shared/api/types';

type Listener = (event?: { preventDefault: () => void }) => void;

type MockEl = {
  value: string;
  hidden: boolean;
  listeners: Map<string, Listener[]>;
  addEventListener: (type: string, listener: Listener) => void;
  focus: () => void;
  remove: () => void;
};

function createDom() {
  const elements = new Map<string, MockEl>();
  let html = '';
  const makeEl = (selector: string): MockEl => {
    const existing = elements.get(selector);
    if (existing) return existing;
    const listeners = new Map<string, Listener[]>();
    const el: MockEl = {
      value: '',
      hidden: false,
      listeners,
      addEventListener(type, listener) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      focus() {},
      remove() {},
    };
    elements.set(selector, el);
    return el;
  };
  const container = {
    set innerHTML(value: string) { html = value; },
    get innerHTML(): string { return html; },
    querySelector: (selector: string) => makeEl(selector),
  } as unknown as HTMLElement;
  return {
    container,
    html: () => html,
    query: (selector: string) => makeEl(selector),
    fire: (selector: string, type: string) => {
      const event = { preventDefault() {} };
      for (const listener of makeEl(selector).listeners.get(type) ?? []) listener(event);
    },
  };
}

describe('Mandatory login modal', () => {
  let originalDispatch: typeof apiBus.dispatch;

  beforeEach(() => {
    setLanguage('it');
    appStore.setAuth('', undefined);
    originalDispatch = apiBus.dispatch;
  });

  afterEach(() => {
    (apiBus as { dispatch: typeof apiBus.dispatch }).dispatch = originalDispatch;
    appStore.setAuth('', undefined);
  });

  it('blocks the UI until local credentials are accepted', async () => {
    const dom = createDom();
    const identity: AuthIdentityDto = {
      actor: 'human:admin',
      roles: ['Admin'],
      source: 'local',
      authenticated: true,
      rbacEnabled: true,
      strict: false,
      idpConfigured: false,
      userStoreConfigured: true,
    };
    const calls: Array<{ command: string; payload: unknown }> = [];
    let authenticated: AuthIdentityDto | undefined;
    (apiBus as any).dispatch = async (command: string, payload: unknown) => {
      calls.push({ command, payload });
      return { success: true, token: 'local-token', auth: identity };
    };

    const modal = new LoginModal({
      container: dom.container,
      onAuthenticated: value => { authenticated = value; },
    });
    modal.open();

    assert.ok(dom.html().includes('Accesso richiesto'));
    assert.equal(modal.isOpen, true);

    dom.query('[data-role="login-username"]').value = 'admin';
    dom.query('[data-role="login-password"]').value = 'admin';
    dom.fire('[data-role="login-form"]', 'submit');
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'auth.login');
    assert.deepEqual(calls[0].payload, { body: { username: 'admin', password: 'admin' } });
    assert.equal(authenticated, identity);
    assert.equal(modal.isOpen, false);
    assert.equal(appStore.getState().auth.token, 'local-token');
  });
});
