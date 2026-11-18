import { escapeHtml } from '@frontend/core/utils/html';
import { ReviewTab } from '@frontend/core/types/review';

export interface ReviewContextMenuCallbacks {
  onOpenReview: (noteId: string, tab: ReviewTab) => void;
  onOpenNote?: (noteId: string) => void;
}

const ITEMS: Array<{ tab: ReviewTab; label: string; icon: string; shortcut?: string }> = [
  { tab: 'verify', label: 'Verifica umana', icon: '✓', shortcut: 'Ctrl+Alt+R' },
  { tab: 'critique', label: 'Revisione critica', icon: '⚡', shortcut: 'Ctrl+Alt+C' },
  { tab: 'digest', label: 'Digest attività', icon: '◷', shortcut: 'Ctrl+Alt+D' },
  { tab: 'diff', label: 'Confronta versioni', icon: '⇄', shortcut: 'Ctrl+Alt+F' },
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
        </button>`).join('')}`;

    this.el.querySelectorAll<HTMLElement>('.wf-rs-ctx-item').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab') as ReviewTab | null;
        const noteId = this.noteId;
        this.hide();
        if (tab && noteId) this.callbacks.onOpenReview(noteId, tab);
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
