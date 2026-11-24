import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { appStore, DEFAULT_PINNED_ACTION_IDS } from '@frontend/store/appStore';
import {
  canAction,
  canOperation,
  canProject,
  loadUiAccess,
  resetUiAccess,
  type UiAccessBus,
} from '@frontend/core/uiAccess';
import { getLanguage } from '@frontend/core/i18n/strings';
import { defaultUiPreferences } from '@shared/auth/uiPreferences';
import type { AuthIdentityDto, UiAccessDto, UiPreferencesDto } from '@shared/api/types';

/**
 * F3 — frontend access/preferences pipeline. The bus is mocked: no component
 * builds URLs and no test reaches the network.
 */

const ADMIN: AuthIdentityDto = {
  actor: 'human:admin',
  roles: ['Admin'],
  source: 'local',
  authenticated: true,
  rbacEnabled: true,
  strict: false,
  idpConfigured: false,
  userStoreConfigured: true,
};

const READER: AuthIdentityDto = {
  ...ADMIN,
  actor: 'human:reader',
  roles: ['Reader'],
};

const LEGACY: AuthIdentityDto = {
  ...ADMIN,
  actor: 'process:api-token',
  roles: [],
  source: 'legacy-token',
  authenticated: false,
};

const ALL_ROLES = ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin'];

function accessFor(identity: AuthIdentityDto): UiAccessDto {
  const roles = identity.authenticated ? identity.roles : ALL_ROLES;
  return {
    ...identity,
    visibleProjects: ['default'],
    projectRoles: { default: roles },
    actions: [
      'global:projects', 'global:docsWiki', 'global:research', 'global:help', 'global:customize',
      ...(roles.includes('Admin') ? ['global:users'] : []),
    ],
    operations: [
      'auth.me', 'ui.access', 'ui.preferences.get', 'ui.preferences.put',
      ...(roles.includes('Admin') ? ['users.create'] : []),
    ],
  };
}

function preferences(overrides: Partial<UiPreferencesDto> = {}): UiPreferencesDto {
  return { ...defaultUiPreferences(), ...overrides };
}

interface BusCall {
  id: string;
  request: unknown;
}

