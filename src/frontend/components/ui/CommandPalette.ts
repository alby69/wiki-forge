import { WikiNote } from '@frontend/core/types/wiki';
import { resolveApiBaseUrl } from '@frontend/storage/ApiStorage';

export interface CommandItem {
  id: string;
  type: 'note' | 'procedure' | 'action';
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

export class CommandPalette {
  private overlay: HTMLElement;
  private inputEl: HTMLInputElement;
  private resultsEl: HTMLElement;
  private items: CommandItem[] = [];
  private selectedIndex: number = 0;
  private apiBaseUrl: string = resolveApiBaseUrl();

  constructor(
    private getNotesCb: () => WikiNote[],
    private onSelectNoteCb: (noteId: string) => void,
    private onOpenCockpitCb: () => void
  ) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'command-palette-overlay';
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.75); display: none; align-items: flex-start; justify-content: center;
      padding-top: 15vh; z-index: 3000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const paletteCard = document.createElement('div');
    paletteCard.style.cssText = `
      width: 600px; max-width: 90vw; background: #0f172a; border: 1px solid #334155;
      border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
      display: flex; flex-direction: column;
    `;

    paletteCard.innerHTML = `
      <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #1e293b; gap: 10px;">
        <span style="font-size: 18px; color: #818cf8;">🔍</span>
        <input id="cmd-palette-input" type="text" placeholder="Search notes, procedures, or commands (Ctrl+K)..." style="
          flex: 1; background: transparent; border: none; outline: none; color: #f8fafc; font-size: 15px;
        " />
        <span style="font-size: 11px; background: #1e293b; color: #94a3b8; padding: 2px 6px; border-radius: 4px;">ESC to close</span>
      </div>
      <div id="cmd-palette-results" style="max-height: 380px; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px;"></div>
    `;

    this.overlay.appendChild(paletteCard);
    document.body.appendChild(this.overlay);

    this.inputEl = paletteCard.querySelector('#cmd-palette-input') as HTMLInputElement;
    this.resultsEl = paletteCard.querySelector('#cmd-palette-results') as HTMLElement;

    this.attachEvents();
  }

  private attachEvents(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.overlay.style.display === 'flex') {
        this.close();
      }
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.inputEl.addEventListener('input', () => {
      this.renderResults();
    });

    this.inputEl.addEventListener('keydown', (e) => {
      const filtered = this.getFilteredItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, filtered.length);
        this.updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + filtered.length) % Math.max(1, filtered.length);
        this.updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[this.selectedIndex]) {
          filtered[this.selectedIndex].action();
          this.close();
        }
      }
    });
  }

  public open(): void {
    this.overlay.style.display = 'flex';
    this.inputEl.value = '';
    this.selectedIndex = 0;
    this.buildItems();
    this.renderResults();
    setTimeout(() => this.inputEl.focus(), 50);
  }

  public close(): void {
    this.overlay.style.display = 'none';
  }

  public toggle(): void {
    if (this.overlay.style.display === 'flex') this.close();
    else this.open();
  }

  private buildItems(): void {
    const items: CommandItem[] = [];

    // Global Actions
    items.push({
      id: 'act-cockpit',
      type: 'action',
      title: 'Knowledge Engineer Cockpit',
      subtitle: 'Open health metrics, maturity scorecard, and procedure runner',
      icon: '🚀',
      action: () => this.onOpenCockpitCb(),
    });

    // Notes
    const notes = this.getNotesCb();
    for (const note of notes) {
      items.push({
        id: `note-${note.id}`,
        type: 'note',
        title: note.title || note.id,
        subtitle: `Note in wiki/${note.folder || 'general'}`,
        icon: '📄',
        action: () => this.onSelectNoteCb(note.id),
      });
    }

    this.items = items;
  }

  private getFilteredItems(): CommandItem[] {
    const q = this.inputEl.value.toLowerCase().trim();
    if (!q) return this.items.slice(0, 15);
    return this.items.filter(
      i => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q)
    ).slice(0, 15);
  }

  private renderResults(): void {
    const filtered = this.getFilteredItems();
    if (filtered.length === 0) {
      this.resultsEl.innerHTML = `<div style="padding: 12px; color: #64748b; font-size: 13px;">No matching notes or commands found.</div>`;
      return;
    }

    this.resultsEl.innerHTML = filtered.map((item, idx) => `
      <div class="cmd-item" data-idx="${idx}" style="
        padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 10px;
        background: ${idx === this.selectedIndex ? '#1e293b' : 'transparent'};
        border: 1px solid ${idx === this.selectedIndex ? '#334155' : 'transparent'};
      ">
        <span style="font-size: 16px;">${item.icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 13px; color: ${idx === this.selectedIndex ? '#818cf8' : '#f8fafc'};">${item.title}</div>
          <div style="font-size: 11px; color: #94a3b8;">${item.subtitle}</div>
        </div>
      </div>
    `).join('');

    const itemEls = this.resultsEl.querySelectorAll('.cmd-item');
    itemEls.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
        if (filtered[idx]) {
          filtered[idx].action();
          this.close();
        }
      });
    });
  }

  private updateSelection(): void {
    this.renderResults();
  }
}
