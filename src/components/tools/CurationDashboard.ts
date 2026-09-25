import { WikiNote } from '../../core/types/wiki';
import { ApiStorage } from '../../storage/ApiStorage';
import { escapeHtml } from '../../core/utils/html';

export interface CurationDashboardCallbacks {
  onSelectNote: (noteId: string) => void;
  onFixWithAgent: (prompt: string) => void;
}

export class CurationDashboard {
  private apiStorage: ApiStorage;
  private callbacks: CurationDashboardCallbacks;
  private overlay: HTMLElement | null = null;

  constructor(apiStorage: ApiStorage, callbacks: CurationDashboardCallbacks) {
    this.apiStorage = apiStorage;
    this.callbacks = callbacks;
  }

  public async open(): Promise<void> {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'curation-dashboard-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.75)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';

    this.overlay = overlay;
    document.body.appendChild(overlay);

    overlay.innerHTML = `
      <div style="background: #18191c; border: 1px solid #2d3748; border-radius: 8px; width: 900px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column; color: #e2e8f0; font-family: sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.6); overflow: hidden;">
        <div style="padding: 16px 20px; background: #121316; border-bottom: 1px solid #2d3748; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🛡️</span>
            <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6;">Knowledge Curation Dashboard</h2>
          </div>
          <button id="curation-close-btn" style="background: none; border: none; color: #a0aec0; font-size: 20px; cursor: pointer;">&times;</button>
        </div>

        <div id="curation-content" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; justify-content: center; align-items: center; font-size: 13px; color: #a0aec0;">
          <span>Loading curation metrics... ⏳</span>
        </div>
      </div>
    `;

    overlay.querySelector('#curation-close-btn')?.addEventListener('click', () => this.close());
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.close();
    });

    await this.loadAndRenderContent();
  }

  public close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private async loadAndRenderContent(): Promise<void> {
    if (!this.overlay) return;
    const contentEl = this.overlay.querySelector('#curation-content');
    if (!contentEl) return;

    const data = await this.apiStorage.getCuration();

    const inReviewCount = data.inReview.length;
    const orphansCount = data.orphans.length;
    const staleCount = data.stale.length;

    contentEl.innerHTML = `
      <div style="width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; align-items: start;">

        <!-- Card 1: In Review -->
        <div style="background: #1e2025; border: 1px solid #2d3748; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 14px; color: #90cdf4; font-weight: 600;">🤖 In Review (${inReviewCount})</h3>
            <span style="background: #2a4365; color: #90cdf4; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Machine-Confirmed</span>
          </div>
          <div style="flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: 8px;">
            ${
              inReviewCount > 0
                ? data.inReview.map(note => this.renderNoteItem(note, 'inReview')).join('')
                : '<div style="color: #718096; font-size: 12px; padding: 12px 0;">No pending notes to review! 🎉</div>'
            }
          </div>
        </div>

        <!-- Card 2: Orphans -->
        <div style="background: #1e2025; border: 1px solid #2d3748; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 14px; color: #feb2b2; font-weight: 600;">⚠️ Orphan Notes (${orphansCount})</h3>
            <span style="background: #742a2a; color: #feb2b2; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">0 Backlinks</span>
          </div>
          <div style="flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: 8px;">
            ${
              orphansCount > 0
                ? data.orphans.map(note => this.renderNoteItem(note, 'orphans')).join('')
                : '<div style="color: #718096; font-size: 12px; padding: 12px 0;">No orphan notes detected! 🔗</div>'
            }
          </div>
        </div>

        <!-- Card 3: Stale -->
        <div style="background: #1e2025; border: 1px solid #2d3748; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 14px; color: #fbd38d; font-weight: 600;">⏰ Stale Notes (${staleCount})</h3>
            <span style="background: #7b341e; color: #fbd38d; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Needs Update</span>
          </div>
          <div style="flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: 8px;">
            ${
              staleCount > 0
                ? data.stale.map(note => this.renderNoteItem(note, 'stale')).join('')
                : '<div style="color: #718096; font-size: 12px; padding: 12px 0;">All notes are fresh and up to date! 🌿</div>'
            }
          </div>
        </div>

      </div>
    `;

    this.attachItemEvents();
  }

  private renderNoteItem(note: WikiNote, type: 'inReview' | 'orphans' | 'stale'): string {
    const tagsStr = note.tags.length > 0 ? note.tags.map(t => `#${t}`).join(' ') : 'No tags';

    return `
      <div style="background: #121316; border: 1px solid #2d3748; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 6px;">
        <div style="font-weight: 600; color: #e2e8f0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(note.title)}
        </div>
        <div style="font-size: 11px; color: #a0aec0; display: flex; justify-content: space-between;">
          <span>📁 ${escapeHtml(note.folder || 'wiki')}</span>
          <span style="color: #718096;">${escapeHtml(tagsStr)}</span>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
          <button class="curation-open-btn" data-note-id="${escapeHtml(note.id)}" style="background: #2d3748; color: #64b5f6; border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">📖 Open</button>
          <button class="curation-fix-btn" data-note-id="${escapeHtml(note.id)}" data-title="${escapeHtml(note.title)}" data-type="${type}" style="background: #3182ce; color: #ffffff; border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">🪄 Fix with Agent</button>
        </div>
      </div>
    `;
  }

  private attachItemEvents(): void {
    if (!this.overlay) return;

    this.overlay.querySelectorAll('.curation-open-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const noteId = btn.getAttribute('data-note-id');
        if (noteId) {
          this.close();
          this.callbacks.onSelectNote(noteId);
        }
      });
    });

    this.overlay.querySelectorAll('.curation-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-title') || '';
        const noteId = btn.getAttribute('data-note-id') || '';
        const type = btn.getAttribute('data-type');

        let prompt = `/consult Find potential connections, wikilinks, and updates for note [[${title}]] (${noteId}).`;
        if (type === 'orphans') {
          prompt = `/consult Find related notes and suggest outbound/inbound wikilinks for orphan note [[${title}]].`;
        } else if (type === 'inReview') {
          prompt = `/consult Review and verify accuracy, citations, and OKF frontmatter for machine-confirmed note [[${title}]].`;
        } else if (type === 'stale') {
          prompt = `/consult Update outdated information and verify current references for stale note [[${title}]].`;
        }

        this.close();
        this.callbacks.onFixWithAgent(prompt);
      });
    });
  }
}
