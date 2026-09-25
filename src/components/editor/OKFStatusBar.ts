import { WikiNote } from '../../core/types/wiki';
import { ApiStorage } from '../../storage/ApiStorage';
import { escapeHtml } from '../../core/utils/html';

export interface OKFStatusBarCallbacks {
  onMetadataChanged: (updatedNote: WikiNote) => void;
}

export class OKFStatusBar {
  private container: HTMLElement;
  private apiStorage: ApiStorage;
  private currentNote: WikiNote | null = null;
  private callbacks: OKFStatusBarCallbacks;

  constructor(
    container: HTMLElement,
    apiStorage: ApiStorage,
    callbacks: OKFStatusBarCallbacks
  ) {
    this.container = container;
    this.apiStorage = apiStorage;
    this.callbacks = callbacks;
  }

  public setNote(note: WikiNote | null): void {
    this.currentNote = note;
    this.render();
  }

  public render(): void {
    if (!this.currentNote) {
      this.container.innerHTML = '';
      return;
    }

    const note = this.currentNote;
    const type = (typeof note.frontmatter?.type === 'string' ? note.frontmatter.type : 'Concept');
    const status = note.status || 'draft';
    const trustTier = note.trustTier || 'unverified';

    this.container.innerHTML = `
      <div class="okf-status-bar" style="padding: 6px 16px; background: #18191c; border-bottom: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span style="font-weight: 600; color: #a0aec0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">OKF Metadata:</span>

          <!-- Type Selector -->
          <label style="color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px;">
            Type:
            <select id="okf-type-select" style="background: #2d3748; color: #64b5f6; border: 1px solid #4a5568; border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer; font-weight: 600;">
              <option value="Concept" ${type === 'Concept' ? 'selected' : ''}>📘 Concept</option>
              <option value="Paper" ${type === 'Paper' ? 'selected' : ''}>📄 Paper</option>
              <option value="Tool" ${type === 'Tool' ? 'selected' : ''}>🛠️ Tool</option>
              <option value="Workflow" ${type === 'Workflow' ? 'selected' : ''}>⚡ Workflow</option>
              <option value="Guideline" ${type === 'Guideline' ? 'selected' : ''}>📜 Guideline</option>
              <option value="Thesis" ${type === 'Thesis' ? 'selected' : ''}>🎓 Thesis</option>
            </select>
          </label>

          <!-- Status Selector -->
          <label style="color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px;">
            Status:
            <select id="okf-status-select" style="background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer; font-weight: 600;">
              <option value="draft" ${status === 'draft' ? 'selected' : ''}>✏️ Draft</option>
              <option value="stable" ${status === 'stable' ? 'selected' : ''}>🟢 Stable</option>
              <option value="deprecated" ${status === 'deprecated' ? 'selected' : ''}>⚠️ Deprecated</option>
            </select>
          </label>

          <!-- Trust Tier Selector -->
          <label style="color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px;">
            Trust Tier:
            <select id="okf-trust-select" style="background: #2d3748; color: ${trustTier === 'human-reviewed' ? '#9ae6b4' : trustTier === 'machine-confirmed' ? '#90cdf4' : '#e2e8f0'}; border: 1px solid #4a5568; border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer; font-weight: 600;">
              <option value="human-reviewed" ${trustTier === 'human-reviewed' ? 'selected' : ''}>✓ Human-Reviewed</option>
              <option value="machine-confirmed" ${trustTier === 'machine-confirmed' ? 'selected' : ''}>🤖 Machine-Confirmed</option>
              <option value="unverified" ${trustTier === 'unverified' ? 'selected' : ''}>❓ Unverified</option>
            </select>
          </label>
        </div>

        <span id="okf-status-msg" style="font-size: 11px; color: #48bb78; font-weight: 500;"></span>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.currentNote) return;

    const typeSelect = this.container.querySelector('#okf-type-select') as HTMLSelectElement;
    const statusSelect = this.container.querySelector('#okf-status-select') as HTMLSelectElement;
    const trustSelect = this.container.querySelector('#okf-trust-select') as HTMLSelectElement;
    const msgEl = this.container.querySelector('#okf-status-msg');

    const update = async () => {
      if (!this.currentNote) return;

      const updated = await this.apiStorage.updateMetadata({
        id: this.currentNote.id,
        path: this.currentNote.path,
        type: typeSelect.value,
        status: statusSelect.value,
        trustTier: trustSelect.value as any,
      });

      if (updated) {
        this.currentNote = updated;
        if (msgEl) {
          msgEl.textContent = 'OKF metadata updated ⚡';
          setTimeout(() => { msgEl.textContent = ''; }, 2500);
        }
        this.callbacks.onMetadataChanged(updated);
      }
    };

    typeSelect?.addEventListener('change', update);
    statusSelect?.addEventListener('change', update);
    trustSelect?.addEventListener('change', update);
  }
}
