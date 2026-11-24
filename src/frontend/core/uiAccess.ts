/**
 * F3 — permission-aware UI state pipeline.
 *
 * Components never assemble permissions or call `fetch`: this module asks the
 * typed bus for the server-derived view model, falls back to the verified
 * identity when the endpoint is unavailable/forbidden, and persists only real
 * presentation changes. Preferences can never widen the permission filter.
 */

import type { EndpointId } from '@shared/api/contracts';
import type { AuthIdentityDto, UiAccessDto, UiPreferencesDto } from '@shared/api/types';
import {
  ACTION_MIN_ROLE,
  OPERATION_MIN_ROLE,
  ROLE_ORDER,
  UI_PANELS,
  canUseAction as sharedCanUseAction,
  canUseOperation as sharedCanUseOperation,
  isPinnableActionId,
  minimumRoleForAction,
  minimumRoleForOperation,
  roleHasCapability,
  type UiPanelId,
} from '@shared/auth/capabilities';
import {
  defaultUiPreferences,
  normalizeUiPreferences,
  uiPreferencesSignature,
} from '@shared/auth/uiPreferences';
import { apiBus, type FrontendApiBus } from './apiBus';
import { appStore, type AppState, type UiAccessSource } from '../store/appStore';

export type UiAccessBus = Pick<FrontendApiBus, 'dispatch'>;

export interface UiAccessStore {
  getState(): AppState;
  subscribe(listener: (state: AppState) => void): () => void;
  setUiAccess(access: UiAccessDto | undefined, source?: UiAccessSource): void;
  applyUiPreferences(input: unknown): UiPreferencesDto;
}

export interface UiAccessServiceOptions {
  bus?: UiAccessBus;
  store?: UiAccessStore;
  /** Bypass the "already loaded for this identity" short-circuit. */
  force?: boolean;
}

let stopActiveSync: (() => void) | undefined;

function isManagedIdentity(identity: AuthIdentityDto | undefined): boolean {
  return identity?.authenticated === true && (identity.source === 'local' || identity.source === 'idp');
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

/** Defensive copy of the server DTO: malformed payloads are never trusted. */
function normalizeAccess(input: unknown): UiAccessDto | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const raw = input as Partial<UiAccessDto>;
  const roles = asStringArray(raw.roles);
  const actions = asStringArray(raw.actions);
  const operations = asStringArray(raw.operations);
  const visibleProjects = asStringArray(raw.visibleProjects);
  if (!roles || !actions || !operations || !visibleProjects) return undefined;
  if (typeof raw.actor !== 'string' || typeof raw.authenticated !== 'boolean') return undefined;
  if (raw.source !== 'legacy-token' && raw.source !== 'idp' && raw.source !== 'local' && raw.source !== 'process') {
    return undefined;
  }
  const projectRoles: Record<string, string[]> = {};
  if (raw.projectRoles && typeof raw.projectRoles === 'object' && !Array.isArray(raw.projectRoles)) {
    for (const [projectId, value] of Object.entries(raw.projectRoles)) {
      const scoped = asStringArray(value);
      if (scoped) projectRoles[projectId] = scoped;
    }
  }
  return {
    actor: raw.actor,
    source: raw.source,
    authenticated: raw.authenticated,
    roles,
    visibleProjects,
    projectRoles,
    actions,
    operations,
  };
}

/**
 * Used when `ui.access` is forbidden (strict ACL) or unreachable. It uses only
 * the roles returned by `auth.me` and the shared capability matrix, so it can
 * never be broader than the verified identity.
 */
function fallbackAccess(identity: AuthIdentityDto): UiAccessDto {
  const roles = identity.roles.filter((role): role is string => typeof role === 'string');
  return {
    actor: identity.actor,
    source: identity.source,
    authenticated: identity.authenticated,
    roles,
    visibleProjects: [],
    projectRoles: {},
    actions: Object.keys(ACTION_MIN_ROLE).filter(id => sharedCanUseAction(roles, id)),
    operations: Object.keys(OPERATION_MIN_ROLE).filter(id => sharedCanUseOperation(roles, id)),
  };
}

function identityMatches(access: UiAccessDto, identity: AuthIdentityDto | undefined): boolean {
  if (!identity || !isManagedIdentity(identity)) return false;
  return access.actor === identity.actor
    && access.roles.join('\u0000') === identity.roles.join('\u0000');
}

function currentAccess(state: AppState): UiAccessDto | undefined {
  if (!state.access || !identityMatches(state.access, state.auth.identity)) return undefined;
  return state.access;
}

/** Legacy mode keeps the historical full surface; managed identities use roles. */
function legacyRoles(state: AppState): string[] | undefined {
  const identity = state.auth.identity;
  if (identity && isManagedIdentity(identity)) return identity.roles;
  return [...ROLE_ORDER];
}

/** Start saving presentation changes from this point on. Callers should load first. */
export function startUiPreferencesSync(options: UiAccessServiceOptions = {}): () => void {
  const store = options.store ?? appStore;
  const bus = options.bus ?? apiBus;
  let lastObserved = uiPreferencesSignature(store.getState().preferences);
  let lastSaved = lastObserved;
  let queued: Promise<void> = Promise.resolve();
  let stopped = false;

  const unsubscribe = store.subscribe((state) => {
    const signature = uiPreferencesSignature(state.preferences);
    if (signature === lastObserved || !isManagedIdentity(state.auth.identity)) return;
    lastObserved = signature;
    queued = queued.then(async () => {
      if (stopped) return;
      const latest = store.getState().preferences;
      const latestSignature = uiPreferencesSignature(latest);
      if (latestSignature === lastSaved) return;
      try {
        const response = await bus.dispatch('ui.preferences.put', { body: latest });
        const saved = normalizeUiPreferences(response.preferences);
        lastSaved = uiPreferencesSignature(saved);
        lastObserved = lastSaved;
      } catch (_error) {
        // Offline/forbidden: localStorage keeps the change, a later edit retries.
      }
    });
  });

  return () => {
    stopped = true;
    unsubscribe();
  };
}

