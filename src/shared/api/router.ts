/** Shared path matching/interpolation for the declarative API catalogue. */

import type { ApiRoute, HttpMethod } from './contracts';

export interface RouteMatch<R extends ApiRoute = ApiRoute> {
  route: R;
  params: Record<string, string>;
}

/**
 * Match a concrete pathname against a catalogue path using `:name` placeholders.
 * Longer (more specific) declarations win, so `/api/projects/import` is never
 * captured by `/api/projects/:id`.
 */
export function matchRoute<R extends ApiRoute>(
  routes: readonly R[],
  method: string,
  pathname: string,
): RouteMatch<R> | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const candidates = routes
    .filter((route) => route.method === method.toUpperCase())
    .sort((a, b) => specificity(b.path) - specificity(a.path));

  for (const route of candidates) {
    const pattern = route.path.replace(/\/+$/, '') || '/';
    const names: string[] = [];
    const regexSource = pattern.split('/').map((segment) => {
      if (!segment) return '';
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    const match = new RegExp(`^${regexSource || '/'}$`).exec(normalized);
    if (!match) continue;
    const params: Record<string, string> = {};
    names.forEach((name, index) => {
      try {
        params[name] = decodeURIComponent(match[index + 1] ?? '');
      } catch {
        params[name] = match[index + 1] ?? '';
      }
    });
    return { route, params };
  }
  return undefined;
}

function specificity(path: string): number {
  return path.split('/').filter(Boolean).length * 10 - (path.match(/:[^/]+/g)?.length ?? 0);
}

/** Fill `:name` placeholders in a catalogue path. */
export function interpolatePath(path: string, params: Record<string, string | number> = {}): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined || value === '') return whole;
    return encodeURIComponent(String(value));
  });
}

/** True when `method` is a method declared by the catalogue. */
export function isHttpMethod(value: string): value is HttpMethod {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(value.toUpperCase());
}
