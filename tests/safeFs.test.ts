import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer } from '@backend/server/agentServer';
import {
  atomicWriteFile,
  getTrashDir,
  listTrash,
  restoreFromTrash,
  softDelete,
} from '@backend/server/safeFs';

describe('A5/A11 — safe filesystem layer', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-safe-fs-'));
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('atomicWriteFile writes content without leaving temp files', async () => {
    const target = path.join(tmpDir, 'wiki', 'note.md');
    await atomicWriteFile(target, '---\ntitle: Note\n---\n');
    assert.equal(await fs.readFile(target, 'utf-8'), '---\ntitle: Note\n---\n');
    const leftovers = (await fs.readdir(path.join(tmpDir, 'wiki'))).filter(f => f.endsWith('.tmp'));
    assert.deepEqual(leftovers, []);
  });

  it('softDelete moves to .wiki-forge/trash and restore brings it back', async () => {
    const target = path.join(tmpDir, 'wiki', 'note.md');
    await fs.writeFile(target, 'content', 'utf-8');

    const entry = await softDelete(target, tmpDir);
    assert.equal(entry.originalPath, 'wiki/note.md');
    assert.equal(entry.type, 'file');
    await assert.rejects(() => fs.access(target), /ENOENT/);
    assert.ok((await fs.readFile(path.join(tmpDir, entry.trashedPath), 'utf-8')) === 'content');

    const entries = await listTrash(tmpDir);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, entry.id);

    const restored = await restoreFromTrash(tmpDir, entry.id);
    assert.equal(restored, 'wiki/note.md');
    assert.equal(await fs.readFile(target, 'utf-8'), 'content');
  });

  it('API delete is recoverable via the trash endpoints', async () => {
    const target = path.join(tmpDir, 'wiki', 'api-note.md');
    await fs.writeFile(target, 'via api', 'utf-8');

    const agentServer = new AgentServer(tmpDir);
    const server = http.createServer((req, res) => {
      void agentServer.handleRequest(req, res).then((handled) => {
        if (!handled) { res.writeHead(404); res.end(); }
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as { port: number }).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const del = await fetch(`${baseUrl}/api/wiki/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: 'wiki/api-note.md' }),
      });
      assert.equal(del.status, 200);
      const deleted = await del.json() as any;
      assert.ok(deleted.trashed?.id, 'delete returns a trash id');

      // The original path is gone from wiki/ but the bytes survived in trash.
      await assert.rejects(() => fs.access(target), /ENOENT/);
      const trashDir = getTrashDir(tmpDir);
      const files = await fs.readdir(trashDir);
      assert.ok(files.some(f => f.includes('wiki__api-note.md')), 'file is in trash');

      const listed = await (await fetch(`${baseUrl}/api/wiki/trash`)).json() as any;
      assert.equal(listed.entries.length, 1);
      assert.equal(listed.entries[0].id, deleted.trashed.id);

      const restored = await fetch(`${baseUrl}/api/wiki/trash/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleted.trashed.id }),
      });
      assert.equal(restored.status, 200);
      assert.equal(await fs.readFile(target, 'utf-8'), 'via api');
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
