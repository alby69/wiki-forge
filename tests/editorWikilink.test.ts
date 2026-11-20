import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseWikilink,
  splitWikilinkText,
  wikilinkNavigationTarget,
} from '@frontend/components/editor/milkdown/wikilinkParsing';
import { resolveEngine } from '@frontend/components/editor/EditorAdapter';

test('parseWikilink handles plain targets', () => {
  assert.deepEqual(parseWikilink('[[target]]'), {
    raw: '[[target]]',
    target: 'target',
    label: 'target',
    anchor: '',
    predicate: '',
  });
});

test('parseWikilink handles custom labels', () => {
  const ref = parseWikilink('[[target|Etichetta]]');
  assert.equal(ref.target, 'target');
  assert.equal(ref.label, 'Etichetta');
});

test('parseWikilink handles predicates', () => {
  const ref = parseWikilink('[[predicate::target|Etichetta]]');
  assert.equal(ref.predicate, 'predicate');
  assert.equal(ref.target, 'target');
  assert.equal(ref.label, 'Etichetta');
});

test('parseWikilink handles anchors', () => {
  const ref = parseWikilink('[[folder/target#Heading|Label]]');
  assert.equal(ref.target, 'folder/target');
  assert.equal(ref.anchor, 'Heading');
  assert.equal(ref.label, 'Label');
});

test('wikilinkNavigationTarget appends anchors and drops labels/predicates', () => {
  assert.equal(wikilinkNavigationTarget('[[target]]'), 'target');
  assert.equal(wikilinkNavigationTarget('[[predicate::target|Label]]'), 'target');
  assert.equal(
    wikilinkNavigationTarget('[[folder/target#Heading|Label]]'),
    'folder/target#Heading'
  );
});

test('splitWikilinkText splits text and wikilink nodes', () => {
  const nodes = splitWikilinkText('Vedi [[a]] e [[b|Label]] fine.');
  assert.deepEqual(nodes, [
    { type: 'text', value: 'Vedi ' },
    { type: 'wikilink', value: '[[a]]' },
    { type: 'text', value: ' e ' },
    { type: 'wikilink', value: '[[b|Label]]' },
    { type: 'text', value: ' fine.' },
  ]);
});

test('splitWikilinkText returns a single text node when no links are present', () => {
  assert.deepEqual(splitWikilinkText('nessun link'), [
    { type: 'text', value: 'nessun link' },
  ]);
});

test('resolveEngine honours explicit preferences', () => {
  assert.equal(resolveEngine('codemirror'), 'codemirror');
  assert.equal(resolveEngine('milkdown'), 'milkdown');
});
