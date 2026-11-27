import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  createPythonApiClient,
  DEFAULT_PYTHON_API_BASE_URL,
  isHTTPValidationError,
  isHealthResponse,
  isRAGQueryRequest,
  isRAGQueryResponse,
  isReasoningDoneFrame,
  isReasoningErrorFrame,
  isReasoningRequest,
  isReasoningStreamFrame,
  isReasoningTokenFrame,
  isSyncRequest,
  isSyncResponse,
  isValidationError,
  isValidationRequest,
  isValidationResponse,
  hasOwn,
  isRecord,
  OPENAPI_JSON_PATH,
  PYTHON_API_OPERATIONS,
  PYTHON_API_PATHS,
  PYTHON_OPENAPI_SNAPSHOT,
  type HealthResponse,
  type PythonApiClient,
  type SyncResponse,
} from '@shared/api/generated/pythonApi.generated';
import { GRAPH_PROXY_PATHS } from '@backend/server/modules/graphProxyModule';
import { loadOpenApiDocument } from '@backend/server/api/openapi';

const DEFAULT_SPEC = path.resolve('src', 'shared', 'api', 'generated', 'python.openapi.json');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function recordingClient(body: unknown) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    return jsonResponse(body);
  };
  return { client: createPythonApiClient({ baseUrl: 'http://python.test/', fetchImpl: fetchImpl as typeof fetch }), calls };
}

test('generated client publishes the exported graph and reasoning contracts', () => {
  assert.deepEqual(PYTHON_API_PATHS, {
    graphRag: '/api/v1/graph/rag',
    graphSync: '/api/v1/graph/sync',
    graphValidate: '/api/v1/graph/validate',
    health: '/api/v1/health',
    llmReasoningStream: '/api/v1/llm/reasoning/stream',
  });
  assert.equal(DEFAULT_PYTHON_API_BASE_URL, 'http://localhost:8000');
  assert.equal(OPENAPI_JSON_PATH, '/openapi.json');
  assert.equal(PYTHON_OPENAPI_SNAPSHOT.info.title, 'Wiki-Forge Knowledge Graph & GraphRAG API');
  assert.deepEqual(
    Object.keys(GRAPH_PROXY_PATHS).sort(),
    [PYTHON_API_PATHS.graphRag, PYTHON_API_PATHS.graphSync, PYTHON_API_PATHS.graphValidate].sort(),
  );
  assert.deepEqual(
    PYTHON_API_OPERATIONS.map((operation) => operation.operationId),
    Object.values(PYTHON_OPENAPI_SNAPSHOT.paths).flatMap((item) =>
      Object.values(item ?? {}).map((operation) => operation?.operationId),
    ),
  );
});

test('generated responses are typed and validators reject renamed fields', () => {
  const sync: SyncResponse = {
    status: 'SUCCESS',
    message: 'Synchronized 4 notes into RDF graph.',
    processed_notes: 4,
    output_path: 'knowledge_graph.ttl',
  };
  const health: HealthResponse = { status: 'ok', service: 'wiki-forge-kg-api' };
  assert.equal(sync.processed_notes, 4);
  assert.equal(health.service, 'wiki-forge-kg-api');
  assert.ok(isSyncResponse(sync));
  assert.ok(isHealthResponse(health));
  assert.ok(isSyncRequest({ wiki_dir: 'wiki' }));
  assert.ok(isRAGQueryRequest({ question: ' chi?' }));
  assert.ok(isRAGQueryResponse({ question: 'q', entities: [], cypher_query: '', final_answer: '' }));
  assert.ok(isValidationRequest({ graph_path: 'graph.ttl' }));
  assert.ok(isValidationResponse({ conforms: true, graph_path: 'g', shapes_path: 's', report: '', violations: [] }));
  assert.ok(isHTTPValidationError({ detail: [{ loc: ['body'], msg: 'bad', type: 'value_error' }] }));
  assert.ok(isValidationError({ loc: [0, 'body'], msg: 'bad', type: 'value_error', input: 7 }));
  assert.ok(isReasoningRequest({ prompt: 'ciao', context: null, max_tokens: 12 }));
  assert.ok(isReasoningTokenFrame({ token: 'ciao', is_thinking: false }));
  assert.ok(isReasoningDoneFrame({ done: true }));
  assert.ok(isReasoningErrorFrame({ error: 'stop' }));
  assert.ok(isReasoningStreamFrame({ token: 'ciao', is_thinking: false }));
  assert.ok(isRecord({ a: 1 }));
  assert.ok(hasOwn({ a: 1 }, 'a'));

  const renamed = { ...sync, processedNotes: sync.processed_notes };
  delete (renamed as Record<string, unknown>).processed_notes;
  assert.equal(isSyncResponse(renamed), false);
  assert.equal(isSyncResponse({ ...sync, processed_notes: '4' }), false);
  assert.equal(isRAGQueryResponse({ question: 'q', entities: [], cypher_query: '' }), false);
  assert.equal(isReasoningStreamFrame({ content: 'ciao', is_thinking: false }), false);
  assert.equal(isReasoningStreamFrame({ token: 'ciao', is_thinking: false, extra: true }), false);
  assert.equal(isRecord([]), false);
  assert.equal(hasOwn({}, 'a'), false);
});

