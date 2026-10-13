import { ScratchpadEntry } from '../../storage/ApiStorage';
import { escapeHtml } from '../../core/utils/html';

export interface ScratchpadCallbacks {
  getScratchpad?: () => Promise<ScratchpadEntry[]>;
  onPromoteScratchpad?: (noteId: string) => void;
  deleteScratchpad?: (noteId: string) => Promise<boolean>;
}

export class ScratchpadPanel {
  private container: HTMLElement;
  private entries: ScratchpadEntry[] = [];
  private expandedIds = new Set<string>();
  private cbs: ScratchpadCallbacks;

  constructor(container: HTMLElement, cbs: ScratchpadCallbacks) {
    this.container = container;
    this.cbs = cbs;
    void this.load();
  }

  public async load(): Promise<void> {
    if (!this.cbs.getScratchpad) return;
    try {
      this.entries = await this.cbs.getScratchpad();
    } catch (_e) {
      this.entries = [];
    }
    this.render();
  }

  private render(): void {
    const items =
      this.entries.length > 0
        ? this.entries
            .map(entry => {
              const open = this.expandedIds.has(entry.id);
              const firstLine = entry.text.split('\n')[0].trim();
              const preview = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
              return `
        <div style="padding: 8px 10px; border-radius: 6px; background: #1a1b1e; border: 1px solid #2d3748; margin-bottom: 6px;">
          <div class="scratch-item" data-scratch-id="${escapeHtml(entry.id)}" style="display: flex; align-items: center; gap: 8px; color: #cbd5e1; cursor: pointer; user-select: none;">
            <span style="color: #718096; width: 12px; display: inline-block; font-size: 12px;">${open ? '▾' : '▸'}</span>
            <span style="font-size: 11px; color: #f6ad55; white-space: nowrap; flex-shrink: 0;">${escapeHtml(entry.timestamp)}</span>
            <strong style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">${escapeHtml(preview)}</strong>
            <span style="font-size: 11px; color: #718096; flex-shrink: 0;">${entry.text.split('\n').length} righe</span>
          </div>
          ${
            open
              ? `<div style="padding: 8px 6px 6px 20px; font-size: 13px; color: #e2e8f0; white-space: pre-wrap; word-break: break-word; max-height: 60%; overflow-y: auto;">${escapeHtml(entry.text)}</div>
                <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px;">
                  <button class="scratch-delete" data-scratch-id="${escapeHtml(entry.id)}" title="Delete this note" style="background: #742a2a; color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">🗑️ Cancella</button>
                  <button class="scratch-promote" data-scratch-id="${escapeHtml(entry.id)}" title="Promote to wiki article (via /promote-note)" style="background: #2b6cb0; color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-weight: 600;">🚀 Promuovi</button>
                </div>`
              : ''
          }
        </div>`;
            })
            .join('')
        : `<div style="font-size: 12px; color: #718096; padding: 8px 4px;">No notes saved yet. Use <code style="color:#cbd5e0;">/note</code> in the chat.</div>`;

    this.container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; background: #18191c; color: #e2e8f0;">
        <div style="padding: 12px 16px; border-bottom: 1px solid #2d3748; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #121316;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #f6ad55;">🗒️ Scratchpad (${this.entries.length})</h2>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; color: #a0aec0;">Appunti non indicizzati: usa <code style="color:#cbd5e0;">/promote-note</code> per trasformarli in articoli.</span>
            <button id="scratch-refresh" title="Ricarica le note" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer;">↻ Reload</button>
          </div>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 12px 16px; min-height: 0;">${items}</div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelector('#scratch-refresh')?.addEventListener('click', () => {
      void this.load();
    });

    this.container.querySelectorAll('.scratch-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-scratch-id');
        if (!id) return;
        if (this.expandedIds.has(id)) this.expandedIds.delete(id);
        else this.expandedIds.add(id);
        this.render();
      });
    });

    this.container.querySelectorAll('.scratch-promote').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-scratch-id');
        if (id && this.cbs.onPromoteScratchpad) {
          this.cbs.onPromoteScratchpad(id);
        }
      });
    });

    this.container.querySelectorAll('.scratch-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-scratch-id');
        if (!id || !this.cbs.deleteScratchpad) return;
        if (!confirm(`Eliminare questa nota dallo scratchpad?\n\n${id}`)) return;
        const ok = await this.cbs.deleteScratchpad(id);
        if (ok) void this.load();
      });
    });
  }
}