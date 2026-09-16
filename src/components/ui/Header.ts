import { ProjectInfo } from '../../storage/ApiStorage';
import { WikiNote } from '../../core/types/wiki';

export class Header {
  private container: HTMLElement;
  private onViewModeChangeCb?: (mode: 'editor' | 'graph' | 'split') => void;
  private onToggleChatCb?: () => void;
  private onOpenConfigCb?: () => void;
  private onOpenToolsCb?: () => void;
  private onProjectSelectCb?: (projectId: string) => void;
  private onToggleMobileMenuCb?: () => void;
  private projects: ProjectInfo[] = [];
  private activeProjectId: string = 'default';
  private activeNote: WikiNote | null = null;

  constructor(
    container: HTMLElement,
    onViewModeChange?: (mode: 'editor' | 'graph' | 'split') => void,
    onToggleChat?: () => void,
    onOpenConfig?: () => void,
    onProjectSelect?: (projectId: string) => void,
    onOpenTools?: () => void,
    onToggleMobileMenu?: () => void
  ) {
    this.container = container;
    this.onViewModeChangeCb = onViewModeChange;
    this.onToggleChatCb = onToggleChat;
    this.onOpenConfigCb = onOpenConfig;
    this.onProjectSelectCb = onProjectSelect;
    this.onOpenToolsCb = onOpenTools;
    this.onToggleMobileMenuCb = onToggleMobileMenu;
    this.render();
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
      return `<span style="font-size: 11px; background: #4a5568; color: #cbd5e0; padding: 2px 6px; border-radius: 4px;">Unverified</span>`;
    }
  }

  public render(): void {
    const projOptions = this.projects.length > 0
      ? this.projects.map(p => `<option value="${p.id}" ${p.id === this.activeProjectId ? 'selected' : ''}>${p.name}</option>`).join('')
      : `<option value="default" selected>Default Wiki</option>`;

    this.container.innerHTML = `
      <header style="height: 50px; background: #121316; border-bottom: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; color: #e2e8f0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="mobile-menu-btn" aria-label="Toggle mobile navigation menu" style="background: #2d3748; color: #64b5f6; border: 1px solid #4a5568; padding: 4px 8px; border-radius: 4px; font-size: 14px; cursor: pointer;">☰ Menu</button>
          <div style="font-weight: 700; font-size: 16px; color: #64b5f6; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">⚒️</span> Wiki-Forge
          </div>
          <span style="font-size: 11px; background: #2d3748; color: #a0aec0; padding: 2px 6px; border-radius: 4px;">OKF v0.2</span>
          ${this.renderNoteBadge()}

          <div style="margin-left: 10px; display: flex; align-items: center; gap: 6px;">
            <label for="header-project-select" style="font-size: 12px; color: #a0aec0;">Project:</label>
            <select id="header-project-select" aria-label="Select active workspace project" style="background: #2d3748; color: #64b5f6; border: 1px solid #4a5568; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
              ${projOptions}
            </select>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="view-mode-editor" aria-label="Switch to Editor view" style="background: #2d3748; color: #e2e8f0; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Editor</button>
          <button id="view-mode-graph" aria-label="Switch to Graph view" style="background: #2d3748; color: #e2e8f0; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Graph View</button>
          <button id="view-mode-split" aria-label="Switch to Split view" style="background: #3182ce; color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">Split View</button>
          <div style="width: 1px; height: 20px; background: #2d3748; margin: 0 4px;"></div>
          <button id="header-tools-btn" aria-label="Open script control panel tools" style="background: #2d3748; color: #64b5f6; border: 1px solid #4a5568; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">🛠️ Tools</button>
          <button id="header-config-btn" aria-label="Open configuration manager" style="background: #4a5568; color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">⚙️ Config</button>
          <button id="chat-toggle-header-btn" aria-label="Toggle OpenCode Assistant chat drawer" style="background: #2b6cb0; color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">💬 OpenCode Chat</button>
        </div>
      </header>
    `;

    const mobileMenuBtn = this.container.querySelector('#mobile-menu-btn');
    const editorBtn = this.container.querySelector('#view-mode-editor');
    const graphBtn = this.container.querySelector('#view-mode-graph');
    const splitBtn = this.container.querySelector('#view-mode-split');
    const toolsBtn = this.container.querySelector('#header-tools-btn');
    const configBtn = this.container.querySelector('#header-config-btn');
    const chatBtn = this.container.querySelector('#chat-toggle-header-btn');

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => this.onToggleMobileMenuCb?.());
    if (toolsBtn) toolsBtn.addEventListener('click', () => this.onOpenToolsCb?.());
    const projectSelect = this.container.querySelector('#header-project-select') as HTMLSelectElement;

    if (editorBtn) editorBtn.addEventListener('click', () => this.onViewModeChangeCb?.('editor'));
    if (graphBtn) graphBtn.addEventListener('click', () => this.onViewModeChangeCb?.('graph'));
    if (splitBtn) splitBtn.addEventListener('click', () => this.onViewModeChangeCb?.('split'));
    if (configBtn) configBtn.addEventListener('click', () => this.onOpenConfigCb?.());
    if (chatBtn) chatBtn.addEventListener('click', () => this.onToggleChatCb?.());
    if (projectSelect) {
      projectSelect.addEventListener('change', () => {
        this.onProjectSelectCb?.(projectSelect.value);
      });
    }
  }
}
