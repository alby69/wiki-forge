import type { ViewMode } from '@frontend/store/appStore';

/** Panes that can occupy the central area on their own. */
export type SingleViewMode = 'editor' | 'graph' | 'scratchpad';

export function isSingleView(mode: ViewMode): mode is SingleViewMode {
  return mode === 'editor' || mode === 'graph' || mode === 'scratchpad';
}

/**
 * Decide the next view mode when the user clicks a header toggle.
 *
 * Split is a real toggle: the first click splits the central area, the second
 * one restores the last single pane (Editor by default). Clicking the active
 * single pane closes the central area; clicking another pane shows it full
 * width. This keeps the editor/graph split an explicit choice instead of a
 * side effect of selecting a note.
 */
export function nextViewMode(
  current: ViewMode,
  requested: ViewMode,
  lastSingle: SingleViewMode
): ViewMode {
  if (requested === 'split') {
    return current === 'split' ? lastSingle : 'split';
  }
  if (requested === 'closed') return 'closed';
  if (current === requested) return 'closed';
  return requested;
}

/**
 * CSS `flex` values for the editor and graph panes of the central row.
 *
 * In split mode the two panes keep the ratio the user dragged. In every other
 * mode the single visible pane must fill the whole row: `flex: 0.42` means
 * "grow to 42% and leave the rest empty" (flex-grow < 1), so restoring the
 * split ratio when going back to Editor left a blank strip on the right and,
 * with the divider hidden, no way to fix it — the editor looked like it could
 * not be resized.
 */
export function paneFlexes(
  showEditor: boolean,
  showGraph: boolean,
  editorFlex: number,
  graphFlex: number
): { editor: string; graph: string } {
  if (showEditor && showGraph) {
    return { editor: String(editorFlex), graph: String(graphFlex) };
  }
  return { editor: '1', graph: '1' };
}
