export declare const BASELINE_LINE_COVERAGE: number;

export declare function parseLineCoverage(output: string | null | undefined): number | null;

export declare function evaluateLineCoverage(
  lineCoverage: number | null | undefined,
  baseline?: number,
): { ok: boolean; reason: 'ok' | 'missing' | 'below' };

export declare function runCoverage(): {
  ok: boolean;
  reason: 'ok' | 'missing' | 'below';
  lineCoverage: number | null;
  baseline: number;
};
