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
