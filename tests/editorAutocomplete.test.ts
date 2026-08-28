import test from 'node:test';
import assert from 'node:assert/strict';
import { matchWikilinkQuery, filterWikilinkCompletions } from '../src/components/editor/wikilinkAutocomplete';
import { WikiNote } from '../src/core/types/wiki';

test('Wikilink Autocomplete Test Suite', async t => {
  const sampleNotes: WikiNote[] = [
    {
      id: 'ai-overview',
      title: 'Artificial Intelligence Overview',
      content: 'Sample',
      folder: 'wiki',
      path: 'wiki/ai-overview.md',
      tags: ['topic/ai'],
      frontmatter: {},
      outboundLinks: [],
      backlinks: [],
    },
    {
      id: 'machine-learning',
      title: 'Machine Learning Fundamentals',
      content: 'Sample',
      folder: 'wiki',
      path: 'wiki/machine-learning.md',
      tags: ['topic/ai'],
      frontmatter: {},
      outboundLinks: [],
      backlinks: [],
    },
  ];

  await t.test('matchWikilinkQuery extracts wikilink trigger and query correctly', () => {
    const res1 = matchWikilinkQuery('Check out [[ai', 14);
    assert.notEqual(res1, null);
    assert.equal(res1?.query, 'ai');
    assert.equal(res1?.from, 12);

    const res2 = matchWikilinkQuery('No wikilink here', 16);
    assert.equal(res2, null);

    const res3 = matchWikilinkQuery('Closed [[already]] here', 23);
    assert.equal(res3, null);
  });

  await t.test('filterWikilinkCompletions filters matching note titles and formats completion items', () => {
    const completions = filterWikilinkCompletions(sampleNotes, 'machine');
    assert.equal(completions.length, 1);
    assert.equal(completions[0].label, 'Machine Learning Fundamentals');
    assert.equal(completions[0].apply, 'machine-learning]]');
  });
});
