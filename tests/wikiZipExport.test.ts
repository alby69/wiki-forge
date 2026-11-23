import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer } from '@backend/server/agentServer';
import { ProjectService } from '@backend/server/projectService';
import { createZip } from '@backend/server/zipFile';

const ENV_KEYS = [
  'WIKIFORGE_API_TOKEN',
  'WIKIFORGE_ADMIN_USERNAME',
  'WIKIFORGE_ADMIN_PASSWORD',
  'WIKIFORGE_USER_STORE_FILE',
] as const;

type EnvKey = typeof ENV_KEYS[number];

const CONFIG = [
  '[project]',
  'name = "zip-root"',
  'title = "Zip Root"',
  '',
  '[paths]',
  'sources = "sources"',
  'raw = "raw"',
  'wiki = "knowledge"',
  'output = "output"',
  'notes = "notes"',
  'templates = "templates"',
  '',
].join('\n');

function entryCount(zip: Buffer): number {
  assert.equal(zip.readUInt32LE(0), 0x04034b50, 'local file header signature');
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50, 'end-of-central-directory signature');
  return zip.readUInt16LE(zip.length - 12);
}

describe('Wiki ZIP export', () => {
  let tmpDir: string;
  let service: ProjectService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-wiki-zip-'));
    await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), CONFIG, 'utf-8');
    service = new ProjectService(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a deterministic ZIP with CRC32, UTF-8 names and no compression', () => {
    const zip = createZip([
      { name: 'index.md', data: Buffer.from('# Index', 'utf8'), date: new Date(2026, 0, 2, 3, 4, 6) },
      { name: 'guide/nested.md', data: Buffer.from('# Nested', 'utf8'), date: new Date(2026, 0, 2, 3, 4, 6) },
    ]);

    assert.equal(entryCount(zip), 2);
    assert.equal(zip.readUInt16LE(8), 0, 'stored (no compression)');
    assert.ok(zip.includes(Buffer.from('index.md', 'utf8')));
    assert.ok(zip.includes(Buffer.from('guide/nested.md', 'utf8')));
    assert.ok(zip.includes(Buffer.from('# Index', 'utf8')));
    assert.ok(zip.includes(Buffer.from('# Nested', 'utf8')));
  });

  it('collects Markdown from the configured wiki path and skips other files', async () => {
    await service.create('zip-project', 'Zip Project');
    const root = path.join(tmpDir, 'projects', 'zip-project', 'knowledge');
    await fs.mkdir(path.join(root, 'guide'), { recursive: true });
    await fs.writeFile(path.join(root, 'index.md'), '# Index', 'utf-8');
    await fs.writeFile(path.join(root, 'guide', 'nested.md'), '# Nested', 'utf-8');
    await fs.writeFile(path.join(root, 'skip.txt'), 'not markdown', 'utf-8');

    const zip = await service.exportWikiMarkdownZip('zip-project');

    assert.equal(entryCount(zip), 2);
    assert.ok(zip.includes(Buffer.from('index.md', 'utf8')));
    assert.ok(zip.includes(Buffer.from('guide/nested.md', 'utf8')));
    assert.ok(zip.includes(Buffer.from('# Nested', 'utf8')));
    assert.ok(!zip.includes(Buffer.from('skip.txt', 'utf8')));
  });

  it('requires local authentication and serves the archive over HTTP', async () => {
    await fs.mkdir(path.join(tmpDir, 'knowledge'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'knowledge', 'index.md'), '# Root wiki', 'utf-8');

    const previous = new Map<EnvKey, string | undefined>();
    for (const key of ENV_KEYS) previous.set(key, process.env[key]);
    delete process.env.WIKIFORGE_API_TOKEN;
    process.env.WIKIFORGE_ADMIN_USERNAME = 'zip-admin';
    process.env.WIKIFORGE_ADMIN_PASSWORD = 'zip-password-long';
    process.env.WIKIFORGE_USER_STORE_FILE = path.join(tmpDir, '.wiki-forge', 'users.json');

    const agentServer = new AgentServer(tmpDir);
    const server = http.createServer(async (req, res) => {
      if (!(await agentServer.handleRequest(req, res))) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const anonymous = await fetch(`${baseUrl}/api/projects/default/export/markdown.zip`);
      assert.equal(anonymous.status, 401);

      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'zip-admin', password: 'zip-password-long' }),
      });
      assert.equal(login.status, 200);
      const loginBody = await login.json() as { token?: string };
      assert.ok(loginBody.token);

      const response = await fetch(`${baseUrl}/api/projects/default/export/markdown.zip`, {
        headers: { Authorization: `Bearer ${loginBody.token}` },
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /application\/zip/);
      assert.match(response.headers.get('content-disposition') ?? '', /attachment; filename="default-wiki.zip"/);
      const zip = Buffer.from(await response.arrayBuffer());
      assert.equal(entryCount(zip), 1);
      assert.ok(zip.includes(Buffer.from('# Root wiki', 'utf8')));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
