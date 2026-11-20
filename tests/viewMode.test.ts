import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  isSingleView,
  isThreePaneSplit,
  nextViewMode,
  paneFlexes,
  SPLIT_PANE_IDS,
} from '@frontend/core/utils/viewMode';
import { appStore } from '@frontend/store/appStore';

describe('Central area view mode toggle', () => {
  it('opens Split only when the Split toggle is clicked', () => {
    assert.strictEqual(nextViewMode('editor', 'split', 'editor'), 'split');
    assert.strictEqual(nextViewMode('graph', 'split', 'graph'), 'split');
  });

  it('restores the last single pane when Split is clicked again', () => {
    assert.strictEqual(nextViewMode('split', 'split', 'editor'), 'editor');
    assert.strictEqual(nextViewMode('split', 'split', 'graph'), 'graph');
    assert.strictEqual(nextViewMode('split', 'split', 'scratchpad'), 'scratchpad');
  });

  it('clicking a single pane while split shows it full width', () => {
    assert.strictEqual(nextViewMode('split', 'editor', 'editor'), 'editor');
    assert.strictEqual(nextViewMode('split', 'graph', 'editor'), 'graph');
    assert.strictEqual(nextViewMode('split', 'scratchpad', 'editor'), 'scratchpad');
  });

  it('clicking the active single pane closes the central area', () => {
    assert.strictEqual(nextViewMode('editor', 'editor', 'editor'), 'closed');
    assert.strictEqual(nextViewMode('graph', 'graph', 'editor'), 'closed');
  });

  it('identifies single panes', () => {
    assert.strictEqual(isSingleView('editor'), true);
    assert.strictEqual(isSingleView('graph'), true);
    assert.strictEqual(isSingleView('scratchpad'), true);
    assert.strictEqual(isSingleView('split'), false);
    assert.strictEqual(isSingleView('closed'), false);
  });

  it('keeps the dragged ratio only in Split', () => {
    assert.deepStrictEqual(paneFlexes(true, true, 0.35, 0.65), { editor: '0.35', graph: '0.65' });
  });

  it('gives the whole row to the single visible pane', () => {
    // Regression: after resizing in Split, going back to Editor used to leave
    // `flex: 0.35` on the editor and a blank strip on the right, with no
    // divider available to widen it.
    assert.deepStrictEqual(paneFlexes(true, false, 0.35, 0.65), { editor: '1', graph: '1' });
    assert.deepStrictEqual(paneFlexes(false, true, 0.35, 0.65), { editor: '1', graph: '1' });
  });

  it('defines Split as three panes: File, Editor, Grafo', () => {
    assert.deepStrictEqual([...SPLIT_PANE_IDS], ['files', 'editor', 'graph']);
    assert.equal(isThreePaneSplit('split', true), true);
    assert.equal(isThreePaneSplit('split', false), false);
    assert.equal(isThreePaneSplit('editor', true), false);
  });
});

describe('Split reveals the file pane', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    appStore.setFilesVisible(true);
    appStore.setViewMode('editor');
  });

  afterEach(() => {
    appStore.setFilesVisible(true);
    appStore.setViewMode('editor');
  });

  it('entering Split makes the File pane visible in one state update', () => {
    appStore.setFilesVisible(false);
    assert.equal(appStore.getState().filesVisible, false);
    appStore.setViewMode('split');
    assert.equal(appStore.getState().viewMode, 'split');
    assert.equal(appStore.getState().filesVisible, true);
    assert.equal(isThreePaneSplit(appStore.getState().viewMode, appStore.getState().filesVisible), true);
  });

  it('the File pane can still be toggled off after Split', () => {
    appStore.setViewMode('split');
    appStore.toggleFilesVisible();
    assert.equal(isThreePaneSplit(appStore.getState().viewMode, appStore.getState().filesVisible), false);
  });
});
