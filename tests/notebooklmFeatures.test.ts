import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AgentServer } from '../src/server/agentServer';
import { renderMarkdown } from '../src/core/utils/markdown';

test('NotebookLM-Inspired Knowledge & Study Features Test Suite', async t => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp-notebooklm-' + Date.now());
  const wikiDir = path.join(tmpDir, 'wiki');
  const rawDir = path.join(tmpDir, 'raw');
  const notesDir = path.join(tmpDir, 'notes');
  const outputDir = path.join(tmpDir, 'output');

  await fs.mkdir(wikiDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(notesDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  // Add raw source document
  await fs.writeFile(
    path.join(rawDir, 'paper_COMPILED.md'),
    `Line 1: Abstract
Line 2: Introduction
Line 3: Agentic architectures build personal knowledge graphs.
Line 4: Deep research algorithms synthesize knowledge graphs.
Line 5: Conclusion
`,
    'utf-8'
  );

  // Add wiki note with line-anchored grounded sources
  await fs.writeFile(
    path.join(wikiDir, 'agent-architecture.md'),
    `---
tags: [ai, agents]
created: 2026-04-29
sources:
  - raw/paper_COMPILED.md#L3-L4
---

# Agent Architecture

## Overview
Agentic systems build personal knowledge graphs.

## Details
Synthesizes knowledge graphs.

## Related
- [[wiki/index]]

## Sources
- raw/paper_COMPILED.md#L3-L4
`,
    'utf-8'
  );

  const agentServer = new AgentServer(tmpDir);

  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  await t.test('renderMarkdown converts line-anchored sources and wikilinks into HTML data attributes', async () => {
    const rawMarkdown = 'See [[agent-architecture#L3-L4]] and raw/paper_COMPILED.md#L3-L4';
    const html = renderMarkdown(rawMarkdown);

    assert.ok(html.includes('data-wikilink="agent-architecture"'));
    assert.ok(html.includes('data-anchor="L3-L4"'));
    assert.ok(html.includes('class="source-link"'));
    assert.ok(html.includes('data-source-file="raw/paper_COMPILED.md"'));
    assert.ok(html.includes('data-line-anchor="L3-L4"'));
  });

  await t.test('/trace extracts line-anchored passages from raw sources', async () => {
    const response = await agentServer.processChatCommand({ command: '/trace Agent' });
    assert.ok(response.includes('Passage Trace for "Agent"'));
    assert.ok(response.includes('raw/paper_COMPILED.md#L3-L4'));
    assert.ok(response.includes('Lines 3-4'));
    assert.ok(response.includes('Agentic architectures build personal knowledge graphs.'));
  });

  await t.test('/study-guide generates output/study-guide-<slug>.md', async () => {
    const response = await agentServer.processChatCommand({ command: '/study-guide agent' });
    assert.ok(response.includes('Study Guide Generated'));
    assert.ok(response.includes('study-guide-agent.md'));

    const createdPath = path.join(outputDir, 'study-guide-agent.md');
    const content = await fs.readFile(createdPath, 'utf-8');
    assert.ok(content.includes('# Study Guide: agent'));
    assert.ok(content.includes('Executive Summary'));
    assert.ok(content.includes('Self-Assessment Questions'));
  });

  await t.test('/quiz generates output/quiz-<slug>.md', async () => {
    const response = await agentServer.processChatCommand({ command: '/quiz agent 3' });
    assert.ok(response.includes('Quiz Generated'));
    assert.ok(response.includes('quiz-agent.md'));

    const createdPath = path.join(outputDir, 'quiz-agent.md');
    const content = await fs.readFile(createdPath, 'utf-8');
    assert.ok(content.includes('Self-Assessment Quiz'));
    assert.ok(content.includes('Question 1'));
    assert.ok(content.includes('Correct Answer'));
  });

  await t.test('/deep-research generates multi-source research report with gaps and matrix', async () => {
    const response = await agentServer.processChatCommand({ command: '/deep-research agent architectures' });
    assert.ok(response.includes('Deep Research Report Generated'));

    const entries = await fs.readdir(outputDir);
    const researchFile = entries.find(f => f.startsWith('research-agent-architectures'));
    assert.ok(researchFile, 'Research report file should be created');

    const content = await fs.readFile(path.join(outputDir, researchFile!), 'utf-8');
    assert.ok(content.includes('# Deep Research Report'));
    assert.ok(content.includes('Executive Summary'));
    assert.ok(content.includes('Source Attribution Matrix'));
    assert.ok(content.includes('Identified Knowledge Gaps'));
  });

  await t.test('/mindmap generates tree and JSON payload', async () => {
    const response = await agentServer.processChatCommand({ command: '/mindmap agent-architecture' });
    assert.ok(response.includes('Mind Map Generated for'));
    assert.ok(response.toLowerCase().includes('agent architecture'));

    const createdPath = path.join(outputDir, 'mindmap-agent-architecture.md');
    const content = await fs.readFile(createdPath, 'utf-8');
    assert.ok(content.includes('# Mind Map:'));
    assert.ok(content.includes('Hierarchical Tree'));
    assert.ok(content.includes('ForceGraph Data Payload (JSON)'));
  });

  await t.test('/note and /promote-note manage scratchpad notes', async () => {
    const noteResponse = await agentServer.processChatCommand({ command: '/note Quick idea on LLM agent loops' });
    assert.ok(noteResponse.includes('Quick Note Saved'));

    const quickNotesContent = await fs.readFile(path.join(notesDir, 'quick-notes.md'), 'utf-8');
    assert.ok(quickNotesContent.includes('Quick idea on LLM agent loops'));

    const promoteResponse = await agentServer.processChatCommand({ command: '/promote-note llm-agent-loops ai-tools' });
    assert.ok(promoteResponse.includes('Note Promoted to Wiki Article'));

    const promotedArticlePath = path.join(wikiDir, 'ai-tools', 'llm-agent-loops.md');
    const promotedContent = await fs.readFile(promotedArticlePath, 'utf-8');
    assert.ok(promotedContent.includes('# Llm agent loops'));
  });

  await t.test('/audio-overview generates Host A / Host B dialogue script', async () => {
    const response = await agentServer.processChatCommand({ command: '/audio-overview agent-architecture' });
    assert.ok(response.includes('Audio Overview Script Generated'));

    const createdPath = path.join(outputDir, 'audio-script-agent-architecture.md');
    const content = await fs.readFile(createdPath, 'utf-8');
    assert.ok(content.includes('Audio Overview Dialogue Script'));
    assert.ok(content.includes('Host A'));
    assert.ok(content.includes('Host B'));
  });
});
