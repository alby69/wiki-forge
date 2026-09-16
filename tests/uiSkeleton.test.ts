import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});
(global as any).window = dom.window;
(global as any).document = dom.window.document;

import { Skeleton } from '../src/components/ui/Skeleton';

test('Skeleton Loaders Test Suite', async t => {
  await t.test('renderBox produces div with skeleton-box class', () => {
    const html = Skeleton.renderBox('100px', '20px');
    const container = document.createElement('div');
    container.innerHTML = html;

    const box = container.querySelector('.skeleton-box');
    assert.notEqual(box, null);
    assert.match(box?.getAttribute('style') || '', /width: 100px/);
    assert.match(box?.getAttribute('style') || '', /height: 20px/);
  });

  await t.test('renderTree produces tree skeleton loader with aria role', () => {
    const html = Skeleton.renderTree(4);
    const container = document.createElement('div');
    container.innerHTML = html;

    const loader = container.querySelector('.skeleton-tree-loader');
    assert.notEqual(loader, null);
    assert.equal(loader?.getAttribute('role'), 'status');
    assert.equal(loader?.getAttribute('aria-label'), 'Loading vault tree');

    const boxes = container.querySelectorAll('.skeleton-box');
    assert.equal(boxes.length, 8); // 2 boxes per tree item * 4 items
  });

  await t.test('renderChatMessage produces message skeleton loader with aria role', () => {
    const html = Skeleton.renderChatMessage();
    const container = document.createElement('div');
    container.innerHTML = html;

    const msg = container.querySelector('.skeleton-chat-message');
    assert.notEqual(msg, null);
    assert.equal(msg?.getAttribute('role'), 'status');
    assert.equal(msg?.getAttribute('aria-label'), 'Waiting for assistant response');
  });

  await t.test('renderGraph produces graph skeleton loader with aria role', () => {
    const html = Skeleton.renderGraph();
    const container = document.createElement('div');
    container.innerHTML = html;

    const graph = container.querySelector('.skeleton-graph-loader');
    assert.notEqual(graph, null);
    assert.equal(graph?.getAttribute('role'), 'status');
    assert.equal(graph?.getAttribute('aria-label'), 'Initializing graph view');
  });
});
