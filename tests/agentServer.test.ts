import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { LlmClient } from '@backend/server/llmClient';
import { ApiStorage } from '@frontend/storage/ApiStorage';

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

  await t.test('POST /api/wiki/ingest stages + compiles a markdown file into the chosen folder', async () => {
    const result = await apiStorage.ingestMarkdownFile('Guida HR.md', '# Guida HR\n\nContenuto di prova.', 'fonti');

    assert.equal(result.success, true);
    assert.equal(result.compiled, true);
    assert.equal(result.targetFolder, 'fonti');
    assert.equal(result.note?.id, 'guida-hr');

    const onDisk = await fs.readFile(path.join(wikiDir, 'fonti', 'guida-hr.md'), 'utf-8');
    assert.ok(onDisk.includes('Consult Synthesis'));

    const rawFiles = await fs.readdir(path.join(tmpDir, 'raw'));
    assert.ok(rawFiles.includes('Guida HR_COMPILED.md'));
    assert.ok(!rawFiles.includes('Guida HR.md'));
  });

  await t.test('POST /api/wiki/ingest rejects folder traversal', async () => {
    const result = await apiStorage.ingestMarkdownFile('evil.md', '# evil', '../escape');
    assert.equal(result.success, true);
    // Traversal segments are stripped; the note stays inside the wiki dir.
    const escaped = path.join(tmpDir, 'escape', 'evil.md');
    let exists = true;
    try {
      await fs.access(escaped);
    } catch {
      exists = false;
    }
    assert.equal(exists, false);
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

  await t.test('system prompt advertises the wiki-edit proposal protocol', async () => {
    const prompt = await serverInstance.getSystemPrompt();
    assert.ok(prompt.includes('EDIT PROPOSAL PROTOCOL'));
    assert.ok(prompt.includes('wiki-edit'));
  });

  await t.test('POST /api/wiki/apply-edit applies a unique find/replace deterministically', async () => {
    await fs.writeFile(
      path.join(wikiDir, 'apply-target.md'),
      '# Apply Target\n\nOriginal line one.\nOriginal line two.\n',
      'utf-8'
    );

    const result = await apiStorage.applyEdit({
      file: 'apply-target.md',
      find: 'Original line two.',
      replace: 'Replaced line two.',
    });

    assert.equal(result.success, true);
    assert.ok(result.note);
    const onDisk = await fs.readFile(path.join(wikiDir, 'apply-target.md'), 'utf-8');
    assert.ok(onDisk.includes('Replaced line two.'));
    assert.ok(onDisk.includes('Original line one.'));
    assert.ok(!onDisk.includes('Original line two.'));
  });

  await t.test('POST /api/wiki/apply-edit resolves notes inside subfolders', async () => {
    await fs.mkdir(path.join(wikiDir, 'capitoli'), { recursive: true });
    await fs.writeFile(
      path.join(wikiDir, 'capitoli', 'apply-sub.md'),
      '# Sub\n\nFinale da sostituire.\n',
      'utf-8'
    );

    const result = await apiStorage.applyEdit({
      file: 'capitoli/apply-sub.md',
      find: 'Finale da sostituire.',
      replace: 'Finale aggiornato.',
    });

    assert.equal(result.success, true);
    const onDisk = await fs.readFile(path.join(wikiDir, 'capitoli', 'apply-sub.md'), 'utf-8');
    assert.ok(onDisk.includes('Finale aggiornato.'));
  });

  await t.test('POST /api/wiki/apply-edit rejects ambiguous and missing find blocks', async () => {
    await fs.writeFile(
      path.join(wikiDir, 'apply-ambig.md'),
      '# Ambig\n\nDUPLICATED_TOKEN here\nDUPLICATED_TOKEN there\n',
      'utf-8'
    );

    const ambiguous = await apiStorage.applyEdit({
      file: 'apply-ambig.md',
      find: 'DUPLICATED_TOKEN',
      replace: 'X',
    });
    assert.equal(ambiguous.success, false);
    assert.ok((ambiguous.error || '').includes('ambiguous'));

    const missing = await apiStorage.applyEdit({
      file: 'apply-ambig.md',
      find: 'NOT_PRESENT_ANYWHERE',
      replace: 'X',
    });
    assert.equal(missing.success, false);
    assert.ok((missing.error || '').includes('not found'));

    // The file must be left untouched when an edit is rejected.
    const onDisk = await fs.readFile(path.join(wikiDir, 'apply-ambig.md'), 'utf-8');
    assert.ok(onDisk.includes('DUPLICATED_TOKEN here'));
    assert.ok(!onDisk.includes('X'));
  });

  await t.test('POST /api/wiki/apply-edit rejects path traversal', async () => {
    const result = await apiStorage.applyEdit({
      file: '../outside.md',
      find: 'anything',
      replace: 'anything',
    });
    assert.equal(result.success, false);

    let escapedExists = true;
    try {
      await fs.access(path.join(tmpDir, 'outside.md'));
    } catch {
      escapedExists = false;
    }
    assert.equal(escapedExists, false);
  });
});

test('getSystemPrompt follows a root AGENT.md pointer to the real manual', async () => {
  const dir = path.join(process.cwd(), 'tests', 'tmp-agent-' + Date.now());
  await fs.mkdir(path.join(dir, 'docs'), { recursive: true });
  await fs.writeFile(path.join(dir, 'AGENT.md'), 'docs/AGENT.md\n', 'utf-8');
  await fs.writeFile(
    path.join(dir, 'docs', 'AGENT.md'),
    '# Real Manual\n\nUNIQUE_MANUAL_SENTINEL about how to operate.\n',
    'utf-8'
  );

  const serverInstance = new AgentServer(dir);
  try {
    const prompt = await serverInstance.getSystemPrompt();
    assert.ok(prompt.includes('UNIQUE_MANUAL_SENTINEL'));
    assert.ok(!prompt.includes('OPERATING MANUAL (AGENT.md) ===\ndocs/AGENT.md'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
