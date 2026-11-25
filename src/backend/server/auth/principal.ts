/**
 * B1/B6 — server-derived identity for requests crossing the HTTP gateway.
 *
 * This module never reads identity fields from the request body. In legacy
 * mode there is a single shared API token, so every request maps to the
 * canonical process actor `process:api-token` with no roles. Since B6, an
 * explicitly configured IdP adapter can instead produce a verified
 * `human:<id>` principal with roles from trusted claims; an invalid IdP token
 * is rejected with the unchanged B0 401 envelope before dispatch.
 */

import type http from 'node:http';
import { apiTokenFromRequest, bearerTokenFromRequest, verifyApiToken } from './apiToken';
import type { IdpAdapter } from './idp';
import type { UserStore } from './userStore';
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

export interface RequestAuthentication {
  ok: boolean;
  principal: Principal;
}

/**
 * B6 — single authentication decision for the HTTP gateway.
 *
 * Precedence: an explicit `Authorization: Bearer` token is always verified by
 * the configured IdP, so a bad audience/expiry can never fall back to the
 * shared token. Without a bearer token the shared API token still works as a
 * service account. When an IdP is configured but no credential is supplied,
 * the request is denied instead of silently becoming legacy-public.
 */
export async function authenticateRequest(
  req: Pick<http.IncomingMessage, 'headers'>,
  idp?: IdpAdapter,
  env: NodeJS.ProcessEnv = process.env,
  userStore?: UserStore,
): Promise<RequestAuthentication> {
  const legacy = legacyPrincipal();
  const bearer = bearerTokenFromRequest(req);
  const sharedToken = env.WIKIFORGE_API_TOKEN;

  if (env.NODE_ENV === 'production') {
    if (bearer) {
      const localPrincipal = await userStore?.principalForToken(bearer);
      if (localPrincipal) return { ok: true, principal: localPrincipal };
      if (idp) {
        const verified = await idp.verify(bearer);
        return verified.ok && verified.principal
          ? { ok: true, principal: verified.principal }
          : { ok: false, principal: legacy };
      }
      if (sharedToken && verifyApiToken(apiTokenFromRequest(req), sharedToken)) {
        return { ok: true, principal: legacy };
      }
      return { ok: false, principal: legacy };
    }
    if (sharedToken && verifyApiToken(apiTokenFromRequest(req), sharedToken)) {
      return { ok: true, principal: legacy };
    }
    return { ok: false, principal: legacy };
  }

  if (bearer) {
    const localPrincipal = await userStore?.principalForToken(bearer);
    if (localPrincipal) return { ok: true, principal: localPrincipal };
  }
  if (idp) {
    if (bearer) {
      const verified = await idp.verify(bearer);
      return verified.ok && verified.principal
        ? { ok: true, principal: verified.principal }
        : { ok: false, principal: legacy };
    }
    if (sharedToken && verifyApiToken(apiTokenFromRequest(req), sharedToken)) {
      return { ok: true, principal: legacy };
    }
    return { ok: false, principal: legacy };
  }

  if (!sharedToken) return { ok: true, principal: legacy };
  return {
    ok: verifyApiToken(apiTokenFromRequest(req), sharedToken),
    principal: legacy,
  };
}
