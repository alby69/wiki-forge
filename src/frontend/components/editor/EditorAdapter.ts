/**
 * Engine contract for the Wiki-Forge note editor.
 *
 * The shell (`MarkdownEditor`) owns the note header, Node Info panel and the
 * save lifecycle. An adapter only owns the Markdown editing surface. This lets
 * us swap the CodeMirror source view for Milkdown/Crepe without leaking
 * editor-specific types into the application.
 */
export type EditorEngine = 'codemirror' | 'milkdown';

export type InlineFormat = 'strong' | 'emphasis' | 'strike' | 'code';
export type BlockFormat =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet-list'
  | 'ordered-list'
  | 'quote';

export interface NoteEditorAdapter {
  readonly engine: EditorEngine;

  /** Mount the engine into `root` with `markdown` as the initial body. */
  mount(root: HTMLElement, markdown: string): Promise<void>;

  /** Current Markdown body, without OKF frontmatter. */
  getMarkdown(): string;

  /** Replace the whole body (used when another note is selected). */
  replace(markdown: string): void;

  /** Toggle read-only mode. */
  setReadonly(value: boolean): void;

  /** Register a listener called whenever the body changes. */
  onChange(cb: (body: string) => void): void;

  /** Register a listener for clicks on `[[wikilinks]]`. */
  onWikilinkClick(cb: (target: string) => void): void;

  /** Toggle an inline mark on the current selection. */
  toggleInline(format: InlineFormat): void;

  /** Apply a block-level format to the current line/selection. */
  applyBlock(format: BlockFormat): void;

  /** Apply a text colour (raw HTML is preserved by the serializer). */
  insertColor(color: string): void;

  /** Apply text alignment (raw HTML is preserved by the serializer). */
  insertAlignment(align: string): void;

  /** Undo / redo through the engine's own history. */
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;

  /** Focus the editing surface. */
  focus(): void;

  /** Tear down the engine and its DOM listeners. */
  destroy(): Promise<void>;
}

/**
 * Capability probe used for the automatic engine choice.
 *
 * Milkdown needs a real browser DOM (ranges, selections, layout). The unit
 * tests use a lightweight mock DOM, so they transparently fall back to the
 * CodeMirror adapter instead of trying to boot ProseMirror in a fake document.
 */
export function isMilkdownSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  if (typeof document.createRange !== 'function') return false;
  const probe = document.createElement('div');
  if (typeof probe.getBoundingClientRect !== 'function') return false;
  if (typeof (window as unknown as { getSelection?: unknown }).getSelection !== 'function') {
    return false;
  }
  return true;
}

export function resolveEngine(preferred: EditorEngine | 'auto' = 'auto'): EditorEngine {
  if (preferred === 'codemirror') return 'codemirror';
  if (preferred === 'milkdown') return 'milkdown';
  return isMilkdownSupported() ? 'milkdown' : 'codemirror';
}
