import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AgentServer } from '../src/server/agentServer';
import { LlmClient, LlmCompletionParams } from '../src/server/llmClient';

class MockWorkflowLlmClient implements LlmClient {
  public async complete(params: LlmCompletionParams): Promise<string> {
    if (params.userMessage.includes('/consult') || params.userMessage.includes('consult')) {
      return '### 🔍 Consult Synthesis\n\nSynthesized response for consult query citing [[sample-note]].';
    }
    if (params.userMessage.includes('wizard')) {
      return '### 🪄 Wizard Run\n\nExecuting Academic / Thesis / Paper Review workflow:\n1. Ingest PDFs\n2. Extract Authors/Theories\n3. Compile Literature Review\n4. Audit Wiki Links';
    }
    return `---
title: Compiled Note
tags: [test, compile]
---
# Compiled Note

This is compiled content from raw source citing [[other-note]].
`;
  }
}

test('Workflow Commands Real Execution Test Suite', async t => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp-workflows-' + Date.now());
  const wikiDir = path.join(tmpDir, 'wiki');
  const rawDir = path.join(tmpDir, 'raw');

  await fs.mkdir(wikiDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });

  // Add initial note with missing link and frontmatter
  await fs.writeFile(
    path.join(wikiDir, 'sample-note.md'),
    `---
title: Sample Note
tags: [test]
---
# Sample Note

Links to [[non-existent-note]].
`,
    'utf-8'
  );

  // Add note without frontmatter
  await fs.writeFile(
    path.join(wikiDir, 'no-fm-note.md'),
    `# Plain Note Without Frontmatter\n\nNo tags here.\n`,
    'utf-8'
  );

  // Add uncompiled file in raw
  const rawFileName = 'new-source-doc.md';
  await fs.writeFile(
    path.join(rawDir, rawFileName),
    `# Raw Document Title\n\nRaw text to compile.\n`,
    'utf-8'
  );

  const mockClient = new MockWorkflowLlmClient();
  const agentServer = new AgentServer(tmpDir, mockClient);

  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  await t.test('/reindex writes wiki/index.md on disk', async () => {
    const response = await agentServer.processChatCommand({ command: '/reindex' });
    assert.ok(response.includes('Reindex Complete'));

    const masterIndex = await fs.readFile(path.join(wikiDir, 'index.md'), 'utf-8');
    assert.ok(masterIndex.includes('Wiki Master Index'));
    assert.ok(masterIndex.includes('sample-note'));
  });

  await t.test('/audit reports broken links, orphans, and missing frontmatter correctly', async () => {
    const report = await agentServer.processChatCommand({ command: '/audit' });
    assert.ok(report.includes('Audit Report'));
    assert.ok(report.includes('non-existent-note'), 'Should identify broken link');
    assert.ok(report.includes('no-fm-note'), 'Should identify note missing frontmatter');
  });

  await t.test('/compile ingests raw source, writes wiki note, and renames raw file to _COMPILED.md', async () => {
    const report = await agentServer.processChatCommand({ command: '/compile' });
    assert.ok(report.includes('Compile Workflow Execution Report'));

    // Check that compiled raw file exists
    const compiledRawPath = path.join(rawDir, 'new-source-doc_COMPILED.md');
    const compiledExists = await fs.stat(compiledRawPath).then(() => true).catch(() => false);
    assert.ok(compiledExists, 'Raw file should be renamed to _COMPILED.md');

    // Check that wiki note was created
    const createdNotePath = path.join(wikiDir, 'general', 'new-source-doc.md');
    const noteExists = await fs.stat(createdNotePath).then(() => true).catch(() => false);
    assert.ok(noteExists, 'Compiled note should be saved in wiki/general/new-source-doc.md');
  });

  await t.test('/consult returns synthesis', async () => {
    const response = await agentServer.processChatCommand({ message: '/consult sample' });
    assert.ok(response.includes('Consult Synthesis'));
    assert.ok(response.includes('sample-note'));
  });

  await t.test('/wizard lists available scenarios', async () => {
    const response = await agentServer.processChatCommand({ message: '/wizard' });
    assert.ok(response.includes('Wizard Scenarios'));
    assert.ok(response.includes('/wizard academic'));
    assert.ok(response.includes('/wizard creative'));
  });

  await t.test('/wizard <scenario> runs the scenario workflow', async () => {
    const response = await agentServer.processChatCommand({ message: '/wizard academic' });
    assert.ok(response.includes('Wizard Run'));
    assert.ok(response.includes('Academic'));
  });

  await t.test('/trace traces connections for given query', async () => {
    const response = await agentServer.processChatCommand({ message: '/trace sample' });
    assert.ok(response.includes('Connection Trace for "sample"'));
    assert.ok(response.includes('sample-note'));
  });
});
