/**
 * B6 — pluggable identity-provider adapters.
 *
 * The core never opens a network connection by itself: discovery, JWKS,
 * SAML metadata and OAuth2 token exchange are injected dependencies. With no
 * provider in `[enterprise.auth]` `createIdpAdapter()` returns `undefined`
 * and the B0–B5 legacy auth path is untouched. A configured-but-incomplete
 * provider returns a fail-closed adapter instead of silently falling back to
 * the public/legacy behaviour.
 */

import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { Principal } from '../bus/messageBus';
import { canonicalActor, isCanonicalActor, PROCESS_FALLBACK_ACTOR } from './actor';
import type { IdpProvider, RbacAuthConfig } from './rbacConfig';

export interface IdpVerificationResult {
  ok: boolean;
  principal?: Principal;
  /** Internal diagnostic only: the HTTP layer always emits the B0 envelope. */
  error?: string;
}

export interface IdpAdapter {
  readonly kind: IdpProvider | 'fail-closed';
  verify(token: string): Promise<IdpVerificationResult>;
}

export interface IdpExchangeResult {
  accessToken?: string;
  idToken?: string;
  /** Allows a mock IdP to return an already-validated principal. */
  principal?: Principal;
}

export interface IdpDependencies {
  fetchJson?: (url: string) => Promise<unknown>;
  fetchText?: (url: string) => Promise<string>;
  now?: () => number;
  verifySamlAssertion?: (assertion: string, metadata: string) => boolean | Promise<boolean>;
  exchangeCode?: (input: {
    code: string;
    tokenUrl: string;
    clientId: string;
    authorizationUrl: string;
  }) => Promise<IdpExchangeResult>;
  verifyAccessToken?: (token: string) => Promise<Record<string, unknown>>;
}

type Jwk = Record<string, unknown>;
type Claims = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function claimAt(claims: Claims, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, claims);
}

function actorFromClaim(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (isCanonicalActor(raw)) return canonicalActor(raw);
  return canonicalActor(/^(human|process):/i.test(raw) ? raw : `human:${raw}`);
}

function rolesFromClaim(value: unknown, auth: RbacAuthConfig, allowedRoles: string[]): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : [];
  const map = new Map(
    Object.entries(auth.roleMap).map(([from, to]) => [from.toLowerCase(), to]),
  );
  const mapped = rawValues
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => map.get(item.toLowerCase()) ?? item);
  return [...new Set(mapped.filter((role) => allowedRoles.includes(role)))];
}

function principalFromClaims(
  claims: Claims,
  auth: RbacAuthConfig,
  allowedRoles: string[],
): Principal | undefined {
  const actor = actorFromClaim(claimAt(claims, auth.actorClaim || 'sub'));
  if (!actor) return undefined;
  return {
    actor,
    roles: rolesFromClaim(claimAt(claims, auth.rolesClaim || 'roles'), auth, allowedRoles),
    source: 'idp',
  };
}

function sanitizePrincipal(value: Principal | undefined, allowedRoles: string[]): Principal | undefined {
  if (!value) return undefined;
  const actor = canonicalActor(value.actor, PROCESS_FALLBACK_ACTOR);
  return {
    actor,
    roles: [...new Set(value.roles.filter((role) => allowedRoles.includes(role)))],
    source: 'idp',
  };
}

function fail(error: string): IdpVerificationResult {
  return { ok: false, error };
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

const SIGNATURE_ALGORITHMS: Record<string, string> = {
  RS256: 'RSA-SHA256',
  RS384: 'RSA-SHA384',
  RS512: 'RSA-SHA512',
};

function validateClaims(claims: Claims, auth: RbacAuthConfig, now: number): void {
  if (auth.issuer && claims.iss !== auth.issuer) throw new Error('issuer mismatch');
  if (auth.audience) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.some((audience) => audience === auth.audience)) {
      throw new Error('audience mismatch');
    }
  }
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('token expired');
  if (typeof claims.nbf === 'number' && claims.nbf > now) throw new Error('token not active');
}

