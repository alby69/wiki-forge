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
  /**
   * Mirror the explicit project id into `?projectId=` as legacy clients do.
   * Enabled for the `ApiStorage` facade; the shared UI bus uses headers only.
   */
  scopeQuery?: boolean;
}

export class FrontendApiBus {
  constructor(
    private readonly client: TypedApiClient = createApiClient({
      // B7 — the store feeds the bearer lazily: no token, no Authorization header.
      getBearerToken: () => appStore.getState().auth.token || undefined,
    }),
    private readonly options: FrontendApiBusOptions = {},
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
  ): Promise<EndpointResponse<K>> {
    eventBus.emit('api:request', { id, projectId });
    try {
      const response = await this.client.call(id, this.withProject(id, request, projectId));
      eventBus.emit('api:result', { id, projectId });
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
  ): Promise<void> {
    eventBus.emit('api:request', { id, projectId });
    try {
      await this.client.stream(id, this.withProject(id, request, projectId), (event) => {
        eventBus.emit('api:stream', { id, event: event.data });
        onEvent(event);
      }, signal);
      eventBus.emit('api:result', { id, projectId });
    } catch (err) {
      eventBus.emit('api:error', { id, error: String(err) });
      throw err;
    }
  }

  /**
   * Explicit project scoping through the header. The compatibility facade also
   * mirrors it in the query, as legacy clients and launchers did; an unscoped
   * call keeps using the client's active-project header only.
   */
  private withProject<K extends EndpointId>(
    _id: K,
    request: EndpointRequest<K>,
    projectId?: string,
  ): EndpointRequest<K> {
    if (!projectId) return request;
    const source = (request ?? {}) as {
      headers?: Record<string, string>;
      query?: Record<string, unknown>;
    };
    const headers = { ...(source.headers ?? {}) };
    headers['X-Project-Id'] = projectId;
    const next = { ...source, headers } as EndpointRequest<K>;
    if (!this.options.scopeQuery) return next;
    const query = { ...(source.query ?? {}) };
    if (query.projectId === undefined) query.projectId = projectId;
    return { ...next, query } as EndpointRequest<K>;
  }
}

/** Default bus used by all UI components. */
export const apiBus = new FrontendApiBus();
