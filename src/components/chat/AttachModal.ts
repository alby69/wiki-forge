import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';
import { AttachOptions } from '../../storage/ApiStorage';

export class AttachModal {
  private overlay: HTMLElement;
  private notes: WikiNote[];
  private contentToAttach: string;
  private onSubmitCb: (options: AttachOptions) => void;

  constructor(
    notes: WikiNote[],
    contentToAttach: string,
    onSubmit: (options: AttachOptions) => void
  ) {
    this.notes = notes;
    this.contentToAttach = contentToAttach;
    this.onSubmitCb = onSubmit;
    this.overlay = document.createElement('div');
    this.render();
  }

  public render(): void {
    this.overlay.className = 'attach-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const noteOptions = this.notes
      .map(
        n =>
          `<option value="${escapeHtml(n.id)}">${escapeHtml(n.title)} (${escapeHtml(
            n.folder || 'wiki'
          )})</option>`
      )
      .join('');

    this.overlay.innerHTML = `
      <div style="background: #18191c; border: 1px solid #3d4759; border-radius: 8px; width: 450px; max-width: 90vw; padding: 20px; color: #e2e8f0; font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #2d3748; padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; color: #64b5f6;">📌 Attach Response to Wiki</h3>
          <button id="modal-close-btn" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
          <div>
            <label style="display: block; margin-bottom: 4px; color: #a0aec0;">Select Existing Note:</label>
            <select id="modal-existing-note" style="width: 100%; background: #121316; border: 1px solid #2d3748; color: #e2e8f0; padding: 8px; border-radius: 4px;">
              <option value="">-- Create New Note --</option>
              ${noteOptions}
            </select>
          </div>

          <div>
            <label style="display: block; margin-bottom: 4px; color: #a0aec0;">Or Enter Note Title / ID:</label>
            <input id="modal-note-title" type="text" placeholder="e.g. LLM Agent Architecture" style="width: 100%; background: #121316; border: 1px solid #2d3748; color: #e2e8f0; padding: 8px; border-radius: 4px; box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; margin-bottom: 4px; color: #a0aec0;">Folder:</label>
            <input id="modal-note-folder" type="text" value="wiki" style="width: 100%; background: #121316; border: 1px solid #2d3748; color: #e2e8f0; padding: 8px; border-radius: 4px; box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; margin-bottom: 4px; color: #a0aec0;">Action Mode:</label>
            <select id="modal-attach-mode" style="width: 100%; background: #121316; border: 1px solid #2d3748; color: #e2e8f0; padding: 8px; border-radius: 4px;">
              <option value="append">Append to Note</option>
              <option value="create">Create / Overwrite Note</option>
            </select>
          </div>

          <div>
            <label style="display: block; margin-bottom: 4px; color: #a0aec0;">Content Preview:</label>
            <div style="background: #121316; border: 1px solid #2d3748; padding: 8px; border-radius: 4px; max-height: 100px; overflow-y: auto; font-family: monospace; font-size: 11px; white-space: pre-wrap;">${escapeHtml(this.contentToAttach.slice(0, 300))}${this.contentToAttach.length > 300 ? '...' : ''}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
          <button id="modal-cancel-btn" style="background: #2d3748; color: #e2e8f0; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px;">Cancel</button>
          <button id="modal-submit-btn" style="background: #3182ce; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;">Attach to Wiki</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const closeBtn = this.overlay.querySelector('#modal-close-btn');
    const cancelBtn = this.overlay.querySelector('#modal-cancel-btn');
    const submitBtn = this.overlay.querySelector('#modal-submit-btn');
    const existingSelect = this.overlay.querySelector('#modal-existing-note') as HTMLSelectElement;
    const titleInput = this.overlay.querySelector('#modal-note-title') as HTMLInputElement;
    const folderInput = this.overlay.querySelector('#modal-note-folder') as HTMLInputElement;
    const modeSelect = this.overlay.querySelector('#modal-attach-mode') as HTMLSelectElement;

    const close = (): void => {
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);

    existingSelect?.addEventListener('change', () => {
      const selectedId = existingSelect.value;
      if (selectedId) {
        const found = this.notes.find(n => n.id === selectedId);
        if (found) {
          titleInput.value = found.title;
          folderInput.value = found.folder || 'wiki';
        }
      }
    });

    submitBtn?.addEventListener('click', () => {
      const selectedId = existingSelect.value;
      const title = titleInput.value.trim();
      const folder = folderInput.value.trim() || 'wiki';
      const mode = modeSelect.value as 'append' | 'create' | 'overwrite';

      this.onSubmitCb({
        noteId: selectedId || undefined,
        title: title || undefined,
        folder,
        content: this.contentToAttach,
        mode,
      });

      close();
    });
  }
}
