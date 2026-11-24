import { eventBus } from '@frontend/core/events';
import { getLanguage, setLanguage } from '@frontend/core/i18n/strings';
import type { AuthIdentityDto, UiAccessDto, UiPreferencesDto } from '@shared/api/types';
import { isUiPanelId, type UiPanelId } from '@shared/auth/capabilities';
import {
  defaultUiPreferences,
  normalizeUiPreferences,
  uiPreferencesSignature,
} from '@shared/auth/uiPreferences';

/** B7 — additive auth slice; empty in legacy mode. */
export interface AuthState {
  /** IdP bearer token, persisted so a reload can restore the session. */
  token: string;
  /** Identity resolved by `GET /api/auth/me`; never client-supplied. */
  identity?: AuthIdentityDto;
}

/** F3 — provenance of the permission view currently used by the UI. */
export type UiAccessSource = 'server' | 'fallback' | 'none';

export interface AppState {
  auth: AuthState;
  /** F3 — server-derived permission view; absent in legacy mode. */
  access?: UiAccessDto;
  accessSource: UiAccessSource;
  /** F3 — canonical presentation preferences (server or local fallback). */
  preferences: UiPreferencesDto;
  isAdvancedMode: boolean;
  activeProjectId: string;
  onboardingCompleted: boolean;
  theme: 'dark' | 'light';
  viewMode: ViewMode;
  /** Global action ids currently pinned as buttons in the main header. */
  pinnedActionIds: string[];
  /** Visibility of the left file-manager pane (the "File" header button). */
  filesVisible: boolean;
  /** Panels hidden by the user; never grants or removes permissions. */
  hiddenPanels: UiPanelId[];
  density: 'comfortable' | 'compact';
}

export type ViewMode = 'editor' | 'graph' | 'split' | 'scratchpad' | 'closed';

type Listener = (state: AppState) => void;

const ADVANCED_MODE_KEY = 'wiki-forge:advanced-mode';
const ONBOARDING_KEY = 'wiki-forge:onboarding-completed';
const PROJECT_KEY = 'wiki-forge:active-project';
const THEME_KEY = 'wiki-forge:theme';
const VIEW_MODE_KEY = 'wiki-forge:view-mode';
const PINNED_ACTIONS_KEY = 'wiki-forge:pinned-actions';
const FILES_VISIBLE_KEY = 'wiki-forge:files-visible';
const DENSITY_KEY = 'wiki-forge:ui-density';
const HIDDEN_PANELS_KEY = 'wiki-forge:ui-hidden-panels';
/** B7 — replaces the ad-hoc reviewer key as the auth session source. */
const AUTH_TOKEN_KEY = 'wiki-forge:auth-token';
/** Legacy key written by MainLayout before the state moved into appStore. */
const LEGACY_SIDEBAR_COLLAPSED_KEY = 'wiki-forge:sidebar-collapsed';

const VIEW_MODES: ViewMode[] = ['editor', 'graph', 'split', 'scratchpad', 'closed'];

/** Header layout before the user customises it (matches the historical UI). */
export const DEFAULT_PINNED_ACTION_IDS: string[] = [
  'global:projects',
  'global:research',
  'global:study',
  'global:docsWiki',
  'global:exportWikiZip',
  'global:chat',
  'global:help',
];

class AppStore {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): AppState {
    let isAdvancedMode = false;
    let onboardingCompleted = false;
    let activeProjectId = 'default';
    let theme: 'dark' | 'light' = 'dark';
    // Open on the editor: the editor/graph split is an explicit user choice
    // (Split toggle) rather than the default layout.
    let viewMode: ViewMode = 'editor';
    let pinnedActionIds = [...DEFAULT_PINNED_ACTION_IDS];
    let filesVisible = true;
    let density: UiPreferencesDto['density'] = 'comfortable';
    let hiddenPanels: UiPanelId[] = [];
    let authToken = '';

