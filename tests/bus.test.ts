import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { createMessageBus } from '@backend/server/bus/messageBus';
import { json } from '@backend/server/api/http';
import { validateWithSchema } from '@backend/server/api/validation';
import { ROUTES } from '@shared/api/contracts';

test('MessageBus dispatches commands, publishes events and normalises errors', async () => {
  const bus = createMessageBus();
  const seen: string[] = [];
  bus.on('command:handled', (payload) => {
    seen.push((payload as { command: string }).command);
  });

  bus.register<{ value: number }>('math.double', (payload) => json({ result: payload.value * 2 }));
  const ok = await bus.dispatch('math.double', { value: 21 });
  assert.equal(ok.kind, 'json');
  assert.deepEqual((ok as { body: unknown }).body, { result: 42 });
  assert.deepEqual(seen, ['math.double']);

  bus.register('math.boom', () => { throw new Error('kaboom'); });
  const failed = await bus.dispatch('math.boom');
  assert.equal((failed as { status: number }).status, 500);
  assert.match(String((failed as { body: { error: string } }).body.error), /kaboom/);

  const missing = await bus.dispatch('math.missing');
  assert.equal((missing as { status: number }).status, 404);

  bus.use(() => json({ blocked: true }));
  const blocked = await bus.dispatch('math.double', { value: 21 });
  assert.deepEqual((blocked as { body: unknown }).body, { blocked: true });
});

test('catalogue schemas drive JSON Schema validation', () => {
  const save = ROUTES.find((route) => route.id === 'wiki.note.save')!;
  assert.deepEqual(validateWithSchema(save.request.body!, { id: 'a', content: '# A' }).errors, []);
  const invalid = validateWithSchema(save.request.body!, { id: 'a' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((message) => message.includes('content')));

  // A schema with component refs must compile too (used by promote-answer).
  const promote = ROUTES.find((route) => route.id === 'research.promoteAnswer')!;
  const result = validateWithSchema(promote.request.body!, { question: 'q' });
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('catalogue HTTP routes are served through the backend bus without behaviour changes', async (t) => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp-bus-' + Date.now());
  await fs.mkdir(path.join(tmpDir, 'docs', 'help'), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'docs', 'help', 'probe.md'),
    '---\nid: probe\ntitle: Probe\norder: 1\ngroup: Test\nmode: both\nkeywords: [probe]\ncontext: []\n---\nBody',
    'utf-8',
  );
  await fs.mkdir(path.join(tmpDir, 'skills', 'demo-skill'), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'skills', 'demo-skill', 'SKILL.md'),
    '---\nname: Demo\ndescription:>\n  A demo skill.\ntriggers:\n  commands: [demo]\n---\n',
    'utf-8',
  );

  const serverInstance = new AgentServer(tmpDir);
  assert.ok(serverInstance.getBus().has('help.list'));
  assert.ok(serverInstance.getBus().has('help.get'));
  assert.ok(serverInstance.getBus().has('skills.list'));
  assert.ok(serverInstance.getBus().has('scripts.list'));
  assert.ok(serverInstance.getBus().has('ke.useCases.list'));
  assert.ok(serverInstance.getBus().has('reviews.list'));
  assert.ok(serverInstance.getBus().has('ingest.queue.list'));
  assert.ok(serverInstance.getBus().has('ingest.queue.process'));
  assert.ok(serverInstance.getBus().has('graph.clusters'));

  const server = http.createServer(async (req, res) => {
    if (!(await serverInstance.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const help = await (await fetch(`http://localhost:${port}/api/help`)).json() as {
    success: boolean; topics: Array<{ id: string }>;
  };
  assert.equal(help.success, true);
  assert.equal(help.topics[0]?.id, 'probe');

  const topic = await (await fetch(`http://localhost:${port}/api/help/probe`)).json() as {
    success: boolean; topic: { id: string; markdown: string };
  };
  assert.equal(topic.topic.id, 'probe');
  assert.equal(topic.topic.markdown, 'Body');

  const missing = await fetch(`http://localhost:${port}/api/help/not-there`);
  assert.equal(missing.status, 404);

  const skills = await (await fetch(`http://localhost:${port}/api/skills`)).json() as {
    success: boolean; skills: Array<{ id: string; name: string }>;
  };
  assert.equal(skills.skills[0]?.id, 'demo-skill');
  assert.equal(skills.skills[0]?.name, 'Demo');

  for (const endpoint of ['/api/scripts/list', '/api/scripts/registry']) {
    const payload = await (await fetch(`http://localhost:${port}${endpoint}`)).json() as {
      success: boolean; scripts: unknown[]; registry: unknown;
    };
    assert.equal(payload.success, true, endpoint);
    assert.ok(payload.scripts.length > 0, endpoint);
    assert.ok(payload.registry, endpoint);
  }

  const useCases = await (await fetch(`http://localhost:${port}/api/ke/use-cases`)).json() as {
    success: boolean; useCases: unknown[];
  };
  assert.equal(useCases.success, true);
  assert.equal(useCases.useCases.length, 8);
});

test('review queue routes keep their payload, storage path and atomic writes', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tests', 'tmp-reviews-'));
  const serverInstance = new AgentServer(tmpDir);
  for (const command of ['reviews.list', 'reviews.add', 'reviews.action']) {
    assert.ok(serverInstance.getBus().has(command), `missing ${command}`);
  }

  const server = http.createServer(async (req, res) => {
    if (!(await serverInstance.handleRequest(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${(server.address() as { port: number }).port}`;
  const reviewFile = path.join(tmpDir, '.llm-wiki', 'reviews.json');
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const initial = await (await fetch(`${base}/api/reviews`)).json() as {
    success: boolean; reviews: unknown[];
  };
  assert.deepEqual(initial, { success: true, reviews: [] });

  const added = await (await fetch(`${base}/api/reviews/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Needs review', sourceFile: 'wiki/note.md' }),
  })).json() as {
    success: boolean; review: { id: string; recommendedAction: string; reason: string; status: string };
  };
  assert.equal(added.success, true);
  assert.match(added.review.id, /^rev-/);
  assert.equal(added.review.recommendedAction, 'Create Page');
  assert.equal(added.review.reason, 'Flagged for human review');
  assert.equal(added.review.status, 'pending');

  const stored = JSON.parse(await fs.readFile(reviewFile, 'utf-8')) as Array<{ id: string }>;
  assert.deepEqual(stored.map((item) => item.id), [added.review.id]);

  const listed = await (await fetch(`${base}/api/reviews`)).json() as {
    success: boolean; reviews: Array<{ id: string }>;
  };
  assert.deepEqual(listed.reviews.map((item) => item.id), [added.review.id]);

  const acted = await (await fetch(`${base}/api/reviews/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: added.review.id, action: 'approve' }),
  })).json() as { success: boolean };
  assert.deepEqual(acted, { success: true });
  assert.deepEqual(JSON.parse(await fs.readFile(reviewFile, 'utf-8')), []);

  const malformed = await fetch(`${base}/api/reviews/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(malformed.status, 500);
  assert.match(String((await malformed.json() as { error: string }).error), /Invalid JSON body/);
});
