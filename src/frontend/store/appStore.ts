import { eventBus } from '@frontend/core/events';
import type { AuthIdentityDto } from '@shared/api/types';

/** B7 — additive auth slice; empty in legacy mode. */
export interface AuthState {
  /** IdP bearer token, persisted so a reload can restore the session. */
  token: string;
  /** Identity resolved by `GET /api/auth/me`; never client-supplied. */
  identity?: AuthIdentityDto;
}

export interface AppState {
  auth: AuthState;
  isAdvancedMode: boolean;
  activeProjectId: string;
  onboardingCompleted: boolean;
  theme: 'dark' | 'light';
  viewMode: ViewMode;
  /** Global action ids currently pinned as buttons in the main header. */
  pinnedActionIds: string[];
  /** Visibility of the left file-manager pane (the "File" header button). */
  filesVisible: boolean;
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

        authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
      } catch (_e) {
        // Fallback
      }
    }

    return {
      auth: { token: authToken },
      isAdvancedMode,
      activeProjectId,
      onboardingCompleted,
      theme,
      viewMode,
      pinnedActionIds,
      filesVisible,
    };
  }

  public getState(): AppState {
    return { ...this.state };
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

  public setTheme(theme: 'dark' | 'light'): void {
    if (this.state.theme === theme) return;
    this.state.theme = theme;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_KEY, theme);
    }
    this.notify();
  }

  public setViewMode(mode: ViewMode): void {
    if (this.state.viewMode === mode) return;
    this.state.viewMode = mode;
    // Split means three panes: File, Editor and Grafo. Revealing the file pane
    // here keeps the store the single source of truth and emits one update.
    if (mode === 'split') this.state.filesVisible = true;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(VIEW_MODE_KEY, mode);
        if (mode === 'split') localStorage.setItem(FILES_VISIBLE_KEY, 'true');
      } catch (_e) {
        // Persisting is best-effort
      }
    }
    this.notify();
  }

  public setFilesVisible(visible: boolean): void {
    if (this.state.filesVisible === visible) return;
    this.state.filesVisible = visible;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(FILES_VISIBLE_KEY, String(visible));
        localStorage.setItem(LEGACY_SIDEBAR_COLLAPSED_KEY, String(!visible));
      } catch (_e) {
        // Best effort only.
      }
    }
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
    this.state.pinnedActionIds = next;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(PINNED_ACTIONS_KEY, JSON.stringify(next));
      } catch (_e) {
        // Persisting is best-effort
      }
    }
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
}

export const appStore = new AppStore();
