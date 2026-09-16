import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost',
});
(global as any).window = dom.window;
(global as any).document = dom.window.document;

import { MainLayout } from '../src/components/ui/MainLayout';
import { Header } from '../src/components/ui/Header';

test('Mobile Responsive UX Test Suite', async t => {
  await t.test('Header renders mobile menu button', () => {
    const container = document.createElement('div');
    new Header(container);

    const mobileBtn = container.querySelector('#mobile-menu-btn');
    assert.notEqual(mobileBtn, null);
    assert.equal(mobileBtn?.getAttribute('aria-label'), 'Toggle mobile navigation menu');
  });

  await t.test('MainLayout manages mobile sidebar toggle', () => {
    const root = document.getElementById('app')!;
    const layout = new MainLayout(root);

    assert.equal(layout.sidebarContainer.classList.contains('mobile-open'), false);

    layout.toggleMobileSidebar();
    assert.equal(layout.sidebarContainer.classList.contains('mobile-open'), true);

    layout.closeMobileSidebar();
    assert.equal(layout.sidebarContainer.classList.contains('mobile-open'), false);
  });
});
