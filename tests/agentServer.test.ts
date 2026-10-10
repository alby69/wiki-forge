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

  await t.test('POST /api/chat /verify records human verification and sets trust tier', async () => {
    await fs.writeFile(
      path.join(wikiDir, 'human-target.md'),
      `---
title: Human Target
status: draft
tags: [test]
---
# Human Target

Body of the target note.
`,
      'utf-8'
    );

    const reply = await apiStorage.sendChat('/verify human-target reviewer=studente stable');
    assert.ok(reply.includes('Human Verification Recorded'));
    assert.ok(reply.includes('human-reviewed'));

    const notes = await apiStorage.getAllNotes();
    const target = notes.find(n => n.id === 'human-target');
    assert.ok(target);
    assert.equal(target.trustTier, 'human-reviewed');
    assert.equal(target.status, 'stable');

    const onDisk = await fs.readFile(path.join(wikiDir, 'human-target.md'), 'utf-8');
    assert.ok(onDisk.includes('by: human:studente'));
    assert.ok(onDisk.includes('status: stable'));

    const log = await fs.readFile(path.join(wikiDir, 'log.md'), 'utf-8');
    assert.ok(log.includes('Human-verified'));
  });

  await t.test('GET /api/wiki/scratchpad parses quick notes from notes/quick-notes.md', async () => {
    const notesDir = path.join(tmpDir, 'notes');
    await fs.mkdir(notesDir, { recursive: true });
    await fs.writeFile(
      path.join(notesDir, 'quick-notes.md'),
      `# Quick Notes Scratchpad\n\nNotes recorded here remain unindexed until promoted with \`/promote-note\`.\n\n## [2026-10-10 14:58:13]\nnota di prova\n\n## [2026-10-11 09:30:00]\nseconda nota su due righe\ncontinua\n`,
      'utf-8'
    );

    const entries = await apiStorage.getScratchpad();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].id, '2026-10-10-14-58-13');
    assert.equal(entries[0].timestamp, '2026-10-10 14:58:13');
    assert.equal(entries[0].text, 'nota di prova');
    assert.equal(entries[1].id, '2026-10-11-09-30-00');
    assert.ok(entries[1].text.includes('continua'));
  });

  await t.test('POST /api/wiki/scratchpad/delete removes a single entry', async () => {
    const ok = await apiStorage.deleteScratchpad('2026-10-10-14-58-13');
    assert.equal(ok, true);

    const entries = await apiStorage.getScratchpad();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, '2026-10-11-09-30-00');

    const fileOnDisk = await fs.readFile(path.join(tmpDir, 'notes', 'quick-notes.md'), 'utf-8');
    assert.ok(!fileOnDisk.includes('14:58:13'));
    assert.ok(fileOnDisk.includes('09:30:00'));

    const notFound = await apiStorage.deleteScratchpad('2026-10-10-14-58-13');
    assert.equal(notFound, false);
  });

  await t.test('GET /api/wiki/scratchpad returns empty when scratchpad missing', async () => {
    await fs.rm(path.join(tmpDir, 'notes', 'quick-notes.md'), { force: true });
    const entries = await apiStorage.getScratchpad();
    assert.deepEqual(entries, []);
  });
});
