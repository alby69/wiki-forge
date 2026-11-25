import type { StateEntry, StateStore } from './types';
import { StateConflictError, StateStoreError } from './types';

export interface HttpStateStoreOptions {
  baseUrl: string;
  token?: string;
  name?: string;
  fetchFn?: typeof fetch;
}

function trimBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function createHttpStateStore(options: HttpStateStoreOptions): StateStore {
  const baseUrl = trimBaseUrl(options.baseUrl);
  if (!baseUrl) throw new StateStoreError('HTTP state backend requires a base URL');
  const fetchFn = options.fetchFn ?? fetch;

  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    try {
      return await fetchFn(`${baseUrl}${path}`, { ...init, headers });
    } catch (err) {
      throw new StateStoreError(`State adapter request failed for '${path}': ${String(err)}`);
    }
  };

  const expectOk = async (
    response: Response,
    path: string,
    expectedVersion?: number,
  ): Promise<Response> => {
    if (response.ok) return response;
    if (response.status === 409) {
      const body = await response.json().catch(() => ({})) as { actualVersion?: number };
      throw new StateConflictError(path, expectedVersion ?? -1, body.actualVersion ?? -1);
    }
    const detail = await response.text().catch(() => '');
    throw new StateStoreError(`State adapter '${path}' returned ${response.status}${detail ? `: ${detail}` : ''}`);
  };

  const keyPath = (key: string): string => `/state/${encodeURIComponent(key)}`;

  return {
    name: options.name ?? 'http',

    async get<T>(key: string): Promise<StateEntry<T> | null> {
      const path = keyPath(key);
      const response = await request(path);
      if (response.status === 404) return null;
      const body = await (await expectOk(response, path)).json() as { entry?: StateEntry<T> };
      return body.entry ?? null;
    },

    async put<T>(key: string, value: T, expectedVersion?: number): Promise<StateEntry<T>> {
      const path = keyPath(key);
      const response = await request(path, {
        method: 'PUT',
        body: JSON.stringify({ value, expectedVersion: expectedVersion ?? null }),
      });
      const body = await (await expectOk(response, path, expectedVersion)).json() as { entry: StateEntry<T> };
      return body.entry;
    },

    async remove(key: string, expectedVersion?: number): Promise<boolean> {
      const query = expectedVersion === undefined ? '' : `?version=${expectedVersion}`;
      const path = `${keyPath(key)}${query}`;
      const response = await request(path, { method: 'DELETE' });
      const body = await (await expectOk(response, path)).json() as { removed?: boolean };
      return body.removed === true;
    },

    async append<T>(key: string, event: T): Promise<void> {
      const path = `${keyPath(key)}/events`;
      await expectOk(await request(path, {
        method: 'POST',
        body: JSON.stringify({ event }),
      }), path);
    },

    async readAll<T>(key: string): Promise<T[]> {
      const path = `${keyPath(key)}/events`;
      const response = await request(path);
      if (response.status === 404) return [];
      const body = await (await expectOk(response, path)).json() as { events?: T[] };
      return body.events ?? [];
    },
  };
}
