import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { UiPreferencesStore, defaultUiPreferences } from '@backend/server/auth/uiPreferencesStore';
import type { Principal } from '@backend/server/bus/messageBus';
import type { UiAccessDto, UiPreferencesDto } from '@shared/api/types';

const ALICE: Principal = { actor: 'human:alice', roles: ['Admin'], source: 'local' };
const BOB: Principal = { actor: 'human:bob', roles: ['Reader'], source: 'local' };

const RBAC_TOML = `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
`;

const ENV_KEYS = [
  'WIKIFORGE_API_TOKEN', 'WIKIFORGE_ADMIN_USERNAME', 'WIKIFORGE_ADMIN_PASSWORD',
  'WIKIFORGE_SESSION_TTL_MS', 'WIKIFORGE_UI_PREFERENCES_FILE',
] as const;
type EnvKey = typeof ENV_KEYS[number];

interface Harness {
  baseUrl: string;
  close: () => Promise<void>;
}

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-ui-access-'));
  for (const dir of ['config', 'wiki', 'raw', 'output', '.wiki-forge']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), RBAC_TOML, 'utf-8');

  const previous = new Map<EnvKey, string | undefined>();
  for (const key of ENV_KEYS) previous.set(key, process.env[key]);
  delete process.env.WIKIFORGE_API_TOKEN;
  delete process.env.WIKIFORGE_UI_PREFERENCES_FILE;
  process.env.WIKIFORGE_ADMIN_USERNAME = 'admin';
  process.env.WIKIFORGE_ADMIN_PASSWORD = 'admin-secret';

  const serverInstance = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    if (!(await serverInstance.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function call(baseUrl: string, route: string, options: {
  method?: string; token?: string; body?: unknown; extraHeaders?: Record<string, string>;
} = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { ...options.extraHeaders };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

describe('F1 — accesso UI derivato dal server', () => {
  it('espone ruoli, progetti e azioni effettivi non manipolabili dal body', async () => {
    const harness = await createHarness();
    try {
      const login = await call(harness.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: 'admin', password: 'admin-secret' },
      });
      assert.equal(login.status, 200);
      const token = login.body.token as string;
      assert.ok(token);

      const response = await call(harness.baseUrl, '/api/ui/access', {
        token,
        // Client-supplied identity fields must be ignored by the bus.
        body: undefined,
        extraHeaders: { 'X-Principal-Roles': 'Reader' },
      });
      assert.equal(response.status, 200);
      const access = response.body.access as UiAccessDto;
      assert.equal(access.actor, 'human:admin');
      assert.deepStrictEqual(access.roles, ['Admin']);
      assert.ok(access.visibleProjects.includes('default'));
      assert.ok(access.actions.includes('global:users'));
      assert.ok(access.operations.includes('users.create'));
    } finally {
      await harness.close();
    }
  });

  it('riduce la superficie per un Reader', async () => {
    const harness = await createHarness();
    try {
      const admin = await call(harness.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: 'admin', password: 'admin-secret' },
      });
      const adminToken = admin.body.token as string;
      const created = await call(harness.baseUrl, '/api/users', {
        method: 'POST', token: adminToken,
        body: { username: 'reader', password: 'reader-secret', roles: ['Reader'] },
      });
      assert.equal(created.status, 200);
      const login = await call(harness.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: 'reader', password: 'reader-secret' },
      });
      const response = await call(harness.baseUrl, '/api/ui/access', { token: login.body.token as string });
      assert.equal(response.status, 200);
      const access = response.body.access as UiAccessDto;
      assert.deepStrictEqual(access.roles, ['Reader']);
      assert.equal(access.actions.includes('global:users'), false);
      assert.equal(access.operations.includes('users.create'), false);
      assert.equal(access.actions.includes('global:research'), true);
    } finally {
      await harness.close();
    }
  });
});

describe('F2 — preferenze UI per utente', () => {
  let tmpDir = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-ui-prefs-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('separa gli utenti, normalizza i valori e non espone actor nel file', async () => {
    const store = new UiPreferencesStore({ rootDir: tmpDir, now: () => 1_800_000_000 });
    const input = {
      version: 1,
      pinnedActionIds: ['global:projects', 'global:users', 'global:users', 'action:inesistente'],
      filesVisible: false,
      viewMode: 'valore-non-valido',
      theme: 'light',
      density: 'compact',
      language: 'en',
      hiddenPanels: ['chat', 'pannello-inesistente'],
    };
    const saved = await store.put(ALICE, input);
    assert.deepStrictEqual(saved.pinnedActionIds, ['global:projects', 'global:users']);
    assert.deepStrictEqual(saved.hiddenPanels, ['chat']);
    assert.equal(saved.viewMode, 'editor');
    assert.equal(saved.language, 'en');
    assert.equal(saved.density, 'compact');
    assert.equal(saved.theme, 'light');
    assert.equal(saved.filesVisible, false);

    assert.deepStrictEqual(await store.get(BOB), defaultUiPreferences());
    assert.deepStrictEqual(await store.get(ALICE), saved);

    const raw = await fs.readFile(path.join(tmpDir, '.wiki-forge', 'ui-preferences.json'), 'utf-8');
    assert.equal(raw.includes('alice'), false);
    assert.equal(raw.includes('human:'), false);
  });

  it('un file corrotto non blocca il caricamento', async () => {
    const filePath = path.join(tmpDir, '.wiki-forge', 'ui-preferences.json');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'testo non JSON', 'utf-8');
    const store = new UiPreferencesStore({ rootDir: tmpDir });
    assert.deepStrictEqual(await store.get(ALICE), defaultUiPreferences());
  });

  it('salva e rilegge le preferenze tramite le route additive', async () => {
    const harness = await createHarness();
    try {
      const login = await call(harness.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: 'admin', password: 'admin-secret' },
      });
      const token = login.body.token as string;
      const prefs: UiPreferencesDto = {
        version: 1,
        pinnedActionIds: ['global:research'],
        filesVisible: false,
        viewMode: 'graph',
        theme: 'light',
        density: 'compact',
        language: 'en',
        hiddenPanels: ['context'],
      };
      const put = await call(harness.baseUrl, '/api/ui/preferences', { method: 'PUT', token, body: prefs });
      assert.equal(put.status, 200);
      assert.deepStrictEqual(put.body.preferences, prefs);

      const get = await call(harness.baseUrl, '/api/ui/preferences', { token });
      assert.equal(get.status, 200);
      assert.deepStrictEqual(get.body.preferences, prefs);
    } finally {
      await harness.close();
    }
  });
});
