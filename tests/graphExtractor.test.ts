import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MarkdownParser } from '../src/services/markdownParser';
import { GraphService } from '../src/services/graphService';

describe('Wiki-Forge Graph & Link Extractor Test Suite', () => {
  const parser = new MarkdownParser();
  const graphService = new GraphService();

  test('should extract [[WikiLinks]] correctly without alias', () => {
    const markdown = 'This is a note linking to [[Architecture]] and [[C64 Dev]].';
    const links = parser.extractWikiLinks(markdown);
    assert.deepStrictEqual(links, ['Architecture', 'C64 Dev']);
  });

  test('should extract [[WikiLinks|Alias]] extracting target name', () => {
    const markdown = 'Link to [[Agent Pipeline|LLM Worker Engine]] in text.';
    const links = parser.extractWikiLinks(markdown);
    assert.deepStrictEqual(links, ['Agent Pipeline']);
  });

  test('should parse YAML frontmatter and extract tags', () => {
    const rawContent = `---
title: Test Note
tags: [test, architecture]
---
# Test Note Header
Here is an inline tag #python.
`;
    const { frontmatter, content } = parser.parseFrontmatter(rawContent);
    assert.strictEqual(frontmatter.title, 'Test Note');
    assert.deepStrictEqual(frontmatter.tags, ['test', 'architecture']);

    const tags = parser.extractTags(content, frontmatter.tags as string[]);
    assert.ok(tags.includes('test'));
    assert.ok(tags.includes('architecture'));
    assert.ok(tags.includes('python'));
  });

  test('should not let nested frontmatter keys clobber top-level ones', () => {
    const rawContent = `---
type: Concept
title: Competenze e Risorse Umane
tags: [topic/hr, status/draft]
generated:
  by: process:wiki-forge-compile
  at: "2026-10-09T00:00:00Z"
sources:
  - id: analisi-impatto-ia-lavoro
    resource: raw/analisi-impatto-ia-lavoro_NoteLM_COMPILED.md
    title: "L'Impatto dell'Intelligenza Artificiale sul Lavoro"
    author: process:notebooklm
---
Body.
`;
    const { frontmatter } = parser.parseFrontmatter(rawContent);
    assert.strictEqual(frontmatter.title, 'Competenze e Risorse Umane');
    assert.deepStrictEqual(frontmatter.tags, ['topic/hr', 'status/draft']);
    assert.strictEqual(frontmatter.type, 'Concept');
  });

  test('should extract nested verified actors and derive human-reviewed tier', () => {
    const rawContent = `---
title: Verified Note
status: stable
verified:
  - by: human:alby69
    at: 2026-09-02T12:30:00Z
  - by: process:compile
    at: 2026-09-01T00:00:00Z
---
Body.
`;
    const actors = parser.extractVerifiedActors(rawContent);
    assert.deepStrictEqual(actors, ['human:alby69', 'process:compile']);

    const note = parser.parseNote('verified-note', 'Verified Note', rawContent, 'wiki');
    assert.deepStrictEqual(note.verified, ['human:alby69', 'process:compile']);
    assert.strictEqual(note.trustTier, 'human-reviewed');
  });

  test('should not misreport machine-only or absent verification as human-reviewed', () => {
    const machineOnly = `---\ntitle: Machine\nverified:\n  - by: process:compile\n    at: 2026-09-01T00:00:00Z\n---\nBody.\n`;
    const machineNote = parser.parseNote('machine', 'Machine', machineOnly, 'wiki');
    assert.strictEqual(machineNote.trustTier, 'machine-confirmed');

    const none = `---\ntitle: None\nverified:\n---\nBody.\n`;
    const noneNote = parser.parseNote('none', 'None', none, 'wiki');
    assert.deepStrictEqual(noneNote.verified, []);
    assert.strictEqual(noneNote.trustTier, 'unverified');
  });

  test('should resolve agent-cited sources by relative path with or without .md', () => {
    const note = parser.parseNote(
      'linee-guida-tesi-hr',
      'Linee Guida Tesi HR',
      'Content',
      'analisi',
      'analisi/linee-guida-tesi-hr.md'
    );

    assert.strictEqual(parser.resolveLinkTarget('linee-guida-tesi-hr', [note])?.id, 'linee-guida-tesi-hr');
    assert.strictEqual(parser.resolveLinkTarget('analisi/linee-guida-tesi-hr', [note])?.id, 'linee-guida-tesi-hr');
    assert.strictEqual(parser.resolveLinkTarget('analisi/linee-guida-tesi-hr.md', [note])?.id, 'linee-guida-tesi-hr');
    assert.strictEqual(parser.resolveLinkTarget('./analisi/linee-guida-tesi-hr.md', [note])?.id, 'linee-guida-tesi-hr');
    assert.strictEqual(parser.resolveLinkTarget('analisi/not-exist.md', [note]), null);
  });

  test('should compute backlinks across multiple notes', () => {
    const note1 = parser.parseNote('note1', 'Index', 'Contains [[Note2]] link.');
    const note2 = parser.parseNote('note2', 'Note2', 'Target note content.');

    const notesWithBacklinks = parser.computeBacklinks([note1, note2]);
    const targetNote = notesWithBacklinks.find(n => n.id === 'note2');

    assert.ok(targetNote);
    assert.strictEqual(targetNote.backlinks.length, 1);
    assert.strictEqual(targetNote.backlinks[0].sourceId, 'note1');
  });

  test('should generate decoupled GraphData JSON payload for Graph Viewer', () => {
    const note1 = parser.parseNote('note1', 'Index', 'Link to [[Note2]]', 'wiki');
    const note2 = parser.parseNote('note2', 'Note2', 'Destination', 'wiki');
    const processedNotes = parser.computeBacklinks([note1, note2]);

    const graphData = graphService.generateGraphData(processedNotes);

    assert.strictEqual(graphData.nodes.length, 2);
    assert.strictEqual(graphData.links.length, 1);
    assert.strictEqual(graphData.links[0].source, 'note1');
    assert.strictEqual(graphData.links[0].target, 'note2');
  });

  test('should filter graph nodes based on search query', () => {
    const note1 = parser.parseNote('note1', 'Index', '', 'wiki');
    const note2 = parser.parseNote('note2', 'C64 Development', '', 'wiki');
    const graphData = graphService.generateGraphData([note1, note2]);

    const filtered = graphService.filterGraphData(graphData, { searchQuery: 'C64' });

    assert.strictEqual(filtered.nodes.length, 1);
    assert.strictEqual(filtered.nodes[0].label, 'C64 Development');
  });
});
