export { FrontendApiBus } from './apiBus';
export type { FrontendApiBusOptions, StreamEvent } from './apiBus';
import { FrontendApiBus, apiBus } from './apiBus';
import { createApiClient } from '../api/client';
import { appStore } from '../store/appStore';

export const api = apiBus;
export { apiBus };

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

export function resolveApiBaseUrl(fallback: string = ''): string {
  if (typeof window !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  return fallback;
}

export function createStorageApi(baseUrl: string): FrontendApiBus {
  return new FrontendApiBus(createApiClient({
    baseUrl,
    getProjectId: () => getActiveProjectId(),
    getBearerToken: () => appStore.getState().auth.token || undefined,
  }), { scopeQuery: true });
}
