import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { buildOpenApiDocument, FASTAPI_SNAPSHOT, mergeUpstreamSpec } from '@backend/server/api/openapi';
import { OPERATION_ROLES } from '@backend/server/auth/rbacMiddleware';

/**
 * C4 — additive declarative graph routes.
 *
 * The three legacy FastAPI proxy paths must keep answering before the token
 * gate; the new Neo4j routes must behave like every other bus operation and
 * return the exact B0 envelope when a token is configured but not supplied.
 */

const UNAUTHORIZED = {
  success: false,
  error: 'Unauthorized: Invalid or missing X-WikiForge-Token',
};

function assertUnauthorized(body: unknown, response: Response, label?: string): void {
  const value = body as Record<string, unknown>;
  assert.deepStrictEqual({ success: value.success, error: value.error }, UNAUTHORIZED, label);
  assert.strictEqual(value.correlationId, response.headers.get('x-correlation-id'), label);
}

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  close: () => Promise<void>;
}

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-graph-routes-'));
  await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
  const agentServer = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    if (!(await agentServer.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  return {
    agentServer,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function withEnv(
  values: Partial<Record<'WIKIFORGE_API_TOKEN' | 'FASTAPI_SERVER_URL', string | undefined>>,
  fn: () => Promise<void>,
): Promise<void> {
  const keys = Object.keys(values) as Array<keyof typeof values>;
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('C4 — declarative Neo4j graph routes', () => {
  let h: Harness;
  let upstream: http.Server;
  let upstreamUrl: string;
  let lastProxyRequest: { method?: string; path?: string; body: string; trace?: string } | undefined;

  before(async () => {
    upstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => {
        lastProxyRequest = {
          method: req.method,
          path: req.url,
          body: Buffer.concat(chunks).toString('utf-8'),
          trace: typeof req.headers['x-trace'] === 'string' ? req.headers['x-trace'] : undefined,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ proxied: true, path: req.url }));
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));
    upstreamUrl = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;
    h = await createHarness();
  });

  after(async () => {
    await h.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  it('declares the three additive routes in the generated OpenAPI document', () => {
    const doc = buildOpenApiDocument();
    const declared = [
      ['/api/v1/graph/cypher', 'post', 'graph.cypher'],
      ['/api/v1/graph/sync/neo4j', 'post', 'graph.sync.neo4j'],
      ['/api/v1/graph/status', 'get', 'graph.status'],
    ] as const;

    for (const [routePath, method, command] of declared) {
      const operation = doc.paths[routePath]?.[method];
      assert.ok(operation, `${method} ${routePath} is missing`);
      assert.equal(operation.operationId, command);
      assert.equal(operation['x-command'], command);
      assert.equal(operation['x-project-scoped'], true);
    }

    mergeUpstreamSpec(doc, FASTAPI_SNAPSHOT, 'test:c4-snapshot');
    assert.ok(doc.paths['/api/v1/graph/status']?.get);
    assert.ok(doc.paths['/api/v1/graph/sync/neo4j']?.post);
    assert.equal(doc.paths['/api/v1/graph/status']?.get?.['x-upstream-contract'], undefined);
    assert.equal(doc.paths['/api/v1/graph/cypher']?.post?.operationId, 'graph.cypher');
  });

  it('requires the gateway token on the new routes with the exact B0 envelope', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token', FASTAPI_SERVER_URL: upstreamUrl }, async () => {
      const requests: Array<[string, string, unknown]> = [
        ['POST', '/api/v1/graph/cypher', { cypher: 'MATCH (n) RETURN n' }],
        ['POST', '/api/v1/graph/sync/neo4j', {}],
        ['GET', '/api/v1/graph/status', undefined],
      ];
      for (const [method, routePath, body] of requests) {
        const res = await fetch(`${h.baseUrl}${routePath}`, {
          method,
          headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        assert.equal(res.status, 401, routePath);
        assertUnauthorized(await res.json(), res, routePath);
      }
    });
  });

  it('keeps the three legacy graph proxy paths byte-compatible', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token', FASTAPI_SERVER_URL: upstreamUrl }, async () => {
      for (const routePath of ['/api/v1/graph/sync', '/api/v1/graph/validate', '/api/v1/graph/rag']) {
        // B4 gates every ingress, the proxy included: no token -> exact B0 envelope.
        const denied = await fetch(`${h.baseUrl}${routePath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        assert.equal(denied.status, 401, routePath);
        assertUnauthorized(await denied.json(), denied, routePath);

        // With a valid token the original FastAPI proxy behaviour is untouched.
        const res = await fetch(`${h.baseUrl}${routePath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WikiForge-Token': 'secret-token' },
          body: '{}',
        });
        assert.equal(res.status, 200, routePath);
        const body = await res.json() as { proxied: boolean; path: string };
        assert.equal(body.proxied, true, routePath);
        assert.equal(body.path, routePath);
      }
    });
  });

  it('serves status, read-only query and full sync with a valid token', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token', FASTAPI_SERVER_URL: upstreamUrl }, async () => {
      const headers = { 'X-WikiForge-Token': 'secret-token', 'Content-Type': 'application/json' };

      const statusRes = await fetch(`${h.baseUrl}/api/v1/graph/status`, { headers });
      assert.equal(statusRes.status, 200);
      const status = await statusRes.json() as Record<string, unknown>;
      assert.equal(status.success, true);
      assert.equal(typeof status.enabled, 'boolean');
      assert.equal(typeof status.configured, 'boolean');
      assert.equal(typeof status.driverInstalled, 'boolean');
      assert.equal(status.mode, 'mock');
      assert.equal(typeof status.database, 'string');

      const queryRes = await fetch(`${h.baseUrl}/api/v1/graph/cypher`, {
        method: 'POST', headers,
        body: JSON.stringify({ cypher: 'MATCH (n:PermanentNote) RETURN n.title AS title', params: {} }),
      });
      assert.equal(queryRes.status, 200);
      const query = await queryRes.json() as Record<string, unknown>;
      assert.equal(query.success, true);
      assert.equal(query.mode, 'mock');
      assert.deepStrictEqual(query.rows, []);
      assert.equal(query.count, 0);

      const writeRes = await fetch(`${h.baseUrl}/api/v1/graph/cypher`, {
        method: 'POST', headers,
        body: JSON.stringify({ cypher: "MATCH (n) SET n.title = 'x' RETURN n" }),
      });
      assert.equal(writeRes.status, 400);
      const write = await writeRes.json() as Record<string, unknown>;
      assert.equal(write.success, false);
      assert.equal(write.errorType, 'read_only_violation');

      const syncRes = await fetch(`${h.baseUrl}/api/v1/graph/sync/neo4j`, {
        method: 'POST', headers,
        body: JSON.stringify({ projectId: `c4-empty-${Date.now()}` }),
      });
      assert.equal(syncRes.status, 200);
      const sync = await syncRes.json() as Record<string, unknown>;
      assert.equal(sync.success, true);
      assert.equal(sync.notes, 0);
      assert.equal(sync.synced, 0);
      assert.equal(sync.mode, 'mock');
    });
  });

  it('dispatches the proxied graph routes through the bus with transport-neutral payloads', async () => {
    await withEnv({ FASTAPI_SERVER_URL: upstreamUrl }, async () => {
      const result = await h.agentServer.getBus().dispatch('graph.rag', {
        method: 'POST',
        search: '?trace=1',
        headers: { 'x-trace': 'bus' },
        body: { question: 'che succede?' },
        bodyText: '{"question":"che succede?"}',
      }, { rootDir: process.cwd(), projectId: 'default', correlationId: 'graph-proxy-test' });

      assert.equal(result.kind, 'binary');
      if (result.kind !== 'binary') return;
      assert.equal(result.status, 200);
      assert.deepStrictEqual(JSON.parse(String(result.body)), {
        proxied: true,
        path: '/api/v1/graph/rag?trace=1',
      });
      assert.equal(lastProxyRequest?.method, 'POST');
      assert.equal(lastProxyRequest?.body, '{"question":"che succede?"}');
      assert.equal(lastProxyRequest?.trace, 'bus');
    });
  });

  it('maps the new commands to explicit RBAC roles and registers them on the bus', () => {
    assert.equal(OPERATION_ROLES['graph.cypher'], 'Reader');
    assert.equal(OPERATION_ROLES['graph.status'], 'Reader');
    assert.equal(OPERATION_ROLES['graph.sync.neo4j'], 'KnowledgeEngineer');
    assert.equal(OPERATION_ROLES['graph.events'], 'Reader');
    assert.equal(OPERATION_ROLES['graph.reconcile'], 'KnowledgeEngineer');
    assert.equal(OPERATION_ROLES['graph.rag'], 'Reader');
    assert.equal(OPERATION_ROLES['graph.validate'], 'Reader');
    assert.equal(OPERATION_ROLES['graph.sync'], 'KnowledgeEngineer');
    for (const command of [
      'graph.cypher', 'graph.status', 'graph.sync.neo4j', 'graph.events', 'graph.reconcile',
      'graph.rag', 'graph.validate', 'graph.sync',
    ]) {
      assert.ok(h.agentServer.getBus().has(command), `${command} is not registered`);
    }
  });
});
