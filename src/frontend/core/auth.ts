/**
 * B7 — identity/session controller.
 *
 * Components never build URLs or call `fetch`: this module talks to the typed
 * bus only. The token lives in the additive app-store slice and is sent by
 * `createApiClient()` as an IdP bearer; every identity field comes back from
 * the server's `GET /api/auth/me` response.
 */

import { apiBus } from './apiBus';
import { appStore } from '../store/appStore';
import type { AuthIdentityDto } from '@shared/api/types';

/** Local mirror of the server role rank (frontend must not import backend code). */
export const RBAC_RANK: Record<string, number> = {
  Reader: 0,
  Contributor: 1,
  KnowledgeEngineer: 2,
  Admin: 3,
};

/** Header actions hidden from IdP users below the required role. */
const HEADER_ACTION_ROLES: Record<string, string> = {
  'global:changesets': 'Admin',
  'global:config': 'Admin',
  'global:wizard': 'Admin',
  'global:keWorkbench': 'KnowledgeEngineer',
  'global:users': 'Admin',
};

export function hasIdpIdentity(): boolean {
  return appStore.getState().auth.identity?.source === 'idp';
}

export function hasManagedIdentity(): boolean {
  const identity = appStore.getState().auth.identity;
  return identity?.authenticated === true && (identity.source === 'idp' || identity.source === 'local');
}

export function canRenderAction(actionId: string): boolean {
  const identity = appStore.getState().auth.identity;
  if (!hasManagedIdentity() || !identity) return true;
  const required = HEADER_ACTION_ROLES[actionId];
  if (!required) return true;
  return identity.roles.some((role) => (RBAC_RANK[role] ?? -1) >= RBAC_RANK[required]);
}

/**
 * Resolve (or re-resolve) the identity from the server. Never throws: a
 * missing credential is a normal anonymous state, a stale credential is
 * discarded so the UI cannot keep offering actions the server would deny.
 */
export async function refreshIdentity(): Promise<AuthIdentityDto | undefined> {
  const token = appStore.getState().auth.token;
  try {
    const data = await apiBus.dispatch('auth.me');
    if (data.success === false) {
      throw new Error((data as { error?: string }).error ?? 'HTTP 200');
    }
    const identity = (data as { auth?: AuthIdentityDto }).auth;
    if (!identity) throw new Error('Risposta auth.me senza identità');
    appStore.setAuth(token, identity);
    return identity;
  } catch (_error) {
    // Fail closed: an unusable bearer must not linger in the session store.
    appStore.signOut();
    return undefined;
  }
}

/** Store an IdP bearer, verify it via `auth.me`, and publish the result. */
export async function signIn(token: string): Promise<AuthIdentityDto> {
  const clean = token.trim();
  if (!clean) throw new Error('Token IdP mancante');
  appStore.setAuth(clean, undefined);
  const identity = await refreshIdentity();
  if (!identity?.authenticated || identity.source !== 'idp') {
    throw new Error('Identità IdP non verificata');
  }
  return identity;
}

export async function signInWithCredentials(username: string, password: string): Promise<AuthIdentityDto> {
  const clean = username.trim();
  if (!clean || !password) throw new Error('Username e password richiesti');
  const data = await apiBus.dispatch('auth.login', { body: { username: clean, password } });
  if (data.success === false) {
    throw new Error((data as { error?: string }).error ?? 'HTTP 200');
  }
  if (!data.token || !data.auth?.authenticated) throw new Error('Identità utente non verificata');
  appStore.setAuth(data.token, data.auth);
  return data.auth;
}

export function signOut(): void {
  appStore.signOut();
}
