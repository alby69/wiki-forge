import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  drawSelection,
  highlightActiveLine,
} from '@codemirror/view';
import { markdown as markdownLanguage } from '@codemirror/lang-markdown';
import {
  defaultKeymap,
  history,
  historyKeymap,
  undo,
  redo,
  undoDepth,
  redoDepth,
} from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

import type {
  BlockFormat,
  InlineFormat,
  NoteEditorAdapter,
} from './EditorAdapter';
import {
  applyAlignment,
  applyColor,
  insertLinePrefix,
  toggleWrapSelection,
} from './editorMarkdownOps';
import { wikilinkAutocompleteSource } from './wikilinkAutocomplete';

const wrappers: Record<InlineFormat, string> = {
  strong: '**',
  emphasis: '*',
  strike: '~~',
  code: '`',
};

const blockPrefixes: Record<BlockFormat, string> = {
  heading1: '# ',
  heading2: '## ',
  heading3: '### ',
  'bullet-list': '- ',
  'ordered-list': '1. ',
  quote: '> ',
};

const placeholders: Record<InlineFormat, string> = {
  strong: 'testo in grassetto',
  emphasis: 'testo in corsivo',
  strike: 'testo barrato',
  code: 'codice',
};

/**
 * Legacy source-view engine. Kept as a capability fallback (and for tests with
 * a mock DOM) so the shell never depends on a fully featured browser.
 */
export class CodeMirrorAdapter implements NoteEditorAdapter {
  readonly engine = 'codemirror' as const;

  private view: EditorView | null = null;
  private changeCb: (body: string) => void = () => {};
  private wikilinkCb: (target: string) => void = () => {};
  private readonly readOnlyCompartment = new Compartment();
  private getNotes: () => unknown[] = () => [];
  private onClick: (event: MouseEvent) => void;

  constructor(getNotes: () => unknown[] = () => []) {
    this.getNotes = getNotes;
    this.onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a.wikilink');
      const raw = link?.getAttribute('data-wikilink');
      if (raw) this.wikilinkCb(raw);
    };
  }

  async mount(root: HTMLElement, markdown: string): Promise<void> {
    const state = EditorState.create({
      doc: markdown,
      extensions: [
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        this.readOnlyCompartment.of(EditorState.readOnly.of(false)),
        markdownLanguage(),
        autocompletion({
          override: [wikilinkAutocompleteSource(this.getNotes as never)],
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            this.changeCb(update.state.doc.toString());
          }
        }),
        keymap.of([
          {
            key: 'Mod-b',
            run: view => toggleWrapSelection(view, wrappers.strong),
          },
          {
            key: 'Mod-i',
            run: view => toggleWrapSelection(view, wrappers.emphasis),
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        wikiForgeEditorTheme,
      ],
    });

    this.view = new EditorView({ state, parent: root });
    root.addEventListener('click', this.onClick);
  }

  getMarkdown(): string {
    return this.view ? this.view.state.doc.toString() : '';
  }

  replace(markdown: string): void {
    if (!this.view) return;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: markdown },
    });
  }

  setReadonly(value: boolean): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(value)),
    });
  }

  onChange(cb: (body: string) => void): void {
    this.changeCb = cb;
  }

  onWikilinkClick(cb: (target: string) => void): void {
    this.wikilinkCb = cb;
  }

  toggleInline(format: InlineFormat): void {
    if (!this.view) return;
    const wrapper = wrappers[format];
    const placeholder = placeholders[format];
    if (format === 'strike') {
      // `toggleWrapSelection` is symmetric; strike is symmetric too.
      toggleWrapSelection(this.view, wrapper);
    } else if (placeholder) {
      const range = this.view.state.selection.main;
      const selected = this.view.state.sliceDoc(range.from, range.to) || placeholder;
      const text = `${wrapper}${selected}${wrapper}`;
      this.view.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: {
          anchor: range.from + wrapper.length,
          head: range.from + wrapper.length + selected.length,
        },
      });
    } else {
      toggleWrapSelection(this.view, wrapper);
    }
  }

  applyBlock(format: BlockFormat): void {
    if (!this.view) return;
    insertLinePrefix(this.view, blockPrefixes[format]);
  }

  insertColor(color: string): void {
    if (this.view && color) applyColor(this.view, color);
  }

  insertAlignment(align: string): void {
    if (this.view && align) applyAlignment(this.view, align);
  }

  undo(): void {
    if (this.view) undo(this.view);
  }

  redo(): void {
    if (this.view) redo(this.view);
  }

  canUndo(): boolean {
    return this.view ? undoDepth(this.view.state) > 0 : false;
  }

  canRedo(): boolean {
    return this.view ? redoDepth(this.view.state) > 0 : false;
  }

  focus(): void {
    this.view?.focus();
  }

  async destroy(): Promise<void> {
    const view = this.view;
    this.view = null;
    if (!view) return;
    const root = view.dom.parentElement;
    root?.removeEventListener('click', this.onClick);
    view.destroy();
  }

}

export const wikiForgeEditorTheme = EditorView.theme({
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
