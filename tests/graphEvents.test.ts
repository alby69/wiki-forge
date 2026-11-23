import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import { AgentServer } from '@backend/server/agentServer';
import { GraphEventHub, graphChangedFrame } from '@backend/server/graphEvents';
import {
  adaptServerGraphData,
  parseGraphFrame,
  startGraphEventSubscription,
} from '@frontend/core/graphEvents';
import { eventBus } from '@frontend/core/events';

interface Harness {
  baseUrl: string;
  close: () => Promise<void>;
}

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-graph-events-'));
  await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
  const agentServer = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    if (!(await agentServer.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

describe('C7 — real-time graph propagation', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness();
  });

  after(async () => {
    await h.close();
  });

  it('fans typed frames out per project and ends streams on close', () => {
    const hub = new GraphEventHub();
    const first = new PassThrough();
    const second = new PassThrough();
    const firstChunks: string[] = [];
    const secondChunks: string[] = [];
    first.on('data', (chunk: Buffer) => firstChunks.push(chunk.toString()));
    second.on('data', (chunk: Buffer) => secondChunks.push(chunk.toString()));
    const removeFirst = hub.addClient(first as unknown as http.ServerResponse, 'alpha');
    hub.addClient(second as unknown as http.ServerResponse, 'beta');
    assert.equal(hub.size, 2);

    assert.equal(hub.publish(graphChangedFrame('neo4j', {
      projectId: 'alpha', id: 'alpha', revision: 7,
    })), 1);
    assert.match(firstChunks.join(''), /"origin":"neo4j"/);
    assert.match(firstChunks.join(''), /"revision":7/);
    assert.match(firstChunks.join(''), /"projectId":"alpha"/);
    assert.equal(secondChunks.join(''), '');

    assert.equal(hub.publish(graphChangedFrame('neo4j', { projectId: 'beta' })), 1);
    assert.match(secondChunks.join(''), /"projectId":"beta"/);
    assert.equal(hub.publish(graphChangedFrame('neo4j', { id: 'global' })), 2);

    removeFirst();
    assert.equal(hub.size, 1);
    hub.close();
    assert.equal(hub.size, 0);
    assert.equal(second.writableEnded, true);
  });

  it('parses SSE frames and adapts server GraphData without touching GraphService', () => {
    const parsed = parseGraphFrame(JSON.stringify({
      type: 'graph:changed', event: 'graph:changed', origin: 'neo4j', id: 'alpha', revision: 7,
      graph: {
        nodes: [{ id: 'alpha', title: 'Alpha', group: 'wiki', tags: ['neo4j'] }, { id: 42 }],
        links: [{ source: 'alpha', target: 'beta' }, { source: 'alpha', target: 'alpha', type: 'self' }],
      },
    }));
    assert.equal(parsed?.origin, 'neo4j');
    assert.equal(parsed?.revision, 7);
    assert.equal(parseGraphFrame('not json'), undefined);
    assert.equal(parseGraphFrame(JSON.stringify({ type: 'snapshot' })), undefined);

    const graph = adaptServerGraphData(parsed?.graph);
    assert.deepEqual(graph?.nodes, [{ id: 'alpha', label: 'Alpha', group: 'wiki', val: 1, color: undefined, tags: ['neo4j'] }]);
    assert.deepEqual(graph?.links, [{ source: 'alpha', target: 'alpha', type: 'self' }]);
    assert.equal(adaptServerGraphData({ nodes: [] }), undefined);
  });

  it('emits graph:changed through the typed stream helper', async () => {
    const seen: string[] = [];
    const unsubscribeEvent = eventBus.on('graph:changed', (payload) => seen.push(payload.origin));
    let received: (frame: { data: string }) => void = () => {};
    const stop = startGraphEventSubscription({
      stream: async (onEvent) => { received = onEvent; },
    });

    received({ data: JSON.stringify({ type: 'snapshot' }) });
    received({ data: JSON.stringify({ type: 'graph:changed', origin: 'reconciler', revision: 9 }) });
    assert.deepEqual(seen, ['reconciler']);
    stop();
    received({ data: JSON.stringify({ type: 'graph:changed', origin: 'neo4j' }) });
    assert.deepEqual(seen, ['reconciler']);
    unsubscribeEvent();
  });

  it('opens an additive SSE route and pushes a frame when a changeset is applied', async () => {
    const controller = new AbortController();
    const stream = await fetch(`${h.baseUrl}/api/v1/graph/events`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();

    async function readFrame(): Promise<string> {
      let text = '';
      while (!text.includes('\n\n')) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      return text;
    }

    assert.match(await readFrame(), /"type":"snapshot"/);

    const staged = await fetch(`${h.baseUrl}/api/v1/changesets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'C7 event test',
        edits: [{ file: 'wiki/graph-event.md', action: 'create', proposed_content: '# Graph event\n' }],
      }),
    });
    assert.equal(staged.status, 201);
    const changeset = await staged.json() as { changeset: { id: string } };

    const applied = await fetch(`${h.baseUrl}/api/v1/changesets/${changeset.changeset.id}/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(applied.status, 200);

    const frame = await readFrame();
    assert.match(frame, /"type":"graph:changed"/);
    assert.match(frame, /"origin":"browser"/);
    assert.match(frame, /graph-event\.md/);
    controller.abort();
  });

  it('keeps UI components free of direct fetch calls', async () => {
    const components = path.join(process.cwd(), 'src', 'frontend', 'components');
    const files: string[] = [];
    async function collect(dir: string): Promise<void> {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await collect(full);
        else if (entry.name.endsWith('.ts')) files.push(full);
      }
    }
    await collect(components);
    assert.ok(files.length > 10);
    for (const file of files) {
      const source = await fs.readFile(file, 'utf-8');
      assert.ok(!/\bfetch\s*\(/.test(source), `direct fetch in ${file}`);
    }
  });
});
