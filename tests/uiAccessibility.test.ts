import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="header-root"></div><div id="sidebar-root"></div><div id="chat-root"></div></body></html>', {
  url: 'http://localhost',
});
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).KeyboardEvent = dom.window.KeyboardEvent;

import { Header } from '../src/components/ui/Header';
import { Sidebar } from '../src/components/ui/Sidebar';
import { ChatDrawer } from '../src/components/chat/ChatDrawer';
import { ConfigManager } from '../src/components/ConfigManager';
import { ToolsModal } from '../src/components/tools/ToolsModal';
import { ApiStorage } from '../src/storage/ApiStorage';

test('UI Accessibility (WCAG 2.1 AA) Test Suite', async t => {
  await t.test('Header buttons have descriptive aria-labels', () => {
    const container = document.getElementById('header-root')!;
    new Header(container);

    const editorBtn = container.querySelector('#view-mode-editor');
    const graphBtn = container.querySelector('#view-mode-graph');
    const splitBtn = container.querySelector('#view-mode-split');
    const toolsBtn = container.querySelector('#header-tools-btn');
    const configBtn = container.querySelector('#header-config-btn');
    const chatBtn = container.querySelector('#chat-toggle-header-btn');

    assert.equal(editorBtn?.getAttribute('aria-label'), 'Switch to Editor view');
    assert.equal(graphBtn?.getAttribute('aria-label'), 'Switch to Graph view');
    assert.equal(splitBtn?.getAttribute('aria-label'), 'Switch to Split view');
    assert.equal(toolsBtn?.getAttribute('aria-label'), 'Open script control panel tools');
    assert.equal(configBtn?.getAttribute('aria-label'), 'Open configuration manager');
    assert.equal(chatBtn?.getAttribute('aria-label'), 'Toggle OpenCode Assistant chat drawer');
  });

  await t.test('Sidebar action buttons and input have aria-labels', async () => {
    const container = document.getElementById('sidebar-root')!;
    const sidebar = new Sidebar(container);
    await sidebar.render();

    const folderBtn = container.querySelector('#btn-new-folder');
    const fileBtn = container.querySelector('#btn-new-file');
    const uploadBtn = container.querySelector('#btn-upload-file');
    const renameBtn = container.querySelector('#btn-rename-item');
    const deleteBtn = container.querySelector('#btn-delete-item');
    const searchInput = container.querySelector('#vault-search-input');

    assert.equal(folderBtn?.getAttribute('aria-label'), 'Create new folder');
    assert.equal(fileBtn?.getAttribute('aria-label'), 'Create new file');
    assert.equal(uploadBtn?.getAttribute('aria-label'), 'Upload file');
    assert.equal(renameBtn?.getAttribute('aria-label'), 'Rename selected item');
    assert.equal(deleteBtn?.getAttribute('aria-label'), 'Delete selected item');
    assert.equal(searchInput?.getAttribute('aria-label'), 'Search vault files');
  });

  await t.test('ChatDrawer header buttons and input have aria-labels', () => {
    const container = document.getElementById('chat-root')!;
    const storage = new ApiStorage();
    new ChatDrawer(container, storage, () => []);

    const clearBtn = container.querySelector('#chat-clear-btn');
    const closeBtn = container.querySelector('#chat-close-btn');
    const input = container.querySelector('#chat-input');
    const sendBtn = container.querySelector('#chat-send-btn');

    assert.equal(clearBtn?.getAttribute('aria-label'), 'Clear chat history');
    assert.equal(closeBtn?.getAttribute('aria-label'), 'Close chat assistant drawer');
    assert.equal(input?.getAttribute('aria-label'), 'Type message for assistant');
    assert.equal(sendBtn?.getAttribute('aria-label'), 'Send message to assistant');
  });

  await t.test('ConfigManager renders as accessible dialog', async () => {
    const storage = new ApiStorage();
    const configManager = new ConfigManager(storage, () => {});
    await configManager.open();

    const dialog = document.querySelector('#config-manager-modal [role="dialog"]');
    assert.notEqual(dialog, null);
    assert.equal(dialog?.getAttribute('aria-modal'), 'true');
    assert.equal(dialog?.getAttribute('aria-labelledby'), 'config-modal-title');

    configManager.close();
  });

  await t.test('ToolsModal renders as accessible dialog', async () => {
    const toolsModal = new ToolsModal();
    await toolsModal.open();

    const dialog = document.querySelector('#tools-modal-root [role="dialog"]');
    assert.notEqual(dialog, null);
    assert.equal(dialog?.getAttribute('aria-modal'), 'true');
    assert.equal(dialog?.getAttribute('aria-labelledby'), 'tools-modal-title');

    toolsModal.close();
  });
});
