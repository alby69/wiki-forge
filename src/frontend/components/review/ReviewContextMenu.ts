import { escapeHtml } from '@frontend/core/utils/html';
import { ReviewTab } from '@frontend/core/types/review';
import { ResearchTab } from '@frontend/core/types/research';
import { StudyTab } from '@frontend/core/types/study';

export interface ReviewContextMenuCallbacks {
  onOpenReview: (noteId: string, tab: ReviewTab) => void;
  onOpenResearch?: (noteId: string, tab: ResearchTab) => void;
  onOpenStudy?: (noteId: string, tab: StudyTab) => void;
  onOpenNote?: (noteId: string) => void;
}

const ITEMS: Array<{ tab: ReviewTab; label: string; icon: string; shortcut?: string }> = [
  { tab: 'verify', label: 'Verifica umana', icon: '✓', shortcut: 'Ctrl+Alt+R' },
  { tab: 'critique', label: 'Revisione critica', icon: '⚡', shortcut: 'Ctrl+Alt+C' },
  { tab: 'digest', label: 'Digest attività', icon: '◷', shortcut: 'Ctrl+Alt+D' },
  { tab: 'diff', label: 'Confronta versioni', icon: '⇄', shortcut: 'Ctrl+Alt+F' },
];

const RESEARCH_ITEMS: Array<{ tab: ResearchTab; label: string; icon: string }> = [
  { tab: 'backlinks', label: 'Backlink della nota', icon: '↩' },
  { tab: 'related', label: 'Correlazioni suggerite', icon: '🧩' },
];

const STUDY_ITEMS: Array<{ tab: StudyTab; label: string; icon: string; shortcut?: string }> = [
  { tab: 'guide', label: 'Guida di studio', icon: '📝', shortcut: 'Ctrl+Alt+G' },
  { tab: 'quiz', label: 'Quiz di autovalutazione', icon: '🧪', shortcut: 'Ctrl+Alt+K' },
  { tab: 'mindmap', label: 'Mappa concettuale', icon: '🧠', shortcut: 'Ctrl+Alt+M' },
  { tab: 'audio', label: 'Copione audio', icon: '🎙️', shortcut: 'Ctrl+Alt+A' },
];

/**
 * Right-click menu for a wiki note.
 *
 * It only exposes review actions: opening a note stays on left click, so the
 * menu cannot accidentally replace the current selection.
 */
export class ReviewContextMenu {
  private el: HTMLElement;
  private callbacks: ReviewContextMenuCallbacks;
  private noteId: string | null = null;

  constructor(callbacks: ReviewContextMenuCallbacks) {
    this.callbacks = callbacks;
    this.el = document.createElement('div');
    this.el.className = 'wf-rs-ctx';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    // A right click elsewhere closes the menu; scrolling does too, because the
    // anchor point would otherwise drift away from the note row.
    document.addEventListener('mousedown', event => {
      if (!this.el.contains(event.target as Node)) this.hide();
    });
    document.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('resize', () => this.hide());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.hide();
    });
  }

  public show(noteId: string, title: string, x: number, y: number): void {
    this.noteId = noteId;
    this.el.innerHTML = `
      <div class="wf-rs-ctx-head">
        <strong>${escapeHtml(title)}</strong>
        <span>Review Studio</span>
      </div>
      ${ITEMS.map(item => `
        <button class="wf-rs-ctx-item" data-tab="${item.tab}">
          <span class="icon">${item.icon}</span>
          <span class="label">${item.label}</span>
          ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
        </button>`).join('')}
      ${RESEARCH_ITEMS.length > 0 ? `
        <div class="wf-rs-ctx-head" style="border-bottom: none; margin: 5px 0 0; padding-bottom: 2px;">
          <span>Research Studio</span>
        </div>
        ${RESEARCH_ITEMS.map(item => `
          <button class="wf-rs-ctx-item" data-rq-tab="${item.tab}">
            <span class="icon">${item.icon}</span>
            <span class="label">${item.label}</span>
          </button>`).join('')}` : ''}
      ${STUDY_ITEMS.length > 0 ? `
        <div class="wf-rs-ctx-head" style="border-bottom: none; margin: 5px 0 0; padding-bottom: 2px;">
          <span>Study Studio</span>
        </div>
        ${STUDY_ITEMS.map(item => `
          <button class="wf-rs-ctx-item" data-st-tab="${item.tab}">
            <span class="icon">${item.icon}</span>
            <span class="label">${item.label}</span>
            ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
          </button>`).join('')}` : ''}`;

    this.el.querySelectorAll<HTMLElement>('.wf-rs-ctx-item').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab') as ReviewTab | null;
        const researchTab = button.getAttribute('data-rq-tab') as ResearchTab | null;
        const studyTab = button.getAttribute('data-st-tab') as StudyTab | null;
        const noteId = this.noteId;
        this.hide();
        if (tab && noteId) this.callbacks.onOpenReview(noteId, tab);
        else if (researchTab && noteId) this.callbacks.onOpenResearch?.(noteId, researchTab);
        else if (studyTab && noteId) this.callbacks.onOpenStudy?.(noteId, studyTab);
      });
    });

    this.el.style.display = 'block';
    this.el.style.left = '0px';
    this.el.style.top = '0px';

    // Keep the menu inside the viewport.
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
}
