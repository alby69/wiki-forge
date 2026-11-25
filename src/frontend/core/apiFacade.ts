export { FrontendApiBus, apiBus, ACTIVE_PROJECT_KEY, getActiveProjectId } from './apiBus';
export type { FrontendApiBusOptions, StreamEvent } from './apiBus';
import { FrontendApiBus, apiBus } from './apiBus';

export const api = apiBus;

export function resolveApiBaseUrl(fallback: string = ''): string {
  if (typeof window !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  return fallback;
}

export function createStorageApi(_baseUrl: string): FrontendApiBus {
  return apiBus;
}
