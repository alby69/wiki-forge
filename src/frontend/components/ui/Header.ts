import { ProjectInfo } from '@frontend/storage/ApiStorage';
import { appStore, type AppState, type ViewMode } from '@frontend/store/appStore';
import { getAction, getActions, runAction, actionLabel, actionTitle, type ActionDefinition } from '@frontend/core/actions';
import { getLanguage, setLanguage, subscribeLanguage, t } from '@frontend/core/i18n/strings';
import { escapeHtml } from '@frontend/core/utils/html';

const VIEW_MODES: Array<{ id: ViewMode; labelKey: 'viewEditor' | 'viewScratchpad' | 'viewGraph' | 'viewSplit'; icon: string }> = [
  { id: 'editor', labelKey: 'viewEditor', icon: '📝' },
  { id: 'scratchpad', labelKey: 'viewScratchpad', icon: '📒' },
  { id: 'graph', labelKey: 'viewGraph', icon: '🕸️' },
  { id: 'split', labelKey: 'viewSplit', icon: '◧' },
];

export interface HeaderOptions {
  container: HTMLElement;
  onViewModeChange?: (mode: ViewMode) => void;
  onToggleChat?: () => void;
  onProjectSelect?: (projectId: string) => void;
  /** Kept for compatibility with existing launchers; falls back to the action registry. */
  onOpenDocsWiki?: () => void;
}

/** Global header. Every shared action comes from the single action registry. */
export class Header {
  private container: HTMLElement;
  private onViewModeChangeCb?: (mode: ViewMode) => void;
  private onToggleChatCb?: () => void;
  private onProjectSelectCb?: (projectId: string) => void;
  private onOpenDocsWikiCb?: () => void;
  private projects: ProjectInfo[] = [];
  private activeProjectId: string = 'default';
  private unsubscribeStore?: () => void;
  private unsubscribeLanguage?: () => void;
  private onOutsideClick?: (event: MouseEvent) => void;
  private renderedActionIds: string[] = [];
  private lastRenderKey = '';

  constructor(options: HeaderOptions) {
    this.container = options.container;
    this.onViewModeChangeCb = options.onViewModeChange;
    this.onToggleChatCb = options.onToggleChat;
    this.onProjectSelectCb = options.onProjectSelect;
    this.onOpenDocsWikiCb = options.onOpenDocsWiki;

    this.unsubscribeStore = appStore.subscribe(state => {
      const key = `${state.isAdvancedMode}|${state.viewMode}|${state.activeProjectId}`;
      if (key !== this.lastRenderKey) this.render();
    });
    this.unsubscribeLanguage = subscribeLanguage(() => this.render());
    this.render();
  }

  public setProjects(projects: ProjectInfo[], activeProjectId: string): void {
    this.projects = projects;
    this.activeProjectId = activeProjectId;
    this.render();
  }

  /** No-op kept for callers that used the old header note badge. */
  public setSimpleDashboard(): void {
    // Focus-mode pills are mounted by WikiForgeApp, not by the header.
  }

  private renderActionButton(action: ActionDefinition, id: string, extraClass = ''): string {
    this.renderedActionIds.push(id);
    const title = escapeHtml(actionTitle(action));
    return `<button id="${id}" class="wf-btn wf-btn--sm ${extraClass}" data-action-id="${id}" data-action-key="${action.id}" title="${title}" aria-label="${title}"><span aria-hidden="true">${action.icon}</span> ${escapeHtml(actionLabel(action))}</button>`;
  }

