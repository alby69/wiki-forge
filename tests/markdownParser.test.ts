import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MarkdownParser } from '@frontend/services/markdownParser';

const parser = new MarkdownParser();

describe('MarkdownParser links and backlinks', () => {
  it('ignores wikilinks shown as syntax inside code', () => {
    // docs/help shows `[[wikilink]]` as an example: it must not become a link,
    // otherwise /audit reports it as broken.
    const content = [
      'Usa `[[wikilink]]` per collegare le note.',
      '',
      '```md',
      '[[altro-esempio]]',
      '```',
      '',
      'Link reale: [[nota-vera]].',
    ].join('\n');

    assert.deepStrictEqual(parser.extractWikiLinks(content), ['nota-vera']);
  });

  it('keeps every note when several files share an id (folder indexes)', () => {
    const notes = [
      parser.parseNote('index', 'Root index', '# Root', 'wiki', 'wiki/index.md'),
      parser.parseNote('index', 'Analisi index', '# Analisi', 'analisi', 'wiki/analisi/index.md'),
      parser.parseNote('index', 'Autori index', '# Autori', 'autori', 'wiki/autori/index.md'),
      parser.parseNote('nota', 'Nota', 'Vedi [[autori/index]].', 'temi', 'wiki/temi/nota.md'),
    ];

    const linked = parser.computeBacklinks(notes);

    assert.strictEqual(linked.length, 4, 'no note may be dropped by an id collision');
    const autoriIndex = linked.find(note => note.path === 'wiki/autori/index.md');
    assert.ok(autoriIndex);
    assert.strictEqual(autoriIndex.backlinks.length, 1);
  });

  it('resolves folder-qualified wikilinks', () => {
    const notes = [
      parser.parseNote('strumenti-note', 'Strumenti', '# Strumenti', 'strumenti', 'wiki/strumenti/strumenti-note.md'),
      parser.parseNote('nota', 'Nota', 'Vedi [[strumenti/strumenti-note]].', 'temi', 'wiki/temi/nota.md'),
    ];

    assert.strictEqual(parser.extractWikiLinks(notes[1].content).length, 1);
    assert.ok(parser.resolveLinkTarget('strumenti/strumenti-note', notes));
  });
});
