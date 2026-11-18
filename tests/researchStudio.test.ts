import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownParser } from '@frontend/services/markdownParser';
import { WikiNote } from '@frontend/core/types/wiki';
import {
  findBacklinks,
  keyTerms,
  searchNotes,
  suggestRelated,
  toNoteRef,
  tokenize,
} from '@backend/server/researchHelpers';

function buildNotes(): WikiNote[] {
  const parser = new MarkdownParser();
  const notes = [
    parser.parseNote(
      'governance-clinica',
      'Governance clinica',
      `---
title: Governance clinica
tags: [governance, salute]
---
# Governance clinica

La governance clinica coordina i percorsi di cura.
Vedi [[comitato-etico]].
`,
      'wiki',
      'wiki/governance-clinica.md'
    ),
    parser.parseNote(
      'comitato-etico',
      'Comitato etico',
      `---
title: Comitato etico
tags: [governance, etica]
---
# Comitato etico

Il comitato etico valuta i protocolli clinici.
Riferimento a [[governance-clinica]].
`,
      'wiki',
      'wiki/comitato-etico.md'
    ),
    parser.parseNote(
      'protocolli',
      'Protocolli clinici',
      `---
title: Protocolli clinici
tags: [clinica]
---
# Protocolli clinici

Linee guida per i percorsi clinici e la governance.
`,
      'wiki',
      'wiki/protocolli.md'
    ),
  ];
  return parser.computeBacklinks(notes);
}

test('Research Studio: tokenize and keyTerms drop stopwords and short tokens', () => {
  const tokens = tokenize('La governance clinica è una pratica della cura');
  assert.deepEqual(tokens.slice(0, 3), ['la', 'governance', 'clinica']);

  const terms = keyTerms('governance clinica governance della clinica cura percorsi');
  assert.ok(terms.includes('governance'));
  assert.ok(terms.includes('clinica'));
  assert.ok(!terms.includes('della'));
  assert.ok(terms.includes('cura'));
});

test('Research Studio: searchNotes ranks title matches and reports lines', () => {
  const notes = buildNotes();
  const result = searchNotes(notes, 'governance clinica');

  assert.equal(result.query, 'governance clinica');
  assert.ok(result.total >= 2);
  assert.equal(result.scanned, notes.length);
  assert.equal(result.results[0].note.id, 'governance-clinica');

  for (const hit of result.results) {
    assert.ok(hit.score > 0);
    assert.ok(hit.matchCount >= 1);
    assert.ok(hit.matches.length >= 1);
    assert.ok(hit.matches[0].line >= 1);
    assert.ok(hit.matches[0].snippet.includes('governance') || hit.matches[0].snippet.toLowerCase().includes('clinica'));
  }
});

test('Research Studio: searchNotes honours the result limit and empty queries', () => {
  const notes = buildNotes();
  const limited = searchNotes(notes, 'clinica', 1);
  assert.equal(limited.results.length, 1);
  assert.ok(limited.total >= 1);

  const empty = searchNotes(notes, '   ');
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.results, []);
});

test('Research Studio: findBacklinks resolves aliases and ignores the target itself', () => {
  const parser = new MarkdownParser();
  const notes = buildNotes();
  const target = notes.find(note => note.id === 'governance-clinica')!;
  const result = findBacklinks(notes, target, (ref, list) => parser.resolveLinkTarget(ref, list));

  assert.equal(result.target.id, 'governance-clinica');
  assert.equal(result.scanned, notes.length);
  assert.ok(result.items.some(item => item.source.id === 'comitato-etico'));
  assert.ok(!result.items.some(item => item.source.id === 'governance-clinica'));
  assert.ok(!result.items.some(item => item.source.id === 'protocolli'));

  for (const item of result.items) {
    assert.ok(item.line >= 1);
    assert.ok(item.snippet.length > 0);
  }
});

test('Research Studio: suggestRelated only proposes notes not linked yet', () => {
  const parser = new MarkdownParser();
  const notes = buildNotes();
  const target = notes.find(note => note.id === 'governance-clinica')!;
  const result = suggestRelated(notes, target, (ref, list) => parser.resolveLinkTarget(ref, list));

  assert.equal(result.target.id, 'governance-clinica');
  assert.ok(!result.suggestions.some(item => item.note.id === 'comitato-etico'));
  const protocolli = result.suggestions.find(item => item.note.id === 'protocolli');
  assert.ok(protocolli);
  assert.ok(protocolli!.score > 0);
  assert.ok(protocolli!.sharedTerms.includes('governance') || protocolli!.sharedTerms.includes('clinici'));
});

test('Research Studio: toNoteRef keeps a folder fallback', () => {
  const notes = buildNotes();
  const ref = toNoteRef(notes[0]);
  assert.equal(ref.id, 'governance-clinica');
  assert.equal(ref.path, 'wiki/governance-clinica.md');
  assert.equal(ref.folder, 'wiki');
});
