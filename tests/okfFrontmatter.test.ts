import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureOkfFrontmatter,
  hasOkfType,
  isReservedOkfFile,
} from '@frontend/services/okfFrontmatter';

describe('OKF frontmatter for newly created notes', () => {
  it('adds a minimal valid header to a plain markdown note', () => {
    const result = ensureOkfFrontmatter('# Mia nota\n\nTesto.', 'Mia nota', 'mia-nota.md');
    assert.match(result, /^---\ntype: Note\ntitle: "Mia nota"\n---\n\n# Mia nota/);
    assert.equal(hasOkfType(result), true);
  });

  it('leaves already valid frontmatter byte-for-byte unchanged', () => {
    const original = '---\ntype: Concept\ntitle: "Esistente"\nstatus: stable\n---\n\n# Testo\n';
    assert.equal(ensureOkfFrontmatter(original, 'Ignorato', 'esistente.md'), original);
  });

  it('adds the missing type without dropping existing frontmatter', () => {
    const original = '---\ntitle: "Solo titolo"\nsources: []\n---\n\n# Corpo\n';
    const result = ensureOkfFrontmatter(original, 'Solo titolo', 'solo-titolo.md');
    assert.match(result, /^---\ntitle: "Solo titolo"\nsources: \[\]\ntype: Note\n---\n/);
    assert.match(result, /# Corpo/);
    assert.equal(hasOkfType(result), true);
  });

  it('fills an empty type instead of duplicating the key', () => {
    const result = ensureOkfFrontmatter('---\ntype: \ntitle: X\n---\n\nbody', 'X', 'x.md');
    assert.equal((result.match(/^type:/gm) ?? []).length, 1);
    assert.match(result, /^type: Note$/m);
  });

  it('never touches the OKF reserved filenames', () => {
    assert.equal(isReservedOkfFile('index.md'), true);
    assert.equal(isReservedOkfFile('guida/index.md'), true);
    assert.equal(isReservedOkfFile('log.md'), true);
    assert.equal(isReservedOkfFile('nota.md'), false);
    for (const name of ['index.md', 'guida/index.md', 'log.md']) {
      const plain = '# Indice\n';
      assert.equal(ensureOkfFrontmatter(plain, 'x', name), plain);
    }
  });
});