async function verifyJwt(
  token: string,
  auth: RbacAuthConfig,
  deps: IdpDependencies,
  loadKeys: () => Promise<Record<string, Jwk>>,
): Promise<Claims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('not a JWT');
  const header = asRecord(JSON.parse(decodeBase64Url(parts[0]).toString('utf-8')));
  const algorithm = typeof header.alg === 'string' ? SIGNATURE_ALGORITHMS[header.alg] : undefined;
  if (!algorithm) throw new Error('unsupported JWT algorithm');

  const keys = await loadKeys();
  const kid = typeof header.kid === 'string' ? header.kid : undefined;
  const candidates = kid
    ? (keys[kid] ? [keys[kid]] : [])
    : Object.values(keys);
  if (candidates.length !== 1) throw new Error('no unique signing key');
  const jwk = candidates[0];
  if (jwk.kty !== 'RSA' || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') {
    throw new Error('JWKS key is not RSA');
  }
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signature = decodeBase64Url(parts[2]);
  const valid = verifySignature(
    algorithm,
    Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii'),
    publicKey,
    signature,
  );
  if (!valid) throw new Error('invalid JWT signature');

  const claims = asRecord(JSON.parse(decodeBase64Url(parts[1]).toString('utf-8')));
  validateClaims(claims, auth, deps.now?.() ?? Date.now() / 1000);
  return claims;
}

async function loadJwks(auth: RbacAuthConfig, deps: IdpDependencies): Promise<Record<string, Jwk>> {
  let url = auth.jwksUrl;
  if (!url && deps.fetchJson && auth.issuer) {
    const discovery = asRecord(
      await deps.fetchJson(`${auth.issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`),
    );
    if (typeof discovery.jwks_uri === 'string') url = discovery.jwks_uri;
  }
  if (!url || !deps.fetchJson) throw new Error('JWKS source is not configured');
  const document = asRecord(await deps.fetchJson(url));
  if (!Array.isArray(document.keys)) throw new Error('JWKS has no keys');
  return Object.fromEntries(document.keys.map((key, index) => [
    typeof (key as Jwk).kid === 'string' ? (key as Jwk).kid : String(index),
    key as Jwk,
  ]));
}

