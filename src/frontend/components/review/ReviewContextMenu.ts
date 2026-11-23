import { escapeHtml } from '@frontend/core/utils/html';
import { ReviewTab } from '@frontend/core/types/review';
import { ResearchTab } from '@frontend/core/types/research';
import { StudyTab } from '@frontend/core/types/study';
import { getActions, actionLabel } from '@frontend/core/actions';
import { t } from '@frontend/core/i18n/strings';
import { registerShortcut, unregisterShortcut } from '@frontend/core/shortcuts';
import { canRenderAction } from '@frontend/core/auth';

export interface ReviewContextMenuCallbacks {
  onOpenReview: (noteId: string, tab: ReviewTab) => void;
  onOpenResearch?: (noteId: string, tab: ResearchTab) => void;
  onOpenStudy?: (noteId: string, tab: StudyTab) => void;
  onOpenNote?: (noteId: string) => void;
}

/** Right-click menu for a wiki note. Items come from the shared action registry. */
export class ReviewContextMenu {
  private el: HTMLElement;
  private callbacks: ReviewContextMenuCallbacks;
  private noteId: string | null = null;

  constructor(callbacks: ReviewContextMenuCallbacks) {
    this.callbacks = callbacks;
    this.el = document.createElement('div');
    this.el.className = 'wf-context-menu';
    this.el.style.display = 'none';
    this.el.setAttribute('role', 'menu');
    document.body.appendChild(this.el);

    document.addEventListener('mousedown', event => {
      if (!this.el.contains(event.target as Node)) this.hide();
    });
    document.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('resize', () => this.hide());
    registerShortcut('context-menu:escape', 'Escape', () => this.hide());
  }

  private section(prefix: string, heading: string): string {
    const items = getActions({ group: 'studio' })
      .filter(action => action.id.startsWith(`${prefix}:`) && canRenderAction(action.id));
    if (items.length === 0) return '';
    return `
      <div class="wf-context-menu__head">${escapeHtml(heading)}</div>
      ${items.map(action => `
        <button class="wf-context-menu__item" role="menuitem" data-action-key="${action.id}" aria-label="${escapeHtml(actionLabel(action))}">
          <span aria-hidden="true">${action.icon}</span>
          <span>${escapeHtml(actionLabel(action))}</span>
          ${action.shortcut ? `<span class="wf-context-menu__shortcut">${escapeHtml(action.shortcut)}</span>` : ''}
        </button>`).join('')}`;
  }

  public show(noteId: string, title: string, x: number, y: number): void {
    this.noteId = noteId;
    this.el.innerHTML = `
      <div class="wf-context-menu__head"><strong>${escapeHtml(title)}</strong>${escapeHtml(t('reviewStudio'))}</div>
      ${this.section('review', t('reviewStudio'))}
      ${this.section('research', t('researchStudio'))}
      ${this.section('study', t('studyStudio'))}`;

    this.el.querySelectorAll<HTMLElement>('[data-action-key]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.actionKey!;
        const id = this.noteId;
        this.hide();
        if (!id) return;
        const tab = key.slice(key.indexOf(':') + 1);
        if (key.startsWith('review:')) this.callbacks.onOpenReview(id, tab as ReviewTab);
        else if (key.startsWith('research:')) this.callbacks.onOpenResearch?.(id, tab as ResearchTab);
        else if (key.startsWith('study:')) this.callbacks.onOpenStudy?.(id, tab as StudyTab);
      });
    });

    this.el.style.display = 'block';
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    const rect = this.el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    this.el.style.left = `${Math.max(8, left)}px`;
    this.el.style.top = `${Math.max(8, top)}px`;
  }

  public hide(): void {
    this.el.style.display = 'none';
    this.noteId = null;
  }

  public destroy(): void {
    unregisterShortcut('context-menu:escape');
    this.el.remove();
  }
}
