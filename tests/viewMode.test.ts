import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isSingleView, nextViewMode } from '@frontend/core/utils/viewMode';

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
});
