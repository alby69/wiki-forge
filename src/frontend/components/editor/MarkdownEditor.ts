import { WikiNote } from '@frontend/core/types/wiki';
import { escapeHtml } from '@frontend/core/utils/html';
import { renderMarkdown } from '@frontend/core/utils/markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap, undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
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
  private onToggleContextCb?: () => void;
  private onOpenHistoryCb?: () => void;
  private contextVisible = true;
  private editorView: EditorView | null = null;

  constructor(
    container: HTMLElement,
    onSave?: (noteId: string, content: string) => void,
    onOpenLink?: (target: string) => void,
    getNotes?: () => WikiNote[],
    onToggleContext?: () => void,
    onOpenHistory?: () => void
  ) {
    this.container = container;
    this.onSaveCb = onSave;
    this.onOpenLinkCb = onOpenLink;
    this.getNotesCb = getNotes;
    this.onToggleContextCb = onToggleContext;
    this.onOpenHistoryCb = onOpenHistory;
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

  public setContextVisible(visible: boolean): void {
    this.contextVisible = visible;
    const btn = this.container.querySelector('#editor-context-toggle');
    if (btn) btn.classList.toggle('active', visible);
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

  private updateUndoRedoState(): void {
    if (!this.editorView) return;
    const undoBtn = this.container.querySelector('#tb-undo') as HTMLButtonElement | null;
    const redoBtn = this.container.querySelector('#tb-redo') as HTMLButtonElement | null;
    if (undoBtn) {
      undoBtn.disabled = undoDepth(this.editorView.state) === 0;
    }
    if (redoBtn) {
      redoBtn.disabled = redoDepth(this.editorView.state) === 0;
    }
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
        <div class="editor-header" style="padding: 12px 16px; border-bottom: 1px solid #2d3748; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; background: #121316;">
          <h2 style="flex: 1; min-width: 0; margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(note.title)}</h2>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span id="editor-save-status" style="font-size: 12px; color: #48bb78; font-weight: 500;">${escapeHtml(this.saveStatusMessage)}</span>
            <span style="font-size: 12px; color: #a0aec0; background: #2d3748; padding: 2px 8px; border-radius: 4px;">${escapeHtml(note.folder || 'wiki')}</span>
            <button id="editor-context-toggle" class="editor-info-toggle ${this.contextVisible ? 'active' : ''}" title="Mostra/nascondi Node Metadata, Backlinks e Outbound Links">📊 Node Info</button>
            <button id="editor-history-btn" title="Cronologia delle versioni della nota" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">🕐 Cronologia</button>
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
              : `<div id="codemirror-wrapper" style="flex: 1; display: flex; flex-direction: column; border: 1px solid #2d3748; border-radius: 6px; overflow: hidden;">
                   <div class="editor-toolbar" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 10px; background: #121316; border-bottom: 1px solid #2d3748; font-size: 12px; user-select: none;">
                     <div class="toolbar-group" style="display: flex; gap: 4px; align-items: center;">
                       <button id="tb-undo" class="toolbar-btn" title="Annulla (Ctrl+Z)" disabled style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">↩️ Undo</button>
                       <button id="tb-redo" class="toolbar-btn" title="Ripristina (Ctrl+Y)" disabled style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">↪️ Redo</button>
                     </div>
                     <div class="toolbar-divider" style="width: 1px; height: 18px; background: #3d4759; margin: 0 2px;"></div>
                     <div class="toolbar-group" style="display: flex; gap: 4px; align-items: center;">
                       <button id="tb-bold" class="toolbar-btn" title="Grassetto (**bold**)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-weight: bold; font-size: 12px;">B</button>
                       <button id="tb-italic" class="toolbar-btn" title="Corsivo (*italic*)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-style: italic; font-size: 12px;">I</button>
                       <button id="tb-strike" class="toolbar-btn" title="Barrato (~~strike~~)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; text-decoration: line-through; font-size: 12px;">S</button>
                       <button id="tb-code" class="toolbar-btn" title="Codice (\`code\`)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-family: monospace; font-size: 11px;">&lt;/&gt;</button>
                     </div>
                     <div class="toolbar-divider" style="width: 1px; height: 18px; background: #3d4759; margin: 0 2px;"></div>
                     <div class="toolbar-group" style="display: flex; gap: 4px; align-items: center;">
                       <select id="tb-heading" class="toolbar-select" title="Intestazione (Header)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 6px; font-size: 12px; cursor: pointer;">
                         <option value="">Header...</option>
                         <option value="# ">H1 - Titolo</option>
                         <option value="## ">H2 - Sezione</option>
                         <option value="### ">H3 - Sottosezione</option>
                       </select>
                       <button id="tb-list-ul" class="toolbar-btn" title="Elenco puntato (- item)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">• Lista</button>
                       <button id="tb-list-ol" class="toolbar-btn" title="Elenco numerato (1. item)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">1. Lista</button>
                       <button id="tb-quote" class="toolbar-btn" title="Citazione (> quote)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">&rdquo; Quote</button>
                     </div>
                     <div class="toolbar-divider" style="width: 1px; height: 18px; background: #3d4759; margin: 0 2px;"></div>
                     <div class="toolbar-group" style="display: flex; gap: 4px; align-items: center;">
                       <select id="tb-color" class="toolbar-select" title="Colore del testo" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 6px; font-size: 12px; cursor: pointer;">
                         <option value="">🎨 Colore...</option>
                         <option value="#e53e3e">🔴 Rosso</option>
                         <option value="#dd6b20">🟠 Arancione</option>
                         <option value="#d69e2e">🟡 Giallo</option>
                         <option value="#38a169">🟢 Verde</option>
                         <option value="#3182ce">🔵 Blu</option>
                         <option value="#805ad5">🟣 Viola</option>
                         <option value="#e2e8f0">⚪ Default</option>
                       </select>
                       <select id="tb-align" class="toolbar-select" title="Allineamento del testo" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 6px; font-size: 12px; cursor: pointer;">
                         <option value="">📐 Align...</option>
                         <option value="left">⬅️ Sinistra</option>
                         <option value="center">↔️ Centro</option>
                         <option value="right">➡️ Destra</option>
                         <option value="justify">📄 Giustificato</option>
                       </select>
                     </div>
                   </div>
                   <div id="cm-editor-container" style="flex: 1; overflow: hidden;"></div>
                 </div>`
          }
        </div>
      </div>
    `;

    const saveBtn = this.container.querySelector('#editor-save-btn');
    saveBtn?.addEventListener('click', () => {
      this.saveCurrentContent();
    });

    const contextToggle = this.container.querySelector('#editor-context-toggle');
    contextToggle?.addEventListener('click', () => {
      this.onToggleContextCb?.();
    });

    const historyBtn = this.container.querySelector('#editor-history-btn');
    historyBtn?.addEventListener('click', () => {
      this.onOpenHistoryCb?.();
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
      this.container.querySelectorAll('a.note-link, a.source-link').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          const ref = link.getAttribute('data-note-ref') || link.getAttribute('data-source-file');
          if (ref && this.onOpenLinkCb) {
            this.onOpenLinkCb(ref.replace(/^raw\//i, '').replace(/\.md$/i, ''));
          }
        });
      });
    } else {
      const cmContainer = this.container.querySelector('#cm-editor-container') as HTMLElement;
      if (cmContainer) {
        const state = EditorState.create({
          doc: note.content,
          extensions: [
            history(),
            drawSelection(),
            highlightActiveLine(),
            EditorView.lineWrapping,
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            markdown(),
            autocompletion({
              override: [
                wikilinkAutocompleteSource(() => (this.getNotesCb ? this.getNotesCb() : [])),
              ],
            }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged || update.selectionSet) {
                this.updateUndoRedoState();
              }
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
          parent: cmContainer,
        });

        this.updateUndoRedoState();
        this.bindToolbarEvents();
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

  private bindToolbarEvents(): void {
    if (!this.editorView) return;

    const undoBtn = this.container.querySelector('#tb-undo');
    undoBtn?.addEventListener('click', () => {
      if (this.editorView) {
        undo(this.editorView);
        this.editorView.focus();
      }
    });

    const redoBtn = this.container.querySelector('#tb-redo');
    redoBtn?.addEventListener('click', () => {
      if (this.editorView) {
        redo(this.editorView);
        this.editorView.focus();
      }
    });

    const boldBtn = this.container.querySelector('#tb-bold');
    boldBtn?.addEventListener('click', () => {
      if (this.editorView) {
        wrapSelection(this.editorView, '**', '**', 'testo in grassetto');
        this.editorView.focus();
      }
    });

    const italicBtn = this.container.querySelector('#tb-italic');
    italicBtn?.addEventListener('click', () => {
      if (this.editorView) {
        wrapSelection(this.editorView, '*', '*', 'testo in corsivo');
        this.editorView.focus();
      }
    });

    const strikeBtn = this.container.querySelector('#tb-strike');
    strikeBtn?.addEventListener('click', () => {
      if (this.editorView) {
        wrapSelection(this.editorView, '~~', '~~', 'testo barrato');
        this.editorView.focus();
      }
    });

    const codeBtn = this.container.querySelector('#tb-code');
    codeBtn?.addEventListener('click', () => {
      if (this.editorView) {
        wrapSelection(this.editorView, '`', '`', 'codice');
        this.editorView.focus();
      }
    });

    const headingSelect = this.container.querySelector('#tb-heading') as HTMLSelectElement | null;
    headingSelect?.addEventListener('change', () => {
      const prefix = headingSelect.value;
      if (prefix && this.editorView) {
        insertLinePrefix(this.editorView, prefix);
        headingSelect.value = '';
        this.editorView.focus();
      }
    });

    const listUlBtn = this.container.querySelector('#tb-list-ul');
    listUlBtn?.addEventListener('click', () => {
      if (this.editorView) {
        insertLinePrefix(this.editorView, '- ');
        this.editorView.focus();
      }
    });

    const listOlBtn = this.container.querySelector('#tb-list-ol');
    listOlBtn?.addEventListener('click', () => {
      if (this.editorView) {
        insertLinePrefix(this.editorView, '1. ');
        this.editorView.focus();
      }
    });

    const quoteBtn = this.container.querySelector('#tb-quote');
    quoteBtn?.addEventListener('click', () => {
      if (this.editorView) {
        insertLinePrefix(this.editorView, '> ');
        this.editorView.focus();
      }
    });

    const colorSelect = this.container.querySelector('#tb-color') as HTMLSelectElement | null;
    colorSelect?.addEventListener('change', () => {
      const color = colorSelect.value;
      if (color && this.editorView) {
        applyColor(this.editorView, color);
        colorSelect.value = '';
        this.editorView.focus();
      }
    });

    const alignSelect = this.container.querySelector('#tb-align') as HTMLSelectElement | null;
    alignSelect?.addEventListener('change', () => {
      const align = alignSelect.value;
      if (align && this.editorView) {
        applyAlignment(this.editorView, align);
        alignSelect.value = '';
        this.editorView.focus();
      }
    });
  }
}

export function toggleWrapSelection(view: EditorView, wrapper: string): boolean {
  return wrapSelection(view, wrapper, wrapper);
}

export function wrapSelection(view: EditorView, before: string, after: string = before, placeholder: string = ''): boolean {
  const range = view.state.selection.main;
  const selectedText = view.state.sliceDoc(range.from, range.to) || placeholder;
  const newText = `${before}${selectedText}${after}`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: newText },
    selection: { anchor: range.from + before.length, head: range.from + before.length + selectedText.length },
  });
  return true;
}

export function insertLinePrefix(view: EditorView, prefix: string): boolean {
  const range = view.state.selection.main;
  const line = view.state.doc.lineAt(range.from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
    selection: { anchor: range.from + prefix.length, head: range.to + prefix.length },
  });
  return true;
}

export function applyColor(view: EditorView, color: string): boolean {
  if (!color) return false;
  return wrapSelection(view, `<span style="color: ${color};">`, `</span>`, 'testo colorato');
}

export function applyAlignment(view: EditorView, align: string): boolean {
  if (!align) return false;
  return wrapSelection(view, `<div align="${align}">\n`, `\n</div>`, 'testo allineato');
}

const wikiForgeEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    width: '100%',
    minWidth: '0',
    backgroundColor: '#121316',
    color: '#e2e8f0',
    fontSize: '13px',
    fontFamily: 'monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
  },
  '.cm-scroller': {
    overflow: 'auto',
    minWidth: '0',
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
