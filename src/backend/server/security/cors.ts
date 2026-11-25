import type http from 'node:http';

export interface CorsPolicy {
  readonly allowWildcard: boolean;
  readonly origins: ReadonlySet<string>;
  readonly production: boolean;
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function corsPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): CorsPolicy {
  const configured = (env.WIKIFORGE_CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const wildcard = configured.includes('*');
  const production = isProduction(env);
  return {
    allowWildcard: !production && (wildcard || configured.length === 0),
    origins: new Set(configured.filter((value) => value !== '*')),
    production,
  };
}

export function corsHeadersFor(
  req: Pick<http.IncomingMessage, 'headers'>,
  policy: CorsPolicy,
): Record<string, string> {
  const raw = req.headers.origin;
  const origin = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Project-Id, X-WikiForge-Token, Authorization',
    Vary: 'Origin',
  };
  if (origin && (policy.allowWildcard || policy.origins.has(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (policy.allowWildcard) {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  return headers;
}
