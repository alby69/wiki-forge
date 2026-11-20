import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer, SCRIPT_REGISTRY, buildCliArgs } from '@backend/server/agentServer';

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

  test('GET /api/scripts/list returns all registered script tools', async () => {
    const res = await fetch(`${baseUrl}/api/scripts/list`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.scripts));
    assert.equal(data.scripts.length, Object.keys(SCRIPT_REGISTRY).length);

    const scriptIds = data.scripts.map((s: { id: string }) => s.id);
    assert.ok(scriptIds.includes('graph_analytics'));
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
    assert.ok(scriptIds.includes('voice_ingest'));
    assert.ok(scriptIds.includes('export_semantic'));
    assert.ok(scriptIds.includes('ontology_rules'));
    assert.ok(scriptIds.includes('cq_validator'));
    assert.ok(scriptIds.includes('odp_suggester'));
    assert.ok(scriptIds.includes('neuro_symbolic_check'));
    assert.ok(scriptIds.includes('ke_maturity'));
    assert.ok(scriptIds.includes('schema_infer'));
    assert.ok(scriptIds.includes('schema_lint'));

    // The TS registry is generated from the Python SSOT (SCRIPT_SCHEMAS).
    // A count drift here means someone edited one copy without the other.
    assert.equal(scriptIds.length, 29);
    for (const generated of ['docs_wiki_drift', 'wiki_program_change_propose', 'wiki_program_change_apply']) {
      assert.ok(scriptIds.includes(generated), `missing generated schema ${generated}`);
    }
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

    const exportSemDef = SCRIPT_REGISTRY['export_semantic'];
    const exportSemArgs = buildCliArgs(exportSemDef, { wiki_dir: 'wiki', output_dir: 'output' });
    assert.deepEqual(exportSemArgs, ['--wiki-dir', 'wiki', '--output-dir', 'output']);

    const ontologyDef = SCRIPT_REGISTRY['ontology_rules'];
    const ontologyArgs = buildCliArgs(ontologyDef, { wiki_dir: 'wiki', strict: true });
    assert.deepEqual(ontologyArgs, ['wiki', '--strict']);

    const schemaInferDef = SCRIPT_REGISTRY['schema_infer'];
    const schemaInferArgs = buildCliArgs(schemaInferDef, { project: 'tesi', wiki_dir: 'wiki' });
    assert.deepEqual(schemaInferArgs, ['--project', 'tesi', '--wiki-dir', 'wiki']);

    const schemaLintDef = SCRIPT_REGISTRY['schema_lint'];
    const schemaLintArgs = buildCliArgs(schemaLintDef, { project: 'tesi', wiki_dir: 'wiki', strict: true, path: 'wiki/analisi', config: 'config/config.toml' });
    assert.deepEqual(schemaLintArgs, ['--project', 'tesi', '--wiki-dir', 'wiki', '--strict', '--path', 'wiki/analisi', '--config', 'config/config.toml']);
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

  async function runScript(
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ): Promise<string> {
    const res = await fetch(`${baseUrl}/api/scripts/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 200);
    return res.text();
  }

  function parseEvents(sse: string): Array<{ type: string; text?: string; cmd?: string; [key: string]: unknown }> {
    return sse
      .split('\n')
      .filter(l => l.startsWith('data: ') && l !== 'data: [DONE]')
      .map(l => JSON.parse(l.slice('data: '.length)));
  }

  async function runAndReadStartEvent(
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ): Promise<{ projectId?: string; cwd?: string; cmd?: string; [key: string]: unknown }> {
    const start = parseEvents(await runScript(body, headers)).find(e => e.type === 'start');
    assert.ok(start, 'expected a start SSE event');
    return start!;
  }

  test('execute scopes the script cwd to the project selected via X-Project-Id', async () => {
    const sse = await runScript(
      { scriptId: 'okf_stats', args: {} },
      { 'X-Project-Id': 'wikiforge' }
    );
    const events = parseEvents(sse);
    const start = events.find(e => e.type === 'start')!;
    assert.equal(start.projectId, 'wikiforge');
    assert.equal(start.cwd, path.resolve(process.cwd(), 'projects', 'wikiforge'));

    // End-to-end: the Python script must actually report the selected wiki.
    const stdout = events.filter(e => e.type === 'stdout').map(e => e.text || '').join('\n');
    assert.ok(stdout.includes(path.join('projects', 'wikiforge', 'wiki')), stdout);
    assert.ok(!stdout.includes(path.join('projects', 'tesi', 'wiki')), stdout);
  });

  test('execute accepts projectId in the body when no project header is present', async () => {
    const start = await runAndReadStartEvent({
      scriptId: 'okf_stats',
      projectId: 'wikiforge',
      args: {},
    });
    assert.equal(start.projectId, 'wikiforge');
    assert.equal(start.cwd, path.resolve(process.cwd(), 'projects', 'wikiforge'));
  });

  test('execute ignores stale/empty project args sent by the panel form', async () => {
    const emptyProject = await runAndReadStartEvent(
      { scriptId: 'schema_infer', args: { project: '', wiki_dir: 'wiki' } },
      { 'X-Project-Id': 'wikiforge' }
    );
    assert.ok(emptyProject.cmd!.includes('--project wikiforge'));

    const staleProject = await runAndReadStartEvent(
      { scriptId: 'schema_infer', args: { project: 'tesi', wiki_dir: 'wiki' } },
      { 'X-Project-Id': 'wikiforge' }
    );
    assert.ok(staleProject.cmd!.includes('--project wikiforge'));
    assert.ok(!staleProject.cmd!.includes('--project tesi'));
  });

  test('project header takes precedence over a conflicting body projectId', async () => {
    const start = await runAndReadStartEvent(
      { scriptId: 'okf_stats', projectId: 'tesi', args: {} },
      { 'X-Project-Id': 'wikiforge' }
    );
    assert.equal(start.projectId, 'wikiforge');
  });

  test('KE use-case execution is scoped to the selected project', async () => {
    const res = await fetch(`${baseUrl}/api/ke/use-cases/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Project-Id': 'wikiforge' },
      // Conflicting body id must not win over the header.
      body: JSON.stringify({ useCaseId: 'ke_schema_modeling', stepIndex: 0, projectId: 'tesi' }),
    });
    assert.equal(res.status, 200);
    const events = parseEvents(await res.text());
    const stepStart = events.find(e => e.type === 'step_start');
    assert.ok(stepStart, 'expected a step_start SSE event');
    assert.ok(stepStart!.cmd!.includes('--project wikiforge'), String(stepStart!.cmd));
    assert.ok(!stepStart!.cmd!.includes('--project tesi'), String(stepStart!.cmd));
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
