import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectHiddenInstructions } from '@shared/domain/contentSecurity';

const payloads: string[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/security/injection/payloads.json'), 'utf-8'),
);

test('injection suite has at least 20 payloads', () => {
  assert.ok(payloads.length >= 20);
});

test('every injection payload is flagged as risky', () => {
  for (const payload of payloads) {
    const report = detectHiddenInstructions(payload);
    assert.strictEqual(report.risky, true, `payload not flagged: ${payload}`);
  }
});

test('benign text is not flagged', () => {
  const benign = 'Il mercato del lavoro cresce secondo i dati ISTAT del 2024.';
  assert.strictEqual(detectHiddenInstructions(benign).risky, false);
});
