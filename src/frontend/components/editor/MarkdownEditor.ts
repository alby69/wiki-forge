import { WikiNote } from '@frontend/core/types/wiki';
import { escapeHtml } from '@frontend/core/utils/html';
import { renderMarkdown } from '@frontend/core/utils/markdown';

import type {
  EditorEngine,
  NoteEditorAdapter,
} from './EditorAdapter';
import { resolveEngine } from './EditorAdapter';
import { CodeMirrorAdapter } from './CodeMirrorAdapter';
import type { ApiStorage } from '@frontend/storage/ApiStorage';
import { actionLabel, actionTitle, getAction, runAction, type ActionDefinition } from '@frontend/core/actions';
import { t } from '@frontend/core/i18n/strings';

export {
  applyAlignment,
  applyColor,
  insertLinePrefix,
  toggleWrapSelection,
  wrapSelection,
} from './editorMarkdownOps';

export interface MarkdownEditorOptions {
  /** Force an engine. `auto` uses Milkdown in real browsers, CodeMirror otherwise. */
  engine?: EditorEngine | 'auto';
  /** Storage used by Milkdown for image uploads. */
  storage?: ApiStorage;
}

/** Typed callback object: the old positional signature remains for compat. */
export interface MarkdownEditorCallbacks {
  onSave?: (noteId: string, content: string, fullContent?: string) => void;
  onOpenLink?: (target: string) => void;
  getNotes?: () => WikiNote[];
  onToggleContext?: () => void;
  onOpenHistory?: () => void;
  onOpenReview?: () => void;
}

type LegacySaveCallback = (noteId: string, content: string, fullContent?: string) => void;

export class MarkdownEditor {
  private container: HTMLElement;
  private currentNote: WikiNote | null = null;
  private mode: 'preview' | 'edit' = 'preview';
  private saveStatusMessage: string = '';
  private onSaveCb?: (noteId: string, content: string, fullContent?: string) => void;
  private onOpenLinkCb?: (target: string) => void;
  private getNotesCb?: () => WikiNote[];
  private onToggleContextCb?: () => void;
  private onOpenHistoryCb?: () => void;
  private onOpenReviewCb?: () => void;
  private contextVisible = false;

  private adapter: NoteEditorAdapter | null = null;
  private renderGeneration = 0;
  private readonly enginePreference: EditorEngine | 'auto';
  private readonly storage?: ApiStorage;
  private onKeyDown: (event: KeyboardEvent) => void = () => {};

