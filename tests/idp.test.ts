import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { AgentServer } from '@backend/server/agentServer';
import type { CommandContext } from '@backend/server/bus/messageBus';
import type { IdpAdapter, IdpDependencies } from '@backend/server/auth/idp';

/**
 * B6 — IdP adapters with mocked discovery/JWKS/metadata/exchange.
 *
 * Every dependency is injected, so these tests perform zero external network
 * calls. The only `fetch` calls hit the in-process HTTP harness.
 */

const UNAUTHORIZED = {
  success: false,
  error: 'Unauthorized: Invalid or missing X-WikiForge-Token',
};

const ISSUER = 'https://idp.example.test';
const AUDIENCE = 'wiki-forge';
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const METADATA_URL = `${ISSUER}/saml/metadata`;
const NOW = 1_800_000_000;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>), kid: 'test-key' };

const BASE_TOML = `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
`;

const OIDC_TOML = `${BASE_TOML}
[enterprise.auth]
provider = "oidc"
issuer = "${ISSUER}"
audience = "${AUDIENCE}"
jwksUrl = "${JWKS_URL}"
actorClaim = "sub"
rolesClaim = "roles"
[enterprise.auth.roleMap]
"wf-admin" = "Admin"
"wf-reader" = "Reader"
`;

const SAML_TOML = `${BASE_TOML}
[enterprise.auth]
provider = "saml"
samlMetadataUrl = "${METADATA_URL}"
actorClaim = "uid"
rolesClaim = "roles"
[enterprise.auth.roleMap]
"wf-admin" = "Admin"
`;

