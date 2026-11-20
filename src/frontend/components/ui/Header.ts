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

/** Stable DOM ids for header buttons. Keep the historical ones for launcher compat. */
const HEADER_BUTTON_IDS: Record<string, string> = {
  'global:projects': 'header-projects-btn',
  'global:research': 'header-research-btn',
  'global:study': 'header-study-btn',
  'global:docsWiki': 'header-docs-wiki-btn',
  'global:review': 'header-review-btn',
  'global:tools': 'header-tools-btn',
  'global:config': 'header-config-btn',
  'global:wizard': 'header-wizard-btn',
  'global:keWorkbench': 'header-ke-workbench-btn',
  'global:changesets': 'header-changesets-btn',
  'global:chat': 'chat-toggle-header-btn',
  'global:help': 'header-help-btn',
};

const ACTION_ID_BY_BUTTON_ID: Record<string, string> = Object.fromEntries(
  Object.entries(HEADER_BUTTON_IDS).map(([actionId, buttonId]) => [buttonId, actionId])
);

/** These keep their bespoke markup; everything else uses renderActionButton(). */
const SPECIAL_HEADER_ACTIONS = new Set(['global:docsWiki', 'global:chat', 'global:help']);

function headerButtonId(actionId: string): string {
  return HEADER_BUTTON_IDS[actionId] ?? `header-${actionId.replace(':', '-')}-btn`;
}

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
  private moreMenuOpen = false;
  private focusPinActionId?: string;

  constructor(options: HeaderOptions) {
    this.container = options.container;
    this.onViewModeChangeCb = options.onViewModeChange;
    this.onToggleChatCb = options.onToggleChat;
    this.onProjectSelectCb = options.onProjectSelect;
    this.onOpenDocsWikiCb = options.onOpenDocsWiki;

    this.unsubscribeStore = appStore.subscribe(state => {
      const key = this.renderKey(state);
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

  private renderKey(state: AppState): string {
    return [
      state.isAdvancedMode,
      state.viewMode,
      state.activeProjectId,
      state.pinnedActionIds.join(','),
    ].join('|');
  }

  private renderActionButton(action: ActionDefinition, id: string, extraClass = ''): string {
    this.renderedActionIds.push(id);
    const title = escapeHtml(actionTitle(action));
    return `<button id="${id}" class="wf-btn wf-btn--sm ${extraClass}" data-action-id="${id}" data-action-key="${action.id}" title="${title}" aria-label="${title}"><span aria-hidden="true">${action.icon}</span> ${escapeHtml(actionLabel(action))}</button>`;
  }

  /** Actions that can be toggled from the ⋯ menu and shown as header buttons. */
  private pinnableActions(state: AppState): ActionDefinition[] {
    return getActions({ group: 'global', menu: true })
      // The docs wiki is a Developer Mode feature: don't offer a flag that
      // would have no visible effect in Focus Mode.
      .filter(action => action.id !== 'global:docsWiki' || state.isAdvancedMode);
  }

  /** Section of the ⋯ menu with one flag per pinnable action. */
  private renderBarCustomizer(state: AppState): string {
    const pinned = new Set(state.pinnedActionIds);
    const rows = this.pinnableActions(state).map(action => {
      const id = `pin-${action.id.replace(':', '-')}`;
      const checked = pinned.has(action.id);
      return `<label class="wf-menu__item wf-menu__toggle" for="${id}" title="${escapeHtml(t('showInBar'))}">
        <input type="checkbox" id="${id}" data-pin-action="${action.id}" ${checked ? 'checked' : ''} />
        <span aria-hidden="true">${action.icon}</span> ${escapeHtml(actionLabel(action))}
      </label>`;
    }).join('');

    return `<div class="wf-menu__section" role="group" aria-label="${escapeHtml(t('customizeBar'))}">
      <div class="wf-menu__label">${escapeHtml(t('customizeBar'))}</div>
      ${rows}
    </div>`;
  }

  private renderMenu(state: AppState): string {
    const actions = getActions({ group: 'global', menu: true });
    return `
      <div class="wf-header__menu">
        <button id="header-more-btn" class="wf-icon-btn" aria-haspopup="menu" aria-expanded="false" title="${escapeHtml(t('moreActions'))}" aria-label="${escapeHtml(t('moreActions'))}">⋯</button>
        <div id="header-more-menu" class="wf-menu" role="menu" hidden>
          ${this.renderBarCustomizer(state)}
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
    this.lastRenderKey = this.renderKey(state);
    this.renderedActionIds = [];

    const projOptions = this.projects.length > 0
      ? this.projects.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === this.activeProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')
      : `<option value="default" selected>Default Wiki</option>`;

    const modeTitle = state.isAdvancedMode ? t('focusMode') : t('developerMode');
    const modeBadge = state.isAdvancedMode
      ? `<button id="mode-toggle-btn" class="mode-badge-advanced mode-badge-btn" title="${escapeHtml(modeTitle)}">👑 ${escapeHtml(t('developerMode'))}</button>`
      : `<button id="mode-toggle-btn" class="mode-badge-simple mode-badge-btn" title="${escapeHtml(modeTitle)}">🌱 ${escapeHtml(t('focusMode'))}</button>`;

    const pinnedIds = new Set(state.pinnedActionIds);
    const pinned = this.pinnableActions(state)
      .filter(action => !SPECIAL_HEADER_ACTIONS.has(action.id) && pinnedIds.has(action.id))
      .map(action => this.renderActionButton(action, headerButtonId(action.id)))
      .join('');

    const docsAction = getAction('global:docsWiki');
    const docsButton = state.isAdvancedMode && pinnedIds.has('global:docsWiki') && docsAction
      ? `<button id="${headerButtonId('global:docsWiki')}" class="wf-btn wf-btn--sm wf-btn--success" data-action-id="${headerButtonId('global:docsWiki')}" data-action-key="global:docsWiki" title="${escapeHtml(t('docsWiki'))}" aria-label="${escapeHtml(t('docsWiki'))}">${docsAction.icon} ${escapeHtml(actionLabel(docsAction))}</button>`
      : '';
    if (docsButton) this.renderedActionIds.push(headerButtonId('global:docsWiki'));

    const chatButton = pinnedIds.has('global:chat')
      ? `<button id="${headerButtonId('global:chat')}" class="wf-btn wf-btn--primary" title="${escapeHtml(t('chat'))}" aria-label="${escapeHtml(t('chat'))}"><span aria-hidden="true">💬</span> ${escapeHtml(t('chat'))}</button>`
      : '';
    const helpButton = pinnedIds.has('global:help')
      ? `<button id="${headerButtonId('global:help')}" class="wf-icon-btn" title="${escapeHtml(t('help'))} (F1)" aria-label="${escapeHtml(t('help'))}">?</button>`
      : '';

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
          ${chatButton}
          ${helpButton}
          ${this.renderMenu(state)}
        </div>
      </header>`;

    this.bindEvents();
    this.toggleMoreMenu(this.moreMenuOpen);
    if (this.focusPinActionId) {
      const checkbox = this.container.querySelector(`#${this.focusPinActionId}`) as HTMLInputElement | null;
      checkbox?.focus?.();
      this.focusPinActionId = undefined;
    }
  }

  private bindEvents(): void {
    VIEW_MODES.forEach(m => {
      this.container.querySelector(`#view-mode-${m.id}`)?.addEventListener('click', () =>
        this.onViewModeChangeCb ? this.onViewModeChangeCb(m.id) : runAction(`view:${m.id}`)
      );
    });

    this.container.querySelector('#mode-toggle-btn')?.addEventListener('click', () => runAction('global:toggleMode'));
    this.container.querySelector(`#${headerButtonId('global:chat')}`)?.addEventListener('click', () => {
      if (this.onToggleChatCb) this.onToggleChatCb();
      else runAction('global:chat');
    });
    this.container.querySelector(`#${headerButtonId('global:help')}`)?.addEventListener('click', () => runAction('global:help'));

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

    // The ⋯ menu flags persist the toolbar layout in appStore.
    for (const action of this.pinnableActions(appStore.getState())) {
      const id = `pin-${action.id.replace(':', '-')}`;
      const checkbox = this.container.querySelector(`#${id}`) as HTMLInputElement | null;
      checkbox?.addEventListener('change', () => {
        this.focusPinActionId = id;
        appStore.setPinnedAction(action.id, checkbox.checked);
        this.focusPinActionId = undefined;
      });
    }

    for (const id of this.renderedActionIds) {
      const element = this.container.querySelector(`#${id}`);
      if (!element) continue;
      const key = this.actionKeyFor(id, element as HTMLElement);
      if (!key) continue;
      element.addEventListener('click', () => {
        if (id === headerButtonId('global:docsWiki') && this.onOpenDocsWikiCb) {
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
      this.toggleMoreMenu(menu.hidden);
    });

    if (typeof document !== 'undefined' && !this.onOutsideClick) {
      this.onOutsideClick = event => {
        if (this.container.contains?.(event.target as Node)) return;
        this.toggleMoreMenu(false);
      };
      document.addEventListener('mousedown', this.onOutsideClick);
    }
  }

  private actionKeyFor(id: string, element: HTMLElement): string | undefined {
    if (element.dataset?.actionKey) return element.dataset.actionKey;
    if (ACTION_ID_BY_BUTTON_ID[id]) return ACTION_ID_BY_BUTTON_ID[id];
    if (id.startsWith('menu-item-')) return id.slice('menu-item-'.length).replace('-', ':');
    return undefined;
  }

  private toggleMoreMenu(open: boolean): void {
    this.moreMenuOpen = open;
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
