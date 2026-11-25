/**
 * Typed API client derived from the declarative route catalogue.
 *
 * Every catalogue operation id becomes a client method; `call` and `stream`
 * provide generic access for higher-order code. Paths, methods, body presence
 * and stream flags all come from `ROUTES`, so no endpoint table is duplicated.
 */

import { ROUTES } from './contracts';
import type { ApiRoute, EndpointId } from './contracts';
import type {
  ApiRequest,
  EndpointRequest,
  EndpointResponse,
  TypedApiClient,
} from './endpoints';
import { interpolatePath } from './router';

export interface ApiClientOptions {
  baseUrl?: string;
  getProjectId?: () => string;
  getToken?: () => string | undefined;
  getBearerToken?: () => string | undefined;
  fetchImpl?: typeof fetch;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
  }
}

const ACTIVE_PROJECT_KEY = 'wiki-forge:active-project';

function defaultBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  return configured ?? '';
}

function defaultProjectId(): string {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_KEY) || 'default';
    } catch (_error) {
      return 'default';
    }
  }
  return 'default';
}

const ROUTE_BY_ID: ReadonlyMap<string, ApiRoute> = new Map(
  ROUTES.map((route): [string, ApiRoute] => [route.id, route]),
);

function routeFor(id: EndpointId): ApiRoute {
  const route = ROUTE_BY_ID.get(id);
  if (!route) throw new Error(`Unknown API endpoint: ${id}`);
  return route;
}

function serializeQuery(query: Record<string, unknown> | undefined): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

function buildUrl(
  baseUrl: string,
  route: ApiRoute,
  params: Record<string, string | number>,
  query: Record<string, unknown> | undefined,
): string {
  const path = `${baseUrl}${interpolatePath(route.path, params)}`;
  return `${path}${serializeQuery(query)}`;
}

async function readApiError(response: Response): Promise<ApiClientError> {
  let body: unknown;
  try {
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch (_error) {
        body = text;
      }
    }
  } catch (_error) {
    return new ApiClientError(`HTTP ${response.status} ${response.statusText}`.trim(), response.status, undefined);
  }
  const errorText =
    body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `HTTP ${response.status} ${response.statusText}`.trim();
  return new ApiClientError(errorText, response.status, body);
}

export function createApiClient(options: ApiClientOptions = {}): TypedApiClient {
  const baseUrl = (options.baseUrl ?? defaultBaseUrl()).replace(/\/+$/, '');
  const getProjectId = options.getProjectId ?? defaultProjectId;
  const getToken = options.getToken ?? (() => undefined);
  const getBearerToken = options.getBearerToken ?? (() => undefined);
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));

  const prepare = <K extends EndpointId>(
    route: ApiRoute,
    request: EndpointRequest<K>,
    acceptStream: boolean,
    signal?: AbortSignal,
  ): { url: string; init: RequestInit } => {
    const req = (request ?? {}) as ApiRequest;
    const params = (req.params ?? {}) as Record<string, string | number>;

    const headers: Record<string, string> = acceptStream ? { Accept: 'text/event-stream' } : {};
    if (route.request.body) headers['Content-Type'] = 'application/json';
    headers['X-Project-Id'] = getProjectId();
    const token = getToken();
    if (token) headers['X-WikiForge-Token'] = token;
    const bearer = getBearerToken();
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
    Object.assign(headers, req.headers ?? {});

    const init: RequestInit = { method: route.method, headers };
    if (signal) init.signal = signal;
    if (route.request.body && req.body !== undefined) init.body = JSON.stringify(req.body);

    return {
      url: buildUrl(baseUrl, route, params, req.query as Record<string, unknown> | undefined),
      init,
    };
  };

  const call = async <K extends EndpointId>(
    id: K,
    request: EndpointRequest<K>,
  ): Promise<EndpointResponse<K>> => {
    const route = routeFor(id);
    const { url, init } = prepare(route, request, false);
    const response = await fetchImpl(url, init);
    if (!response.ok) throw await readApiError(response);

    if (route.stream) return response as unknown as EndpointResponse<K>;

    const headers = response.headers as Headers | undefined;
    const contentType = headers?.get?.('content-type') ?? '';
    if (contentType && !/json/i.test(contentType)) {
      return (await response.text()) as unknown as EndpointResponse<K>;
    }
    return (await response.json()) as EndpointResponse<K>;
  };

  const stream = async <K extends EndpointId>(
    id: K,
    request: EndpointRequest<K>,
    onEvent: (event: { event?: string; data: string }) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const route = routeFor(id);
    const { url, init } = prepare(route, request, true, signal);
    const response = await fetchImpl(url, init);
    if (!response.ok) throw await readApiError(response);
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = '';
    let dataLines: string[] = [];
    let ended = false;

    const dispatch = (): boolean => {
      if (dataLines.length === 0 && !eventName) return false;
      const data = dataLines.join('\n');
      const name = eventName;
      dataLines = [];
      eventName = '';
      if (data === '[DONE]') return true;
      onEvent(name ? { event: name, data } : { data });
      return false;
    };

    const consumeLine = (rawLine: string): boolean => {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (line === '') return dispatch();
      if (line.startsWith(':')) return false;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') dataLines.push(value);
      else if (field === 'event') eventName = value;
      return false;
    };

    const consumeChunk = (chunk: string): boolean => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (consumeLine(line)) return true;
        newline = buffer.indexOf('\n');
      }
      return false;
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (consumeChunk(decoder.decode(value ?? new Uint8Array(), { stream: true }))) {
          ended = true;
          break;
        }
        if (done) break;
      }
      if (!ended) {
        consumeChunk(decoder.decode());
        if (!ended) dispatch();
      }
    } finally {
      if (ended) {
        try {
          await reader.cancel();
        } catch (_error) {
          return;
        }
      }
    }
  };

  const client: Record<string, unknown> = {};
  for (const route of ROUTES) {
    client[route.id] = (request: ApiRequest): Promise<unknown> =>
      call(route.id as EndpointId, request as EndpointRequest<EndpointId>);
  }
  client.call = call;
  client.stream = stream;
  return client as unknown as TypedApiClient;
}

let sharedClient: TypedApiClient | undefined;

export function getApiClient(): TypedApiClient {
  if (!sharedClient) sharedClient = createApiClient();
  return sharedClient;
}
