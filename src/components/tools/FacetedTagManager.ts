import { WikiNote } from '../../core/types/wiki';
import { ApiStorage } from '../../storage/ApiStorage';
import { escapeHtml } from '../../core/utils/html';

export interface FacetedTagManagerCallbacks {
  onFilterTagsChange: (tags: string[]) => void;
  onTagsUpdated: () => void;
}

export class FacetedTagManager {
  private container: HTMLElement;
  private apiStorage: ApiStorage;
  private notes: WikiNote[] = [];
  private selectedTags = new Set<string>();
  private callbacks: FacetedTagManagerCallbacks;

  constructor(
    container: HTMLElement,
    apiStorage: ApiStorage,
    callbacks: FacetedTagManagerCallbacks
  ) {
    this.container = container;
    this.apiStorage = apiStorage;
    this.callbacks = callbacks;
  }

  public setNotes(notes: WikiNote[]): void {
    this.notes = notes;
    this.render();
  }

  public getSelectedTags(): string[] {
    return Array.from(this.selectedTags);
  }

  public clearSelection(): void {
    this.selectedTags.clear();
    this.callbacks.onFilterTagsChange([]);
    this.render();
  }

  public render(): void {
    const counts = new Map<string, number>();
    for (const note of this.notes) {
      for (const tag of note.tags) {
        if (String(tag).match(/^[0-9]+$/)) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    const sortedTags = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

    const pillsHTML = sortedTags.length > 0
      ? sortedTags.map(([tag, count]) => {
          const isSelected = this.selectedTags.has(tag);
          const bg = isSelected ? '#3182ce' : '#2d3748';
          const fg = isSelected ? '#ffffff' : '#cbd5e1';
          const border = isSelected ? '#63b3ed' : 'transparent';
          const canMerge = count > 1 || sortedTags.length > 1;

          return `
            <div class="faceted-tag-pill" data-tag="${escapeHtml(tag)}" style="display: inline-flex; align-items: center; background: ${bg}; color: ${fg}; border: 1px solid ${border}; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; cursor: pointer; user-select: none; transition: all 0.15s ease;">
              <span class="tag-name">#${escapeHtml(tag)}</span>
              <span class="tag-count" style="margin-left: 4px; font-size: 10px; opacity: 0.75; background: rgba(0,0,0,0.2); padding: 0 5px; border-radius: 8px;">${count}</span>
              ${canMerge ? `<button class="tag-settings-btn" data-tag="${escapeHtml(tag)}" title="Merge / Rename tag" style="background: none; border: none; color: #a0aec0; margin-left: 4px; padding: 0 2px; font-size: 10px; cursor: pointer;">⚙️</button>` : ''}
            </div>
          `;
        }).join('')
      : `<span style="font-size: 11px; color: #718096;">No tags found in vault</span>`;

    const clearBtnHTML = this.selectedTags.size > 0
      ? `<button id="tag-clear-all" style="background: none; border: none; color: #fc8181; font-size: 10px; cursor: pointer; padding: 0;">Clear (${this.selectedTags.size})</button>`
      : '';

    this.container.innerHTML = `
      <div class="faceted-tag-manager" style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.5px;">Faceted Tags</span>
          ${clearBtnHTML}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 160px; overflow-y: auto; padding: 2px;">
          ${pillsHTML}
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    this.container.querySelector('#tag-clear-all')?.addEventListener('click', () => {
      this.clearSelection();
    });

    this.container.querySelectorAll('.faceted-tag-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        // Prevent toggle if settings gear button clicked
        if ((e.target as HTMLElement).classList.contains('tag-settings-btn')) return;

        const tag = pill.getAttribute('data-tag');
        if (!tag) return;

        if (this.selectedTags.has(tag)) {
          this.selectedTags.delete(tag);
        } else {
          this.selectedTags.add(tag);
        }

        this.callbacks.onFilterTagsChange(Array.from(this.selectedTags));
        this.render();
      });
    });

    this.container.querySelectorAll('.tag-settings-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = btn.getAttribute('data-tag');
        if (tag) {
          this.openMergeModal(tag);
        }
      });
    });
  }

  private openMergeModal(oldTag: string): void {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    overlay.innerHTML = `
      <div style="background: #1e2025; border: 1px solid #2d3748; border-radius: 8px; padding: 20px; width: 340px; color: #e2e8f0; font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0; font-size: 15px; color: #64b5f6; display: flex; align-items: center; gap: 6px;">
          ⚙️ Merge / Rename Tag
        </h3>
        <p style="font-size: 12px; color: #a0aec0; margin-bottom: 12px;">
          Merge or rename tag <strong>#${escapeHtml(oldTag)}</strong> across all Markdown notes in your vault.
        </p>
        <div style="margin-bottom: 16px;">
          <label style="font-size: 11px; color: #cbd5e1; display: block; margin-bottom: 4px;">New Tag Name:</label>
          <input type="text" id="merge-tag-input" value="${escapeHtml(oldTag)}" style="width: 100%; background: #121316; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="merge-cancel-btn" style="background: #4a5568; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Cancel</button>
          <button id="merge-confirm-btn" style="background: #3182ce; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">Apply Merge</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#merge-tag-input') as HTMLInputElement;
    input.focus();
    input.select();

    const close = () => overlay.remove();

    overlay.querySelector('#merge-cancel-btn')?.addEventListener('click', close);

    overlay.querySelector('#merge-confirm-btn')?.addEventListener('click', async () => {
      const newTag = input.value.trim().replace(/^#/, '');
      if (!newTag || newTag === oldTag) {
        close();
        return;
      }

      const count = await this.apiStorage.mergeTag(oldTag, newTag);
      alert(`Tag #${oldTag} merged into #${newTag} in ${count} note(s).`);
      close();
      this.callbacks.onTagsUpdated();
    });
  }
}
