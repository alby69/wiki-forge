import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { buildOpenApiDocument, loadOpenApiDocument, mergeUpstreamSpec, FASTAPI_SNAPSHOT, MCP_TOOLS } from '@backend/server/api/openapi';
import { ROUTES, SCHEMAS } from '@shared/api/contracts';
import { COMMAND_MANIFEST } from '@shared/api/generated/commandManifest.generated';
import { matchRoute, interpolatePath } from '@shared/api/router';

test('OpenAPI catalogue is the single source of truth', () => {
  const doc = buildOpenApiDocument();
  assert.equal(doc.openapi, '3.1.0');
  assert.ok(ROUTES.length >= 70, `expected the full API catalogue, got ${ROUTES.length} routes`);

  const ids = ROUTES.map((route) => route.id);
  assert.equal(new Set(ids).size, ids.length, 'operation ids must be unique');
  assert.equal(new Set(ROUTES.map((route) => route.command)).size >= 60, true);

  for (const route of ROUTES) {
    const pathKey = route.path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    const operation = doc.paths[pathKey]?.[route.method.toLowerCase()];
    assert.ok(operation, `missing operation for ${route.method} ${route.path}`);
    assert.equal(operation.operationId, route.id);
    assert.equal(operation['x-command'], route.command);
    for (const param of route.request.params ?? []) {
      assert.ok(pathKey.includes(`{${param.name}}`), `${route.id}: path parameter ${param.name} is not declared in the path`);
    }
  }

  assert.ok(doc.paths['/api/auth/me']?.get, 'B7 identity route is declared in the catalogue');
  assert.equal(doc.paths['/api/auth/me']?.get?.operationId, 'auth.me');
  assert.equal(doc.paths['/api/auth/me']?.get?.['x-command'], 'auth.me');
  assert.ok((doc.components as { schemas: Record<string, unknown> }).schemas.AuthIdentity);
  assert.ok(doc.paths['/api/wiki/save']?.post);
  assert.ok(doc.paths['/api/projects/{id}/config']?.put);
  assert.ok(doc.paths['/api/projects/{id}/models/gguf']?.get);
  assert.ok(doc.paths['/api/projects/{id}/models/gguf/start']?.post);
  assert.ok(doc.paths['/api/projects/{id}/models/gguf/chunk']?.post);
  assert.ok(doc.paths['/api/projects/{id}/models/gguf/finalize']?.post);
  assert.ok(doc.paths['/api/projects/{id}/models/gguf/activate']?.post);
  assert.ok((doc.components as { schemas: Record<string, unknown> }).schemas.LocalModel);
  assert.ok(doc.paths['/api/ke/schedule/{jobId}/run']?.post);
  assert.ok(doc.paths['/api/scripts/schedule']?.post);
  assert.ok(doc.paths['/api/scripts/schedule/{jobId}']?.delete);
  assert.ok(doc.paths['/api/v1/changesets']?.get);
  assert.ok(doc.paths['/api/docs']?.get);
  assert.equal(Object.keys(SCHEMAS).length > 20, true);
});

test('MCP metadata is generated from the tool manifest', () => {
  const doc = buildOpenApiDocument();
  const mcp = (doc['x-wikiforge'] as { mcp: { tools: string[]; documentation: string; transport: string[] } }).mcp;
  assert.deepEqual(mcp.tools, MCP_TOOLS.map((tool) => tool.name));
  assert.equal(mcp.tools.length, COMMAND_MANIFEST.mcpTools.length);
  assert.equal(mcp.documentation, 'bin/wf.ts mcp');
  assert.deepEqual(mcp.transport, ['stdio', 'Streamable HTTP']);
  assert.ok(mcp.tools.includes('execute_ke_use_case'));
  assert.ok(!mcp.tools.includes('find_backlinks'));
});

test('shared router matches specific paths before parameterized ones', () => {
  assert.equal(matchRoute(ROUTES, 'POST', '/api/projects/import')?.route.id, 'projects.import');
  assert.equal(matchRoute(ROUTES, 'GET', '/api/projects/wikiforge/stats')?.route.id, 'projects.stats');
  assert.equal(matchRoute(ROUTES, 'GET', '/api/projects/wikiforge/stats')?.params.id, 'wikiforge');
  assert.equal(matchRoute(ROUTES, 'GET', '/api/help/getting-started')?.params.topicId, 'getting-started');
  assert.equal(matchRoute(ROUTES, 'DELETE', '/api/not-a-route'), undefined);
  assert.equal(interpolatePath('/api/projects/:id/config', { id: 'my project' }), '/api/projects/my%20project/config');
});

test('FastAPI spec is merged without overwriting gateway operations', async () => {
  const document = buildOpenApiDocument();
  const nodeSummary = document.paths['/api/v1/graph/rag']!.post!.summary;
  mergeUpstreamSpec(document, FASTAPI_SNAPSHOT, 'test:snapshot');

  assert.equal(document.paths['/api/v1/graph/rag']!.post!.summary, nodeSummary);
  assert.ok(document.paths['/api/v1/graph/rag']!.post!['x-upstream-contract']);
  assert.ok(document.paths['/api/v1/health']?.get);
  assert.ok((document.components as { schemas: Record<string, unknown> }).schemas.FastApi_SyncResponse);

  const loaded = await loadOpenApiDocument(async () => {
    throw new Error('FastAPI offline');
  });
  const specs = (loaded['x-wikiforge'] as { upstreamSpecs: Array<{ source: string }> }).upstreamSpecs;
  assert.equal(specs[0].source, 'fastapi:snapshot');
});

test('documentation browser serves local Swagger UI assets', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tests', 'tmp-openapi-'));
  const serverInstance = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    if (!(await serverInstance.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const base = `http://localhost:${port}`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const specResponse = await fetch(`${base}/api/openapi.json`);
  assert.equal(specResponse.status, 200);
  const spec = await specResponse.json() as { openapi: string; paths: Record<string, unknown> };
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(Object.keys(spec.paths).length >= 70);

  const docsResponse = await fetch(`${base}/api/docs`);
  assert.equal(docsResponse.status, 200);
  const html = await docsResponse.text();
  assert.match(html, /SwaggerUIBundle/);
  assert.match(html, /\/api\/docs\/assets\/swagger-ui-bundle\.js/);
  assert.doesNotMatch(html, /cdn\.|unpkg\.|jsdelivr/i, 'Swagger UI must not depend on a CDN');

  const jsResponse = await fetch(`${base}/api/docs/assets/swagger-ui-bundle.js`);
  assert.equal(jsResponse.status, 200);
  assert.match(jsResponse.headers.get('content-type') ?? '', /javascript/);
  const js = await jsResponse.text();
  assert.ok(js.length > 100_000);

  const traversalResponse = await fetch(`${base}/api/docs/assets/../../../package.json`);
  assert.equal(traversalResponse.status, 404);
});
