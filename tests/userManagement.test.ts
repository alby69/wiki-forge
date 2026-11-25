import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { UserStore } from '@backend/server/auth/userStore';
import type { ManagedUserDto } from '@shared/api/types';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'correct horse battery staple';

const LEGACY_TOML = '[enterprise]\nenable_rbac = false\n';
const RBAC_TOML = `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
`;

const ENV_KEYS = [
  'WIKIFORGE_API_TOKEN',
  'WIKIFORGE_ADMIN_USERNAME',
  'WIKIFORGE_ADMIN_PASSWORD',
  'WIKIFORGE_SESSION_TTL_MS',
  'WIKIFORGE_USER_STORE_FILE',
] as const;

type EnvKey = typeof ENV_KEYS[number];

interface ResponseBody {
  success?: boolean;
  error?: string;
  token?: string;
  user?: ManagedUserDto;
  users?: ManagedUserDto[];
  auth?: {
    actor?: string;
    source?: string;
    roles?: string[];
    authenticated?: boolean;
    rbacEnabled?: boolean;
    userStoreConfigured?: boolean;
  };
}

interface Harness {
  baseUrl: string;
  tmpDir: string;
  close: () => Promise<void>;
}

async function createHarness(configToml: string, env: Partial<Record<EnvKey, string>> = {}): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-user-management-'));
  for (const dir of ['config', 'wiki', 'raw', 'output', '.wiki-forge']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), configToml, 'utf-8');

  const previous = new Map<EnvKey, string | undefined>();
  for (const key of ENV_KEYS) previous.set(key, process.env[key]);
  delete process.env.WIKIFORGE_API_TOKEN;
  process.env.WIKIFORGE_ADMIN_USERNAME = ADMIN_USERNAME;
  process.env.WIKIFORGE_ADMIN_PASSWORD = ADMIN_PASSWORD;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const agentServer = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    if (!(await agentServer.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    tmpDir,
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

async function call(
  baseUrl: string,
  route: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: ResponseBody }> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: res.status, body: await res.json() as ResponseBody };
}

