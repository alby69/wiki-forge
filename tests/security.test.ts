import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AgentServer } from '../src/server/agentServer';
import { renderMarkdown } from '../src/core/utils/markdown';
import { sanitizeHtml } from '../src/core/utils/html';

test('Security Hardening Test Suite', async t => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp-security-' + Date.now());
  const wikiDir = path.join(tmpDir, 'wiki');

  await fs.mkdir(wikiDir, { recursive: true });

  const agentServer = new AgentServer(tmpDir);

  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  await t.test('saveWikiNote rejects path traversal outside wiki directory', async () => {
    await assert.rejects(
      async () => {
        await agentServer.saveWikiNote({
          id: 'evil',
          content: 'malicious payload',
          path: '../../etc/passwd',
        });
      },
      err => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Access denied'));
        return true;
      }
    );
  });

  await t.test('attachToNote rejects folder path traversal outside wiki directory', async () => {
    await assert.rejects(
      async () => {
        await agentServer.attachToNote({
          noteId: 'evil',
          content: 'malicious payload',
          folder: '../../../tmp',
        });
      },
      err => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Access denied'));
        return true;
      }
    );
  });

  await t.test('sanitizeHtml strips script tags, iframe, and onerror handlers', () => {
    const maliciousInput = `<script>alert("xss")</script><img src="x" onerror="alert(1)"><iframe src="http://evil.com"></iframe><a href="javascript:alert(1)">link</a>`;
    const cleaned = sanitizeHtml(maliciousInput);

    assert.ok(!cleaned.includes('<script>'));
    assert.ok(!cleaned.includes('onerror='));
    assert.ok(!cleaned.includes('<iframe'));
    assert.ok(!cleaned.includes('javascript:alert'));
  });

  await t.test('renderMarkdown produces safe HTML free of executable scripts', () => {
    const markdownWithXss = `# Title\n\n<img src=x onerror=alert(1)>\n\nLink to [[safe-note]].`;
    const rendered = renderMarkdown(markdownWithXss);

    assert.ok(!rendered.includes('onerror='));
    assert.ok(rendered.includes('Title'));
    assert.ok(rendered.includes('wikilink'));
  });
});