    if (typeof localStorage !== 'undefined') {
      try {
        const storedAdv = localStorage.getItem(ADVANCED_MODE_KEY);
        if (storedAdv !== null) isAdvancedMode = storedAdv === 'true';

        const storedOnb = localStorage.getItem(ONBOARDING_KEY);
        if (storedOnb !== null) onboardingCompleted = storedOnb === 'true';

        const storedProj = localStorage.getItem(PROJECT_KEY);
        if (storedProj) activeProjectId = storedProj;

        const storedTheme = localStorage.getItem(THEME_KEY);
        if (storedTheme === 'light' || storedTheme === 'dark') theme = storedTheme;

        const storedView = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
        if (storedView && VIEW_MODES.includes(storedView)) viewMode = storedView;

        const storedPinned = localStorage.getItem(PINNED_ACTIONS_KEY);
        if (storedPinned !== null) {
          const parsed: unknown = JSON.parse(storedPinned);
          if (Array.isArray(parsed)) {
            // Unknown ids are harmless: the header ignores actions that are no
            // longer in the catalogue. Keeping them makes upgrades lossless.
            pinnedActionIds = parsed.filter((id): id is string => typeof id === 'string');
          }
        }

        const storedFiles = localStorage.getItem(FILES_VISIBLE_KEY);
        if (storedFiles !== null) filesVisible = storedFiles === 'true';
        else filesVisible = localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY) !== 'true';

        const storedDensity = localStorage.getItem(DENSITY_KEY);
        if (storedDensity === 'compact' || storedDensity === 'comfortable') density = storedDensity;

        const storedHidden = localStorage.getItem(HIDDEN_PANELS_KEY);
        if (storedHidden !== null) {
          const parsed: unknown = JSON.parse(storedHidden);
          if (Array.isArray(parsed)) hiddenPanels = parsed.filter(isUiPanelId);
        }

        authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
      } catch (_e) {
        // Fallback
      }
    }

    const preferences = defaultUiPreferences();
    preferences.pinnedActionIds = [...pinnedActionIds];
    preferences.filesVisible = filesVisible;
    preferences.viewMode = viewMode;
    preferences.theme = theme;
    preferences.density = density;
    preferences.language = getLanguage();
    preferences.hiddenPanels = [...hiddenPanels];

    return {
      auth: { token: authToken },
      accessSource: 'none',
      preferences,
      isAdvancedMode,
      activeProjectId,
      onboardingCompleted,
      theme,
      viewMode,
      pinnedActionIds,
      filesVisible,
      hiddenPanels,
      density,
    };
  }

  public getState(): AppState {
    const state = this.state;
    return {
      ...state,
      auth: { ...state.auth },
      access: state.access ? { ...state.access } : undefined,
      preferences: {
        ...state.preferences,
        pinnedActionIds: [...state.preferences.pinnedActionIds],
        hiddenPanels: [...state.preferences.hiddenPanels],
      },
      pinnedActionIds: [...state.pinnedActionIds],
      hiddenPanels: [...state.hiddenPanels],
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }

  /** Mirror every presentation field to localStorage as an offline fallback. */
  private persistPreferences(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const preferences = this.state.preferences;
      localStorage.setItem(THEME_KEY, preferences.theme);
      localStorage.setItem(VIEW_MODE_KEY, preferences.viewMode);
      localStorage.setItem(FILES_VISIBLE_KEY, String(preferences.filesVisible));
      localStorage.setItem(LEGACY_SIDEBAR_COLLAPSED_KEY, String(!preferences.filesVisible));
      localStorage.setItem(PINNED_ACTIONS_KEY, JSON.stringify(preferences.pinnedActionIds));
      localStorage.setItem(DENSITY_KEY, preferences.density);
      localStorage.setItem(HIDDEN_PANELS_KEY, JSON.stringify(preferences.hiddenPanels));
    } catch (_e) {
      // Preference persistence is best-effort.
    }
  }

  /** One mutation point: keep the DTO and the legacy flat fields in sync. */
  private patchPreferences(patch: Partial<UiPreferencesDto>): void {
    const preferences: UiPreferencesDto = { ...this.state.preferences, ...patch };
    this.state.preferences = preferences;
    this.state.theme = preferences.theme;
    this.state.viewMode = preferences.viewMode;
    this.state.pinnedActionIds = [...preferences.pinnedActionIds];
    this.state.filesVisible = preferences.filesVisible;
    this.state.hiddenPanels = [...preferences.hiddenPanels] as UiPanelId[];
    this.state.density = preferences.density;
    this.persistPreferences();
  }

  /**
   * B7 — update the auth slice in one notification. `identity` is always the
   * server response from `/api/auth/me`, never assembled from client data.
   */
  public setAuth(token: string, identity?: AuthIdentityDto): void {
    const normalized = token.trim();
    const previous = this.state.auth.identity;
    const unchanged = this.state.auth.token === normalized
      && previous?.actor === identity?.actor
      && previous?.authenticated === identity?.authenticated
      && previous?.idpConfigured === identity?.idpConfigured
      && previous?.rbacEnabled === identity?.rbacEnabled
      && previous?.strict === identity?.strict
      && (previous?.roles.join('\u0000') ?? '') === (identity?.roles.join('\u0000') ?? '');
    if (unchanged) return;
    this.state.auth = { token: normalized, identity };
    if (typeof localStorage !== 'undefined') {
      try {
        if (normalized) localStorage.setItem(AUTH_TOKEN_KEY, normalized);
        else localStorage.removeItem(AUTH_TOKEN_KEY);
      } catch (_e) {
        // Session persistence is best-effort.
      }
    }
    this.notify();
  }

  /** B7 — clear the session; legacy UI is restored immediately. */
  public signOut(): void {
    this.setAuth('', undefined);
  }

  public setAdvancedMode(isAdvanced: boolean): void {
    if (this.state.isAdvancedMode === isAdvanced) return;
    this.state.isAdvancedMode = isAdvanced;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADVANCED_MODE_KEY, String(isAdvanced));
    }
    this.notify();
  }

  public toggleAdvancedMode(): boolean {
    const next = !this.state.isAdvancedMode;
    this.setAdvancedMode(next);
    return next;
  }

  public setOnboardingCompleted(completed: boolean): void {
    this.state.onboardingCompleted = completed;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ONBOARDING_KEY, String(completed));
    }
    this.notify();
  }

  public setActiveProjectId(id: string): void {
    const previousId = this.state.activeProjectId;
    if (previousId === id) return;
    this.state.activeProjectId = id;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(PROJECT_KEY, id);
      } catch (_e) {
        // Best effort only.
      }
    }
    this.notify();
    eventBus.emit('project:changed', { id, previousId });
  }

  /** F3 — publish the permission view derived by the server (or its safe fallback). */
  public setUiAccess(access: UiAccessDto | undefined, source: UiAccessSource = 'none'): void {
    const previous = this.state.access;
    const unchanged = source === this.state.accessSource
      && previous?.actor === access?.actor
      && previous?.authenticated === access?.authenticated
      && (previous?.roles.join('\u0000') ?? '') === (access?.roles.join('\u0000') ?? '')
      && (previous?.actions.join('\u0000') ?? '') === (access?.actions.join('\u0000') ?? '')
      && (previous?.operations.join('\u0000') ?? '') === (access?.operations.join('\u0000') ?? '')
      && (previous?.visibleProjects.join('\u0000') ?? '') === (access?.visibleProjects.join('\u0000') ?? '');
    if (unchanged) return;
    this.state.access = access;
    this.state.accessSource = source;
    this.notify();
  }

  /**
   * F3 — hydrate all presentation fields from one normalised DTO. Unknown ids
   * are dropped here, so saved preferences can never widen the UI surface.
   */
  public applyUiPreferences(input: unknown): UiPreferencesDto {
    const preferences = normalizeUiPreferences(input);
    setLanguage(preferences.language);
    if (uiPreferencesSignature(preferences) === uiPreferencesSignature(this.state.preferences)) {
      return preferences;
    }
    this.patchPreferences(preferences);
    this.notify();
    return preferences;
  }

  public setTheme(theme: 'dark' | 'light'): void {
    if (this.state.theme === theme) return;
    this.patchPreferences({ theme });
    this.notify();
  }

  public setViewMode(mode: ViewMode): void {
    // Split means three panes: File, Editor and Grafo. Revealing the file pane
    // here keeps the store the single source of truth and emits one update.
    const filesVisible = mode === 'split' ? true : this.state.filesVisible;
    if (this.state.viewMode === mode && this.state.filesVisible === filesVisible) return;
    this.patchPreferences({ viewMode: mode, filesVisible });
    this.notify();
  }

  public setFilesVisible(visible: boolean): void {
    if (this.state.filesVisible === visible) return;
    this.patchPreferences({ filesVisible: visible });
    this.notify();
  }

  public toggleFilesVisible(): boolean {
    const next = !this.state.filesVisible;
    this.setFilesVisible(next);
    return next;
  }

  /** Persist the full set of actions the user wants as header buttons. */
  public setPinnedActionIds(ids: string[]): void {
    const next = [...new Set(ids)];
    if (next.join('\u0000') === this.state.pinnedActionIds.join('\u0000')) return;
    this.patchPreferences({ pinnedActionIds: next });
    this.notify();
  }

  /** Add or remove a single action from the header (used by the ⋯ menu flags). */
  public setPinnedAction(id: string, pinned: boolean): void {
    const has = this.state.pinnedActionIds.includes(id);
    if (has === pinned) return;
    this.setPinnedActionIds(
      pinned ? [...this.state.pinnedActionIds, id] : this.state.pinnedActionIds.filter(item => item !== id)
    );
  }

  /** F3 — show or hide a presentational panel; permissions are untouched. */
  public setHiddenPanel(panel: UiPanelId, hidden: boolean): void {
    const current = this.state.preferences.hiddenPanels;
    const next = hidden
      ? [...new Set([...current, panel])]
      : current.filter(item => item !== panel);
    if (next.join('\u0000') === current.join('\u0000')) return;
    this.patchPreferences({ hiddenPanels: next });
    this.notify();
  }

  public setDensity(density: UiPreferencesDto['density']): void {
    if (this.state.preferences.density === density) return;
    this.patchPreferences({ density });
    this.notify();
  }

  /** Language lives in the i18n module; the preference DTO follows it. */
  public setUiLanguage(language: UiPreferencesDto['language']): void {
    setLanguage(language);
    if (this.state.preferences.language === language) return;
    this.patchPreferences({ language });
    this.notify();
  }
}

export const appStore = new AppStore();
