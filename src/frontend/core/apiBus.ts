/**
 * Frontend command bus.
 *
 * Components never talk to each other and never build API URLs: they dispatch
 * a catalogue command here. The bus adds project/token headers, emits observable
 * lifecycle events and delegates the HTTP work to the typed generated client.
 */

import type { EndpointId, EndpointRequest, EndpointResponse, TypedApiClient } from '@shared/api/contracts';
import { createApiClient } from '../api/client';
import { appStore } from '../store/appStore';
import { eventBus } from './events';

export interface StreamEvent {
  event?: string;
  data: string;
}

export interface FrontendApiBusOptions {
  scopeQuery?: boolean;
  baseUrl?: string;
}

export const ACTIVE_PROJECT_KEY = 'wiki-forge:active-project';

export function getActiveProjectId(fallback: string = 'default'): string {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (stored) return stored;
    } catch {
      return appStore.getState().activeProjectId || fallback;
    }
  }
  return appStore.getState().activeProjectId || fallback;
}

export class FrontendApiBus {
  constructor(
    private readonly client: TypedApiClient = createApiClient({
      getProjectId: () => getActiveProjectId(),
      // B7 — the store feeds the bearer lazily: no token, no Authorization header.
      getBearerToken: () => appStore.getState().auth.token || undefined,
    }),
    private readonly defaults: FrontendApiBusOptions = {},
  ) {}

  /** Access the underlying typed client for advanced cases (e.g. raw Response). */
  public getClient(): TypedApiClient {
    return this.client;
  }

  /** Dispatch one catalogue command and publish its lifecycle events. */
  public async dispatch<K extends EndpointId>(
    id: K,
    request: EndpointRequest<K> = {} as EndpointRequest<K>,
    projectId?: string,
    options: FrontendApiBusOptions = {},
  ): Promise<EndpointResponse<K>> {
    eventBus.emit('api:request', { id, projectId });
    try {
      const response = await this.client.call(id, this.withOptions(request, projectId, { ...this.defaults, ...options }));
      const envelope = response as { success?: unknown; error?: unknown };
      if (envelope.success === false) {
        eventBus.emit('api:error', { id, error: String(envelope.error ?? 'request failed') });
      } else {
        eventBus.emit('api:result', { id, projectId });
      }
      return response;
    } catch (err) {
      eventBus.emit('api:error', { id, error: String(err) });
      throw err;
    }
  }

  /** Dispatch a streaming catalogue command and forward every SSE frame. */
  public async stream<K extends EndpointId>(
    id: K,
    request: EndpointRequest<K> = {} as EndpointRequest<K>,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
    projectId?: string,
    options: FrontendApiBusOptions = {},
  ): Promise<void> {
    eventBus.emit('api:request', { id, projectId });
    try {
      await this.client.stream(id, this.withOptions(request, projectId, { ...this.defaults, ...options }), (event) => {
        eventBus.emit('api:stream', { id, event: event.data });
        onEvent(event);
      }, signal);
      eventBus.emit('api:result', { id, projectId });
    } catch (err) {
      eventBus.emit('api:error', { id, error: String(err) });
      throw err;
    }
  }

  private withOptions<K extends EndpointId>(
    request: EndpointRequest<K>,
    projectId: string | undefined,
    options: FrontendApiBusOptions,
  ): EndpointRequest<K> {
    let next = (request ?? {}) as EndpointRequest<K>;
    if (projectId) {
      const source = next as {
        headers?: Record<string, string>;
        query?: Record<string, unknown>;
      };
      const headers = { ...(source.headers ?? {}) };
      headers['X-Project-Id'] = projectId;
      next = { ...source, headers } as EndpointRequest<K>;
      if (options.scopeQuery) {
        const query = { ...(source.query ?? {}) };
        if (query.projectId === undefined) query.projectId = projectId;
        next = { ...next, query } as EndpointRequest<K>;
      }
    }
    if (options.baseUrl) {
      next = { ...next, baseUrl: options.baseUrl } as EndpointRequest<K>;
    }
    return next;
  }
}

/** Default bus used by all UI components. */
export const apiBus = new FrontendApiBus();