  constructor(container: HTMLElement, callbacks?: MarkdownEditorCallbacks, options?: MarkdownEditorOptions);
  constructor(
    container: HTMLElement,
    onSave?: LegacySaveCallback,
    onOpenLink?: (target: string) => void,
    getNotes?: () => WikiNote[],
    onToggleContext?: () => void,
    onOpenHistory?: () => void,
    onOpenReview?: () => void,
    onOpenResearch?: () => void,
    onOpenStudy?: () => void,
    options?: MarkdownEditorOptions
  );
  constructor(
    container: HTMLElement,
    callbacksOrSave?: MarkdownEditorCallbacks | LegacySaveCallback,
    legacyOpenLinkOrOptions?: ((target: string) => void) | MarkdownEditorOptions,
    legacyGetNotes?: () => WikiNote[],
    legacyToggleContext?: () => void,
    legacyHistory?: () => void,
    legacyReview?: () => void,
    _legacyResearch?: () => void,
    _legacyStudy?: () => void,
    options: MarkdownEditorOptions = {}
  ) {
    this.container = container;
    const resolvedOptions: MarkdownEditorOptions =
      typeof legacyOpenLinkOrOptions === 'object' && legacyOpenLinkOrOptions !== null
        ? legacyOpenLinkOrOptions
        : options;
    if (typeof callbacksOrSave === 'function') {
      this.onSaveCb = callbacksOrSave;
      this.onOpenLinkCb = legacyOpenLinkOrOptions as ((target: string) => void) | undefined;
      this.getNotesCb = legacyGetNotes;
      this.onToggleContextCb = legacyToggleContext;
      this.onOpenHistoryCb = legacyHistory;
      this.onOpenReviewCb = legacyReview;
    } else if (callbacksOrSave) {
      this.onSaveCb = callbacksOrSave.onSave;
      this.onOpenLinkCb = callbacksOrSave.onOpenLink;
      this.getNotesCb = callbacksOrSave.getNotes;
      this.onToggleContextCb = callbacksOrSave.onToggleContext;
      this.onOpenHistoryCb = callbacksOrSave.onOpenHistory;
      this.onOpenReviewCb = callbacksOrSave.onOpenReview;
    }
    this.enginePreference = resolvedOptions.engine ?? 'auto';
    this.storage = resolvedOptions.storage;
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
    if (btn) btn.classList.toggle('wf-btn--active', visible);
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

  /** Current engine, exposed for diagnostics and tests. */
  public get engine(): EditorEngine {
    return resolveEngine(this.enginePreference);
  }

  private destroyEditor(target: NoteEditorAdapter | null = this.adapter): void {
    if (this.adapter === target) this.adapter = null;
    if (!target) return;
    void target.destroy().catch(() => {
      // A torn-down editor must never block navigation.
    });
  }

  private saveCurrentContent(): void {
    if (!this.currentNote || !this.onSaveCb) return;
    const content = this.adapter ? this.adapter.getMarkdown() : this.currentNote.content;
    const fullContent = `${this.currentNote.frontmatterRaw ?? ''}${content}`;
    this.onSaveCb(this.currentNote.id, content, fullContent);
  }

  private updateUndoRedoState(): void {
    const undoBtn = this.container.querySelector('#tb-undo') as HTMLButtonElement | null;
    const redoBtn = this.container.querySelector('#tb-redo') as HTMLButtonElement | null;
    if (undoBtn) undoBtn.disabled = !this.adapter?.canUndo();
    if (redoBtn) redoBtn.disabled = !this.adapter?.canRedo();
  }

  private createAdapter(): NoteEditorAdapter | Promise<NoteEditorAdapter> {
    const getNotes = () => (this.getNotesCb ? this.getNotesCb() : []);
    const engine = resolveEngine(this.enginePreference);
    if (engine === 'milkdown') {
      // Loaded on demand: Crepe is ESM-only and must not be evaluated by the
      // Node test runner, which always uses the CodeMirror fallback.
      return import('./milkdown/MilkdownAdapter').then(({ MilkdownAdapter }) =>
        new MilkdownAdapter({
          uploadFile: this.storage
            ? (folder, name, data) => this.storage!.uploadFile(folder, name, data)
            : undefined,
        })
      );
    }
    return new CodeMirrorAdapter(getNotes);
  }

  private renderNoteAction(id: string, elementId: string, variant: string): string {
    const action = getAction(id);
    if (!action) return '';
    const title = escapeHtml(actionTitle(action));
    return `<button id="${elementId}" class="wf-btn wf-btn--sm ${variant}" data-action-key="${id}" title="${title}" aria-label="${title}"><span aria-hidden="true">${action.icon}</span> ${escapeHtml(actionLabel(action))}</button>`;
  }

  /** Render one note-scoped action from the shared catalogue. */
  private noteActions(): Array<{ id: string; elementId: string; variant: string; action: ActionDefinition }> {
    const spec: Array<{ id: string; elementId: string; variant: string }> = [
      { id: 'note:info', elementId: 'editor-context-toggle', variant: 'wf-btn--info' },
      { id: 'note:review', elementId: 'editor-review-btn', variant: 'wf-btn--success' },
      { id: 'note:history', elementId: 'editor-history-btn', variant: '' },
    ];
    return spec
      .map(item => ({ ...item, action: getAction(item.id) }))
      .filter((item): item is { id: string; elementId: string; variant: string; action: ActionDefinition } => Boolean(item.action));
  }

  public render(): void {
    const generation = ++this.renderGeneration;
    const previous = this.adapter;
    this.adapter = null;
    this.container.removeEventListener('keydown', this.onKeyDown);
    if (previous) this.destroyEditor(previous);

    if (!this.currentNote) {
      this.container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--wf-text-muted); background: var(--wf-bg-deep); font-size: 14px;">
          ${escapeHtml(t('noNoteSelected'))}
        </div>
      `;
      return;
    }

    const note = this.currentNote;
    const isPreview = this.mode === 'preview';

    this.container.innerHTML = `
      <div class="editor-panel-wrapper" style="height: 100%; display: flex; flex-direction: column; background: #18191c; color: #e2e8f0; border-right: 1px solid #2d3748;">
        <div class="editor-header" style="padding: 12px 16px; border-bottom: 1px solid #2d3748; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; background: #121316;">
          <h2 style="flex: 1 1 220px; min-width: 0; margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(note.title)}</h2>
          <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; flex: 0 1 auto; min-width: 0; max-width: 100%;">
            <span id="editor-save-status" style="font-size: 12px; color: #48bb78; font-weight: 500;">${escapeHtml(this.saveStatusMessage)}</span>
            <span style="font-size: 12px; color: #a0aec0; background: #2d3748; padding: 2px 8px; border-radius: 4px;">${escapeHtml(note.folder || 'wiki')}</span>
            ${this.noteActions().map(item =>
              this.renderNoteAction(item.id, item.elementId, item.id === 'note:info' && this.contextVisible ? `${item.variant} wf-btn--active` : item.variant)
            ).join('')}
            ${
              isPreview
                ? `<button id="editor-save-btn" class="wf-btn wf-btn--primary">💾 ${escapeHtml(t('save'))}</button>
                   <button id="editor-toggle-btn" class="wf-btn">✏️ ${escapeHtml(t('edit'))}</button>`
                : `<button id="editor-save-close-btn" class="wf-btn wf-btn--primary">💾 ${escapeHtml(t('saveAndClose'))}</button>
                   <button id="editor-cancel-btn" class="wf-btn">✖ ${escapeHtml(t('cancel'))}</button>`
            }
          </div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; padding: 16px; overflow: hidden;">
          ${
            isPreview
              ? `<div id="markdown-preview" class="markdown-body" style="flex: 1; overflow-y: auto; line-height: 1.6; font-size: 14px;">${renderMarkdown(note.content)}</div>`
              : `<div id="cm-editor-wrapper" style="flex: 1; display: flex; flex-direction: column; border: 1px solid #2d3748; border-radius: 6px; overflow: hidden;">
                   <div class="editor-toolbar" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 10px; background: #121316; border-bottom: 1px solid #2d3748; font-size: 12px; user-select: none;">
                     <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-width: 0;">
                       <button id="tb-undo" class="toolbar-btn" title="Annulla (Ctrl+Z)" disabled style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">↩️ Undo</button>
                       <button id="tb-redo" class="toolbar-btn" title="Ripristina (Ctrl+Y)" disabled style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">↪️ Redo</button>
                     </div>
                     <div class="toolbar-divider" style="width: 1px; height: 18px; background: #3d4759; margin: 0 2px;"></div>
                     <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-width: 0;">
                       <button id="tb-bold" class="toolbar-btn" title="Grassetto (Ctrl+B)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-weight: bold; font-size: 12px;">B</button>
                       <button id="tb-italic" class="toolbar-btn" title="Corsivo (Ctrl+I)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-style: italic; font-size: 12px;">I</button>
                       <button id="tb-strike" class="toolbar-btn" title="Barrato (~~strike~~)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; text-decoration: line-through; font-size: 12px;">S</button>
                       <button id="tb-code" class="toolbar-btn" title="Codice (\`code\`)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-family: monospace; font-size: 11px;">&lt;/&gt;</button>
                     </div>
                     <div class="toolbar-divider" style="width: 1px; height: 18px; background: #3d4759; margin: 0 2px;"></div>
                     <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-width: 0;">
                       <select id="tb-heading" class="toolbar-select" title="Intestazione (Header)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 6px; font-size: 12px; cursor: pointer;">
                         <option value="">Header...</option>
                         <option value="h1">H1 - Titolo</option>
                         <option value="h2">H2 - Sezione</option>
                         <option value="h3">H3 - Sottosezione</option>
                       </select>
                       <button id="tb-list-ul" class="toolbar-btn" title="Elenco puntato (- item)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">• Lista</button>
                       <button id="tb-list-ol" class="toolbar-btn" title="Elenco numerato (1. item)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">1. Lista</button>
                       <button id="tb-quote" class="toolbar-btn" title="Citazione (> quote)" style="background: #2d3748; color: #e2e8f0; border: 1px solid #3d4759; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px;">&rdquo; Quote</button>
                     </div>
                     <div class="toolbar-divider" style="width: 1px; height: 18px; background: #3d4759; margin: 0 2px;"></div>
                     <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-width: 0;">
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
                   <div id="cm-editor-container" class="wiki-forge-editor-surface" style="flex: 1; overflow: hidden;"></div>
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
      if (this.onOpenHistoryCb) this.onOpenHistoryCb();
      else runAction('note:history', { noteId: this.currentNote?.id });
    });

    const reviewBtn = this.container.querySelector('#editor-review-btn');
    reviewBtn?.addEventListener('click', () => {
      if (this.onOpenReviewCb) this.onOpenReviewCb();
      else runAction('note:review', { noteId: this.currentNote?.id });
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
      return;
    }

    const editorRoot = this.container.querySelector('#cm-editor-container') as HTMLElement | null;
    if (editorRoot) {
      const setupAdapter = (adapter: NoteEditorAdapter): void => {
        if (generation !== this.renderGeneration) {
          void adapter.destroy();
          return;
        }
        adapter.onChange(() => this.updateUndoRedoState());
        adapter.onWikilinkClick(target => this.onOpenLinkCb?.(target));
        this.adapter = adapter;
        void Promise.resolve(adapter.mount(editorRoot, note.content))
          .then(() => {
            if (generation !== this.renderGeneration) {
              this.destroyEditor(adapter);
              return;
            }
            this.bindToolbarEvents();
            this.updateUndoRedoState();
          })
          .catch(() => {
            // If the engine fails to boot, keep the toolbar usable.
            this.bindToolbarEvents();
            this.updateUndoRedoState();
          });
      };

      const pendingAdapter = this.createAdapter();
      if (pendingAdapter instanceof Promise) {
        void pendingAdapter.then(setupAdapter).catch(() => {
          this.bindToolbarEvents();
          this.updateUndoRedoState();
        });
      } else {
        setupAdapter(pendingAdapter);
      }

      this.onKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          this.saveCurrentContent();
        }
      };
      this.container.addEventListener('keydown', this.onKeyDown);
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

  private bindToolbarEvents(): void {
    const bindClick = (id: string, cb: () => void): void => {
      this.container.querySelector(id)?.addEventListener('click', () => {
        cb();
        this.adapter?.focus();
      });
    };

    const adapter = this.adapter;
    if (!adapter) return;

    bindClick('#tb-undo', () => adapter.undo());
    bindClick('#tb-redo', () => adapter.redo());
    bindClick('#tb-bold', () => adapter.toggleInline('strong'));
    bindClick('#tb-italic', () => adapter.toggleInline('emphasis'));
    bindClick('#tb-strike', () => adapter.toggleInline('strike'));
    bindClick('#tb-code', () => adapter.toggleInline('code'));
    bindClick('#tb-list-ul', () => adapter.applyBlock('bullet-list'));
    bindClick('#tb-list-ol', () => adapter.applyBlock('ordered-list'));
    bindClick('#tb-quote', () => adapter.applyBlock('quote'));

    const headingSelect = this.container.querySelector('#tb-heading') as HTMLSelectElement | null;
    headingSelect?.addEventListener('change', () => {
      const value = headingSelect.value;
      if (/^h[123]$/.test(value)) {
        adapter.applyBlock(value as 'heading1' | 'heading2' | 'heading3');
        headingSelect.value = '';
        adapter.focus();
      }
    });

    const colorSelect = this.container.querySelector('#tb-color') as HTMLSelectElement | null;
    colorSelect?.addEventListener('change', () => {
      const color = colorSelect.value;
      if (color) {
        adapter.insertColor(color);
        colorSelect.value = '';
        adapter.focus();
      }
    });

    const alignSelect = this.container.querySelector('#tb-align') as HTMLSelectElement | null;
    alignSelect?.addEventListener('change', () => {
      const align = alignSelect.value;
      if (align) {
        adapter.insertAlignment(align);
        alignSelect.value = '';
        adapter.focus();
      }
    });
  }
}
