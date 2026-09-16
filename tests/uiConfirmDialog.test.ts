import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><button id="trigger-btn">Open Dialog</button></body></html>', {
  url: 'http://localhost',
});
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).KeyboardEvent = dom.window.KeyboardEvent;

import { ConfirmDialog, confirmAction } from '../src/components/ui/ConfirmDialog';

test('ConfirmDialog Test Suite', async t => {
  t.afterEach(() => {
    const overlay = document.querySelector('.confirm-dialog-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  });

  await t.test('renders modal dialog with aria accessibility attributes', () => {
    const dialog = new ConfirmDialog({
      title: 'Delete File',
      message: 'Are you sure you want to delete this file?',
    });
    dialog.show();

    const overlay = document.querySelector('.confirm-dialog-overlay');
    assert.notEqual(overlay, null);

    const dialogEl = document.querySelector('.confirm-dialog');
    assert.notEqual(dialogEl, null);
    assert.equal(dialogEl?.getAttribute('role'), 'dialog');
    assert.equal(dialogEl?.getAttribute('aria-modal'), 'true');
    assert.equal(dialogEl?.getAttribute('aria-labelledby'), 'confirm-dialog-title');
    assert.equal(dialogEl?.getAttribute('aria-describedby'), 'confirm-dialog-message');

    assert.match(document.getElementById('confirm-dialog-title')?.textContent || '', /Delete File/);
    assert.match(document.getElementById('confirm-dialog-message')?.textContent || '', /Are you sure/);
  });

  await t.test('confirmAction resolves true on confirm button click', async () => {
    let confirmCalled = false;
    const promise = confirmAction({
      title: 'Confirm',
      message: 'Test message',
      onConfirm: () => {
        confirmCalled = true;
      },
    });

    const confirmBtn = document.querySelector('#confirm-dialog-confirm') as HTMLButtonElement;
    assert.notEqual(confirmBtn, null);
    confirmBtn.click();

    const result = await promise;
    assert.equal(result, true);
    assert.equal(confirmCalled, true);
    assert.equal(document.querySelector('.confirm-dialog-overlay'), null);
  });

  await t.test('confirmAction resolves false on cancel button click', async () => {
    let cancelCalled = false;
    const promise = confirmAction({
      title: 'Confirm',
      message: 'Test message',
      onCancel: () => {
        cancelCalled = true;
      },
    });

    const cancelBtn = document.querySelector('#confirm-dialog-cancel') as HTMLButtonElement;
    assert.notEqual(cancelBtn, null);
    cancelBtn.click();

    const result = await promise;
    assert.equal(result, false);
    assert.equal(cancelCalled, true);
    assert.equal(document.querySelector('.confirm-dialog-overlay'), null);
  });

  await t.test('closes and resolves false on Esc key press', async () => {
    const promise = confirmAction({
      title: 'Confirm',
      message: 'Test message',
    });

    const escEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escEvent);

    const result = await promise;
    assert.equal(result, false);
    assert.equal(document.querySelector('.confirm-dialog-overlay'), null);
  });
});