/**
 * Load access and preferences for the verified caller. Never throws: a 403 on
 * either additive route degrades to identity roles / local preferences.
 */
export async function loadUiAccess(options: UiAccessServiceOptions = {}): Promise<UiAccessDto | undefined> {
  const store = options.store ?? appStore;
  const identity = store.getState().auth.identity;

  // Startup and sign-in may both ask for the same identity: reuse the view and
  // keep the existing save subscription instead of issuing duplicate requests.
  if (!options.force) {
    const current = store.getState().access;
    if (current && identityMatches(current, identity)) {
      if (!stopActiveSync) stopActiveSync = startUiPreferencesSync(options);
      return current;
    }
  }

  stopActiveSync?.();
  stopActiveSync = undefined;

  // Legacy traffic is unauthenticated and would share a process-level key: keep
  // its historical surface and local preferences, without calling the new APIs.
  if (!identity || !isManagedIdentity(identity)) {
    store.setUiAccess(undefined, 'none');
    return undefined;
  }

  const bus = options.bus ?? apiBus;
  const [accessResult, preferencesResult] = await Promise.allSettled([
    bus.dispatch('ui.access'),
    bus.dispatch('ui.preferences.get'),
  ]);

  const serverAccess = accessResult.status === 'fulfilled'
    ? normalizeAccess(accessResult.value.access)
    : undefined;
  const access = serverAccess ?? fallbackAccess(identity);
  store.setUiAccess(access, serverAccess ? 'server' : 'fallback');

  if (preferencesResult.status === 'fulfilled' && preferencesResult.value.preferences) {
    store.applyUiPreferences(preferencesResult.value.preferences);
  }

  // The sync baseline is the state just applied, so hydration never writes back.
  stopActiveSync = startUiPreferencesSync(options);
  return access;
}

/** Clear the server-derived view and restore default local presentation. */
export function resetUiAccess(options: Pick<UiAccessServiceOptions, 'store'> = {}): void {
  stopActiveSync?.();
  stopActiveSync = undefined;
  const store = options.store ?? appStore;
  store.setUiAccess(undefined, 'none');
  store.applyUiPreferences(defaultUiPreferences());
}

/** True when a server-derived (or identity fallback) view is active. */
export function hasUiAccess(state: AppState = appStore.getState()): boolean {
  return Boolean(currentAccess(state));
}

/** Can the current caller render this UI action, optionally in a project? */
export function canAction(actionId: string, projectId?: string): boolean {
  const state = appStore.getState();
  const access = currentAccess(state);
  if (!access) return sharedCanUseAction(legacyRoles(state), actionId);
  if (!access.actions.includes(actionId)) return false;
  if (projectId === undefined) return true;
  if (!canProjectIn(access, projectId)) return false;
  const required = minimumRoleForAction(actionId);
  return required === undefined || roleHasCapability(access.projectRoles[projectId] ?? [], required);
}

/** Can the current caller dispatch this operation, optionally in a project? */
export function canOperation(command: EndpointId | string, projectId?: string): boolean {
  const state = appStore.getState();
  const access = currentAccess(state);
  if (!access) return sharedCanUseOperation(legacyRoles(state), command);
  if (!access.operations.includes(command)) return false;
  if (projectId === undefined) return true;
  if (!canProjectIn(access, projectId)) return false;
  return roleHasCapability(access.projectRoles[projectId] ?? [], minimumRoleForOperation(command));
}

function canProjectIn(access: UiAccessDto, projectId: string): boolean {
  return access.visibleProjects.includes(projectId);
}

/** Projects whose ACL grants the caller at least one effective role. */
export function canProject(projectId: string): boolean {
  const access = currentAccess(appStore.getState());
  return !access || canProjectIn(access, projectId);
}

/** Only global actions from the shared matrix may be pinned in the header. */
export function canPinAction(actionId: string, projectId?: string): boolean {
  return isPinnableActionId(actionId) && canAction(actionId, projectId);
}

/** True when the caller's effective roles unlock the panel's operation. */
export function panelAllowed(panelId: UiPanelId, projectId?: string): boolean {
  const panel = UI_PANELS.find(definition => definition.id === panelId);
  if (!panel) return false;
  return panel.essential === true || canOperation(panel.requiredOperation, projectId);
}

/** Hidden preferences are applied after RBAC, never before. */
export function isPanelVisible(panelId: UiPanelId, projectId?: string): boolean {
  if (!panelAllowed(panelId, projectId)) return false;
  const panel = UI_PANELS.find(definition => definition.id === panelId)!;
  if (panel.essential) return true;
  return !appStore.getState().preferences.hiddenPanels.includes(panelId);
}

/** Panels currently renderable for the active caller. */
export function visiblePanels(projectId?: string): UiPanelId[] {
  return UI_PANELS.filter(definition => isPanelVisible(definition.id, projectId))
    .map(definition => definition.id);
}
