import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';
import { renderMarkdown } from '../../core/utils/markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { wikilinkAutocompleteSource } from './wikilinkAutocomplete';

export class MarkdownEditor {
  private container: HTMLElement;
  private currentNote: WikiNote | null = null;
  private mode: 'preview' | 'edit' = 'preview';
  private saveStatusMessage: string = '';
  private onSaveCb?: (noteId: string, content: string) => void;
  private onOpenLinkCb?: (target: string) => void;
  private getNotesCb?: () => WikiNote[];
  private editorView: EditorView | null = null;

  constructor(
    container: HTMLElement,
    onSave?: (noteId: string, content: string) => void,
    onOpenLink?: (target: string) => void,
    getNotes?: () => WikiNote[]
  ) {
    this.container = container;
    this.onSaveCb = onSave;
    this.onOpenLinkCb = onOpenLink;
    this.getNotesCb = getNotes;
    this.render();
  }

  public setNotesGetter(fn: () => WikiNote[]): void {
    this.getNotesCb = fn;
  }

  public setNote(note: WikiNote | null): void {
    this.destroyEditor();
    this.currentNote = note;
    this.mode = 'preview';
    this.saveStatusMessage = '';
    this.render();
  }

  public showSaveStatus(msg: string): void {
    this.saveStatusMessage = msg;
    const statusEl = this.container.querySelector('#editor-save-status');
    if (statusEl) {
      statusEl.textContent = msg;
    } else {
      this.render();
    }
    setTimeout(() => {
      this.saveStatusMessage = '';
      const statusEl2 = this.container.querySelector('#editor-save-status');
      if (statusEl2) statusEl2.textContent = '';
    }, 3000);
  }

  private destroyEditor(): void {
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
  }

  private saveCurrentContent(): void {
    if (!this.currentNote || !this.onSaveCb) return;
    const content = this.editorView ? this.editorView.state.doc.toString() : this.currentNote.content;
    this.onSaveCb(this.currentNote.id, content);
  }

  public render(): void {
    this.destroyEditor();

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
            <span id="editor-save-status" style="font-size: 12px; color: #48bb78; font-weight: 500;">${escapeHtml(this.saveStatusMessage)}</span>
            <span style="font-size: 12px; color: #a0aec0; background: #2d3748; padding: 2px 8px; border-radius: 4px;">${escapeHtml(note.folder || 'wiki')}</span>
            ${
              isPreview
                ? `<button id="editor-save-btn" style="background: #3182ce; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">💾 Save</button>
                   <button id="editor-toggle-btn" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">✏️ Edit</button>`
                : `<button id="editor-save-close-btn" style="background: #3182ce; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">💾 Save & Close</button>
                   <button id="editor-cancel-btn" style="background: #4a5568; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">✖ Cancel</button>`
            }
          </div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; padding: 16px; overflow: hidden;">
          ${
            isPreview
              ? `<div id="markdown-preview" class="markdown-body" style="flex: 1; overflow-y: auto; line-height: 1.6; font-size: 14px;">${renderMarkdown(note.content)}</div>`
              : `<div id="codemirror-wrapper" style="flex: 1; display: flex; flex-direction: column; border: 1px solid #2d3748; border-radius: 6px; overflow: hidden;"></div>`
          }
        </div>
      </div>
    `;

    const saveBtn = this.container.querySelector('#editor-save-btn');
    saveBtn?.addEventListener('click', () => {
      this.saveCurrentContent();
    });

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
      const cmWrapper = this.container.querySelector('#codemirror-wrapper') as HTMLElement;
      if (cmWrapper) {
        const state = EditorState.create({
          doc: note.content,
          extensions: [
            history(),
            drawSelection(),
            highlightActiveLine(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            markdown(),
            autocompletion({
              override: [
                wikilinkAutocompleteSource(() => (this.getNotesCb ? this.getNotesCb() : [])),
              ],
            }),
            keymap.of([
              {
                key: 'Mod-s',
                run: () => {
                  this.saveCurrentContent();
                  return true;
                },
              },
              {
                key: 'Mod-b',
                run: (view) => toggleWrapSelection(view, '**'),
              },
              {
                key: 'Mod-i',
                run: (view) => toggleWrapSelection(view, '*'),
              },
              ...defaultKeymap,
              ...historyKeymap,
            ]),
            wikiForgeEditorTheme,
          ],
        });

        this.editorView = new EditorView({
          state,
          parent: cmWrapper,
        });
      }

      const saveCloseBtn = this.container.querySelector('#editor-save-close-btn');
      saveCloseBtn?.addEventListener('click', () => {
        this.saveCurrentContent();
        this.mode = 'preview';
        this.render();
      });

      const cancelBtn = this.container.querySelector('#editor-cancel-btn');
      cancelBtn?.addEventListener('click', () => {
        this.mode = 'preview';
        this.render();
      });
    }
  }
}

function toggleWrapSelection(view: EditorView, wrapper: string): boolean {
  const range = view.state.selection.main;
  const selectedText = view.state.sliceDoc(range.from, range.to);
  const newText = `${wrapper}${selectedText}${wrapper}`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: newText },
    selection: { anchor: range.from + wrapper.length, head: range.to + wrapper.length },
  });
  return true;
}

const wikiForgeEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#121316',
    color: '#e2e8f0',
    fontSize: '13px',
    fontFamily: 'monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
  },
  '.cm-content': {
    caretColor: '#64b5f6',
    padding: '12px',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#64b5f6',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#2b6cb0 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#18191c',
    color: '#718096',
    borderRight: '1px solid #2d3748',
  },
  '.cm-activeLine': {
    backgroundColor: '#1a1d24',
  },
});
