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
        <div class="context-panel" style="display: flex; align-items: center; gap: 10px; height: 100%; padding: 0 16px; background: #121316; color: #a0aec0; font-size: 13px; box-sizing: border-box;">
          <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #718096;">Node Metadata</span>
          <span style="width: 1px; height: 16px; background: #2d3748;"></span>
          <span>Nessun nodo selezionato.</span>
        </div>
      `;
      return;
    }

    const backlinksHTML =
      this.selectedNote.backlinks.length > 0
        ? this.selectedNote.backlinks
            .map(
              b =>
                `<span class="context-link-item" data-note-id="${escapeHtml(b.sourceId)}" title="${escapeHtml(b.sourceTitle)}" style="display: inline-block; cursor: pointer; color: #64b5f6; background: #1a2332; border: 1px solid #2d4a63; padding: 2px 7px; border-radius: 4px; font-size: 11px; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; vertical-align: top;">[[${escapeHtml(b.sourceTitle)}]]</span>`
            )
            .join('')
        : `<span style="color: #718096; font-size: 11px;">Nessuno</span>`;

    const outboundHTML =
      this.selectedNote.outboundLinks.length > 0
        ? this.selectedNote.outboundLinks
            .map(
              target =>
                `<span class="context-link-item" data-note-id="${escapeHtml(target)}" style="display: inline-block; cursor: pointer; color: #81c784; background: #16261c; border: 1px solid #2d4a37; padding: 2px 7px; border-radius: 4px; font-size: 11px; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; vertical-align: top;">[[${escapeHtml(target)}]]</span>`
            )
            .join('')
        : `<span style="color: #718096; font-size: 11px;">Nessuno</span>`;

    const tagsHTML =
      this.selectedNote.tags.length > 0
        ? this.selectedNote.tags
            .map(
              t =>
                `<span style="display: inline-block; background: #2d3748; color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;">#${escapeHtml(t)}</span>`
            )
            .join('')
        : `<span style="color: #718096; font-size: 11px;">Nessun tag</span>`;

    const trustTier = this.selectedNote.trustTier || 'unverified';
    const status = this.selectedNote.status || 'draft';
    const staleAfter = this.selectedNote.staleAfter;
    const isStale = staleAfter && staleAfter < new Date().toISOString().slice(0, 10);

    let trustBadge = `<span style="display: inline-block; background: #4a5568; color: #cbd5e0; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;">Unverified</span>`;
    if (trustTier === 'human-reviewed') {
      trustBadge = `<span style="display: inline-block; background: #22543d; color: #9ae6b4; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">✓ Human-Reviewed</span>`;
    } else if (trustTier === 'machine-confirmed') {
      trustBadge = `<span style="display: inline-block; background: #2a4365; color: #90cdf4; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">🤖 Machine-Confirmed</span>`;
    }

    let statusBadge = `<span style="display: inline-block; background: #2d3748; color: #a0aec0; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;">${escapeHtml(status)}</span>`;
    if (status === 'stable') {
      statusBadge = `<span style="display: inline-block; background: #1a365d; color: #63b3ed; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">stable</span>`;
    } else if (status === 'deprecated') {
      statusBadge = `<span style="display: inline-block; background: #742a2a; color: #feb2b2; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">⚠️ deprecated</span>`;
    }

    const staleBadge = isStale ? `<span style="display: inline-block; background: #742a2a; color: #feb2b2; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;">⏰ Stale (${escapeHtml(staleAfter ?? '')})</span>` : '';

    const verifiersList = (this.selectedNote.verified || []).length > 0
      ? (this.selectedNote.verified || []).map(v => `<span style="display: inline-block; background: #1a1b1e; border: 1px solid #2d3748; color: #a0aec0; padding: 1px 5px; border-radius: 3px; font-size: 10px; white-space: nowrap;">${escapeHtml(v)}</span>`).join('')
      : `<span style="color: #718096; font-size: 11px;">Nessuno</span>`;

    const section = (label: string, body: string, extra: string = ''): string => `
      <div style="flex: 1 1 0; min-width: 0; padding: 8px 14px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; ${extra}">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #718096; white-space: nowrap;">${label}</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start;">${body}</div>
      </div>
    `;

    this.container.innerHTML = `
      <div class="context-panel" style="display: flex; align-items: stretch; height: 100%; background: #121316; color: #e2e8f0; font-size: 13px; box-sizing: border-box; overflow: hidden;">

        <div style="flex: 0 0 auto; max-width: 300px; padding: 8px 14px; display: flex; flex-direction: column; gap: 5px; border-right: 1px solid #2d3748; overflow-y: auto;">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #718096;">Node Metadata</div>
          <strong style="color: #fff; font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(this.selectedNote.title)}</strong>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">${tagsHTML}</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            ${trustBadge}
            ${statusBadge}
            ${staleBadge}
          </div>
          <div style="font-size: 11px; color: #a0aec0; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
            <strong>Verifiers:</strong> ${verifiersList}
          </div>
        </div>

        ${section(`Backlinks (${this.selectedNote.backlinks.length})`, backlinksHTML, 'border-right: 1px solid #2d3748;')}

        ${section(`Outbound Links (${this.selectedNote.outboundLinks.length})`, outboundHTML, 'border-right: 1px solid #2d3748;')}

        <div style="flex: 0 0 auto; padding: 8px 14px; display: flex; flex-direction: column; gap: 6px; justify-content: center;">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #718096;">LLM Agent</div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 8px; height: 8px; background: #48bb78; border-radius: 50%; flex-shrink: 0;"></span>
            <span style="font-size: 12px; color: #cbd5e1; white-space: nowrap;">Agent Ready (Idle)</span>
          </div>
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