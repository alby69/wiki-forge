import { ProjectInfo } from '../../storage/ApiStorage';
import { WikiNote } from '../../core/types/wiki';
import { appStore, ViewMode } from '../../store/appStore';

const VIEW_MODES: { id: ViewMode; label: string; title: string; icon: string }[] = [
  { id: 'editor', label: 'Editor', title: 'Solo Editor', icon: '📝' },
  { id: 'graph', label: 'Graph', title: 'Solo Knowledge Graph', icon: '🕸️' },
  { id: 'split', label: 'Split', title: 'Editor e Graph affiancati', icon: '◧' },
];

export class Header {
  private container: HTMLElement;
  private onViewModeChangeCb?: (mode: ViewMode) => void;
  private onToggleChatCb?: () => void;
  private onOpenConfigCb?: () => void;
  private onOpenToolsCb?: () => void;
  private onProjectSelectCb?: (projectId: string) => void;
  private onOpenWizardCb?: () => void;
  private onOpenKEWorkbenchCb?: () => void;
  private projects: ProjectInfo[] = [];
  private activeProjectId: string = 'default';
  private activeNote: WikiNote | null = null;
  private unsubscribeStore?: () => void;

  constructor(
    container: HTMLElement,
    onViewModeChange?: (mode: ViewMode) => void,
    onToggleChat?: () => void,
    onOpenConfig?: () => void,
    onProjectSelect?: (projectId: string) => void,
    onOpenTools?: () => void,
    onOpenWizard?: () => void,
    onOpenKEWorkbench?: () => void
  ) {
    this.container = container;
    this.onViewModeChangeCb = onViewModeChange;
    this.onToggleChatCb = onToggleChat;
    this.onOpenConfigCb = onOpenConfig;
    this.onProjectSelectCb = onProjectSelect;
    this.onOpenToolsCb = onOpenTools;
    this.onOpenWizardCb = onOpenWizard;
    this.onOpenKEWorkbenchCb = onOpenKEWorkbench;

    this.unsubscribeStore = appStore.subscribe(() => {
      this.render();
    });

    this.setupKeyboardShortcuts();
    this.render();
  }