describe('Server-side user store', () => {
  it('does not bootstrap a default admin account', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-user-store-default-'));
    try {
      const store = new UserStore({ rootDir: tmpDir, env: {}, now: () => 1_800_000_000 });
      assert.equal(store.isEnabledSync(), false);

      await store.initialize();
      assert.deepStrictEqual(await store.list(), []);
      assert.equal(await store.authenticate({ username: 'admin', password: 'admin' }), undefined);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('bootstraps an Admin, persists hashed users and guards the last Admin', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-user-store-'));
    const env: NodeJS.ProcessEnv = {
      WIKIFORGE_ADMIN_USERNAME: ADMIN_USERNAME,
      WIKIFORGE_ADMIN_PASSWORD: ADMIN_PASSWORD,
      WIKIFORGE_SESSION_TTL_MS: '60000',
    };
    try {
      const store = new UserStore({ rootDir: tmpDir, env, now: () => 1_800_000_000 });
      assert.equal(store.isEnabledSync(), true);

      await store.initialize();
      const initial = await store.list();
      assert.equal(initial.length, 1);
      assert.equal(initial[0].username, ADMIN_USERNAME);
      assert.deepStrictEqual(initial[0].roles, ['Admin']);

      const filePath = path.join(tmpDir, '.wiki-forge', 'users.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      assert.ok(!raw.includes(ADMIN_PASSWORD));
      assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);

      const created = await store.create({
        username: 'reader', password: 'reader-password', roles: ['Reader', 'Contributor'],
      });
      assert.deepStrictEqual(created.roles, ['Reader', 'Contributor']);
      assert.equal(created.active, true);

      assert.equal(await store.authenticate({ username: 'reader', password: 'wrong' }), undefined);
      const session = await store.authenticate({ username: 'reader', password: 'reader-password' });
      assert.ok(session);
      assert.deepStrictEqual(await store.principalForToken(session!.token), {
        actor: 'human:reader', roles: ['Reader', 'Contributor'], source: 'local',
      });

      await store.update(session!.user.id, { roles: ['Reader'] });
      assert.deepStrictEqual((await store.principalForToken(session!.token))?.roles, ['Reader']);
      await store.update(session!.user.id, { active: false });
      assert.equal(await store.principalForToken(session!.token), undefined);

      await assert.rejects(
        store.update(initial[0].id, { roles: ['Reader'] }),
        /At least one active Admin account is required/,
      );
      await assert.rejects(store.delete(initial[0].id), /At least one active Admin account is required/);
      assert.deepStrictEqual((await store.list()).map(user => user.username), [ADMIN_USERNAME, 'reader']);

      const reloaded = new UserStore({ rootDir: tmpDir, env: {} });
      assert.equal(reloaded.isEnabledSync(), true);
      assert.deepStrictEqual((await reloaded.list()).map(user => user.username), [ADMIN_USERNAME, 'reader']);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('expires local sessions deterministically', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-user-store-'));
    let now = 1_800_000_000;
    try {
      const store = new UserStore({
        rootDir: tmpDir,
        env: {
          WIKIFORGE_ADMIN_USERNAME: ADMIN_USERNAME,
          WIKIFORGE_ADMIN_PASSWORD: ADMIN_PASSWORD,
          WIKIFORGE_SESSION_TTL_MS: '1000',
        },
        now: () => now,
      });
      const session = await store.authenticate({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
      assert.ok(session);
      assert.ok(await store.principalForToken(session!.token));
      now += 1001;
      assert.equal(await store.principalForToken(session!.token), undefined);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('User management API', () => {
  it('authenticates local users without a shared token and enforces Admin CRUD', async () => {
    const h = await createHarness(LEGACY_TOML);
    try {
      const anonymous = await call(h.baseUrl, '/api/users');
      assert.equal(anonymous.status, 403);
      assert.match(anonymous.body.error ?? '', /users\.\*/);

      const badLogin = await call(h.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: ADMIN_USERNAME, password: 'wrong' },
      });
      assert.equal(badLogin.status, 401);

      const login = await call(h.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
      });
      assert.equal(login.status, 200);
      assert.ok(login.body.token);
      assert.equal(login.body.user?.username, ADMIN_USERNAME);
      assert.equal(login.body.auth?.source, 'local');
      assert.equal(login.body.auth?.authenticated, true);
      assert.equal(login.body.auth?.userStoreConfigured, true);

      const me = await call(h.baseUrl, '/api/auth/me', { token: login.body.token });
      assert.equal(me.status, 200);
      assert.equal(me.body.auth?.source, 'local');

      const created = await call(h.baseUrl, '/api/users', {
        method: 'POST', token: login.body.token,
        body: { username: 'alice', password: 'alice-password', roles: ['Reader'] },
      });
      assert.equal(created.status, 200);
      assert.equal(created.body.user?.username, 'alice');

      const readerLogin = await call(h.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: 'alice', password: 'alice-password' },
      });
      assert.equal(readerLogin.status, 200);
      const readerList = await call(h.baseUrl, '/api/users', { token: readerLogin.body.token });
      assert.equal(readerList.status, 403);

      const list = await call(h.baseUrl, '/api/users', { token: login.body.token });
      assert.equal(list.status, 200);
      assert.deepStrictEqual(list.body.users?.map(user => user.username), [ADMIN_USERNAME, 'alice']);

      const updated = await call(h.baseUrl, `/api/users/${created.body.user?.id}`, {
        method: 'PATCH', token: login.body.token, body: { roles: ['Contributor'] },
      });
      assert.equal(updated.status, 200);
      assert.deepStrictEqual(updated.body.user?.roles, ['Contributor']);

      const removed = await call(h.baseUrl, `/api/users/${created.body.user?.id}`, {
        method: 'DELETE', token: login.body.token,
      });
      assert.equal(removed.status, 200);
      assert.deepStrictEqual((await call(h.baseUrl, '/api/users', { token: login.body.token })).body.users?.map(user => user.username), [ADMIN_USERNAME]);
    } finally {
      await h.close();
    }
  });

  it('enforces local Admin roles even when the RBAC flag is enabled', async () => {
    const h = await createHarness(RBAC_TOML);
    try {
      const login = await call(h.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
      });
      assert.equal(login.status, 200);
      assert.equal(login.body.auth?.rbacEnabled, true);

      const list = await call(h.baseUrl, '/api/users', { token: login.body.token });
      assert.equal(list.status, 200);

      const created = await call(h.baseUrl, '/api/users', {
        method: 'POST', token: login.body.token,
        body: { username: 'bob', password: 'bob-password', roles: ['Reader'] },
      });
      assert.equal(created.status, 200);

      const readerLogin = await call(h.baseUrl, '/api/auth/login', {
        method: 'POST', body: { username: 'bob', password: 'bob-password' },
      });
      const denied = await call(h.baseUrl, '/api/users', { token: readerLogin.body.token });
      assert.equal(denied.status, 403);
    } finally {
      await h.close();
    }
  });
});
