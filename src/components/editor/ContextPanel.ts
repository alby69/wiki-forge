import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';

export class ContextPanel {
  private container: HTMLElement;
  private selectedNote: WikiNote | null = null;
  private onNoteSelectCb?: (noteId: string) => void;

  constructor(container: HTMLElement, onNoteSelect?: (noteId: string) => void) {
    this.container = container;
    this.onNoteSelectCb = onNoteSelect;
    this.render();
  }

  public setSelectedNote(note: WikiNote | null): void {
    this.selectedNote = note;
    this.render();
  }

  public render(): void {
    if (!this.selectedNote) {
      this.container.innerHTML = `
        <div style="padding: 16px; color: #718096; font-size: 13px;">
          <h3 style="margin-top: 0; color: #a0aec0; font-size: 14px; font-weight: 600;">Node Metadata & Context</h3>
          <p>No node selected.</p>
        </div>
      `;
      return;
    }

    const backlinksHTML =
      this.selectedNote.backlinks.length > 0
        ? this.selectedNote.backlinks
            .map(
              b =>
                 `<li class="context-link-item" data-note-id="${escapeHtml(b.sourceId)}" style="cursor: pointer; color: #64b5f6; margin-bottom: 6px; font-size: 13px;">[[${escapeHtml(b.sourceTitle)}]]</li>`
            )
            .join('')
        : `<li style="color: #718096; font-size: 12px; list-style: none;">None</li>`;

    const outboundHTML =
      this.selectedNote.outboundLinks.length > 0
        ? this.selectedNote.outboundLinks
            .map(
              target =>
                 `<li class="context-link-item" data-note-id="${escapeHtml(target)}" style="cursor: pointer; color: #81c784; margin-bottom: 6px; font-size: 13px;">[[${escapeHtml(target)}]]</li>`
            )
            .join('')
        : `<li style="color: #718096; font-size: 12px; list-style: none;">None</li>`;

    const tagsHTML =
      this.selectedNote.tags.length > 0
        ? this.selectedNote.tags
            .map(
              t =>
                `<span style="background: #2d3748; color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">#${t}</span>`
            )
            .join('')
        : `<span style="color: #718096; font-size: 12px;">No tags</span>`;

    this.container.innerHTML = `
      <div class="context-panel" style="padding: 16px; background: #121316; height: 100%; color: #e2e8f0; font-size: 13px; box-sizing: border-box; overflow-y: auto;">
        <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #a0aec0; border-bottom: 1px solid #2d3748; padding-bottom: 8px;">Node Metadata</h3>
        <div style="margin-bottom: 16px;">
          <strong style="color: #fff; font-size: 15px;">${escapeHtml(this.selectedNote.title)}</strong>
          <div style="margin-top: 6px;">${tagsHTML}</div>
        </div>

        <h4 style="margin-bottom: 8px; font-size: 12px; color: #a0aec0;">Backlinks (${this.selectedNote.backlinks.length})</h4>
        <ul style="padding-left: 16px; margin-top: 0; margin-bottom: 16px;">
          ${backlinksHTML}
        </ul>

        <h4 style="margin-bottom: 8px; font-size: 12px; color: #a0aec0;">Outbound Links (${this.selectedNote.outboundLinks.length})</h4>
        <ul style="padding-left: 16px; margin-top: 0; margin-bottom: 16px;">
          ${outboundHTML}
        </ul>

        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #2d3748;">
          <h4 style="margin-bottom: 8px; font-size: 12px; color: #a0aec0;">LLM Agent Status</h4>
          <span style="display: inline-block; width: 8px; height: 8px; background: #48bb78; border-radius: 50%; margin-right: 6px;"></span>
          <span style="font-size: 12px; color: #cbd5e1;">Agent Ready (Idle)</span>
        </div>
      </div>
    `;

    const linkItems = this.container.querySelectorAll('.context-link-item');
    linkItems.forEach(item => {
      item.addEventListener('click', () => {
        const noteId = item.getAttribute('data-note-id');
        if (noteId && this.onNoteSelectCb) {
          this.onNoteSelectCb(noteId);
        }
      });
    });
  }
}