test('generated client routes every operation through the injected fetch', async () => {
  const sync: SyncResponse = {
    status: 'SUCCESS', message: 'ok', processed_notes: 2, output_path: 'graph.ttl',
  };
  const { client, calls } = recordingClient(sync);
  assert.deepEqual(await client.syncGraph({ wiki_dir: 'wiki' }), sync);
  assert.equal(calls.at(-1)?.url, 'http://python.test/api/v1/graph/sync');
  assert.equal(calls.at(-1)?.init?.method, 'POST');
  assert.equal(calls.at(-1)?.init?.body, JSON.stringify({ wiki_dir: 'wiki' }));
  assert.deepEqual((calls.at(-1)?.init?.headers as Record<string, string>)['Content-Type'], 'application/json');

  await client.queryRag({ question: 'q' }, { search: '?trace=1', headers: { 'X-Trace': 'abc' } });
  assert.equal(calls.at(-1)?.url, 'http://python.test/api/v1/graph/rag?trace=1');
  assert.equal((calls.at(-1)?.init?.headers as Record<string, string>)['X-Trace'], 'abc');

  await client.validateShaclEndpoint({});
  assert.equal(calls.at(-1)?.url, 'http://python.test/api/v1/graph/validate');
  await client.healthCheck();
  assert.equal(calls.at(-1)?.url, 'http://python.test/api/v1/health');
  assert.equal(calls.at(-1)?.init?.method, 'GET');
  await client.getOpenApiSpec();
  assert.equal(calls.at(-1)?.url, 'http://python.test/openapi.json');

  const stream = await client.reasoningStream({ prompt: 'q', max_tokens: 8 });
  assert.equal(stream.status, 200);
  assert.equal(calls.at(-1)?.url, 'http://python.test/api/v1/llm/reasoning/stream');

  await client.request(PYTHON_API_PATHS.graphSync, { bodyText: '{"raw":true}', search: '?x=2' });
  assert.equal(calls.at(-1)?.url, 'http://python.test/api/v1/graph/sync?x=2');
  assert.equal(calls.at(-1)?.init?.body, '{"raw":true}');
});

test('generated client fails closed on HTTP errors', async () => {
  const client: PythonApiClient = createPythonApiClient({
    fetchImpl: (async () => jsonResponse({ error: 'down' }, 503)) as typeof fetch,
  });
  await assert.rejects(client.healthCheck(), /HTTP 503/);
  await assert.rejects(client.reasoningStream({ prompt: 'q' }), /HTTP 503/);
  await assert.rejects(client.getOpenApiSpec(), /HTTP 503/);
});

test('OpenAPI document consumes the checked-in FastAPI snapshot via the client', async () => {
  const seen: string[] = [];
  const document = await loadOpenApiDocument(async (input) => {
    seen.push(String(input));
    return jsonResponse({ error: 'offline' }, 502);
  });
  assert.deepEqual(seen, ['http://localhost:8000/openapi.json']);
  const specs = document['x-wikiforge'] as { upstreamSpecs: Array<{ source: string }> };
  assert.equal(specs.upstreamSpecs[0].source, 'fastapi:snapshot');
  const schemas = document.components.schemas as Record<string, unknown>;
  assert.ok(schemas.FastApi_SyncResponse);
});

test('no ad-hoc Python HTTP call site remains outside the generated client', () => {
  const apiStorage = readFileSync(path.resolve('src/frontend/storage/ApiStorage.ts'), 'utf-8');
  assert.ok(!apiStorage.includes('fetch('));
  assert.ok(!apiStorage.includes('/api/v1/llm/reasoning/stream'));
  const proxy = readFileSync(path.resolve('src/backend/server/modules/graphProxyModule.ts'), 'utf-8');
  assert.ok(!proxy.includes('fetch('));
  assert.ok(proxy.includes('createPythonApiClient'));
  const openapi = readFileSync(path.resolve('src/backend/server/api/openapi.ts'), 'utf-8');
  assert.ok(!openapi.includes('fetchFn('));
});

test('renaming an exported FastAPI response field fails python-contract:check', (t) => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wf-python-contract-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const mutated = JSON.parse(readFileSync(DEFAULT_SPEC, 'utf-8')) as {
    components: { schemas: { SyncResponse: { properties: Record<string, unknown> } } };
  };
  const properties = mutated.components.schemas.SyncResponse.properties;
  properties.processed_notes_count = properties.processed_notes;
  delete properties.processed_notes;
  const specPath = path.join(tmp, 'python.openapi.json');
  writeFileSync(specPath, JSON.stringify(mutated, null, 2));

  const result = spawnSync('npm', ['run', 'python-contract:check'], {
    cwd: process.cwd(),
    env: { ...process.env, PYTHON_OPENAPI_PATH: specPath },
    encoding: 'utf-8',
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /STALE:.*does not match the FastAPI app/);
});

test('a stale generated client also fails python-contract:check', (t) => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wf-python-client-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const clientPath = path.join(tmp, 'pythonApi.generated.ts');
  writeFileSync(clientPath, 'export const BROKEN = true;\n', 'utf-8');
  const result = spawnSync('npm', ['run', 'python-contract:check'], {
    cwd: process.cwd(),
    env: { ...process.env, PYTHON_API_CLIENT_PATH: clientPath },
    encoding: 'utf-8',
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /STALE:.*pythonApi\.generated\.ts/);
});
