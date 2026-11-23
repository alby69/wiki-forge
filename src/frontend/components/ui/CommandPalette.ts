import { WikiNote } from '@frontend/core/types/wiki';
import { actionLabel, getActions, runAction, type ActionContext } from '@frontend/core/actions';
import { t } from '@frontend/core/i18n/strings';
import { escapeHtml } from '@frontend/core/utils/html';
import { registerShortcut, unregisterShortcut } from '@frontend/core/shortcuts';
import { canRenderAction } from '@frontend/core/auth';

export interface CommandItem {
  id: string;
  type: 'note' | 'procedure' | 'action';
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

/** Command palette: notes + the same action catalogue used by every toolbar. */
export class CommandPalette {
  private overlay: HTMLElement;
  private inputEl: HTMLInputElement;
  private resultsEl: HTMLElement;
  private items: CommandItem[] = [];
  private selectedIndex = 0;

  constructor(
    private getNotesCb: () => WikiNote[],
    private onSelectNoteCb: (noteId: string) => void,
    private onOpenCockpitCb: () => void,
    private getContext: () => ActionContext = () => ({})
  ) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'command-palette-overlay';
    this.overlay.className = 'wf-modal-overlay';
    this.overlay.style.display = 'none';

    const paletteCard = document.createElement('div');
    paletteCard.className = 'wf-modal';
    paletteCard.innerHTML = `
      <div class="wf-modal__header">
        <span aria-hidden="true">🔍</span>
        <input id="cmd-palette-input" class="wf-field wf-field--block" type="text"
          placeholder="${escapeHtml(t('searchPlaceholder'))}"
          aria-label="${escapeHtml(t('searchPlaceholder'))}" />
        <span class="wf-badge">${escapeHtml(t('escapeHint'))}</span>
      </div>
      <div id="cmd-palette-results" class="wf-palette-results" role="listbox"></div>`;

    this.overlay.appendChild(paletteCard);
    document.body.appendChild(this.overlay);
    this.inputEl = paletteCard.querySelector('#cmd-palette-input') as HTMLInputElement;
    this.resultsEl = paletteCard.querySelector('#cmd-palette-results') as HTMLElement;

    this.attachEvents();
  }

  private attachEvents(): void {
    registerShortcut('command-palette:toggle', 'Ctrl+K', () => this.toggle());
    registerShortcut('command-palette:escape', 'Escape', () => {
      if (this.overlay.style.display === 'flex') this.close();
    });
    this.overlay.addEventListener('click', event => {
      if (event.target === this.overlay) this.close();
    });
    this.inputEl.addEventListener('input', () => {
      this.selectedIndex = 0;
      this.renderResults();
    });
    this.inputEl.addEventListener('keydown', event => {
      const filtered = this.getFilteredItems();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, filtered.length);
        this.renderResults();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + filtered.length) % Math.max(1, filtered.length);
        this.renderResults();
      } else if (event.key === 'Enter' && filtered[this.selectedIndex]) {
        event.preventDefault();
        filtered[this.selectedIndex].action();
        this.close();
      }
    });
  }

  public open(): void {
    this.overlay.style.display = 'flex';
    this.inputEl.value = '';
    this.selectedIndex = 0;
    this.buildItems();
    this.renderResults();
    window.setTimeout(() => this.inputEl.focus(), 20);
  }

  public close(): void {
    this.overlay.style.display = 'none';
  }

  public toggle(): void {
    if (this.overlay.style.display === 'flex') this.close();
    else this.open();
  }

  private buildItems(): void {
    const items: CommandItem[] = canRenderAction('global:keWorkbench')
      ? [{
          id: 'act-cockpit',
          type: 'action',
          title: t('keWorkbench'),
          subtitle: t('actions'),
          icon: '🚀',
          action: () => this.onOpenCockpitCb(),
        }]
      : [];
    for (const action of getActions({ menu: true }).filter(candidate => canRenderAction(candidate.id))) {
      items.push({
        id: `act-${action.id}`,
        type: 'action',
        title: actionLabel(action),
        subtitle: t(action.group === 'global' ? 'actions' : 'note'),
        icon: action.icon,
        action: () => runAction(action.id, this.getContext()),
      });
    }
    for (const note of this.getNotesCb()) {
      items.push({
        id: `note-${note.id}`,
        type: 'note',
        title: note.title || note.id,
        subtitle: `${t('openNote')} wiki/${note.folder || 'general'}`,
        icon: '📄',
        action: () => this.onSelectNoteCb(note.id),
      });
    }
    this.items = items;
  }

  private getFilteredItems(): CommandItem[] {
    const query = (this.inputEl.value || '').toLowerCase().trim();
    if (!query) return this.items.slice(0, 15);
    return this.items
      .filter(item => item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query))
      .slice(0, 15);
  }

  private renderResults(): void {
    const filtered = this.getFilteredItems();
    if (filtered.length === 0) {
      this.resultsEl.innerHTML = `<div class="wf-modal__hint">${escapeHtml(t('noResults'))}</div>`;
      return;
    }
    this.resultsEl.innerHTML = filtered.map((item, index) => `
      <button class="wf-palette-item" role="option" data-idx="${index}" aria-selected="${index === this.selectedIndex}">
        <span class="wf-palette-item__icon" aria-hidden="true">${item.icon}</span>
        <span>
          <span class="wf-palette-item__title">${escapeHtml(item.title)}</span>
          <span class="wf-palette-item__subtitle">${escapeHtml(item.subtitle)}</span>
        </span>
      </button>`).join('');

    this.resultsEl.querySelectorAll<HTMLElement>('.wf-palette-item').forEach(element => {
      element.addEventListener('click', () => {
        const index = Number(element.getAttribute('data-idx') ?? 0);
        if (filtered[index]) {
          filtered[index].action();
          this.close();
        }
      });
    });
  }

  public destroy(): void {
    unregisterShortcut('command-palette:toggle');
    unregisterShortcut('command-palette:escape');
    this.overlay.remove();
  }
}
