import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '../src/server/agentServer';
import { LlmClient } from '../src/server/llmClient';
import { ApiStorage } from '../src/storage/ApiStorage';

test('AgentServer & ApiStorage Integration Test Suite', async t => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp-vault-' + Date.now());
  const wikiDir = path.join(tmpDir, 'wiki');

  await fs.mkdir(wikiDir, { recursive: true });
  await fs.writeFile(
    path.join(wikiDir, 'sample-note.md'),
    `---
title: Sample Note
tags: [test]
---
# Sample Note

This is a test note linking to [[other-note]].
`,
    'utf-8'
  );

  // Deterministic mock so /consult does not spawn the real opencode CLI.
  const mockClient: LlmClient = {
    complete: async () => '### 🔍 Consult Synthesis (Mock)\n\nBased on [[sample-note]].',
  };

  const serverInstance = new AgentServer(tmpDir, mockClient);

  const server = http.createServer(async (req, res) => {
    const handled = await serverInstance.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;
  const apiStorage = new ApiStorage(baseUrl);

  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  await t.test('GET /api/wiki/notes returns list of notes', async () => {
    const notes = await apiStorage.getAllNotes();
    assert.equal(notes.length, 1);
    assert.equal(notes[0].id, 'sample-note');
    assert.equal(notes[0].title, 'Sample Note');
    assert.ok(notes[0].outboundLinks.includes('other-note'));
  });

  await t.test('POST /api/wiki/save persists markdown note on disk', async () => {
    const saved = await apiStorage.saveNote({
      id: 'new-note',
      title: 'New Note',
      folder: 'wiki',
      content: '# New Note\n\nContent saved from UI.',
    });

    assert.equal(saved.id, 'new-note');
    assert.equal(saved.title, 'New Note');

    const fileOnDisk = await fs.readFile(path.join(wikiDir, 'new-note.md'), 'utf-8');
    assert.ok(fileOnDisk.includes('Content saved from UI.'));
  });

  await t.test('POST /api/wiki/attach appends response to note', async () => {
    const attached = await apiStorage.attachNote({
      noteId: 'sample-note',
      content: 'Extra response from agent.',
      mode: 'append',
    });

    assert.equal(attached.id, 'sample-note');
    const fileOnDisk = await fs.readFile(path.join(wikiDir, 'sample-note.md'), 'utf-8');
    assert.ok(fileOnDisk.includes('## Attached Note'));
    assert.ok(fileOnDisk.includes('Extra response from agent.'));
  });

  await t.test('POST /api/chat handles slash commands (/consult, /audit, /compile, /reindex)', async () => {
    const consultReply = await apiStorage.sendChat('/consult sample');
    assert.ok(consultReply.includes('Consult Synthesis'));

    const auditReply = await apiStorage.sendChat('/audit');
    assert.ok(auditReply.includes('Audit Report'));

    const compileReply = await apiStorage.sendChat('/compile');
    assert.ok(compileReply.includes('Compile Workflow Completed'));

    const reindexReply = await apiStorage.sendChat('/reindex');
    assert.ok(reindexReply.includes('Reindex Complete'));
  });
});
