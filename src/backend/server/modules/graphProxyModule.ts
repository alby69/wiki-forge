import { binary, error, json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';

export const GRAPH_PROXY_COMMANDS = ['graph.sync', 'graph.validate', 'graph.rag'] as const;

export const GRAPH_PROXY_PATHS: Readonly<Record<string, (typeof GRAPH_PROXY_COMMANDS)[number]>> = {
  '/api/v1/graph/sync': 'graph.sync',
  '/api/v1/graph/validate': 'graph.validate',
  '/api/v1/graph/rag': 'graph.rag',
};

export type FastApiUrlResolver = string | (() => string);

export interface GraphProxyOptions {
  baseUrl?: FastApiUrlResolver;
  fetchImpl?: typeof fetch;
}

interface FastApiProxyPayload {
  method?: string;
  search?: string;
  headers?: Record<string, unknown>;
  bodyText?: string;
  body?: unknown;
}

const DEFAULT_BASE_URL: FastApiUrlResolver = () =>
  process.env.FASTAPI_SERVER_URL || 'http://127.0.0.1:8000';

const REQUEST_HEADER_BLOCKLIST = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
]);

const RESPONSE_HEADER_BLOCKLIST = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

function resolveBaseUrl(resolver: FastApiUrlResolver): string {
  const value = typeof resolver === 'function' ? resolver() : resolver;
  return value.replace(/\/+$/, '');
}

function normalizeRequestHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (REQUEST_HEADER_BLOCKLIST.has(key.toLowerCase())) continue;
    if (typeof value === 'string') normalized[key] = value;
    else if (Array.isArray(value)) normalized[key] = value.map(String).join(', ');
  }
  return normalized;
}

function passthroughResponseHeaders(headers: Headers): Record<string, string> {
  const passthrough: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!RESPONSE_HEADER_BLOCKLIST.has(key.toLowerCase())) passthrough[key] = value;
  });
  return passthrough;
}

export class GraphProxyModule implements DomainModule {
  readonly name = 'graph-proxy';

  private readonly baseUrl: FastApiUrlResolver;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GraphProxyOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  register(bus: MessageBus): void {
    for (const [path, command] of Object.entries(GRAPH_PROXY_PATHS)) {
      bus.register<FastApiProxyPayload>(command, (payload) => this.proxy(path, payload));
    }
  }

  private async proxy(
    path: string,
    payload: FastApiProxyPayload,
  ): Promise<ApiResult> {
    const url = `${resolveBaseUrl(this.baseUrl)}${path}${payload.search ?? ''}`;
    const headers = normalizeRequestHeaders(payload.headers);
    const body = typeof payload.bodyText === 'string'
      ? payload.bodyText
      : payload.body === undefined
        ? undefined
        : JSON.stringify(payload.body);

    try {
      const response = await this.fetchImpl(url, {
        method: payload.method === 'GET' ? 'GET' : 'POST',
        headers,
        body,
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'application/json';
      return binary(bytes, contentType, passthroughResponseHeaders(response.headers), response.status);
    } catch (err) {
      return error(`FastAPI Knowledge Graph Service unavailable: ${String(err)}`, 502);
    }
  }
}

export function createGraphProxyModule(options: GraphProxyOptions = {}): GraphProxyModule {
  return new GraphProxyModule(options);
}