  private setupKeyboardShortcuts(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
          e.preventDefault();
          appStore.toggleAdvancedMode();
        }
      });
    }
  }

  public setProjects(projects: ProjectInfo[], activeProjectId: string): void {
    this.projects = projects;
    this.activeProjectId = activeProjectId;
    this.render();
  }

  public setActiveNote(note: WikiNote | null): void {
    this.activeNote = note;
    this.render();
  }

  private renderNoteBadge(): string {
    if (!this.activeNote) return '';

    const tier = this.activeNote.trustTier || 'unverified';
    if (tier === 'human-reviewed') {
      return `<span style="font-size: 11px; background: #22543d; color: #9ae6b4; padding: 2px 6px; border-radius: 4px; font-weight: 600;">✓ Human-Reviewed</span>`;
    } else if (tier === 'machine-confirmed') {
      return `<span style="font-size: 11px; background: #2a4365; color: #90cdf4; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🤖 Machine-Confirmed</span>`;
    } else {
      return `<span style="font-size: 11px; background: #334155; color: #cbd5e0; padding: 2px 6px; border-radius: 4px;">Unverified</span>`;
    }
  }

  public render(): void {
    const { isAdvancedMode, viewMode } = appStore.getState();

    const projOptions = this.projects.length > 0
      ? this.projects.map(p => `<option value="${p.id}" ${p.id === this.activeProjectId ? 'selected' : ''}>${p.name}</option>`).join('')
      : `<option value="default" selected>Default Wiki</option>`;

    const modeBadge = isAdvancedMode
      ? `<span class="mode-badge-advanced">👑 Developer Mode</span>`
      : `<span class="mode-badge-simple">🌱 Focus Mode</span>`;

    this.container.innerHTML = `
      <header style="height: 52px; background: #0f172a; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; color: #f8fafc;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-weight: 700; font-size: 16px; color: #60a5fa; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; cursor: pointer;" id="header-brand">
            <span style="font-size: 18px;">⚒️</span> Wiki-Forge
          </div>
          ${modeBadge}
          <span style="font-size: 11px; background: #1e293b; color: #94a3b8; padding: 2px 6px; border-radius: 4px;">OKF v0.2</span>
          ${this.renderNoteBadge()}

          <div style="margin-left: 6px; display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 12px; color: #94a3b8;">Project:</label>
            <select id="header-project-select" style="background: #1e293b; color: #60a5fa; border: 1px solid #334155; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
              ${projOptions}
            </select>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <!-- View Mode Toggles -->
          <div class="seg-control" role="tablist" aria-label="Vista">
            ${VIEW_MODES.map(
              m => `<button
                id="view-mode-${m.id}"
                class="seg-btn ${viewMode === m.id ? 'active' : ''}"
                role="tab"
                aria-selected="${viewMode === m.id}"
                title="${m.title}"
              >${m.icon} ${m.label}</button>`
            ).join('')}
          </div>

          <div style="width: 1px; height: 20px; background: #334155; margin: 0 2px;"></div>

          <!-- Wizard Quick Access Button in Simple Mode -->
          <button id="header-wizard-btn" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">
            <span>🪄</span> Onboarding Wizard
          </button>

          <!-- Developer Tools in Advanced Mode -->
          ${
            isAdvancedMode
              ? `<button id="header-ke-btn" style="background: #312e81; color: #a5b4fc; border: 1px solid #4338ca; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">🧠 KE Workbench</button>
                 <button id="header-tools-btn" style="background: #1e293b; color: #60a5fa; border: 1px solid #334155; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">🛠️ Tools</button>
                 <button id="header-config-btn" style="background: #334155; color: #ffffff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">⚙️ Config</button>`
              : ''
          }

          <button id="chat-toggle-header-btn" style="background: #4338ca; color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">💬 Agent Chat</button>

          <!-- Developer Mode Toggle Switch -->
          <div style="display: flex; align-items: center; gap: 6px; margin-left: 4px; padding-left: 8px; border-left: 1px solid #334155;">
            <label for="developer-mode-toggle" style="font-size: 11px; color: #94a3b8; font-weight: 600; cursor: pointer; user-select: none;">Dev Mode</label>
            <input type="checkbox" id="developer-mode-toggle" ${isAdvancedMode ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: #6366f1;" title="Toggle Developer Mode (Ctrl+Shift+D)" />
          </div>
        </div>
      </header>
    `;

    const wizardBtn = this.container.querySelector('#header-wizard-btn');
    const keBtn = this.container.querySelector('#header-ke-btn');
    const toolsBtn = this.container.querySelector('#header-tools-btn');
    const configBtn = this.container.querySelector('#header-config-btn');
    const chatBtn = this.container.querySelector('#chat-toggle-header-btn');
    const devToggle = this.container.querySelector('#developer-mode-toggle') as HTMLInputElement;
    const projectSelect = this.container.querySelector('#header-project-select') as HTMLSelectElement;

    VIEW_MODES.forEach(m => {
      const btn = this.container.querySelector(`#view-mode-${m.id}`);
      btn?.addEventListener('click', () => this.onViewModeChangeCb?.(m.id));
    });

    if (wizardBtn) wizardBtn.addEventListener('click', () => this.onOpenWizardCb?.());
    if (keBtn) keBtn.addEventListener('click', () => this.onOpenKEWorkbenchCb?.());
    if (toolsBtn) toolsBtn.addEventListener('click', () => this.onOpenToolsCb?.());
    if (configBtn) configBtn.addEventListener('click', () => this.onOpenConfigCb?.());
    if (chatBtn) chatBtn.addEventListener('click', () => this.onToggleChatCb?.());

    if (devToggle) {
      devToggle.addEventListener('change', () => {
        appStore.setAdvancedMode(devToggle.checked);
      });
    }

    if (projectSelect) {
      projectSelect.addEventListener('change', () => {
        this.onProjectSelectCb?.(projectSelect.value);
      });
    }
  }

  public destroy(): void {
    if (this.unsubscribeStore) this.unsubscribeStore();
  }
}