  private renderMenu(): string {
    const actions = getActions({ group: 'global', menu: true });
    return `
      <div class="wf-header__menu">
        <button id="header-more-btn" class="wf-icon-btn" aria-haspopup="menu" aria-expanded="false" title="${escapeHtml(t('moreActions'))}" aria-label="${escapeHtml(t('moreActions'))}">⋯</button>
        <div id="header-more-menu" class="wf-menu" role="menu" hidden>
          ${actions.map(action => {
            const id = `menu-item-${action.id.replace(':', '-')}`;
            this.renderedActionIds.push(id);
            const shortcut = action.shortcut ? `<span class="wf-menu__shortcut">${escapeHtml(action.shortcut)}</span>` : '';
            return `<button id="${id}" class="wf-menu__item" role="menuitem" data-action-id="${id}" data-action-key="${action.id}"><span aria-hidden="true">${action.icon}</span> ${escapeHtml(actionLabel(action))}${shortcut}</button>`;
          }).join('')}
        </div>
      </div>`;
  }

  public render(): void {
    const state: AppState = appStore.getState();
    this.lastRenderKey = `${state.isAdvancedMode}|${state.viewMode}|${state.activeProjectId}`;
    this.renderedActionIds = [];

    const projOptions = this.projects.length > 0
      ? this.projects.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === this.activeProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')
      : `<option value="default" selected>Default Wiki</option>`;

    const modeTitle = state.isAdvancedMode ? t('focusMode') : t('developerMode');
    const modeBadge = state.isAdvancedMode
      ? `<button id="mode-toggle-btn" class="mode-badge-advanced mode-badge-btn" title="${escapeHtml(modeTitle)}">👑 ${escapeHtml(t('developerMode'))}</button>`
      : `<button id="mode-toggle-btn" class="mode-badge-simple mode-badge-btn" title="${escapeHtml(modeTitle)}">🌱 ${escapeHtml(t('focusMode'))}</button>`;

    const docsAction = getAction('global:docsWiki');
    const pinnedIds = ['global:projects', 'global:research', 'global:study'];
    const pinned = pinnedIds
      .map(id => getAction(id))
      .filter((action): action is ActionDefinition => Boolean(action))
      .map(action => this.renderActionButton(action, `header-${action.id.replace(':', '-')}-btn`))
      .join('');
    const docsButton = state.isAdvancedMode && docsAction
      ? `<button id="header-docs-wiki-btn" class="wf-btn wf-btn--sm wf-btn--success" data-action-id="header-docs-wiki-btn" data-action-key="global:docsWiki" title="${escapeHtml(t('docsWiki'))}" aria-label="${escapeHtml(t('docsWiki'))}">${docsAction.icon} ${escapeHtml(actionLabel(docsAction))}</button>`
      : '';
    if (docsButton) this.renderedActionIds.push('header-docs-wiki-btn');

    this.container.innerHTML = `
      <header class="wf-header">
        <div class="wf-header__group">
          <a href="https://github.com/alby69/wiki-forge" target="_blank" rel="noopener noreferrer" class="wf-header__brand" id="header-brand">${escapeHtml(t('appName'))}</a>
          ${modeBadge}
          <div class="wf-header__group">
            <label class="wf-label" for="header-project-select">${escapeHtml(t('project'))}:</label>
            <select id="header-project-select" class="wf-field" aria-label="${escapeHtml(t('project'))}">${projOptions}</select>
          </div>
          <label class="wf-label" for="header-language-select">${escapeHtml(t('language'))}:</label>
          <select id="header-language-select" class="wf-field" aria-label="${escapeHtml(t('language'))}">
            <option value="it" ${getLanguage() === 'it' ? 'selected' : ''}>🇮🇹 IT</option>
            <option value="en" ${getLanguage() === 'en' ? 'selected' : ''}>🇬🇧 EN</option>
          </select>
        </div>

        <div class="wf-header__group">
          <div class="seg-control" role="tablist" aria-label="${escapeHtml(t('view'))}">
            ${VIEW_MODES.map(m => {
              const active = m.id === state.viewMode;
              return `<button id="view-mode-${m.id}" class="seg-btn ${active ? 'active' : ''}" role="tab" aria-selected="${active}" title="${escapeHtml(t(m.labelKey))}"><span aria-hidden="true">${m.icon}</span> ${escapeHtml(t(m.labelKey))}</button>`;
            }).join('')}
          </div>
          <div class="wf-divider"></div>
          ${pinned}
          ${docsButton}
          <button id="chat-toggle-header-btn" class="wf-btn wf-btn--primary" title="${escapeHtml(t('chat'))}" aria-label="${escapeHtml(t('chat'))}"><span aria-hidden="true">💬</span> ${escapeHtml(t('chat'))}</button>
          <button id="header-help-btn" class="wf-icon-btn" title="${escapeHtml(t('help'))} (F1)" aria-label="${escapeHtml(t('help'))}">?</button>
          ${this.renderMenu()}
        </div>
      </header>`;

    this.bindEvents();
  }

