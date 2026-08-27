import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';
import { renderMarkdown } from '../../core/utils/markdown';

export class MarkdownEditor {
  private container: HTMLElement;
  private currentNote: WikiNote | null = null;
  private mode: 'preview' | 'edit' = 'preview';
  private onSaveCb?: (noteId: string, content: string) => void;
  private onOpenLinkCb?: (target: string) => void;

  constructor(
    container: HTMLElement,
    onSave?: (noteId: string, content: string) => void,
    onOpenLink?: (target: string) => void
  ) {
    this.container = container;
    this.onSaveCb = onSave;
    this.onOpenLinkCb = onOpenLink;
    this.render();
  }

  public setNote(note: WikiNote | null): void {
    this.currentNote = note;
    this.mode = 'preview';
    this.render();
  }

  public render(): void {
    if (!this.currentNote) {
      this.container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #718096; background: #18191c; font-size: 14px;">
          Select a note from the vault or click a graph node to view it.
        </div>
      `;
      return;
    }

    const note = this.currentNote;
    const isPreview = this.mode === 'preview';

    this.container.innerHTML = `
      <div class="editor-panel-wrapper" style="height: 100%; display: flex; flex-direction: column; background: #18191c; color: #e2e8f0; border-right: 1px solid #2d3748;">
        <div class="editor-header" style="padding: 12px 16px; border-bottom: 1px solid #2d3748; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #121316;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(note.title)}</h2>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span style="font-size: 12px; color: #a0aec0; background: #2d3748; padding: 2px 8px; border-radius: 4px;">${escapeHtml(note.folder || 'wiki')}</span>
            <button id="editor-toggle-btn" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">${isPreview ? 'Edit' : 'Preview'}</button>
          </div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; padding: 16px; overflow: hidden;">
          ${
            isPreview
              ? `<div id="markdown-preview" class="markdown-body" style="flex: 1; overflow-y: auto; line-height: 1.6; font-size: 14px;">${renderMarkdown(note.content)}</div>`
              : `<textarea id="markdown-textarea" style="width: 100%; flex: 1; background: #121316; border: 1px solid #2d3748; color: #e2e8f0; padding: 12px; font-family: monospace; font-size: 13px; line-height: 1.5; resize: none; border-radius: 6px; box-sizing: border-box;">${escapeHtml(note.content)}</textarea>`
          }
          ${
            isPreview
              ? ''
              : `<div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                   <button id="editor-save-btn" style="background: #3182ce; color: white; border: none; padding: 6px 16px; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 600;">Save Changes</button>
                 </div>`
          }
        </div>
      </div>
    `;

    const toggleBtn = this.container.querySelector('#editor-toggle-btn');
    toggleBtn?.addEventListener('click', () => {
      this.mode = isPreview ? 'edit' : 'preview';
      this.render();
    });

    if (isPreview) {
      this.container.querySelectorAll('a.wikilink').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          const target = link.getAttribute('data-wikilink');
          if (target && this.onOpenLinkCb) this.onOpenLinkCb(target);
        });
      });
    } else {
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
}