function createOidcAdapter(
  auth: RbacAuthConfig,
  allowedRoles: string[],
  deps: IdpDependencies,
): IdpAdapter {
  let keysPromise: Promise<Record<string, Jwk>> | undefined;
  const loadKeys = async (): Promise<Record<string, Jwk>> => {
    if (!keysPromise) keysPromise = loadJwks(auth, deps);
    try {
      return await keysPromise;
    } catch (err) {
      keysPromise = undefined;
      throw err;
    }
  };
  return {
    kind: 'oidc',
    async verify(token) {
      try {
        const claims = await verifyJwt(token, auth, deps, loadKeys);
        const principal = principalFromClaims(claims, auth, allowedRoles);
        return principal ? { ok: true, principal } : fail('no actor claim');
      } catch (err) {
        return fail(String(err));
      }
    },
  };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function decodeSamlToken(token: string): string {
  if (token.includes('<')) return token;
  const decoded = Buffer.from(token, 'base64').toString('utf-8');
  return decoded.includes('<') ? decoded : token;
}

function samlNameId(assertion: string): string | undefined {
  const match = /<(?:[\w-]+:)?NameID\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?NameID>/.exec(assertion);
  return match ? decodeXmlEntities(match[1].trim()) : undefined;
}

function samlAttributes(assertion: string): Record<string, string[]> {
  const attributes: Record<string, string[]> = {};
  const attributePattern =
    /<(?:[\w-]+:)?Attribute\b[^>]*\bName="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Attribute>/g;
  const valuePattern =
    /<(?:[\w-]+:)?AttributeValue\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?AttributeValue>/g;
  for (const match of assertion.matchAll(attributePattern)) {
    const values: string[] = [];
    for (const value of match[2].matchAll(valuePattern)) {
      values.push(decodeXmlEntities(value[1].trim()));
    }
    attributes[match[1]] = values;
  }
  return attributes;
}

function createSamlAdapter(
  auth: RbacAuthConfig,
  allowedRoles: string[],
  deps: IdpDependencies,
): IdpAdapter {
  let metadataPromise: Promise<string> | undefined;
  const loadMetadata = async (): Promise<string> => {
    if (!metadataPromise) {
      metadataPromise = auth.samlMetadataUrl && deps.fetchText
        ? deps.fetchText(auth.samlMetadataUrl)
        : Promise.reject(new Error('SAML metadata source is not configured'));
    }
    try {
      return await metadataPromise;
    } catch (err) {
      metadataPromise = undefined;
      throw err;
    }
  };
  return {
    kind: 'saml',
    async verify(token) {
      try {
        const assertion = decodeSamlToken(token);
        const metadata = await loadMetadata();
        const valid = await deps.verifySamlAssertion?.(assertion, metadata);
        if (!valid) return fail('invalid SAML assertion');
        const attributes = samlAttributes(assertion);
        const actorClaim = auth.actorClaim;
        const actorValue = (actorClaim ? attributes[actorClaim]?.[0] : undefined) ?? samlNameId(assertion);
        const rolesClaim = auth.rolesClaim || 'roles';
        const actor = actorFromClaim(actorValue);
        if (!actor) return fail('no NameID');
        return {
          ok: true,
          principal: {
            actor,
            roles: rolesFromClaim(attributes[rolesClaim], auth, allowedRoles),
            source: 'idp',
          },
        };
      } catch (err) {
        return fail(String(err));
      }
    },
  };
}

function createOAuth2Adapter(
  auth: RbacAuthConfig,
  allowedRoles: string[],
  deps: IdpDependencies,
): IdpAdapter {
  const oidc = createOidcAdapter(auth, allowedRoles, deps);
  return {
    kind: 'oauth2',
    async verify(code) {
      try {
        if (!deps.exchangeCode) return fail('OAuth2 code exchange is not configured');
        const exchanged = await deps.exchangeCode({
          code,
          tokenUrl: auth.tokenUrl,
          clientId: auth.clientId,
          authorizationUrl: auth.authorizationUrl,
        });
        const direct = sanitizePrincipal(exchanged.principal, allowedRoles);
        if (direct) return { ok: true, principal: direct };
        if (exchanged.idToken) return oidc.verify(exchanged.idToken);
        if (exchanged.accessToken && deps.verifyAccessToken) {
          const claims = await deps.verifyAccessToken(exchanged.accessToken);
          const principal = principalFromClaims(claims, auth, allowedRoles);
          return principal ? { ok: true, principal } : fail('no actor claim');
        }
        return fail('no verifiable OAuth2 token');
      } catch (err) {
        return fail(String(err));
      }
    },
  };
}

function failClosedAdapter(kind: IdpProvider, error: string): IdpAdapter {
  return { kind: 'fail-closed', verify: async () => fail(`${kind}: ${error}`) };
}

/** Build the adapter from declarative config; no network call happens here. */
export function createIdpAdapter(
  auth: RbacAuthConfig,
  allowedRoles: string[],
  deps: IdpDependencies = {},
): IdpAdapter | undefined {
  switch (auth.provider) {
    case '':
      return undefined;
    case 'oidc':
      if (!auth.issuer || (!auth.jwksUrl && !deps.fetchJson)) {
        return failClosedAdapter('oidc', 'issuer and JWKS source are required');
      }
      if (!auth.audience) return failClosedAdapter('oidc', 'audience is required');
      return createOidcAdapter(auth, allowedRoles, deps);
    case 'saml':
      if (!deps.verifySamlAssertion) {
        return failClosedAdapter('saml', 'assertion verifier is required');
      }
      return createSamlAdapter(auth, allowedRoles, deps);
    case 'oauth2':
      if (!deps.exchangeCode) {
        return failClosedAdapter('oauth2', 'code exchange is required');
      }
      return createOAuth2Adapter(auth, allowedRoles, deps);
  }
}

/** Production dependencies: only used when an IdP is explicitly configured. */
export function defaultIdpDependencies(): IdpDependencies {
  if (typeof fetch !== 'function') return { now: () => Date.now() / 1000 };
  return {
    now: () => Date.now() / 1000,
    fetchJson: async (url) => {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`IdP fetch failed: ${response.status}`);
      return response.json();
    },
    fetchText: async (url) => {
      const response = await fetch(url, { headers: { Accept: 'application/xml, text/xml' } });
      if (!response.ok) throw new Error(`IdP fetch failed: ${response.status}`);
      return response.text();
    },
  };
}
