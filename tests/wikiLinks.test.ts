import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  DocumentMove,
  rewriteDocumentLinks,
  setDocumentTitle,
  slugifyDocumentTitle,
  updateLeadingHeading,
} from '@backend/server/wikiLinks';

describe('Wiki link & title helpers', () => {
  test('slugifyDocumentTitle keeps the chapter number and produces a safe name', () => {
    assert.strictEqual(
      slugifyDocumentTitle(
        "Capitolo 5: Il Quadro Normativo Europeo: L'EU AI Act e la Tutela del Lavoratore",
        'Capitolo 5? Il Quadro Normativo Europeo?'
      ),
      '05-il-quadro-normativo-europeo-leu-ai-act-e-la-tutela-del-lavoratore'
    );

    assert.strictEqual(
      slugifyDocumentTitle('Capitolo 1: Introduzione', '01-introduzione'),
      '01-introduzione'
    );

    assert.strictEqual(slugifyDocumentTitle('Frontespizio e Sinossi', '00-frontespizio-e-sinossi'), '00-frontespizio-e-sinossi');
  });

  test('setDocumentTitle updates an existing title and escapes apostrophes', () => {
    const input = `---
type: Concept
title: Vecchio
status: stable
---
Body
`;

    const updated = setDocumentTitle(input, "L'Impatto dell'IA");
    assert.ok(updated.includes("title: 'L''Impatto dell''IA'"));
    assert.ok(updated.includes('status: stable'));
    assert.ok(updated.includes('Body'));
  });

  test('setDocumentTitle adds frontmatter when missing', () => {
    const updated = setDocumentTitle('# Titolo\n\nTesto\n', 'Nuovo Titolo');
    assert.strictEqual(updated, "---\ntype: Concept\ntitle: 'Nuovo Titolo'\n---\n\n# Titolo\n\nTesto\n");
  });

  test('setDocumentTitle keeps OKF frontmatter valid when type is missing', () => {
    const updated = setDocumentTitle('---\ntitle: Vecchio\n---\nBody\n', 'Nuovo');
    assert.ok(updated.startsWith("---\ntype: Concept\ntitle: 'Nuovo'\n---"));
  });

  test('setDocumentTitle replaces a wrapped multiline title', () => {
    const input = `---
title: 'Capitolo 2: Studio degli Attori
  Principali del Settore AI'
tags: [thesis/chapter]
---
Body
`;
    const updated = setDocumentTitle(input, 'Capitolo 2: Nuovo Titolo');
    assert.ok(updated.includes("title: 'Capitolo 2: Nuovo Titolo'"));
    assert.ok(!updated.includes('Principali del Settore AI'));
    assert.ok(updated.includes('tags: [thesis/chapter]'));
  });

  test('updateLeadingHeading rewrites only a heading equal to the old title', () => {
    const input = `# Capitolo 1: Introduzione\n\nText\n`;
    assert.ok(updateLeadingHeading(input, 'Capitolo 1: Introduzione', 'Capitolo 1: Nuovo').startsWith('# Capitolo 1: Nuovo'));

    const different = `# Un titolo editoriale\n\nText\n`;
    assert.strictEqual(updateLeadingHeading(different, 'Vecchio Titolo', 'Nuovo'), different);
  });

  const moves: DocumentMove[] = [
    {
      old: {
        relPath: 'wiki/capitoli/05-vecchio.md',
        relId: 'capitoli/05-vecchio',
        stem: '05-vecchio',
        title: 'Vecchio Titolo',
      },
      new: {
        relPath: 'wiki/capitoli/05-nuovo.md',
        relId: 'capitoli/05-nuovo',
        stem: '05-nuovo',
        title: 'Nuovo Titolo',
      },
    },
  ];

  test('rewriteDocumentLinks updates path, bare, title and labelled links', () => {
    const input = [
      'Vedi [[capitoli/05-vecchio|Capitolo 5]] e [[05-vecchio]].',
      'Anche [[Vecchio Titolo]] e [[capitoli/05-vecchio#L10-L20]].',
      'Embed ![[05-vecchio]]',
    ].join('\n');

    const report = rewriteDocumentLinks(input, {
      moves,
      sourceRelPath: 'wiki/capitoli/04.md',
      allRelIds: ['capitoli/04', 'capitoli/05-nuovo', 'capitoli/05-vecchio'],
    });

    assert.strictEqual(report.replacements, 5);
    assert.ok(report.content.includes('[[capitoli/05-nuovo|Capitolo 5]]'));
    assert.ok(report.content.includes('[[05-nuovo]]'));
    assert.ok(report.content.includes('[[Nuovo Titolo]]'));
    assert.ok(report.content.includes('[[capitoli/05-nuovo#L10-L20]]'));
    assert.ok(report.content.includes('![[05-nuovo]]'));
  });

  test('rewriteDocumentLinks refreshes a label that repeated the old title', () => {
    const input = 'Vedi [[capitoli/05-vecchio|Vecchio Titolo]] e [[05-vecchio|Capitolo 5]].';
    const report = rewriteDocumentLinks(input, {
      moves,
      sourceRelPath: 'wiki/capitoli/04.md',
      allRelIds: ['capitoli/04', 'capitoli/05-nuovo', 'capitoli/05-vecchio'],
    });

    assert.strictEqual(report.replacements, 2);
    assert.ok(report.content.includes('[[capitoli/05-nuovo|Nuovo Titolo]]'));
    // Editorial labels are preserved.
    assert.ok(report.content.includes('[[05-nuovo|Capitolo 5]]'));
  });

  test('rewriteDocumentLinks updates relative Markdown links', () => {
    const input = 'Vedi [il capitolo](05-vecchio.md) e [ancora](05-vecchio.md#sezione).';
    const report = rewriteDocumentLinks(input, {
      moves,
      sourceRelPath: 'wiki/capitoli/04.md',
      allRelIds: ['capitoli/04', 'capitoli/05-nuovo', 'capitoli/05-vecchio'],
    });

    assert.strictEqual(report.replacements, 2);
    assert.ok(report.content.includes('(05-nuovo.md)'));
    assert.ok(report.content.includes('(05-nuovo.md#sezione)'));
  });

  test('rewriteDocumentLinks never touches code spans or fenced blocks', () => {
    const input = [
      'Inline `[[05-vecchio]]` rest',
      '```md',
      '[[05-vecchio]]',
      '```',
      'Outside [[05-vecchio]]',
    ].join('\n');

    const report = rewriteDocumentLinks(input, {
      moves,
      sourceRelPath: 'wiki/capitoli/04.md',
      allRelIds: ['capitoli/04', 'capitoli/05-nuovo', 'capitoli/05-vecchio'],
    });

    assert.strictEqual(report.replacements, 1);
    assert.ok(report.content.includes('Inline `[[05-vecchio]]` rest'));
    assert.ok(report.content.includes('Outside [[05-nuovo]]'));
  });

  test('rewriteDocumentLinks skips ambiguous bare stems', () => {
    const input = 'Link ambiguo [[05-vecchio]]';
    const report = rewriteDocumentLinks(input, {
      moves,
      sourceRelPath: 'wiki/capitoli/04.md',
      allRelIds: ['capitoli/05-vecchio', 'altri/05-vecchio'],
    });

    assert.strictEqual(report.replacements, 0);
    assert.strictEqual(report.content, input);
  });
});
