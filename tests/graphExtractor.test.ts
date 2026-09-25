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

  test('should extract OKF node metadata and filter by OKF criteria', () => {
    const note1 = parser.parseNote('n1', 'Concept Note', '---\ntype: Concept\nstatus: stable\nverified: ["human:agent"]\n---\nBody text [[n2]]', 'wiki');
    const note2 = parser.parseNote('n2', 'Draft Paper', '---\ntype: Paper\nstatus: draft\n---\nDraft content', 'wiki');
    const orphanNote = parser.parseNote('n3', 'Orphan Note', '---\ntype: Tool\nstatus: draft\n---\nNo links here', 'wiki');

    const processed = parser.computeBacklinks([note1, note2, orphanNote]);
    const graphData = graphService.generateGraphData(processed);

    assert.strictEqual(graphData.nodes.length, 3);

    const conceptNode = graphData.nodes.find(n => n.id === 'n1');
    assert.strictEqual(conceptNode?.okfType, 'Concept');
    assert.strictEqual(conceptNode?.trustTier, 'human-reviewed');
    assert.strictEqual(conceptNode?.status, 'stable');

    const orphanNode = graphData.nodes.find(n => n.id === 'n3');
    assert.strictEqual(orphanNode?.isOrphan, true);

    // Test filter: hideDrafts
    const noDrafts = graphService.filterGraphData(graphData, { hideDrafts: true });
    assert.strictEqual(noDrafts.nodes.length, 1);
    assert.strictEqual(noDrafts.nodes[0].id, 'n1');

    // Test filter: showOnlyOrphans
    const onlyOrphans = graphService.filterGraphData(graphData, { showOnlyOrphans: true });
    assert.strictEqual(onlyOrphans.nodes.length, 1);
    assert.strictEqual(onlyOrphans.nodes[0].id, 'n3');

    // Test filter: okfType
    const paperOnly = graphService.filterGraphData(graphData, { okfType: 'Paper' });
    assert.strictEqual(paperOnly.nodes.length, 1);
    assert.strictEqual(paperOnly.nodes[0].id, 'n2');

    // Test maxNodes cap
    const capped = graphService.filterGraphData(graphData, { maxNodes: 2 });
    assert.strictEqual(capped.nodes.length, 2);
  });
});
