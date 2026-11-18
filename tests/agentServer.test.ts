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

  // In-app guide topics are served from <rootDir>/docs/help (see GET /api/help).
  await fs.cp(path.join(process.cwd(), 'docs', 'help'), path.join(tmpDir, 'docs', 'help'), {
    recursive: true,
  });

  // Deterministic mock so /consult does not spawn the real opencode CLI.
  const mockClient: LlmClient = {
    // Article-shaped (frontmatter first) so the compile workflow persists it
    // as a note, while still carrying the marker the assertions look for.
    complete: async () => `---
title: Mock Note
tags: [test]
---
### 🔍 Consult Synthesis (Mock)

Based on [[sample-note]].`,
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

  await t.test('Review Studio: meta returns note identity, quality gate and history', async () => {
    const meta = await apiStorage.getReviewMeta('human-target');

    assert.equal(meta.success, true);
    assert.equal(meta.note?.id, 'human-target');
    assert.equal(meta.note?.trustTier, 'human-reviewed');
    assert.equal(meta.quality?.total, 5);
    assert.ok((meta.quality?.passed ?? 0) >= 3);
    assert.ok(meta.history?.some(event => event.actor === 'human:studente'));
    assert.equal(meta.suggestedReviewer, 'studente');
  });

  await t.test('Review Studio: meta reports a missing note instead of throwing', async () => {
    const meta = await apiStorage.getReviewMeta('does-not-exist');
    assert.equal(meta.success, false);
    assert.ok(meta.error?.includes('Nota non trovata'));
  });

  await t.test('Review Studio: verify endpoint records the reviewer and refreshes meta', async () => {
    await fs.writeFile(
      path.join(wikiDir, 'review-target.md'),
      `---
title: Review Target
status: draft
tags: [test]
sources:
  - id: source-1
    resource: raw/source-1.md
---
# Review Target

Body used by the Review Studio tests, linking to [[sample-note]].
`,
      'utf-8'
    );

    const result = await apiStorage.verifyNote({
      note: 'review-target',
      reviewer: 'alice',
      comment: 'Controllata in Review Studio.',
      setStable: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.changed, true);
    assert.equal(result.actor, 'human:alice');
    assert.equal(result.note?.trustTier, 'human-reviewed');
    assert.equal(result.note?.status, 'stable');
    assert.equal(result.meta?.suggestedReviewer, 'alice');

    const onDisk = await fs.readFile(path.join(wikiDir, 'review-target.md'), 'utf-8');
    assert.ok(onDisk.includes('by: human:alice'));

    // The verification is a write, so a pre-write snapshot must exist.
    const snapshots = await apiStorage.listReviewSnapshots('review-target');
    assert.ok(snapshots.length >= 1);
    assert.equal(snapshots[0].reason, 'verifica');
  });

  await t.test('Review Studio: digest summarises the recent log and note health', async () => {
    const digest = await apiStorage.getReviewDigest({ days: 30, scope: 'all' });

    assert.equal(digest.success, true);
    assert.equal(digest.rangeDays, 30);
    assert.ok(digest.stats.notes >= 4);
    assert.ok(digest.stats.verified >= 2);
    assert.ok(digest.health.score >= 0 && digest.health.score <= 100);
    assert.ok(digest.markdown.includes('Digest Wiki'));
    assert.ok(digest.days.length >= 1);
  });

  await t.test('Review Studio: save creates a snapshot, diff shows changes, restore reverts', async () => {
    const notePath = path.join(wikiDir, 'history-target.md');
    const original = `---
title: History Target
status: draft
tags: [test]
---
# History Target

Original body.
`;
    await fs.writeFile(notePath, original, 'utf-8');

    await apiStorage.saveNote({
      id: 'history-target',
      title: 'History Target',
      folder: 'wiki',
      content: original.replace('Original body.', 'Modified body.'),
    });

    const snapshots = await apiStorage.listReviewSnapshots('history-target');
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].reason, 'salvataggio');

    const diff = await apiStorage.getReviewDiff('history-target', snapshots[0].id);
    assert.equal(diff.success, true);
    assert.ok((diff.stats?.added ?? 0) >= 1);
    assert.ok((diff.stats?.removed ?? 0) >= 1);

    const restored = await apiStorage.restoreReviewSnapshot('history-target', snapshots[0].id);
    assert.ok(restored);
    const afterRestore = await fs.readFile(notePath, 'utf-8');
    assert.ok(afterRestore.includes('Original body.'));
    assert.ok(!afterRestore.includes('Modified body.'));
  });

  await t.test('Research Studio: search, backlinks, related and trace are deterministic', async () => {
    const search = await apiStorage.researchSearch('sample');
    assert.equal(search.success, true);
    assert.ok(search.total >= 1);
    assert.ok(search.results.some(hit => hit.note.id === 'sample-note'));

    await fs.writeFile(
      path.join(wikiDir, 'linker.md'),
      `---
title: Linker
tags: [test]
---
# Linker

Vedi [[sample-note]] per i dettagli.
`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(wikiDir, 'affine.md'),
      `---
title: Affine
tags: [test]
---
# Affine

Sample note: governance clinica content.
`,
      'utf-8'
    );
    await fs.mkdir(path.join(tmpDir, 'raw'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'raw', 'evidence.md'),
      'Governance evidence line\nSecond line\nThird line\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(wikiDir, 'traced.md'),
      `---
title: Traced Claim
tags: [trace]
sources:
  - raw/evidence.md#L1-L2
---
# Traced Claim

The governance board approved the protocol.
`,
      'utf-8'
    );

    const backlinks = await apiStorage.researchBacklinks('sample-note');
    assert.equal(backlinks.success, true);
    assert.ok(backlinks.items.some(item => item.source.id === 'linker'));
    assert.ok(backlinks.items.every(item => item.source.id !== 'sample-note'));

    const related = await apiStorage.researchRelated('sample-note');
    assert.equal(related.success, true);
    assert.ok(related.suggestions.every(item => item.note.id !== 'linker'));
    assert.ok(related.suggestions.some(item => item.note.id === 'affine'));

    const trace = await apiStorage.researchTrace('governance');
    assert.equal(trace.success, true);
    const traced = trace.notes.find(item => item.note.id === 'traced');
    assert.ok(traced);
    assert.ok(traced!.matchedIn.includes('corpo'));
    assert.equal(traced!.sources.length, 1);
    assert.equal(traced!.sources[0].exists, true);
    assert.equal(traced!.sources[0].startLine, 1);
    assert.equal(traced!.sources[0].endLine, 2);
    assert.ok(traced!.sources[0].passage?.includes('Governance'));
  });

  await t.test('Research Studio: consult returns the mocked LLM answer with citations', async () => {
    const consult = await apiStorage.researchConsult('sample note');
    assert.equal(consult.success, true);
    assert.equal(consult.fallback, false);
    assert.ok(consult.markdown.includes('Consult Synthesis'));
    assert.ok(consult.citations.some(citation => citation.id === 'sample-note'));
  });

  await t.test('Research Studio: deep research writes report and synthesis files', async () => {
    const deep = await apiStorage.researchDeepResearch('sample note');
    assert.equal(deep.success, true);
    assert.ok(deep.articles >= 1);
    assert.ok(deep.outputPath && deep.synthesisPath);
    await fs.access(path.join(tmpDir, deep.outputPath!));
    await fs.access(path.join(tmpDir, deep.synthesisPath!));

    const onDisk = await fs.readFile(path.join(tmpDir, deep.synthesisPath!), 'utf-8');
    assert.ok(onDisk.includes('tags: [deep-research'));
  });

  await t.test('Research Studio: endpoints validate their input', async () => {
    const searchRes = await fetch(`${baseUrl}/api/notes/research/search`);
    assert.equal(searchRes.status, 400);

    const consultRes = await fetch(`${baseUrl}/api/notes/research/consult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(consultRes.status, 400);

    const missing = await apiStorage.researchBacklinks('does-not-exist');
    assert.equal(missing.success, false);
  });

  await t.test('Study Studio: guide, quiz, mindmap and audio write artefacts', async () => {
    const guide = await apiStorage.studyGuide('sample');
    assert.equal(guide.success, true);
    assert.ok(guide.outputPath.startsWith('output/study-guide-'));
    assert.ok(guide.markdown.includes('Executive Summary'));
    assert.ok(guide.sources.some(source => source.id === 'sample-note'));
    await fs.access(path.join(tmpDir, guide.outputPath));

    const quiz = await apiStorage.studyQuiz('sample', 3);
    assert.equal(quiz.success, true);
    assert.equal(quiz.count, 3);
    assert.equal((quiz.markdown.match(/### Question \d+/g) || []).length, 3);
    assert.ok(quiz.outputPath.startsWith('output/quiz-'));
    await fs.access(path.join(tmpDir, quiz.outputPath));

    const mindmap = await apiStorage.studyMindmap('sample-note');
    assert.equal(mindmap.success, true);
    assert.ok(mindmap.nodes.length >= 1);
    assert.equal(mindmap.note?.id, 'sample-note');
    await fs.access(path.join(tmpDir, mindmap.outputPath));

    const audio = await apiStorage.studyAudioOverview('sample');
    assert.equal(audio.success, true);
    assert.ok(audio.markdown.includes('**Host A**'));
    await fs.access(path.join(tmpDir, audio.outputPath));

    const missing = await apiStorage.studyMindmap('definitely-not-a-note');
    assert.equal(missing.success, true, 'fallback to the first note keeps the command usable');
  });

  await t.test('Study Studio: quick note promotion uses the selected entry', async () => {
    await fs.rm(path.join(tmpDir, 'notes', 'quick-notes.md'), { force: true });

    const saved = await apiStorage.studyQuickNote('Promuovi questa idea di studio');
    assert.equal(saved.success, true);
    assert.equal(saved.entries.length, 1);
    assert.ok(saved.entry?.id);

    const promoted = await apiStorage.studyPromoteNote(saved.entry!.id, 'sperimentale');
    assert.equal(promoted.success, true);
    assert.ok(promoted.note);

    const articlePath = path.join(wikiDir, 'sperimentale', `${promoted.note!.id}.md`);
    const article = await fs.readFile(articlePath, 'utf-8');
    assert.ok(article.includes('Promuovi questa idea di studio'));
    assert.ok(article.includes(`entry \`${saved.entry!.id}\``));
  });

  await t.test('Study Studio: thesis chapter aggregates chapters and mature syntheses', async () => {
    await fs.mkdir(path.join(wikiDir, 'capitoli'), { recursive: true });
    await fs.mkdir(path.join(wikiDir, 'sintesi'), { recursive: true });
    await fs.writeFile(
      path.join(wikiDir, 'capitoli', '01-introduzione.md'),
      `---
titolo: Introduzione
tipo: capitolo_tesi
capitolo_numero: 1
maturita: 80
---
# Introduzione

Testo del capitolo introduttivo con [[sample-note]].
`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(wikiDir, 'sintesi', 'modelli.md'),
      `---
titolo: Modelli concettuali
tipo: sintesi
maturita: 70
---
# Modelli concettuali

Sintesi matura pronta per la tesi.
`,
      'utf-8'
    );

    const thesis = await apiStorage.studyThesisChapter('tesi di prova', { minMaturity: 50 });
    assert.equal(thesis.success, true);
    assert.equal(thesis.chapters.length, 1);
    assert.equal(thesis.chapters[0].title, 'Introduzione');
    assert.equal(thesis.syntheses.length, 1);
    assert.ok(thesis.markdown.includes('Capitolo 1: Introduzione'));
    assert.ok(thesis.markdown.includes('Modelli concettuali'));
    await fs.access(path.join(tmpDir, thesis.outputPath));
  });

  await t.test('Study Studio: the chat router routes /thesis-chapter', async () => {
    const reply = await apiStorage.sendChat('/thesis-chapter governance maturity=50');
    assert.ok(reply.includes('Thesis Chapter Generated'));
    assert.ok(reply.includes('thesis-governance.md') || reply.includes('thesis-'));
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

  await t.test('scratchpad keeps two notes saved in the same second distinct', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'notes', 'quick-notes.md'),
      '# Quick Notes Scratchpad\n\n## [2026-10-12 08:00:00]\nprima\n\n## [2026-10-12 08:00:00]\nseconda\n',
      'utf-8'
    );

    const entries = await apiStorage.getScratchpad();
    assert.equal(entries.length, 2);
    assert.notEqual(entries[0].id, entries[1].id, 'ids must not collide');

    await apiStorage.deleteScratchpad(entries[0].id);
    const remaining = await apiStorage.getScratchpad();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].text, 'seconda');
  });

  await t.test('GET /api/wiki/scratchpad returns empty when scratchpad missing', async () => {
    await fs.rm(path.join(tmpDir, 'notes', 'quick-notes.md'), { force: true });
    const entries = await apiStorage.getScratchpad();
    assert.deepEqual(entries, []);
  });

  await t.test('GET /api/help returns the in-app help topic index', async () => {
    const topics = await apiStorage.getHelpTopics();
    assert.ok(topics.length >= 10, `expected >= 10 topics, got ${topics.length}`);

    const ids = topics.map(t => t.id);
    assert.equal(new Set(ids).size, ids.length, 'topic ids must be unique');
    assert.ok(ids.includes('inizio'));

    const inizio = topics.find(t => t.id === 'inizio');
    assert.ok(inizio);
    assert.ok(inizio.title.length > 0);
    assert.ok(inizio.icon.length > 0);
    assert.ok(inizio.order > 0);
    assert.ok(inizio.group.length > 0);
    assert.ok(Array.isArray(inizio.keywords) && inizio.keywords.length > 0);
    assert.ok(Array.isArray(inizio.context));
  });

  await t.test('GET /api/help/<id> returns content; unknown or invalid ids return 404', async () => {
    const topic = await apiStorage.getHelpTopic('inizio');
    assert.ok(topic);
    assert.equal(topic.id, 'inizio');
    assert.ok(topic.markdown.trim().length > 0);

    const unknown = await apiStorage.getHelpTopic('does-not-exist');
    assert.equal(unknown, null);

    const invalid = await apiStorage.getHelpTopic('../evil');
    assert.equal(invalid, null);
  });

  await t.test('POST /api/chat /help answers deterministically without the LLM', async () => {
    const indexReply = await apiStorage.sendChat('/help');
    assert.ok(indexReply.includes('Guida Wiki-Forge'));
    assert.ok(indexReply.includes('`inizio`'));
    assert.ok(indexReply.includes('F1'));

    const topicReply = await apiStorage.sendChat('/help caricare');
    assert.ok(topicReply.includes('caricare-documenti'));

    const noMatchReply = await apiStorage.sendChat('/help xyzzy-nope');
    assert.ok(noMatchReply.includes('Nessun argomento'));
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
