import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASELINE_LINE_COVERAGE,
  evaluateLineCoverage,
  parseLineCoverage,
} from '../scripts/check_ts_coverage.mjs';

describe('TS coverage gate', () => {
  it('parses the TAP summary emitted on Node 22', () => {
    const tap = [
      '# start of coverage report',
      '# file | line % | branch % | funcs % | uncovered lines',
      '# all files                            |  92.95 |    79.51 |   88.09 | ',
      '# end of coverage report',
    ].join('\n');
    assert.equal(parseLineCoverage(tap), 92.95);
  });

  it('parses the TAP summary emitted on Node 20', () => {
    const tap = [
      '# start of coverage report',
      '# file | line % | branch % | funcs %',
      '# all files                                                  |  88.89 |    78.34 |   82.53 |',
      '# end of coverage report',
    ].join('\n');
    assert.equal(parseLineCoverage(tap), 88.89);
  });

  it('returns null when the coverage summary is missing', () => {
    assert.equal(parseLineCoverage('# tests 1\n# pass 1\n# fail 0'), null);
    assert.equal(parseLineCoverage(null), null);
  });

  it('fails below the committed baseline and accepts the baseline itself', () => {
    assert.deepEqual(evaluateLineCoverage(BASELINE_LINE_COVERAGE - 0.01), { ok: false, reason: 'below' });
    assert.deepEqual(evaluateLineCoverage(BASELINE_LINE_COVERAGE), { ok: true, reason: 'ok' });
    assert.deepEqual(evaluateLineCoverage(null), { ok: false, reason: 'missing' });
  });
});
