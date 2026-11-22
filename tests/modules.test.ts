import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type * as http from 'node:http';
import { PYTHON_CMD } from '@backend/server/agentServer';
import { createMessageBus } from '@backend/server/bus/messageBus';
import type { BinaryResult, JsonResult, SseResult } from '@backend/server/api/http';
import { createIngestionModule } from '@backend/server/modules/ingestionModule';
import { createGraphModule } from '@backend/server/modules/graphModule';
import type { PythonTool } from '@backend/server/modules/pythonTool';

test('ingestion and graph modules dispatch Python tools through the bus', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tests', 'tmp-modules-'));
  const scriptPath = path.join(tmpDir, 'fake_tool.py');
  await fs.writeFile(scriptPath, [
    'import json',
    'print(json.dumps({',
    '  "items": [{"file": "raw/a.md"}],',
    '  "surprising_connections": [{"from": "a", "to": "b"}],',
    '  "knowledge_gaps": ["c"]',
    '}))',
  ].join('\n'), 'utf-8');
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const tool: PythonTool = {
    resolveRoot: async () => tmpDir,
    pathFor: () => scriptPath,
    pythonCmd: PYTHON_CMD,
  };
  const bus = createMessageBus();
  createIngestionModule(tool).register(bus);
  createGraphModule(tool).register(bus);

  const list = await bus.dispatch('ingest.queue.list', {}, { projectId: 'demo' });
  assert.equal(list.kind, 'binary');
  assert.match(String((list as BinaryResult).body), /raw\/a\.md/);
  assert.equal((list as BinaryResult).contentType, 'application/json');

  const add = await bus.dispatch('ingest.queue.add', { filePath: 'raw/a.md' }, { projectId: 'demo' });
  assert.equal(add.kind, 'binary');
  assert.match(String((add as BinaryResult).body), /knowledge_gaps/);

  const clusters = await bus.dispatch('graph.clusters', {}, { projectId: 'demo' });
  assert.equal(clusters.kind, 'binary');
  assert.match(String((clusters as BinaryResult).body), /surprising_connections/);

  const insights = await bus.dispatch('graph.insights', {}, { projectId: 'demo' });
  assert.equal(insights.kind, 'json');
  assert.deepEqual((insights as JsonResult).body, {
    success: true,
    surprisingConnections: [{ from: 'a', to: 'b' }],
    knowledgeGaps: ['c'],
  });
});

test('ingestion process streams the original SSE frame sequence through the bus', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tests', 'tmp-sse-'));
  const scriptPath = path.join(tmpDir, 'emit.py');
  await fs.writeFile(scriptPath, [
    'import sys',
    'print("converted a note")',
    'print("minor warning", file=sys.stderr)',
  ].join('\n'), 'utf-8');
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const tool: PythonTool = {
    resolveRoot: async () => tmpDir,
    pathFor: () => scriptPath,
    pythonCmd: PYTHON_CMD,
  };
  const bus = createMessageBus();
  createIngestionModule(tool).register(bus);
  const result = await bus.dispatch('ingest.queue.process', {}, { projectId: 'demo' });
  assert.equal(result.kind, 'sse');

  const frames: string[] = [];
  let finish!: () => void;
  const ended = new Promise<void>((resolve) => { finish = resolve; });
  const fakeRes = {
    write: (chunk: string) => { frames.push(chunk); return true; },
    end: () => finish(),
  } as unknown as http.ServerResponse;

  await (result as SseResult).write(fakeRes);
  await ended;

  const stream = frames.join('');
  assert.match(stream, /"type":"start"/);
  assert.match(stream, /"type":"stdout"/);
  assert.match(stream, /converted a note/);
  assert.match(stream, /"type":"stderr"/);
  assert.match(stream, /"type":"exit","code":0/);
  assert.ok(stream.endsWith('data: [DONE]\n\n'));
});
