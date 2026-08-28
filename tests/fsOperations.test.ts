import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer } from '../src/server/agentServer';
import { ApiStorage } from '../src/storage/ApiStorage';

describe('Filesystem Operations Test Suite', () => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp_fs_test');
  let server: AgentServer;
  let httpServer: http.Server;
  let baseUrl: string;
  let storage: ApiStorage;

  before(async () => {
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'raw'), { recursive: true });

    server = new AgentServer(tmpDir);

    httpServer = http.createServer((req, res) => {
      void server.handleRequest(req, res);
    });

    await new Promise<void>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const address = httpServer.address() as { port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        storage = new ApiStorage(baseUrl);
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('createFolder creates directory on disk inside wiki', async () => {
    const success = await storage.createFolder('project-docs');
    assert.strictEqual(success, true);
    const exists = await fs.stat(path.join(tmpDir, 'wiki', 'project-docs')).then(s => s.isDirectory()).catch(() => false);
    assert.strictEqual(exists, true);
  });

  test('createFile creates markdown note on disk', async () => {
    const note = await storage.createFile('project-docs', 'architecture.md', '# Architecture\n\nDesign document.');
    assert.strictEqual(note.id, 'architecture');
    const content = await fs.readFile(path.join(tmpDir, 'wiki', 'project-docs', 'architecture.md'), 'utf-8');
    assert.ok(content.includes('Design document.'));
  });

  test('renameItem renames file on disk', async () => {
    const oldPath = 'wiki/project-docs/architecture.md';
    const success = await storage.renameItem(oldPath, 'system-architecture.md');
    assert.strictEqual(success, true);
    const existsNew = await fs.stat(path.join(tmpDir, 'wiki', 'project-docs', 'system-architecture.md')).then(s => s.isFile()).catch(() => false);
    assert.strictEqual(existsNew, true);
  });

  test('moveItem moves file into target folder', async () => {
    await storage.createFolder('archive');
    const sourcePath = 'wiki/project-docs/system-architecture.md';
    const success = await storage.moveItem(sourcePath, 'archive');
    assert.strictEqual(success, true);
    const existsInArchive = await fs.stat(path.join(tmpDir, 'wiki', 'archive', 'system-architecture.md')).then(s => s.isFile()).catch(() => false);
    assert.strictEqual(existsInArchive, true);
  });

  test('uploadFile saves text and base64 encoded content', async () => {
    const successText = await storage.uploadFile('project-docs', 'readme.txt', 'Sample text file');
    assert.strictEqual(successText, true);

    const successBin = await storage.uploadFile('project-docs', 'data.bin', new Uint8Array([1, 2, 3, 4]).buffer);
    assert.strictEqual(successBin, true);

    const textContent = await fs.readFile(path.join(tmpDir, 'wiki', 'project-docs', 'readme.txt'), 'utf-8');
    assert.strictEqual(textContent, 'Sample text file');
  });

  test('deleteNote deletes file or folder on disk', async () => {
    const success = await storage.deleteNote('wiki/project-docs/readme.txt');
    assert.strictEqual(success, true);
    const exists = await fs.stat(path.join(tmpDir, 'wiki', 'project-docs', 'readme.txt')).catch(() => null);
    assert.strictEqual(exists, null);
  });

  test('rejects path traversal security attempt', async () => {
    const res = await fetch(`${baseUrl}/api/wiki/folder/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: '../../etc/hacked' }),
    });
    assert.strictEqual(res.status, 400);
  });
});
