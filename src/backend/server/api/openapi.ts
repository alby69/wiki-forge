/**
 * OpenAPI 3.1 generation from the declarative TypeScript catalogue.
 *
 * No YAML is maintained by hand. The Node gateway operations come from
 * `ROUTES`; the FastAPI graph service contributes its own `/openapi.json`
 * when reachable, otherwise a checked-in snapshot generated from the Pydantic
 * request/response models in `api_server.py` is merged instead.
 */

import { ROUTES, SCHEMAS } from '../../../shared/api/contracts';
import {
  createPythonApiClient,
  PYTHON_OPENAPI_SNAPSHOT,
} from '../../../shared/api/generated/pythonApi.generated';
import { MCP_TOOL_DESCRIPTORS } from '../../../shared/mcp/tools';
import { matchRoute } from '../../../shared/api/router';
import type { ApiRoute, JsonSchema } from '../../../shared/api/contracts';

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: Record<string, unknown>;
  servers: Array<Record<string, unknown>>;
  tags: Array<Record<string, unknown>>;
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: Record<string, unknown>;
  security: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export const FASTAPI_BASE_URL = 'http://localhost:8000';

/** Runtime URL of the graph service; same variable used by the proxy route. */
export function fastApiBaseUrl(): string {
  return (process.env.FASTAPI_SERVER_URL || FASTAPI_BASE_URL).replace(/\/+$/, '');
}

/** Snapshot exported from the FastAPI app by scripts/export_python_openapi.py. */
export const FASTAPI_SNAPSHOT: Record<string, unknown> =
  PYTHON_OPENAPI_SNAPSHOT as unknown as Record<string, unknown>;

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
}

function operation(route: ApiRoute): Record<string, unknown> {
  const result: Record<string, unknown> = {
    tags: route.tags,
    summary: route.summary,
    operationId: route.id,
    description: route.description,
    'x-command': route.command,
    'x-project-scoped': Boolean(route.projectScoped),
  };

  const params = [
    ...(route.request.params ?? []).map((param) => ({ ...param, in: 'path', required: true })),
    ...(route.request.query ?? []),
    ...(route.request.headers ?? []),
    ...(route.projectScoped ? [{
      name: 'X-Project-Id', in: 'header', required: false,
      description: 'Project id. Falls back to `?projectId=` and then to `default`.',
      schema: { type: 'string' },
    }] : []),
  ];
  if (params.length) result.parameters = params;

  if (route.request.body) {
    result.requestBody = {
      required: Boolean(route.request.bodyRequired),
      description: route.request.body.description,
      content: {
        'application/json': {
          schema: route.request.body,
        },
      },
    };
  }

  const responseContent: Record<string, unknown> = route.stream === 'sse'
    ? { 'text/event-stream': { schema: { type: 'string', description: 'Server-Sent Events stream' } } }
    : route.stream === 'binary'
      ? { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } }
      : { 'application/json': { schema: route.response.schema } };

  const successStatus = String(route.status ?? 200);
  result.responses = {
    [successStatus]: {
      description: route.response.description ?? (route.stream === 'sse' ? 'Event stream' : 'Successful response'),
      content: responseContent,
    },
    '400': { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
    '500': { description: 'Unexpected server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
  };
  if (route.deprecated) result.deprecated = true;
  return result;
}

/** Build the OpenAPI document from TypeScript contracts only. */
export function buildOpenApiDocument(): OpenApiDocument {
  const paths: OpenApiDocument['paths'] = {};
  const tagSet = new Set<string>();
  for (const route of ROUTES) {
    const key = openApiPath(route.path);
    route.tags.forEach((tag) => tagSet.add(tag));
    (paths[key] ??= {})[route.method.toLowerCase()] = operation(route);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Wiki-Forge API',
      version: '4.1.0',
      description: [
        'Unified contract for the Node gateway, the FastAPI knowledge-graph service and the MCP tools.',
        '',
        'Generated at runtime from `src/shared/api/contracts.ts` — never edit a YAML file.',
        'Project-scoped endpoints read `X-Project-Id` (or `?projectId=`). The gateway accepts',
        '`X-WikiForge-Token` when `WIKIFORGE_API_TOKEN` is configured on the server.',
        '',
        'The API browser is served self-hosted at `/api/docs`.',
      ].join('\n'),
    },
    servers: [{ url: '/', description: 'Current host (gateway :3001 or Vite proxy :5173)' }],
    tags: [...tagSet].sort().map((name) => ({ name })),
    paths,
    components: {
      schemas: { ...SCHEMAS },
      securitySchemes: {
        WikiForgeToken: {
          type: 'apiKey', in: 'header', name: 'X-WikiForge-Token',
          description: 'Optional when the server has no WIKIFORGE_API_TOKEN configured.',
        },
      },
    },
    security: [{ WikiForgeToken: [] }],
    'x-wikiforge': {
      source: 'src/shared/api/contracts.ts',
      routeCount: ROUTES.length,
      mcp: {
        transport: ['stdio', 'Streamable HTTP'],
        tools: MCP_TOOL_DESCRIPTORS.map((tool) => tool.name),
        documentation: 'bin/wf.ts mcp',
      },
      upstreamSpecs: [],
    },
  };
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

function prefixSchemaRefs(value: unknown, prefix: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => prefixSchemaRefs(entry, prefix));
  if (!isRecord(value)) return value;
  const result: UnknownRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string' && entry.startsWith('#/components/schemas/')) {
      result[key] = entry.replace('#/components/schemas/', `#/components/schemas/${prefix}`);
    } else {
      result[key] = prefixSchemaRefs(entry, prefix);
    }
  }
  return result;
}

