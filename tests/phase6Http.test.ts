import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { UserStore } from '@backend/server/auth/userStore';
import { authenticateRequest } from '@backend/server/auth/principal';
import { defaultRbacConfig, normalizeRbacConfig } from '@backend/server/auth/rbacConfig';
import { corsPolicyFromEnv } from '@backend/server/security/cors';
import { createLogger } from '@backend/server/observability/logger';
import { runWithRequestContext } from '@backend/server/observability/context';
import { createTelemetry, localTrace, type SpanAttributes } from '@backend/server/observability/telemetry';

const LEGACY_TOML = '[enterprise]\nenable_rbac = false\n';

type TestEnv = Record<string, string | undefined>;

async function withEnv<T>(values: TestEnv, fn: () => Promise<T>): Promise<T> {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

interface Harness {
  baseUrl: string;
  agentServer: AgentServer;
}

async function withHarness(
  fn: (harness: Harness) => Promise<void>,
  options: { env?: TestEnv; configToml?: string } = {},
): Promise<void> {
  await withEnv(options.env ?? {}, async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-phase6-http-'));
    for (const dir of ['config', 'wiki', 'raw', 'output', '.wiki-forge']) {
      await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
    }
    await fs.writeFile(
      path.join(tmpDir, 'config', 'config.toml'),
      options.configToml ?? LEGACY_TOML,
      'utf-8',
    );
    const agentServer = new AgentServer(tmpDir);
    const server = http.createServer(async (req, res) => {
      if (!(await agentServer.handleRequest(req, res))) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as { port: number };
    try {
      await fn({ baseUrl: `http://127.0.0.1:${port}`, agentServer });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
}

describe('Fase 6 — HTTP, auth e osservabilità', () => {
  it('CORS: preflight pubblico con wildcard in development', async () => {
    await withHarness(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/v1/graph/sync`, { method: 'OPTIONS' });
      assert.equal(res.status, 204);
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
      assert.match(res.headers.get('access-control-allow-headers') ?? '', /X-WikiForge-Token/);
      assert.ok(res.headers.get('x-correlation-id'));
    }, { env: { NODE_ENV: 'test' } });
  });

  it('CORS: allowlist esplicita con echo dell\'origin e preflight negato alle altre', async () => {
    await withHarness(async ({ baseUrl }) => {
      const allowed = await fetch(`${baseUrl}/api/help`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://a.example' },
      });
      assert.equal(allowed.status, 204);
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://a.example');

      const denied = await fetch(`${baseUrl}/api/help`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      });
      assert.equal(denied.status, 204);
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
    }, { env: { NODE_ENV: 'test', WIKIFORGE_CORS_ORIGINS: 'https://a.example, https://b.example' } });
  });

  it('CORS: in production il wildcard non abilita origini arbitrarie', async () => {
    const wildcard = corsPolicyFromEnv({ NODE_ENV: 'production', WIKIFORGE_CORS_ORIGINS: '*' });
    assert.equal(wildcard.allowWildcard, false);
    assert.equal(wildcard.origins.size, 0);

    await withHarness(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/help`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      });
      assert.equal(res.status, 204);
      assert.equal(res.headers.get('access-control-allow-origin'), null);
    }, { env: {
      NODE_ENV: 'production',
      WIKIFORGE_API_TOKEN: 'secret-token',
      WIKIFORGE_CORS_ORIGINS: '*',
    } });

    await withHarness(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/help`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://a.example' },
      });
      assert.equal(res.headers.get('access-control-allow-origin'), 'https://a.example');
    }, { env: {
      NODE_ENV: 'production',
      WIKIFORGE_API_TOKEN: 'secret-token',
      WIKIFORGE_CORS_ORIGINS: 'https://a.example',
    } });
  });

  it('body: JSON invalido diventa 400 e supera il limite diventa 413', async () => {
    await withHarness(async ({ baseUrl }) => {
      const invalid = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      });
      assert.equal(invalid.status, 400);
      const invalidBody = await invalid.json() as { success: boolean; error: string; correlationId: string };
      assert.equal(invalidBody.success, false);
      assert.match(invalidBody.error, /Invalid JSON body/);
      assert.equal(invalidBody.correlationId, invalid.headers.get('x-correlation-id'));

      const oversized = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'a'.repeat(200), password: 'b'.repeat(200) }),
      });
      assert.equal(oversized.status, 413);
      const oversizedBody = await oversized.json() as { correlationId: string; code: string };
      assert.equal(oversizedBody.correlationId, oversized.headers.get('x-correlation-id'));
      assert.equal(oversizedBody.code, 'body_too_large');
    }, { env: { NODE_ENV: 'test', WIKIFORGE_MAX_BODY_BYTES: '64' } });
  });

  it('correlationId è su ogni risposta e nei body di errore', async () => {
    await withHarness(async ({ baseUrl }) => {
      const ok = await fetch(`${baseUrl}/api/help`, {
        headers: { 'X-WikiForge-Token': 'secret-token' },
      });
      assert.ok(ok.headers.get('x-correlation-id'));
      assert.equal((await ok.json() as { success: boolean }).success, true);

      const denied = await fetch(`${baseUrl}/api/help`);
      assert.ok(denied.headers.get('x-correlation-id'));
      const deniedBody = await denied.json() as {
        success: boolean; error: string; correlationId: string;
      };
      assert.equal(deniedBody.success, false);
      assert.equal(deniedBody.correlationId, denied.headers.get('x-correlation-id'));
    }, { env: { NODE_ENV: 'test', WIKIFORGE_API_TOKEN: 'secret-token' } });
  });

  it('RBAC fail-closed: production abilita anche con enable_rbac=false', () => {
    assert.equal(defaultRbacConfig({ NODE_ENV: 'production' }).enabled, true);
    assert.equal(defaultRbacConfig({ NODE_ENV: 'test' }).enabled, false);
    assert.equal(
      normalizeRbacConfig({ enterprise: { enable_rbac: false } }, { NODE_ENV: 'production' }).enabled,
      true,
    );
    assert.equal(
      normalizeRbacConfig({ enterprise: { enable_rbac: false } }, { NODE_ENV: 'test' }).enabled,
      false,
    );
  });

  it('token obbligatorio in production senza IdP, user store o token configurati', async () => {
    const anonymous = { headers: {} };
    assert.equal((await authenticateRequest(anonymous, undefined, { NODE_ENV: 'production' })).ok, false);
    assert.equal((await authenticateRequest(anonymous, undefined, { NODE_ENV: 'test' })).ok, true);
    const verified = await authenticateRequest(
      { headers: { 'x-wikiforge-token': 'secret-token' } },
      undefined,
      { NODE_ENV: 'production', WIKIFORGE_API_TOKEN: 'secret-token' },
    );
    assert.equal(verified.ok, true);
    assert.deepEqual(verified.principal, {
      actor: 'process:api-token', roles: [], source: 'legacy-token',
    });

    await withHarness(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/help`);
      assert.equal(res.status, 401);
      const body = await res.json() as { correlationId: string };
      assert.equal(body.correlationId, res.headers.get('x-correlation-id'));
    }, { env: { NODE_ENV: 'production' } });
  });

  it('admin/admin rimosso: bootstrap solo con WIKIFORGE_ADMIN_PASSWORD', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-phase6-users-'));
    try {
      const empty = new UserStore({ rootDir: tmpDir, env: {} });
      assert.equal(empty.isEnabledSync(), false);
      assert.deepEqual(await empty.list(), []);
      assert.equal(await empty.authenticate({ username: 'admin', password: 'admin' }), undefined);

      const configured = new UserStore({
        rootDir: tmpDir,
        env: { WIKIFORGE_ADMIN_PASSWORD: 'correct horse battery staple' },
        now: () => 1_800_000_000,
      });
      assert.equal(configured.isEnabledSync(), true);
      const users = await configured.list();
      assert.deepEqual(users.map((user) => user.username), ['admin']);
      assert.ok(await configured.authenticate({
        username: 'admin', password: 'correct horse battery staple',
      }));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('health, readiness e metrics sono pubblici e rispondono prima dell\'auth', async () => {
    await withHarness(async ({ baseUrl }) => {
      const health = await fetch(`${baseUrl}/api/healthz`);
      assert.equal(health.status, 200);
      assert.equal((await health.json() as { status: string }).status, 'ok');

      const ready = await fetch(`${baseUrl}/api/readyz`);
      assert.equal(ready.status, 200);
      assert.equal((await ready.json() as { status: string }).status, 'ok');

      const metrics = await fetch(`${baseUrl}/api/metrics`);
      assert.equal(metrics.status, 200);
      assert.match(metrics.headers.get('content-type') ?? '', /text\/plain/);
      const text = await metrics.text();
      assert.match(text, /wikiforge_http_requests_total/);
      assert.match(text, /wikiforge_http_request_duration_ms_total/);

      const denied = await fetch(`${baseUrl}/api/help`);
      assert.equal(denied.status, 401);
    }, { env: { NODE_ENV: 'production', WIKIFORGE_API_TOKEN: 'secret-token' } });
  });

  it('logger JSON strutturato e adapter OpenTelemetry locale', async () => {
    const lines: string[] = [];
    const logger = createLogger('test', {
      env: { WIKIFORGE_LOG_LEVEL: 'debug' },
      sink: (line) => { lines.push(line); },
    });
    runWithRequestContext({ correlationId: 'corr-1' }, () => {
      logger.info('hello', { answer: 42 });
    });
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    assert.equal(entry.level, 'info');
    assert.equal(entry.component, 'test');
    assert.equal(entry.correlationId, 'corr-1');
    assert.equal(entry.answer, 42);

    assert.equal(createTelemetry({ WIKIFORGE_OTEL_DISABLED: '1' }).provider, 'local');
    const seen: SpanAttributes[] = [];
    const result = await localTrace.getTracer('test', '1.0.0').startActiveSpan(
      'operation',
      { attributes: { 'test.step': 1 } },
      async (span) => {
        seen.push({ 'test.step': 1 });
        span.setAttribute('http.request.duration_ms', 5);
        span.end();
        return 'done';
      },
    );
    assert.equal(result, 'done');
    assert.deepEqual(seen, [{ 'test.step': 1 }]);
  });
});
