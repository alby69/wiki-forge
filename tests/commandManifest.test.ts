import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { ROUTES } from '@shared/api/contracts';
import {
  COMMAND_MANIFEST,
  OPERATION_IDS,
} from '@shared/api/generated/commandManifest.generated';
import { deriveCommandManifest } from '../scripts/lib/commandManifest.mjs';

const BASELINE = path.resolve('tests', 'fixtures', 'known-command-gaps.json');

function gapKeys(gaps: ReadonlyArray<{ readonly kind: string; readonly id: string }>): string[] {
  return gaps.map((gap) => `${gap.kind}:${gap.id}`).sort();
}

describe('Command manifest — Fase 0 del piano di disaccoppiamento', () => {
  it('il manifest generato corrisponde all/inventario derivato dal codice', async () => {
    const derived = await deriveCommandManifest();
    assert.deepEqual(COMMAND_MANIFEST, derived);
  });

  it('gli operation id sono univoci e coprono tutte le route dichiarate', () => {
    assert.equal(COMMAND_MANIFEST.routes.length, ROUTES.length);
    assert.equal(new Set(OPERATION_IDS).size, OPERATION_IDS.length);
    assert.deepEqual([...OPERATION_IDS].sort(), ROUTES.map((route) => route.id).sort());
  });

  it('i gap sono esattamente quelli accettati nella baseline', async () => {
    const baseline = JSON.parse(await readFile(BASELINE, 'utf-8')) as { gaps: string[] };
    const current = gapKeys(COMMAND_MANIFEST.gaps);
    const added = current.filter((gap) => !baseline.gaps.includes(gap));
    const resolved = baseline.gaps.filter((gap) => !current.includes(gap));

    assert.deepEqual(
      { added, resolved },
      { added: [], resolved: [] },
      `Nuovi gap: ${added.join(', ') || 'nessuno'}; gap risolti da registrare: ${resolved.join(', ') || 'nessuno'}`,
    );
  });

  it('ogni handler bus dichiarato è univoco', () => {
    assert.equal(new Set(COMMAND_MANIFEST.busCommands).size, COMMAND_MANIFEST.busCommands.length);
  });
});