/** Merge an upstream OpenAPI document without overwriting gateway operations. */
export function mergeUpstreamSpec(
  document: OpenApiDocument,
  upstream: unknown,
  source: string,
): OpenApiDocument {
  if (!isRecord(upstream)) return document;
  const metadata: UnknownRecord = {
    source,
    title: isRecord(upstream.info) ? String(upstream.info.title ?? 'Unknown service') : 'Unknown service',
    version: isRecord(upstream.info) ? String(upstream.info.version ?? '') : '',
  };
  const upstreamPaths = isRecord(upstream.paths) ? upstream.paths : {};
  let sharedPaths = 0;
  let addedPaths = 0;

  for (const [path, rawPathItem] of Object.entries(upstreamPaths)) {
    if (!isRecord(rawPathItem)) continue;
    const target = (document.paths[path] ??= {});
    for (const [method, rawOperation] of Object.entries(rawPathItem)) {
      const operationName = method.toLowerCase();
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(operationName) || !isRecord(rawOperation)) continue;
      const upstreamOperation = {
        ...(prefixSchemaRefs(rawOperation, 'FastApi_') as UnknownRecord),
        servers: [{ url: fastApiBaseUrl(), description: 'FastAPI knowledge-graph service' }],
        'x-upstream': source,
      };
      if (target[operationName]) {
        sharedPaths += 1;
        target[operationName]['x-upstream-contract'] = upstreamOperation;
      } else {
        target[operationName] = upstreamOperation;
        addedPaths += 1;
      }
    }
  }

  const components = isRecord(document.components) ? document.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  const upstreamComponents = isRecord(upstream.components) ? upstream.components : {};
  const upstreamSchemas = isRecord(upstreamComponents.schemas) ? upstreamComponents.schemas : {};
  for (const [name, schema] of Object.entries(upstreamSchemas)) {
    schemas[`FastApi_${name}`] = prefixSchemaRefs(schema, 'FastApi_');
  }
  components.schemas = schemas;
  document.components = components;

  metadata.pathsAdded = addedPaths;
  metadata.operationsMerged = sharedPaths;
  const info = isRecord(document['x-wikiforge']) ? document['x-wikiforge'] : {};
  const specs = Array.isArray(info.upstreamSpecs) ? info.upstreamSpecs : [];
  specs.push(metadata);
  info.upstreamSpecs = specs;
  document['x-wikiforge'] = info;
  return document;
}

/** Try the live FastAPI spec; always fall back to the snapshot. */
export async function loadOpenApiDocument(fetchFn: typeof fetch = fetch): Promise<OpenApiDocument> {
  const document = buildOpenApiDocument();
  let merged = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const client = createPythonApiClient({ baseUrl: fastApiBaseUrl(), fetchImpl: fetchFn });
    const upstream = await client.getOpenApiSpec({ headers: { Accept: 'application/json' }, signal: controller.signal });
    mergeUpstreamSpec(document, upstream, 'fastapi:live');
    merged = true;
  } catch {
    // FastAPI is optional for the docs browser; the snapshot is enough.
  } finally {
    clearTimeout(timer);
  }
  if (!merged) mergeUpstreamSpec(document, FASTAPI_SNAPSHOT, 'fastapi:snapshot');
  return document;
}

export interface McpToolSummary {
  name: string;
  description: string;
  required: string[];
}

export const MCP_TOOLS: McpToolSummary[] = MCP_TOOL_DESCRIPTORS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required.map(String) : [],
}));

/** Utility used by tests and by validation in the next phase. */
export function findRoute(method: string, pathname: string): ApiRoute | undefined {
  return matchRoute(ROUTES, method, pathname)?.route;
}

/** Exposed for validation middleware in Fase 2. */
export function requestSchema(method: string, pathname: string): JsonSchema | undefined {
  return findRoute(method, pathname)?.request.body;
}
