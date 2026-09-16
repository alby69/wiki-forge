import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);

import { ToastManager, showToast, useToast } from '../src/components/ui/Toast';

test('Toast Notifications Test Suite', async t => {
  t.afterEach(() => {
    document.body.innerHTML = '';
  });

  await t.test('shows toast with default info variant', () => {
    showToast('Hello world');
    const container = document.getElementById('toast-container');
    assert.notEqual(container, null);
    assert.equal(container?.getAttribute('aria-live'), 'polite');

    const toast = container?.querySelector('.toast-info');
    assert.notEqual(toast, null);
    assert.equal(toast?.getAttribute('role'), 'status');
    assert.match(toast?.textContent || '', /Hello world/);
  });

  await t.test('shows error toast with alert role', () => {
    showToast({ message: 'Error occurred', variant: 'error' });
    const toast = document.querySelector('.toast-error');
    assert.notEqual(toast, null);
    assert.equal(toast?.getAttribute('role'), 'alert');
    assert.match(toast?.textContent || '', /Error occurred/);
  });

  await t.test('useToast hook helper functions render correct variants', () => {
    const toast = useToast();
    toast.success('Success msg');
    toast.warning('Warning msg');

    assert.notEqual(document.querySelector('.toast-success'), null);
    assert.notEqual(document.querySelector('.toast-warning'), null);
  });

  await t.test('manual close button dismisses toast', async () => {
    showToast({ message: 'Closable toast', duration: 0, closable: true });
    const toast = document.querySelector('.toast');
    assert.notEqual(toast, null);

    const closeBtn = toast?.querySelector('button');
    assert.notEqual(closeBtn, null);
    assert.equal(closeBtn?.getAttribute('aria-label'), 'Close notification');

    closeBtn?.click();
    await new Promise(res => setTimeout(res, 300));
    assert.equal(document.querySelector('.toast'), null);
  });
});
