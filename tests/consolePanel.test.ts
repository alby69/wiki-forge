import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  clampConsoleHeight,
  CONSOLE_MAX_HEIGHT,
  CONSOLE_MIN_HEIGHT,
  CONSOLE_RESERVED_TOP_SPACE,
} from '@frontend/core/utils/consolePanel';

describe('KE Workbench console panel sizing', () => {
  it('keeps an in-range height unchanged', () => {
    assert.strictEqual(clampConsoleHeight(280), 280);
  });

  it('clamps heights outside the global bounds', () => {
    assert.strictEqual(clampConsoleHeight(-50), CONSOLE_MIN_HEIGHT);
    assert.strictEqual(clampConsoleHeight(9999), CONSOLE_MAX_HEIGHT);
  });

  it('falls back to the minimum for invalid stored values', () => {
    assert.strictEqual(clampConsoleHeight(Number.NaN), CONSOLE_MIN_HEIGHT);
    assert.strictEqual(clampConsoleHeight(Number.POSITIVE_INFINITY), CONSOLE_MIN_HEIGHT);
  });

  it('always leaves room for the Use Case pane', () => {
    const containerHeight = 600;
    const max = containerHeight - CONSOLE_RESERVED_TOP_SPACE;
    assert.strictEqual(clampConsoleHeight(500, containerHeight), max);
    assert.strictEqual(clampConsoleHeight(max - 20, containerHeight), max - 20);
  });

  it('never grows past the global maximum, even in a tall window', () => {
    assert.strictEqual(clampConsoleHeight(2000, 2000), CONSOLE_MAX_HEIGHT);
  });

  it('degrades safely in a very short window', () => {
    assert.strictEqual(clampConsoleHeight(280, 200), CONSOLE_MIN_HEIGHT);
  });
});
