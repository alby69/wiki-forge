import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownParser } from '@frontend/services/markdownParser';
import { WikiNote } from '@frontend/core/types/wiki';
import {
  buildAudioOverview,
  buildMindmap,
  buildQuiz,
  buildStudyGuide,
  buildThesis,
  matchNotesByTopic,
  selectMindmapNote,
  slugifyTopic,
  usableStudyNotes,
} from '@backend/server/studyHelpers';

function buildNotes(): WikiNote[] {
  const parser = new MarkdownParser();
  return [
    parser.parseNote(
      'governance-clinica',
      'Governance clinica',
      `---
title: Governance clinica
tags: [governance, salute]
---
# Governance clinica

La governance clinica coordina i percorsi di cura e i protocolli.

## Ruolo del comitato
Il comitato etico valuta i protocolli.

### Sotto-sezione
Dettaglio operativo.
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
Vedi [[governance-clinica]].
`,
      'wiki',
      'wiki/comitato-etico.md'
    ),
    parser.parseNote(
      'index',
      'Indice',
      `# Indice\n\nElenco delle note.\n`,
      'wiki',
      'wiki/index.md'
    ),
    parser.parseNote(
      '01-introduzione',
      'Introduzione',
      `---
titolo: Introduzione
tipo: capitolo_tesi
capitolo_numero: 1
maturita: 80
---
# Introduzione

Testo del primo capitolo.
`,
      'capitoli',
      'wiki/capitoli/01-introduzione.md'
    ),
    parser.parseNote(
      'modelli-llm',
      'Modelli LLM',
      `---
titolo: Modelli LLM
tipo: sintesi
maturita: 72
---
# Modelli LLM

Sintesi sui modelli linguistici.
`,
      'sintesi',
      'wiki/sintesi/modelli-llm.md'
    ),
    parser.parseNote(
      'bozza-immature',
      'Bozza immatura',
      `---
titolo: Bozza immatura
tipo: sintesi
maturita: 10
---
# Bozza immatura

Non ancora pronta.
`,
      'sintesi',
      'wiki/sintesi/bozza-immature.md'
    ),
  ];
}

test('Study Studio: usableStudyNotes hides structural index/log notes', () => {
  const notes = buildNotes();
  const usable = usableStudyNotes(notes);
  assert.ok(!usable.some(note => note.id === 'index'));
  assert.ok(usable.some(note => note.id === 'governance-clinica'));
});

test('Study Studio: slugifyTopic normalises accents-free slugs', () => {
  assert.equal(slugifyTopic('  Governance Clinica!  '), 'governance-clinica');
  assert.equal(slugifyTopic('   ', 'general'), 'general');
});

test('Study Studio: matchNotesByTopic ranks title matches and ignores index', () => {
  const notes = buildNotes();
  const matches = matchNotesByTopic(notes, 'governance', 5);
  assert.ok(matches.length >= 2);
  assert.equal(matches[0].id, 'governance-clinica');
  assert.ok(!matches.some(note => note.id === 'index'));
});

test('Study Studio: buildStudyGuide writes a frontmatter with real note paths', () => {
  const notes = buildNotes();
  const built = buildStudyGuide(notes, 'governance');

  assert.equal(built.slug, 'governance');
  assert.ok(built.markdown.includes('# Study Guide: governance'));
  assert.ok(built.markdown.includes('Executive Summary'));
  assert.ok(built.markdown.includes('Self-Assessment Questions'));
  assert.ok(built.markdown.includes('  - wiki/governance-clinica.md'));
  assert.ok(!built.markdown.includes('wiki/wiki/'));
  assert.ok(built.sources.some(source => source.id === 'governance-clinica'));
});

test('Study Studio: buildQuiz honours the requested number of questions', () => {
  const notes = buildNotes();

  const three = buildQuiz(notes, 'governance', 3);
  assert.equal(three.count, 3);
  assert.equal((three.markdown.match(/### Question \d+/g) || []).length, 3);

  const eight = buildQuiz(notes, 'governance', 8);
  assert.equal(eight.count, 8);
  assert.equal((eight.markdown.match(/### Question \d+/g) || []).length, 8);

  const capped = buildQuiz(notes, 'governance', 99);
  assert.equal(capped.count, 25);
  assert.equal((capped.markdown.match(/### Question \d+/g) || []).length, 25);
});

test('Study Studio: selectMindmapNote resolves by id, title and heading tree', () => {
  const notes = buildNotes();
  assert.equal(selectMindmapNote(notes, 'governance-clinica')?.id, 'governance-clinica');
  assert.equal(selectMindmapNote(notes, 'Comitato etico')?.id, 'comitato-etico');

  const built = buildMindmap(notes, 'governance-clinica');
  assert.equal(built.note?.id, 'governance-clinica');
  assert.ok(built.nodes.length >= 3);
  assert.ok(built.links.length >= 2);
  assert.ok(built.tree.some(line => line.includes('Ruolo del comitato')));
  assert.ok(built.markdown.includes('ForceGraph Data Payload (JSON)'));
  assert.ok(built.markdown.includes('  - wiki/governance-clinica.md'));
  assert.ok(!built.markdown.includes('wiki/wiki/'));
});

test('Study Studio: buildMindmap reports no match instead of throwing', () => {
  const built = buildMindmap([], 'anything');
  assert.equal(built.note, undefined);
  assert.ok(built.markdown.includes('No matching note found'));
});

test('Study Studio: buildAudioOverview produces a Host A / Host B dialogue', () => {
  const notes = buildNotes();
  const built = buildAudioOverview(notes, 'governance clinica');

  assert.equal(built.slug, 'governance-clinica');
  assert.ok(built.markdown.includes('Audio Overview Dialogue Script'));
  assert.ok(built.markdown.includes('**Host A**'));
  assert.ok(built.markdown.includes('**Host B**'));
  assert.ok(built.sources.some(source => source.id === 'governance-clinica'));
});

test('Study Studio: buildThesis orders chapters and filters syntheses by maturity', () => {
  const notes = buildNotes();
  const built = buildThesis(notes, { topic: 'governance', minMaturity: 50 });

  assert.equal(built.title, 'Tesi: governance');
  assert.equal(built.chapters.length, 1);
  assert.equal(built.chapters[0].number, 1);
  assert.equal(built.chapters[0].title, 'Introduzione');
  assert.equal(built.chapters[0].maturity, 80);

  assert.equal(built.syntheses.length, 1);
  assert.equal(built.syntheses[0].title, 'Modelli LLM');
  assert.ok(!built.syntheses.some(item => item.title === 'Bozza immatura'));

  assert.ok(built.markdown.includes('## Parte I: Capitoli Strutturati'));
  assert.ok(built.markdown.includes('### Capitolo 1: Introduzione'));
  assert.ok(built.markdown.includes('## Parte II: Sintesi e Modelli Concettuali'));
  assert.ok(!built.markdown.includes('titolo: Introduzione'));
});

test('Study Studio: buildThesis explains an empty draft', () => {
  const built = buildThesis([], {});
  assert.equal(built.chapters.length, 0);
  assert.equal(built.syntheses.length, 0);
  assert.ok(built.markdown.includes('Nessun contenuto'));
});
