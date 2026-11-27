#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASELINE_LINE_COVERAGE = 88.5;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EPSILON = 0.005;

export function parseLineCoverage(output) {
  const lines = String(output ?? '').split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = /^\s*#\s*all files\b[^|]*\|\s*(\d+(?:\.\d+)?)%?\s*\|/.exec(lines[index]);
    if (match) return Number(match[1]);
  }
  return null;
}

export function evaluateLineCoverage(lineCoverage, baseline = BASELINE_LINE_COVERAGE) {
  if (typeof lineCoverage !== 'number' || !Number.isFinite(lineCoverage)) {
    return { ok: false, reason: 'missing' };
  }
  if (lineCoverage + EPSILON < baseline) {
    return { ok: false, reason: 'below' };
  }
  return { ok: true, reason: 'ok' };
}

export function runCoverage() {
  const testFiles = readdirSync(path.join(REPO_ROOT, 'tests'))
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .map((file) => path.join('tests', file));
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--experimental-test-coverage',
      '--test-reporter=tap',
      '--test',
      ...testFiles,
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  return {
    status: result.status,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    error: result.error,
  };
}

function main() {
  const result = runCoverage();
  if (result.error) {
    console.error(`TS coverage gate could not run: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }
  if (result.status !== 0) {
    console.error(result.output);
    process.exitCode = 1;
    return;
  }
  const coverage = parseLineCoverage(result.output);
  const verdict = evaluateLineCoverage(coverage);
  if (!verdict.ok) {
    console.error(`TS line coverage ${coverage ?? 'unknown'}% — ${verdict.reason} baseline ${BASELINE_LINE_COVERAGE.toFixed(2)}%`);
    process.exitCode = 1;
    return;
  }
  console.log(`TS line coverage ${coverage.toFixed(2)}% >= baseline ${BASELINE_LINE_COVERAGE.toFixed(2)}%`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