  private bindEvents(): void {
    VIEW_MODES.forEach(m => {
      this.container.querySelector(`#view-mode-${m.id}`)?.addEventListener('click', () =>
        this.onViewModeChangeCb ? this.onViewModeChangeCb(m.id) : runAction(`view:${m.id}`)
      );
    });

    this.container.querySelector('#mode-toggle-btn')?.addEventListener('click', () => runAction('global:toggleMode'));
    this.container.querySelector('#chat-toggle-header-btn')?.addEventListener('click', () => {
      if (this.onToggleChatCb) this.onToggleChatCb();
      else runAction('global:chat');
    });
    this.container.querySelector('#header-help-btn')?.addEventListener('click', () => runAction('global:help'));

    const projectSelect = this.container.querySelector('#header-project-select') as HTMLSelectElement | null;
    projectSelect?.addEventListener('change', () => {
      const id = projectSelect.value;
      this.activeProjectId = id;
      if (this.onProjectSelectCb) this.onProjectSelectCb(id);
      else appStore.setActiveProjectId(id);
    });

    const languageSelect = this.container.querySelector('#header-language-select') as HTMLSelectElement | null;
    languageSelect?.addEventListener('change', () => {
      const value = languageSelect.value;
      if (value === 'it' || value === 'en') setLanguage(value);
    });

    const actionKeyById: Record<string, string> = {
      'header-docs-wiki-btn': 'global:docsWiki',
      'header-projects-btn': 'global:projects',
      'header-research-btn': 'global:research',
      'header-study-btn': 'global:study',
      'header-help-btn': 'global:help',
    };
    for (const id of this.renderedActionIds) {
      const element = this.container.querySelector(`#${id}`);
      if (!element) continue;
      const key = (element as HTMLElement).dataset?.actionKey ?? actionKeyById[id];
      if (!key) continue;
      element.addEventListener('click', () => {
        if (id === 'header-docs-wiki-btn' && this.onOpenDocsWikiCb) {
          this.onOpenDocsWikiCb();
          return;
        }
        this.toggleMoreMenu(false);
        runAction(key);
      });
    }

    const moreBtn = this.container.querySelector('#header-more-btn');
    moreBtn?.addEventListener('click', () => {
      const menu = this.container.querySelector('#header-more-menu') as HTMLElement | null;
      if (!menu) return;
      const open = menu.hidden;
      menu.hidden = !open;
      moreBtn.setAttribute?.('aria-expanded', String(open));
    });

    if (typeof document !== 'undefined' && !this.onOutsideClick) {
      this.onOutsideClick = event => {
        if (this.container.contains?.(event.target as Node)) return;
        this.toggleMoreMenu(false);
      };
      document.addEventListener('mousedown', this.onOutsideClick);
    }
  }

  private toggleMoreMenu(open: boolean): void {
    const menu = this.container.querySelector('#header-more-menu') as HTMLElement | null;
    const button = this.container.querySelector('#header-more-btn');
    if (menu) menu.hidden = !open;
    button?.setAttribute?.('aria-expanded', String(open));
  }

  public destroy(): void {
    this.unsubscribeStore?.();
    this.unsubscribeLanguage?.();
    if (this.onOutsideClick && typeof document !== 'undefined') {
      document.removeEventListener('mousedown', this.onOutsideClick);
      this.onOutsideClick = undefined;
    }
  }
}
