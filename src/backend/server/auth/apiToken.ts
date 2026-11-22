/**
 * B4 — single source of truth for the shared API token check.
 *
 * Token verification must not leak prefix/length information through timing,
 * and must be identical for every ingress (catalogue routes and the FastAPI
 * graph proxy). Both sides are hashed to fixed-length digests before
 * `timingSafeEqual`, so comparison time does not depend on token content.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type http from 'node:http';

export const API_TOKEN_HEADER = 'x-wikiforge-token';
export const UNAUTHORIZED_MESSAGE = 'Unauthorized: Invalid or missing X-WikiForge-Token';

/** Constant-time comparison; a missing/short value never throws. */
export function verifyApiToken(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const actual = createHash('sha256').update(provided, 'utf-8').digest();
  const required = createHash('sha256').update(expected, 'utf-8').digest();
  return timingSafeEqual(actual, required);
}

/**
 * Extract the token from the verified transport. Client-supplied identity
 * fields in the body are deliberately ignored (B1).
 */
export function apiTokenFromRequest(
  req: Pick<http.IncomingMessage, 'headers'>,
): string | undefined {
  const direct = req.headers[API_TOKEN_HEADER];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (Array.isArray(direct) && typeof direct[0] === 'string' && direct[0].trim()) {
    return direct[0].trim();
  }

  const authorization = req.headers.authorization;
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const value = raw.trim();
  // Also handle a bare `Bearer` header (no token) before trimming: `value` is
  // already trimmed, so `Bearer   ` must not be mistaken for a raw token.
  const bearer = /^Bearer(?:\s+|$)/i.exec(value);
  return (bearer ? value.slice(bearer[0].length) : value).trim() || undefined;
}

/**
 * B6 — IdP tokens are accepted only as `Authorization: Bearer <token>`.
 * Keeping this separate from `apiTokenFromRequest()` prevents a shared API
 * token in the same header from being mistaken for an IdP credential.
 */
export function bearerTokenFromRequest(
  req: Pick<http.IncomingMessage, 'headers'>,
): string | undefined {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1].trim() || undefined;
}
