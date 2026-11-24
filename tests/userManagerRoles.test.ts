import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { UserManagerModal } from '@frontend/components/users/UserManagerModal';
import { apiBus } from '@frontend/core/apiBus';
import { setLanguage } from '@frontend/core/i18n/strings';
import { notifications } from '@frontend/services/notificationService';
import { appStore } from '@frontend/store/appStore';
import type { AuthIdentityDto, ManagedUserDto } from '@shared/api/types';

type MockEl = {
  hidden: boolean;
  checked: boolean;
  value: string;
  dataset: Record<string, string>;
  listeners: Map<string, Array<() => void>>;
  addEventListener: (type: string, cb: () => void) => void;
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
      dataset,
      listeners,
      addEventListener(type, cb) {
        listeners.set(type, [...(listeners.get(type) ?? []), cb]);
      },
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
  } as unknown as HTMLElement;
  return { container, html: () => html, query: (selector: string) => makeEl(selector) };
}

function fire(el: MockEl | undefined, type: string): void {
  for (const cb of el?.listeners.get(type) ?? []) cb();
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

function users(): ManagedUserDto[] {
  return [
    {
      id: 'u-self', username: 'admin', roles: ['Admin'], active: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'u-other', username: 'alice', roles: ['Reader'], active: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

describe('User manager roles and self-account safety', () => {
  let originalDispatch: typeof apiBus.dispatch;
  let originalConfirm: typeof notifications.confirm;
  let calls: Array<{ id: string; request: Record<string, unknown> }>;
  let confirmCalls: number;

  beforeEach(() => {
    originalDispatch = apiBus.dispatch;
    originalConfirm = notifications.confirm;
    calls = [];
    confirmCalls = 0;
    (globalThis as any).document = {
      documentElement: { lang: 'it' },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    setLanguage('it');
    appStore.setAuth('', undefined);
    (apiBus as any).dispatch = async (id: string, request: Record<string, unknown> = {}) => {
      calls.push({ id, request });
      if (id === 'users.list') return { success: true, users: users() };
      return { success: true };
    };
    (notifications as any).confirm = async () => { confirmCalls += 1; return true; };
  });

  afterEach(() => {
    (apiBus as any).dispatch = originalDispatch;
    (notifications as any).confirm = originalConfirm;
    appStore.setAuth('', undefined);
    setLanguage('it');
  });

  it('shows role descriptions and capability preview in both languages', async () => {
    const dom = createDom();
    const modal = new UserManagerModal({ container: dom.container });
    await modal.open();
    let markup = dom.html();

    for (const needle of [
      'Ruoli e permessi',
      'Legge wiki, progetti, grafo',
      'Modifica note, cartelle e template',
      'Verifica e critica le revisioni',
      'Controlla progetti, configurazione',
      'Lettura wiki e progetti',
      'Gestione utenti',
      'Personalizzazione UI',
      'azioni disponibili',
    ]) {
      assert.ok(markup.includes(needle), `Italian markup includes ${needle}`);
    }
    assert.ok(/Reader[\s\S]*Contributor[\s\S]*KnowledgeEngineer[\s\S]*Admin/.test(markup));

    setLanguage('en');
    await modal.open();
    markup = dom.html();
    for (const needle of [
      'Roles and permissions',
      'Reads wiki, projects, graph',
      'Edits notes, folders and templates',
      'Verifies and critiques reviews',
      'Controls projects, configuration',
      'Read wiki and projects',
      'User management',
      'UI customisation',
      'available actions',
    ]) {
      assert.ok(markup.includes(needle), `English markup includes ${needle}`);
    }
    modal.close();
  });

  it('blocks edit, deactivation and deletion of the current local account', async () => {
    appStore.setAuth('local-token', identity({
      actor: 'human:admin', roles: ['Admin'], source: 'local', authenticated: true,
    }));
    const dom = createDom();
    const modal = new UserManagerModal({ container: dom.container });
    await modal.open();
    const markup = dom.html();

    assert.ok(markup.includes('data-user-id="u-self" data-self="true"'), 'self row is marked');
    assert.ok(markup.includes('data-user-edit="u-self" disabled'), 'self edit is disabled');
    assert.ok(markup.includes('data-user-delete="u-self" disabled'), 'self delete is disabled');
    assert.ok(markup.includes('Non puoi modificare, disattivare o eliminare il tuo account.'));

    fire(dom.query('[data-user-edit="u-self"]'), 'click');
    fire(dom.query('[data-user-delete="u-self"]'), 'click');
    await tick();

    assert.ok(!calls.some(call => call.id === 'users.update'), 'no self update dispatched');
    assert.ok(!calls.some(call => call.id === 'users.delete'), 'no self delete dispatched');
    assert.equal(confirmCalls, 0, 'no confirmation shown for self delete');
    modal.close();
  });

  it('refuses a staged self update if the local identity changes before save', async () => {
    const dom = createDom();
    const modal = new UserManagerModal({ container: dom.container });
    await modal.open();
    (modal as unknown as { editingId: string }).editingId = 'u-self';

    appStore.setAuth('local-token', identity({
      actor: 'human:admin', roles: ['Admin'], source: 'local', authenticated: true,
    }));
    fire(dom.query('#user-save'), 'click');
    await tick();

    assert.ok(!calls.some(call => call.id === 'users.update'), 'staged self update is blocked');
    assert.ok(dom.html().includes('Non puoi modificare il tuo account.'));
    modal.close();
  });
});
