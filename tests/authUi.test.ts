import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { AgentServer } from '@backend/server/agentServer';
import { createApiClient } from '@frontend/api/client';
import { Header } from '@frontend/components/ui/Header';
import { signOut } from '@frontend/core/auth';
import { appStore, DEFAULT_PINNED_ACTION_IDS } from '@frontend/store/appStore';
import type { AuthIdentityDto } from '@shared/api/types';

/**
 * B7 — identity UI over the typed transport only.
 *
 * Legacy mode must render no identity markup and send no Authorization header.
 * With an IdP, the bearer comes from the additive app-store slice and every
 * identity field comes back from GET /api/auth/me.
 */

const UNAUTHORIZED = {
  success: false,
  error: 'Unauthorized: Invalid or missing X-WikiForge-Token',
};

const ISSUER = 'https://idp.example.test';
const AUDIENCE = 'wiki-forge';
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const NOW = 1_800_000_000;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>), kid: 'ui-key' };

const LEGACY_TOML = '[enterprise]\nenable_rbac = false\n';
const RESTRICTED_RBAC_TOML = `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = []
`;

const IDP_TOML = `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
[enterprise.auth]
provider = "oidc"
issuer = "${ISSUER}"
audience = "${AUDIENCE}"
jwksUrl = "${JWKS_URL}"
rolesClaim = "roles"
[enterprise.auth.roleMap]
"wf-admin" = "Admin"
`;

