import { ProjectInfo } from '@frontend/storage/ApiStorage';
import { WikiNote } from '@frontend/core/types/wiki';
import { appStore, ViewMode } from '@frontend/store/appStore';
import { SimpleModeDashboard } from '@frontend/components/simple-mode/SimpleModeDashboard';

const VIEW_MODES: { id: ViewMode; label: string; title: string; icon: string }[] = [
  { id: 'editor', label: 'Editor', title: 'Solo Editor (riclicca per chiudere)', icon: '📝' },
  { id: 'scratchpad', label: 'Scratchpad', title: 'Note veloci nello spazio editor (riclicca per chiudere)', icon: '📒' },
  { id: 'graph', label: 'Graph', title: 'Solo Knowledge Graph (riclicca per chiudere)', icon: '🕸️' },
  { id: 'split', label: 'Split', title: 'Editor e Graph affiancati', icon: '◧' },
];

export interface HeaderOptions {
  container: HTMLElement;
  onViewModeChange?: (mode: ViewMode) => void;
  onToggleChat?: () => void;
  onOpenConfig?: () => void;
  onProjectSelect?: (projectId: string) => void;
  onOpenTools?: () => void;
  onOpenWizard?: () => void;
  onOpenKEWorkbench?: () => void;
  onOpenHelp?: () => void;
}

export class Header {
  private container: HTMLElement;
  private onViewModeChangeCb?: (mode: ViewMode) => void;
  private onToggleChatCb?: () => void;
  private onOpenConfigCb?: () => void;
  private onOpenToolsCb?: () => void;
  private onProjectSelectCb?: (projectId: string) => void;
  private onOpenWizardCb?: () => void;
  private onOpenKEWorkbenchCb?: () => void;
  private onOpenHelpCb?: () => void;
  private simpleDashboard?: SimpleModeDashboard;
  private projects: ProjectInfo[] = [];
  private activeProjectId: string = 'default';
  private activeNote: WikiNote | null = null;
  private unsubscribeStore?: () => void;

  constructor(options: HeaderOptions) {
    this.container = options.container;
    this.onViewModeChangeCb = options.onViewModeChange;
    this.onToggleChatCb = options.onToggleChat;
    this.onOpenConfigCb = options.onOpenConfig;
    this.onProjectSelectCb = options.onProjectSelect;
    this.onOpenToolsCb = options.onOpenTools;
    this.onOpenWizardCb = options.onOpenWizard;
    this.onOpenKEWorkbenchCb = options.onOpenKEWorkbench;
    this.onOpenHelpCb = options.onOpenHelp;

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

  public setSimpleDashboard(dashboard: SimpleModeDashboard): void {
    this.simpleDashboard = dashboard;
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
      ? `<button id="mode-toggle-btn" class="mode-badge-advanced mode-badge-btn" title="Passa a Focus Mode (Ctrl+Shift+D)">👑 Developer Mode</button>`
      : `<button id="mode-toggle-btn" class="mode-badge-simple mode-badge-btn" title="Passa a Developer Mode (Ctrl+Shift+D)">🌱 Focus Mode</button>`;

    this.container.innerHTML = `
      <header style="height: 52px; background: #0f172a; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; color: #f8fafc;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <a href="https://github.com/alby69/wiki-forge" target="_blank" rel="noopener noreferrer" style="font-weight: 700; font-size: 16px; color: #60a5fa; letter-spacing: 0.5px; white-space: nowrap; text-decoration: none;" id="header-brand">Wiki-Forge</a>
          ${modeBadge}
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
              m => {
                const isActive =
                  m.id === viewMode || (m.id !== 'split' && viewMode === 'split');
                return `<button
                id="view-mode-${m.id}"
                class="seg-btn ${isActive ? 'active' : ''}"
                role="tab"
                aria-selected="${isActive}"
                title="${m.title}"
              >${m.icon} ${m.label}</button>`;
              }
            ).join('')}
          </div>

          <div style="width: 1px; height: 20px; background: #334155; margin: 0 2px;"></div>

          ${
            isAdvancedMode
              ? `<!-- Onboarding + Developer Tools in Dev Mode -->
                 <button id="header-wizard-btn" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                   <span>🪄</span> Onboarding Wizard
                 </button>
                 <button id="header-ke-btn" style="background: #312e81; color: #a5b4fc; border: 1px solid #4338ca; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">🧠 KE Workbench</button>
                 <button id="header-tools-btn" style="background: #1e293b; color: #60a5fa; border: 1px solid #334155; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">🛠️ Tools</button>
                 <button id="header-config-btn" style="background: #334155; color: #ffffff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">⚙️ Config</button>`
              : `<!-- Simple-mode action pills in Focus Mode -->
                 <div id="simple-mode-pills-slot" style="display: flex; align-items: center; gap: 6px;"></div>`
          }

          <button id="header-help-btn" title="Guida Wiki-Forge (F1)" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; width: 26px; height: 26px; border-radius: 50%; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0;">?</button>

          <button id="chat-toggle-header-btn" style="background: #4338ca; color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">💬 Agent Chat</button>
        </div>
      </header>
    `;

    const wizardBtn = this.container.querySelector('#header-wizard-btn');
    const keBtn = this.container.querySelector('#header-ke-btn');
    const toolsBtn = this.container.querySelector('#header-tools-btn');
    const configBtn = this.container.querySelector('#header-config-btn');
    const chatBtn = this.container.querySelector('#chat-toggle-header-btn');
    const helpBtn = this.container.querySelector('#header-help-btn');
    const modeToggleBtn = this.container.querySelector('#mode-toggle-btn');
    const pillsSlot = this.container.querySelector('#simple-mode-pills-slot') as HTMLElement | null;
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
    if (helpBtn) helpBtn.addEventListener('click', () => this.onOpenHelpCb?.());

    if (modeToggleBtn) {
      modeToggleBtn.addEventListener('click', () => {
        appStore.toggleAdvancedMode();
      });
    }

    if (pillsSlot && this.simpleDashboard) {
      this.simpleDashboard.mountIn(pillsSlot);
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
