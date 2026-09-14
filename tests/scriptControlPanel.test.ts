import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer, SCRIPT_REGISTRY, buildCliArgs } from '../src/server/agentServer';

describe('Script Control Panel Test Suite', () => {
  let tmpDir: string;
  let server: http.Server;
  let agentServer: AgentServer;
  let baseUrl: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-script-test-'));
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'raw'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'sources'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'output'), { recursive: true });

    agentServer = new AgentServer(process.cwd());

    server = http.createServer(async (req, res) => {
      const handled = await agentServer.handleRequest(req, res);
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>(resolve => server.listen(0, resolve));
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterEach(async () => {
    server.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('GET /api/scripts/list returns all 15 registered script tools', async () => {
    const res = await fetch(`${baseUrl}/api/scripts/list`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.scripts));
    assert.equal(data.scripts.length, 15);

    const scriptIds = data.scripts.map((s: { id: string }) => s.id);
    assert.ok(scriptIds.includes('conv2md'));
    assert.ok(scriptIds.includes('clip2md'));
    assert.ok(scriptIds.includes('notebooklm_import'));
    assert.ok(scriptIds.includes('migrate_to_okf'));
    assert.ok(scriptIds.includes('okf_lint'));
    assert.ok(scriptIds.includes('okf_log'));
    assert.ok(scriptIds.includes('okf_reindex'));
    assert.ok(scriptIds.includes('okf_stats'));
    assert.ok(scriptIds.includes('wiki_stats'));
    assert.ok(scriptIds.includes('maturity_calculator'));
    assert.ok(scriptIds.includes('check_docs_sync'));
    assert.ok(scriptIds.includes('suggest_tags'));
    assert.ok(scriptIds.includes('generate_thesis'));
    assert.ok(scriptIds.includes('export_thesis_pdf'));
    assert.ok(scriptIds.includes('wizard'));
  });

  test('buildCliArgs builds expected command arguments for script definitions', () => {
    const convDef = SCRIPT_REGISTRY['conv2md'];
    const convArgs = buildCliArgs(convDef, { input: 'sources', output: 'raw', ocr: true });
    assert.deepEqual(convArgs, ['--input', 'sources', '--output', 'raw', '--ocr']);

    const clipDef = SCRIPT_REGISTRY['clip2md'];
    const clipArgs = buildCliArgs(clipDef, { url: 'https://example.com/test', output: 'sources/web-clips' });
    assert.deepEqual(clipArgs, ['https://example.com/test', '--output', 'sources/web-clips']);

    const wizardDef = SCRIPT_REGISTRY['wizard'];
    const wizardArgs = buildCliArgs(wizardDef, { preset: 'academic' });
    assert.deepEqual(wizardArgs, ['--preset', 'academic']);
  });

  test('POST /api/scripts/execute streams SSE response events for wiki_stats', async () => {
    const res = await fetch(`${baseUrl}/api/scripts/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId: 'wiki_stats', args: {} }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');

    const text = await res.text();
    assert.ok(text.includes('data: {"type":"start"'));
    assert.ok(text.includes('data: {"type":"exit"'));
    assert.ok(text.includes('data: [DONE]'));
  });

  test('POST /api/scripts/execute rejects unknown script IDs with 400', async () => {
    const res = await fetch(`${baseUrl}/api/scripts/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId: 'malicious_script', args: {} }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Invalid or unregistered script ID'));
  });

  test('GET /api/files/download downloads file and prevents path traversal', async () => {
    const testFile = path.join(process.cwd(), 'output', 'test-download.txt');
    await fs.mkdir(path.dirname(testFile), { recursive: true });
    await fs.writeFile(testFile, 'Hello Script Control Panel', 'utf-8');

    try {
      const res = await fetch(`${baseUrl}/api/files/download?path=output/test-download.txt`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.equal(text, 'Hello Script Control Panel');

      // Attempt path traversal
      const badRes = await fetch(`${baseUrl}/api/files/download?path=../../package.json`);
      assert.equal(badRes.status, 400);
    } finally {
      await fs.rm(testFile, { force: true });
    }
  });
});
