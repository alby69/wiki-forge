import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer } from '@backend/server/agentServer';

describe('A7 — changeset Plan / Review / Apply', () => {
  let tmpDir: string;
  let baseUrl: string;
  let server: http.Server;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-changesets-'));
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
    const agentServer = new AgentServer(tmpDir);
    server = http.createServer((req, res) => {
      void agentServer.handleRequest(req, res).then((handled) => {
        if (!handled) { res.writeHead(404); res.end(); }
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function post<T = any>(url: string, body?: unknown): Promise<{ status: number; body: T }> {
    const res = await fetch(baseUrl + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as T };
  }

  it('stages LLM edits without touching the wiki, then applies after review', async () => {
    const note = path.join(tmpDir, 'wiki', 'note.md');
    await fs.writeFile(note, '# Old\n\ntext to replace\n', 'utf-8');

    const staged = await post('/api/v1/changesets', {
      description: 'LLM proposal',
      author: 'agent:chat',
      rationale: 'grounded in wiki',
      sources: ['chat'],
      edits: [{ file: 'wiki/note.md', action: 'modify', find: 'text to replace', replace: 'new text' }],
    });
    assert.equal(staged.status, 201);
    const id = (staged.body as any).changeset.id;
    assert.match(id, /^cs-/);

    // Nothing was written yet.
    assert.match(await fs.readFile(note, 'utf-8'), /text to replace/);
    const pending = await (await fetch(`${baseUrl}/api/v1/changesets?status=pending`)).json() as any;
    assert.equal(pending.changesets.length, 1);

    const applied = await post(`/api/v1/changesets/${id}/apply`);
    assert.equal(applied.status, 200);
    assert.deepEqual((applied.body as any).appliedFiles, ['wiki/note.md']);
    assert.match(await fs.readFile(note, 'utf-8'), /new text/);

    const stillPending = await (await fetch(`${baseUrl}/api/v1/changesets?status=pending`)).json() as any;
    assert.equal(stillPending.changesets.length, 0);
  });

  it('rejects a changeset without modifying the file', async () => {
    const note = path.join(tmpDir, 'wiki', 'note.md');
    await fs.writeFile(note, 'original', 'utf-8');
    const staged = await post('/api/v1/changesets', {
      description: 'to reject',
      edits: [{ file: 'wiki/note.md', action: 'modify', proposed_content: 'replacement' }],
    });
    const id = (staged.body as any).changeset.id;

    const rejected = await post(`/api/v1/changesets/${id}/reject`, { reason: 'not grounded' });
    assert.equal(rejected.status, 200);
    assert.equal((rejected.body as any).changeset.status, 'rejected');
    assert.equal(await fs.readFile(note, 'utf-8'), 'original');
  });

  it('refuses a find block that no longer exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'wiki', 'note.md'), 'original', 'utf-8');
    const staged = await post('/api/v1/changesets', {
      description: 'stale edit',
      edits: [{ file: 'wiki/note.md', action: 'modify', find: 'missing', replace: 'x' }],
    });
    const id = (staged.body as any).changeset.id;
    const applied = await post(`/api/v1/changesets/${id}/apply`);
    assert.equal(applied.status, 400);
    assert.match((applied.body as any).error, /Find block not found/);
  });

  it('refuses paths that escape the project root', async () => {
    const escaped = await post('/api/v1/changesets', {
      description: 'traversal',
      edits: [{ file: '../outside.md', action: 'create', proposed_content: 'x' }],
    });
    assert.equal(escaped.status, 400);
  });

  it('delete edits go through the trash, not unlink', async () => {
    const note = path.join(tmpDir, 'wiki', 'doomed.md');
    await fs.writeFile(note, 'keep me', 'utf-8');
    const staged = await post('/api/v1/changesets', {
      description: 'remove note',
      edits: [{ file: 'wiki/doomed.md', action: 'delete' }],
    });
    const id = (staged.body as any).changeset.id;
    assert.equal((await post(`/api/v1/changesets/${id}/apply`)).status, 200);
    await assert.rejects(() => fs.access(note), /ENOENT/);

    const trash = await (await fetch(`${baseUrl}/api/wiki/trash`)).json() as any;
    assert.equal(trash.entries.length, 1);
    assert.equal(trash.entries[0].originalPath, 'wiki/doomed.md');
  });
});
