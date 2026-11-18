import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isSingleView, nextViewMode, paneFlexes } from '@frontend/core/utils/viewMode';

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
});
