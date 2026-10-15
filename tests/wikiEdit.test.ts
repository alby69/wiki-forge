import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWikiEdits, stripWikiEdits, isAffirmative } from '@frontend/core/utils/wikiEdit';

test('parseWikiEdits extracts a single well-formed proposal', () => {
  const message = [
    'Ecco la modifica proposta:',
    '',
    '```wiki-edit',
    'file: capitoli/01-introduzione.md',
    'find: |',
    '  Vecchio testo',
    '  su due righe.',
    'replace: |',
    '  Nuovo testo',
    '  sempre su due righe.',
    '```',
    '',
    'Confermi?',
  ].join('\n');

  const edits = parseWikiEdits(message);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].file, 'capitoli/01-introduzione.md');
  assert.equal(edits[0].find, 'Vecchio testo\nsu due righe.');
  assert.equal(edits[0].replace, 'Nuovo testo\nsempre su due righe.');
});

test('parseWikiEdits supports multiple blocks and inline values', () => {
  const message = [
    '```wiki-edit',
    'file: a.md',
    'find: |',
    '  only',
    'replace: |',
    '  ONE',
    '```',
    '',
    '```wiki-edit',
    'file: b.md',
    'find: inline find',
    'replace: inline replace',
    '```',
  ].join('\n');

  const edits = parseWikiEdits(message);
  assert.equal(edits.length, 2);
  assert.equal(edits[0].file, 'a.md');
  assert.equal(edits[1].find, 'inline find');
  assert.equal(edits[1].replace, 'inline replace');
});

test('parseWikiEdits ignores malformed blocks and empty finds', () => {
  const message = [
    '```wiki-edit',
    'file: missing-find.md',
    'replace: |',
    '  nothing',
    '```',
    '```wiki-edit',
    'file: empty-find.md',
    'find: |',
    'replace: |',
    '  x',
    '```',
  ].join('\n');

  assert.deepEqual(parseWikiEdits(message), []);
});

test('parseWikiEdits returns empty for plain messages', () => {
  assert.deepEqual(parseWikiEdits('Nessuna proposta qui.'), []);
  assert.deepEqual(parseWikiEdits(''), []);
});

test('stripWikiEdits removes proposal blocks but keeps the prose', () => {
  const message = 'Intro\n\n```wiki-edit\nfile: a.md\nfind: x\nreplace: y\n```\n\nOutro';
  const clean = stripWikiEdits(message);
  assert.ok(clean.includes('Intro'));
  assert.ok(clean.includes('Outro'));
  assert.ok(!clean.includes('wiki-edit'));
});

test('isAffirmative recognises short confirmations', () => {
  for (const yes of ['sì, procedi', 'Si, procedi', 'ok', 'confermo', 'applica', 'vai pure', 'yes, go ahead', '/apply']) {
    assert.equal(isAffirmative(yes), true, `expected "${yes}" to be affirmative`);
  }
});

test('isAffirmative rejects questions and non-confirmations', () => {
  for (const no of ['no', 'spiegami meglio', 'perché?', 'si può fare una cosa?', 'grazie mille davvero']) {
    assert.equal(isAffirmative(no), false, `expected "${no}" not to be affirmative`);
  }
});