function createBus(handler: (id: string, request: any) => unknown): { bus: UiAccessBus; calls: BusCall[] } {
  const calls: BusCall[] = [];
  const bus = {
    dispatch: async (id: string, request: unknown = {}) => {
      calls.push({ id, request });
      return handler(id, request) as never;
    },
  } as unknown as UiAccessBus;
  return { bus, calls };
}

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('F3 — pipeline frontend accesso/preferenze', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    };
    resetUiAccess();
    appStore.setAuth('', undefined);
    appStore.setPinnedActionIds([...DEFAULT_PINNED_ACTION_IDS]);
    appStore.setAdvancedMode(false);
  });

  afterEach(() => {
    resetUiAccess();
    appStore.setAuth('', undefined);
    appStore.applyUiPreferences(defaultUiPreferences());
    (globalThis as any).localStorage = undefined;
  });

  it('applica access e preferenze del server e salva solo i cambi reali', async () => {
    const serverPreferences = preferences({
      pinnedActionIds: ['global:research'],
      hiddenPanels: ['context'],
      density: 'compact',
      language: 'en',
    });
    const { bus, calls } = createBus((id, request) => {
      if (id === 'ui.access') return { success: true, access: accessFor(ADMIN) };
      if (id === 'ui.preferences.get') return { success: true, preferences: serverPreferences };
      if (id === 'ui.preferences.put') return { success: true, preferences: request.body };
      throw new Error(`Unexpected command ${id}`);
    });
    appStore.setAuth('local-token', ADMIN);

    const access = await loadUiAccess({ bus });
    assert.equal(access?.actor, 'human:admin');
    assert.equal(appStore.getState().accessSource, 'server');
    assert.deepEqual(appStore.getState().preferences.pinnedActionIds, ['global:research']);
    assert.equal(appStore.getState().density, 'compact');
    assert.ok(appStore.getState().hiddenPanels.includes('context'));
    assert.equal(getLanguage(), 'en');
    assert.equal(canAction('global:users'), true);
    assert.equal(canAction('global:users', 'default'), true);
    assert.equal(canOperation('users.create'), true);
    assert.equal(canProject('default'), true);

    const puts = () => calls.filter(call => call.id === 'ui.preferences.put');
    assert.equal(puts().length, 0, 'hydrating preferences must not write back');

    appStore.setHiddenPanel('chat', true);
    await tick();
    assert.equal(puts().length, 1);
    assert.deepEqual((puts()[0].request as { body: UiPreferencesDto }).body.hiddenPanels.sort(), ['chat', 'context']);

    appStore.setHiddenPanel('chat', true);
    await tick();
    assert.equal(puts().length, 1, 'unchanged preferences must not be persisted');
  });

  it('usa i ruoli dell’identità se ui.access risponde 403', async () => {
    const { bus, calls } = createBus((id) => {
      if (id === 'ui.access' || id === 'ui.preferences.get') throw new Error('403 Forbidden');
      throw new Error(`Unexpected command ${id}`);
    });
    appStore.setAuth('local-token', READER);

    const access = await loadUiAccess({ bus });
    assert.equal(access?.actor, 'human:reader');
    assert.equal(appStore.getState().accessSource, 'fallback');
    assert.equal(canAction('global:users'), false);
    assert.equal(canOperation('users.create'), false);
    assert.equal(canAction('global:research'), true);
    assert.equal(canAction('global:study'), false);
    assert.equal(canProject('default'), false, 'fallback cannot claim project visibility');
    assert.equal(calls.some(call => call.id === 'ui.preferences.put'), false);
  });

  it('legacy mode mantiene la superficie storica senza chiamare le nuove route', async () => {
    const { bus, calls } = createBus(() => { throw new Error('Legacy mode must not call the bus'); });
    appStore.setAuth('', LEGACY);

    const access = await loadUiAccess({ bus });
    assert.equal(access, undefined);
    assert.equal(appStore.getState().accessSource, 'none');
    assert.equal(calls.length, 0);
    assert.equal(canAction('global:users'), true);
    assert.equal(canOperation('projects.create'), true);
    assert.equal(canProject('any-project'), true);
  });

  it('invalida un access slice obsoleto quando cambia l’identità', async () => {
    const { bus } = createBus((id) => {
      if (id === 'ui.access') return { success: true, access: accessFor(ADMIN) };
      if (id === 'ui.preferences.get') return { success: true, preferences: preferences() };
      throw new Error(`Unexpected command ${id}`);
    });
    appStore.setAuth('local-token', ADMIN);
    await loadUiAccess({ bus });
    assert.equal(canAction('global:users'), true);

    appStore.setAuth('local-token', READER);
    assert.equal(canAction('global:users'), false, 'stale admin access must be ignored');
    assert.equal(canAction('global:research'), true);
  });

  it('logout ripristina preferenze locali di default', async () => {
    const { bus } = createBus((id, request) => {
      if (id === 'ui.access') return { success: true, access: accessFor(ADMIN) };
      if (id === 'ui.preferences.get') return { success: true, preferences: preferences({ density: 'compact' }) };
      if (id === 'ui.preferences.put') return { success: true, preferences: request.body };
      throw new Error(`Unexpected command ${id}`);
    });
    appStore.setAuth('local-token', ADMIN);
    await loadUiAccess({ bus });
    assert.equal(appStore.getState().density, 'compact');

    resetUiAccess();
    assert.equal(appStore.getState().access, undefined);
    assert.equal(appStore.getState().accessSource, 'none');
    assert.deepEqual(appStore.getState().preferences, defaultUiPreferences());
    assert.equal(canAction('global:users'), true);
  });
});
