export interface AppState {
  isAdvancedMode: boolean;
  activeProjectId: string;
  onboardingCompleted: boolean;
  theme: 'dark' | 'light';
}

type Listener = (state: AppState) => void;

const ADVANCED_MODE_KEY = 'wiki-forge:advanced-mode';
const ONBOARDING_KEY = 'wiki-forge:onboarding-completed';
const PROJECT_KEY = 'wiki-forge:active-project';
const THEME_KEY = 'wiki-forge:theme';

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
      } catch (_e) {
        // Fallback
      }
    }

    return {
      isAdvancedMode,
      activeProjectId,
      onboardingCompleted,
      theme,
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
    this.state.activeProjectId = id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PROJECT_KEY, id);
    }
    this.notify();
  }

  public setTheme(theme: 'dark' | 'light'): void {
    this.state.theme = theme;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_KEY, theme);
    }
    this.notify();
  }
}

export const appStore = new AppStore();