const OAUTH2_TOML = `${BASE_TOML}
[enterprise.auth]
provider = "oauth2"
issuer = "${ISSUER}"
audience = "${AUDIENCE}"
jwksUrl = "${JWKS_URL}"
clientId = "wiki-forge-ui"
authorizationUrl = "${ISSUER}/authorize"
tokenUrl = "${ISSUER}/token"
rolesClaim = "roles"
[enterprise.auth.roleMap]
"wf-admin" = "Admin"
`;

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signJwt(overrides: Record<string, unknown> = {}): string {
  const { header = {}, claims = {} } = overrides as {
    header?: Record<string, unknown>;
    claims?: Record<string, unknown>;
  };
  const encodedHeader = b64url({ alg: 'RS256', typ: 'JWT', kid: 'test-key', ...header });
  const encodedClaims = b64url({
    iss: ISSUER,
    aud: AUDIENCE,
    iat: NOW,
    exp: NOW + 600,
    sub: 'alice@example.test',
    roles: ['wf-admin'],
    ...claims,
  });
  const input = `${encodedHeader}.${encodedClaims}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), privateKey);
  return `${input}.${signature.toString('base64url')}`;
}

function jwksDeps(calls: string[] = []): IdpDependencies {
  return {
    now: () => NOW,
    fetchJson: async (url) => {
      calls.push(url);
      if (url === JWKS_URL) return { keys: [jwk] };
      throw new Error(`unexpected fetch: ${url}`);
    },
  };
}

interface Harness {
  baseUrl: string;
  captures: Array<{ command: string; context: CommandContext }>;
  agentServer: AgentServer;
  close: () => Promise<void>;
}

async function createHarness(options: {
  configToml: string;
  dependencies?: IdpDependencies;
  adapter?: IdpAdapter;
}): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-idp-'));
  for (const dir of ['config', 'wiki', 'raw', 'output']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), options.configToml, 'utf-8');

  const agentServer = new AgentServer(
    tmpDir,
    undefined,
    options.adapter,
    options.dependencies ?? jwksDeps(),
  );
  const captures: Array<{ command: string; context: CommandContext }> = [];
  agentServer.getBus().use((command, _payload, context) => {
    captures.push({ command, context });
    return undefined;
  });

  const server = http.createServer(async (req, res) => {
    const handled = await agentServer.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    captures,
    agentServer,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function withEnvToken(value: string | undefined, fn: () => Promise<void>): Promise<void> {
  const previous = process.env.WIKIFORGE_API_TOKEN;
  if (value === undefined) delete process.env.WIKIFORGE_API_TOKEN;
  else process.env.WIKIFORGE_API_TOKEN = value;
  try {
    await fn();
  } finally {
    if (previous === undefined) delete process.env.WIKIFORGE_API_TOKEN;
    else process.env.WIKIFORGE_API_TOKEN = previous;
  }
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

describe('IdP adapters (B6)', () => {
  it('senza provider il comportamento B0/B5 resta invariato', async () => {
    const h = await createHarness({ configToml: BASE_TOML });
    try {
      await withEnvToken(undefined, async () => {
        const res = await fetch(`${h.baseUrl}/api/help`);
        assert.strictEqual(res.status, 200);
      });
      assert.strictEqual(h.captures.length, 1);
      assert.deepStrictEqual(h.captures[0].context.principal, {
        actor: 'process:api-token', roles: [], source: 'legacy-token',
      });
      assert.strictEqual(h.agentServer.isStrictProvenance(), true);
    } finally {
      await h.close();
    }
  });

  it('provider configurato ma enable_rbac=false resta inerte', async () => {
    const disabled = OIDC_TOML.replace('enable_rbac = true', 'enable_rbac = false');
    const h = await createHarness({ configToml: disabled });
    try {
      await withEnvToken(undefined, async () => {
        const res = await fetch(`${h.baseUrl}/api/help`, { headers: bearer('not-a-jwt') });
        assert.strictEqual(res.status, 200);
      });
      assert.deepStrictEqual(h.captures[0]?.context.principal, {
        actor: 'process:api-token', roles: [], source: 'legacy-token',
      });
    } finally {
      await h.close();
    }
  });

  it('OIDC: JWKS mockato produce un Principal umano con ruoli mappati', async () => {
    const calls: string[] = [];
    const h = await createHarness({ configToml: OIDC_TOML, dependencies: jwksDeps(calls) });
    try {
      await withEnvToken(undefined, async () => {
        const res = await fetch(`${h.baseUrl}/api/help`, { headers: bearer(signJwt()) });
        assert.strictEqual(res.status, 200);
      });
      assert.deepStrictEqual(calls, [JWKS_URL]);
      const principal = h.captures[0].context.principal;
      assert.deepStrictEqual(principal, {
        actor: 'human:alice-example-test', roles: ['Admin'], source: 'idp',
      });
      assert.strictEqual(h.agentServer.provenanceActorFor(principal), 'human:alice-example-test');
    } finally {
      await h.close();
    }
  });

  it('OIDC: audience errato e token scaduto danno 401 con envelope B0 e nessun dispatch', async () => {
    const h = await createHarness({ configToml: OIDC_TOML });
    try {
      await withEnvToken(undefined, async () => {
        for (const token of [
          signJwt({ claims: { aud: 'another-app' } }),
          signJwt({ claims: { exp: NOW - 10 } }),
        ]) {
          const res = await fetch(`${h.baseUrl}/api/help`, { headers: bearer(token) });
          assert.strictEqual(res.status, 401);
          assert.deepStrictEqual(await res.json(), UNAUTHORIZED);
        }
      });
      assert.strictEqual(h.captures.length, 0);
    } finally {
      await h.close();
    }
  });

  it('i ruoli dei claim alimentano la matrice B3 (Reader non può salvare una nota)', async () => {
    const h = await createHarness({ configToml: OIDC_TOML });
    try {
      await withEnvToken(undefined, async () => {
        const token = signJwt({ claims: { roles: ['wf-reader'] } });
        // A permitted read first: the RBAC middleware denies before the
        // capture middleware, so only allowed dispatches reach the spy.
        const read = await fetch(`${h.baseUrl}/api/help`, { headers: bearer(token) });
        assert.strictEqual(read.status, 200);
        const res = await fetch(`${h.baseUrl}/api/wiki/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...bearer(token) },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 403);
        const body = await res.json() as any;
        assert.match(body.error, /wiki\.note\.save.*Contributor/);
      });
      const capture = h.captures[0];
      assert.ok(capture);
      assert.deepStrictEqual(capture.context.principal?.roles, ['Reader']);
      assert.deepStrictEqual(capture.context.rbac?.roles, ['Reader']);
    } finally {
      await h.close();
    }
  });

  it('il token condiviso resta un service account anche con IdP configurato', async () => {
    const h = await createHarness({ configToml: OIDC_TOML });
    try {
      await withEnvToken('secret-token', async () => {
        const res = await fetch(`${h.baseUrl}/api/help`, {
          headers: { 'X-WikiForge-Token': 'secret-token' },
        });
        assert.strictEqual(res.status, 200);
      });
      assert.deepStrictEqual(h.captures[0].context.principal, {
        actor: 'process:api-token', roles: [], source: 'legacy-token',
      });
    } finally {
      await h.close();
    }
  });

  it('SAML: metadata e verifica assertion injectati producono il Principal', async () => {
    const xml = [
      '<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">',
      '<saml:Subject><saml:NameID>alice@example.test</saml:NameID></saml:Subject>',
      '<saml:AttributeStatement>',
      '<saml:Attribute Name="uid"><saml:AttributeValue>alice</saml:AttributeValue></saml:Attribute>',
      '<saml:Attribute Name="roles"><saml:AttributeValue>wf-admin</saml:AttributeValue></saml:Attribute>',
      '</saml:AttributeStatement></saml:Assertion>',
    ].join('');
    const deps: IdpDependencies = {
      fetchText: async (url) => {
        assert.strictEqual(url, METADATA_URL);
        return '<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="idp.example.test"/>';
      },
      verifySamlAssertion: async (assertion, metadata) => {
        assert.ok(assertion.includes('NameID'));
        assert.ok(metadata.includes('EntityDescriptor'));
        return true;
      },
    };
    const h = await createHarness({ configToml: SAML_TOML, dependencies: deps });
    try {
      await withEnvToken(undefined, async () => {
        const res = await fetch(`${h.baseUrl}/api/help`, {
          headers: bearer(Buffer.from(xml).toString('base64')),
        });
        assert.strictEqual(res.status, 200);
      });
      assert.deepStrictEqual(h.captures[0].context.principal, {
        actor: 'human:alice', roles: ['Admin'], source: 'idp',
      });
    } finally {
      await h.close();
    }
  });

  it('SAML: assertion non valida dà 401 con lo stesso envelope', async () => {
    const h = await createHarness({
      configToml: SAML_TOML,
      dependencies: {
        fetchText: async () => '<EntityDescriptor/>',
        verifySamlAssertion: async () => false,
      },
    });
    try {
      await withEnvToken(undefined, async () => {
        const res = await fetch(`${h.baseUrl}/api/help`, {
          headers: bearer(Buffer.from('<Assertion/>').toString('base64')),
        });
        assert.strictEqual(res.status, 401);
        assert.deepStrictEqual(await res.json(), UNAUTHORIZED);
      });
      assert.strictEqual(h.captures.length, 0);
    } finally {
      await h.close();
    }
  });

  it('OAuth2: exchange mockato verifica l’id_token con lo stesso adapter OIDC', async () => {
    let exchangedCode = '';
    const deps: IdpDependencies = {
      ...jwksDeps(),
      exchangeCode: async ({ code, tokenUrl, clientId }) => {
        exchangedCode = code;
        assert.strictEqual(tokenUrl, `${ISSUER}/token`);
        assert.strictEqual(clientId, 'wiki-forge-ui');
        return { idToken: signJwt() };
      },
    };
    const h = await createHarness({ configToml: OAUTH2_TOML, dependencies: deps });
    try {
      await withEnvToken(undefined, async () => {
        const res = await fetch(`${h.baseUrl}/api/help`, { headers: bearer('code-123') });
        assert.strictEqual(res.status, 200);
      });
      assert.strictEqual(exchangedCode, 'code-123');
      const capture = h.captures[0];
      assert.ok(capture?.context.principal);
      assert.strictEqual(capture.context.principal.actor, 'human:alice-example-test');
    } finally {
      await h.close();
    }
  });

  it('provider configurato male fail-closed: nessun fallback pubblico', async () => {
    const broken = BASE_TOML + '\n[enterprise.auth]\nprovider = "oidc"\nissuer = "https://idp.example.test"\n';
    const h = await createHarness({ configToml: broken });
    try {
      await withEnvToken(undefined, async () => {
        const res = await fetch(`${h.baseUrl}/api/help`);
        assert.strictEqual(res.status, 401);
        assert.deepStrictEqual(await res.json(), UNAUTHORIZED);
      });
      assert.strictEqual(h.captures.length, 0);
    } finally {
      await h.close();
    }
  });
});
