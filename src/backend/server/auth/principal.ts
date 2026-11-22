/**
 * B1 — server-derived identity for requests crossing the HTTP gateway.
 *
 * This module is deliberately tiny: in legacy mode there is a single shared
 * API token, so it cannot identify a human. Every request therefore maps to
 * the canonical process actor `process:api-token` with no roles. The function
 * never reads the request body or client-supplied identity headers; IdP-backed
 * `human:<id>` principals will be added in B6 behind `enterprise.enable_rbac`.
 */

import type http from 'node:http';
import type { Principal } from '../bus/messageBus';

/** Canonical actor used until a real identity provider is configured. */
export const LEGACY_PRINCIPAL_ACTOR = 'process:api-token';

export function legacyPrincipal(): Principal {
  return { actor: LEGACY_PRINCIPAL_ACTOR, roles: [], source: 'legacy-token' };
}

/**
 * Derive the only trusted principal for a request.
 *
 * The token check itself is performed by `AgentServer.validateApiToken()`
 * before dispatch; this function intentionally ignores any `X-Principal-*`,
 * `reviewer`, `user` or `actor` value coming from the client.
 */
export function deriveRequestPrincipal(
  _req: Pick<http.IncomingMessage, 'headers'>,
  _env: NodeJS.ProcessEnv = process.env,
): Principal {
  return legacyPrincipal();
}