function jwt(roles: string[] = ['wf-admin']): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'ui-key' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: ISSUER, aud: AUDIENCE, exp: NOW + 600, sub: 'alice', roles,
  })).toString('base64url');
  const input = `${header}.${claims}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

interface Harness {
  baseUrl: string;
  close: () => Promise<void>;
}

async function createHarness(configToml: string): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-auth-ui-'));
  for (const dir of ['config', 'wiki', 'raw', 'output']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), configToml, 'utf-8');
  const agentServer = new AgentServer(tmpDir, undefined, undefined, {
    now: () => NOW,
    fetchJson: async (url) => {
      assert.strictEqual(url, JWKS_URL);
      return { keys: [jwk] };
    },
  });
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
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

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
      hidden: true, checked: false, value: '', _listeners: listeners,
      addEventListener(type, cb) { listeners.set(type, [...(listeners.get(type) ?? []), cb]); },
      setAttribute() {}, focus() {},
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

function fire(el: MockEl | undefined, type: string): void {
  for (const cb of el?._listeners.get(type) ?? []) cb();
}

function identity(overrides: Partial<AuthIdentityDto> = {}): AuthIdentityDto {
  return {
    actor: 'human:alice', roles: ['Admin'], source: 'idp',
    authenticated: true, rbacEnabled: true, strict: true, idpConfigured: true,
    ...overrides,
  };
}

describe('GET /api/auth/me (B7)', () => {
  it('legacy mode returns the process identity without a credential gate', async () => {
    const h = await createHarness(LEGACY_TOML);
    try {
      const res = await fetch(`${h.baseUrl}/api/auth/me`);
      assert.strictEqual(res.status, 200);
      const body = await res.json() as { success: boolean; auth: AuthIdentityDto };
      assert.strictEqual(body.success, true);
      assert.deepStrictEqual(body.auth, {
        actor: 'process:api-token', roles: [], source: 'legacy-token',
        authenticated: false, rbacEnabled: false, strict: false, idpConfigured: false,
      });
    } finally {
      await h.close();
    }
  });

  it('an IdP without credentials is discoverable but not authenticated', async () => {
    const h = await createHarness(IDP_TOML);
    try {
      const res = await fetch(`${h.baseUrl}/api/auth/me`);
      assert.strictEqual(res.status, 200);
      const body = await res.json() as { auth: AuthIdentityDto };
      assert.strictEqual(body.auth.idpConfigured, true);
      assert.strictEqual(body.auth.authenticated, false);
      assert.strictEqual(body.auth.strict, true);
    } finally {
      await h.close();
    }
  });

  it('anonymous discovery stays public with a restrictive project ACL', async () => {
    const h = await createHarness(RESTRICTED_RBAC_TOML);
    try {
      const res = await fetch(`${h.baseUrl}/api/auth/me`);
      assert.strictEqual(res.status, 200);
      const body = await res.json() as { success: boolean; auth: AuthIdentityDto };
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.auth.authenticated, false);
      assert.strictEqual(body.auth.rbacEnabled, true);
    } finally {
      await h.close();
    }
  });

  it('an invalid bearer keeps the exact B0 401 envelope', async () => {
    const h = await createHarness(IDP_TOML);
    try {
      const res = await fetch(`${h.baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer not-a-jwt' },
      });
      assert.strictEqual(res.status, 401);
      assert.deepStrictEqual(await res.json(), UNAUTHORIZED);
    } finally {
      await h.close();
    }
  });

  it('a valid bearer returns the server-derived actor and mapped roles', async () => {
    const h = await createHarness(IDP_TOML);
    try {
      const res = await fetch(`${h.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${jwt()}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as { auth: AuthIdentityDto };
      assert.deepStrictEqual(body.auth, {
        actor: 'human:alice', roles: ['Admin'], source: 'idp',
        authenticated: true, rbacEnabled: true, strict: true, idpConfigured: true,
      });
    } finally {
      await h.close();
    }
  });
});

describe('Typed client bearer (B7)', () => {
  it('sends Authorization only when the store supplies a token', async () => {
    const headers: Array<Record<string, string>> = [];
    const respond = async (_url: string, init?: RequestInit) => {
      headers.push({ ...(init?.headers as Record<string, string>) });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    };
    let bearer: string | undefined = 'idp-token';
    const client = createApiClient({
      getToken: () => 'shared-token',
      getBearerToken: () => bearer,
      fetchImpl: respond as typeof fetch,
    });
    await client['help.list']({});
    assert.strictEqual(headers[0]['X-WikiForge-Token'], 'shared-token');
    assert.strictEqual(headers[0]['Authorization'], 'Bearer idp-token');

    bearer = undefined;
    await client['help.list']({});
    assert.strictEqual(headers[1]['X-WikiForge-Token'], 'shared-token');
    assert.strictEqual(headers[1]['Authorization'], undefined);
  });
});

describe('Identity UI (B7)', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    (globalThis as any).window = { addEventListener: () => {} };
    (globalThis as any).document = { addEventListener: () => {}, removeEventListener: () => {} };
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    };
    appStore.setAuth('', undefined);
    appStore.setPinnedActionIds([...DEFAULT_PINNED_ACTION_IDS, 'global:changesets']);
    appStore.setAdvancedMode(true);
  });

  afterEach(() => {
    appStore.setAuth('', undefined);
    appStore.setPinnedActionIds([...DEFAULT_PINNED_ACTION_IDS]);
    appStore.setAdvancedMode(false);
  });

  it('legacy mode renders no identity markup', () => {
    const dom = createDom();
    new Header({ container: dom.container });
    assert.doesNotMatch(dom.html(), /wf-identity|wf-signin-btn|wf-signout-btn/);
  });

  it('a verified IdP identity shows the actor, roles and sign-out', () => {
    const dom = createDom();
    appStore.setAuth('idp-token', identity());
    new Header({ container: dom.container });
    const markup = dom.html();
    assert.match(markup, /id="wf-identity"/);
    assert.match(markup, /human:alice/);
    assert.match(markup, /Admin/);
    assert.match(markup, /id="wf-signout-btn"/);
    assert.doesNotMatch(markup, /id="wf-signin-btn"/);
  });

  it('an IdP without a credential offers sign-in only', () => {
    const dom = createDom();
    appStore.setAuth('', identity({
      actor: 'process:api-token', roles: [], source: 'legacy-token',
      authenticated: false,
    }));
    new Header({ container: dom.container });
    assert.match(dom.html(), /id="wf-identity-signin"/);
    assert.match(dom.html(), /id="wf-signin-btn"/);
  });

  it('roles gate admin actions only for IdP identities', () => {
    const dom = createDom();
    appStore.setAuth('idp-token', identity({ roles: ['Reader'] }));
    new Header({ container: dom.container });
    assert.doesNotMatch(dom.html(), /id="header-changesets-btn"/);

    appStore.setAuth('idp-token', identity({ roles: ['Admin'] }));
    assert.match(dom.html(), /id="header-changesets-btn"/);
  });

  it('sign-out clears the token and restores the legacy header', () => {
    const dom = createDom();
    appStore.setAuth('idp-token', identity());
    new Header({ container: dom.container });
    fire(dom.elements.get('#wf-signout-btn'), 'click');
    assert.strictEqual(appStore.getState().auth.token, '');
    assert.strictEqual(appStore.getState().auth.identity, undefined);
    assert.strictEqual(storage.has('wiki-forge:auth-token'), false);
    assert.doesNotMatch(dom.html(), /wf-identity/);
  });
});
