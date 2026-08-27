import { WikiNote } from '../../core/types/wiki';

export class MarkdownEditor {
  private container: HTMLElement;
  private currentNote: WikiNote | null = null;
  private onSaveCb?: (noteId: string, content: string) => void;

  constructor(container: HTMLElement, onSave?: (noteId: string, content: string) => void) {
    this.container = container;
    this.onSaveCb = onSave;
    this.render();
  }

  public setNote(note: WikiNote | null): void {
    this.currentNote = note;
    this.render();
  }

  public render(): void {
    if (!this.currentNote) {
      this.container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #718096; background: #18191c; font-size: 14px;">
          Select a note from the vault or click a graph node to edit.
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="editor-panel-wrapper" style="height: 100%; display: flex; flex-direction: column; background: #18191c; color: #e2e8f0; border-right: 1px solid #2d3748;">
        <div class="editor-header" style="padding: 12px 16px; border-bottom: 1px solid #2d3748; display: flex; justify-content: space-between; align-items: center; background: #121316;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6;">${this.currentNote.title}</h2>
          <span style="font-size: 12px; color: #a0aec0; background: #2d3748; padding: 2px 8px; border-radius: 4px;">${this.currentNote.folder || 'wiki'}</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; padding: 16px;">
          <textarea id="markdown-textarea" style="width: 100%; flex: 1; background: #121316; border: 1px solid #2d3748; color: #e2e8f0; padding: 12px; font-family: monospace; font-size: 13px; line-height: 1.5; resize: none; border-radius: 6px; box-sizing: border-box;">${this.currentNote.content}</textarea>
          <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
            <button id="editor-save-btn" style="background: #3182ce; color: white; border: none; padding: 6px 16px; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 600;">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    const saveBtn = this.container.querySelector('#editor-save-btn');
    const textarea = this.container.querySelector('#markdown-textarea') as HTMLTextAreaElement;

    if (saveBtn && textarea) {
      saveBtn.addEventListener('click', () => {
        if (this.currentNote && this.onSaveCb) {
          this.onSaveCb(this.currentNote.id, textarea.value);
        }
      });
    }
  }
}
