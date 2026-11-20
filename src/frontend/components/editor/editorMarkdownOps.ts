import type { EditorView } from '@codemirror/view';

/** Wrap the current selection with symmetric Markdown markers. */
export function toggleWrapSelection(view: EditorView, wrapper: string): boolean {
  return wrapSelection(view, wrapper, wrapper);
}

/** Wrap the current selection with raw Markdown/HTML markers. */
export function wrapSelection(
  view: EditorView,
  before: string,
  after: string = before,
  placeholder: string = ''
): boolean {
  const range = view.state.selection.main;
  const selectedText = view.state.sliceDoc(range.from, range.to) || placeholder;
  const newText = `${before}${selectedText}${after}`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: newText },
    selection: {
      anchor: range.from + before.length,
      head: range.from + before.length + selectedText.length,
    },
  });
  return true;
}

/** Prefix the line under the cursor with a Markdown marker. */
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
  return wrapSelection(view, `<span style="color: ${color};">`, '</span>', 'testo colorato');
}

export function applyAlignment(view: EditorView, align: string): boolean {
  if (!align) return false;
  return wrapSelection(view, `<div align="${align}">\n`, '\n</div>', 'testo allineato');
}
