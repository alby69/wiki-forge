import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import * as toml from 'smol-toml';
import { AgentServer } from '@backend/server/agentServer';
import { ProjectService, type ProjectBundle } from '@backend/server/projectService';
import { listTrash, restoreFromTrash } from '@backend/server/safeFs';

describe('F5 — project lifecycle', () => {
  let tmpDir: string;
  let service: ProjectService;

  const registryPath = () => path.join(tmpDir, 'config', 'projects.json');
  const projectPath = (id: string) => path.join(tmpDir, 'projects', id);
  const exists = async (target: string) => (await fs.stat(target).catch(() => null)) !== null;
  const readRegistry = async () => JSON.parse(await fs.readFile(registryPath(), 'utf-8')) as Array<Record<string, unknown>>;
  const writeRegistry = async (entries: unknown) => {
    await fs.mkdir(path.dirname(registryPath()), { recursive: true });
    await fs.writeFile(registryPath(), JSON.stringify(entries, null, 2), 'utf-8');
  };
  const readConfig = async (dir: string) => toml.parse(await fs.readFile(path.join(dir, 'config', 'config.toml'), 'utf-8')) as Record<string, any>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-project-lifecycle-'));
    await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'config', 'config.toml'),
      [
        '[project]',
        'name = "root-source"',
        'title = "Root Source"',
        '',
        '[paths]',
        'sources = "sources"',
        'raw = "raw"',
        'wiki = "wiki"',
        'output = "output"',
        'notes = "notes"',
        'templates = "templates"',
        '',
        '[agent]',
        'confirm_destructive = true',
        '',
      ].join('\n'),
      'utf-8'
    );
    service = new ProjectService(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('create sanitizes the id, scaffolds every directory and copies the root config', async () => {
    const entry = await service.create('  Alpha Project  ', 'Alpha Wiki');

    assert.equal(entry.id, 'alpha-project');
    assert.equal(entry.name, 'Alpha Wiki');
    assert.equal(entry.path, 'projects/alpha-project');
    assert.ok(entry.createdAt);

    for (const dir of ['sources', 'raw', 'wiki', 'output', 'notes', 'templates']) {
      assert.equal(await exists(path.join(projectPath('alpha-project'), dir)), true, `${dir} scaffolded`);
    }

    const config = await readConfig(projectPath('alpha-project'));
    assert.equal(config.project.name, 'alpha-project');
    assert.equal(config.project.title, 'Alpha Wiki');
    assert.equal(config.paths.templates, 'templates');
    assert.equal(config.agent.confirm_destructive, true, 'root sections survive the copy');

    assert.ok((await readRegistry()).some((item) => item.id === 'alpha-project'));
  });

  it('create rejects duplicate ids without touching the registry', async () => {
    await service.create('dupe', 'First');
    const before = await readRegistry();

    await assert.rejects(() => service.create('dupe', 'Second'), /already exists/);
    await assert.rejects(() => service.create('DUPE', 'Third'), /already exists/);

    assert.deepEqual(await readRegistry(), before);
    assert.equal(await exists(projectPath('dupe')), true);
  });

  it('rename updates the display name in registry and config without changing id or path', async () => {
    const created = await service.create('rename-me', 'Old Name');
    const renamed = await service.rename(created.id, 'New Display Name');

    assert.equal(renamed.id, 'rename-me');
    assert.equal(renamed.path, 'projects/rename-me');
    assert.equal(renamed.name, 'New Display Name');

    const config = await readConfig(projectPath('rename-me'));
    assert.equal(config.project.name, 'rename-me');
    assert.equal(config.project.title, 'New Display Name');
    assert.equal((await readRegistry()).find((item) => item.id === 'rename-me')?.name, 'New Display Name');
  });

  it('clone copies content but excludes runtime files, and honours include flags', async () => {
    await service.create('source', 'Source');
    const source = projectPath('source');
    const extras: Array<[string, string]> = [
      ['wiki/intro.md', '# Intro'],
      ['raw/doc.txt', 'raw text'],
      ['sources/ref.md', 'reference'],
      ['notes/note.md', 'note'],
      ['output/report.md', 'report'],
      ['templates/t.md', 'template'],
      ['.wiki-forge/trash/junk.txt', 'junk'],
      ['.wiki-forge/snapshots/snap.json', '{}'],
      ['cache.db', 'database'],
      ['node_modules/pkg/index.js', 'module'],
    ];
    for (const [relative, content] of extras) {
      const target = path.join(source, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf-8');
    }

    const copy = await service.clone('source', { id: 'copy', name: 'Copy' });
    assert.equal(copy.sourceProjectId, 'source');
    for (const relative of ['wiki/intro.md', 'raw/doc.txt', 'sources/ref.md', 'notes/note.md', 'output/report.md', 'templates/t.md']) {
      assert.equal(await exists(path.join(projectPath('copy'), relative)), true, `${relative} copied`);
    }
    for (const relative of ['.wiki-forge/trash/junk.txt', '.wiki-forge/snapshots/snap.json', 'cache.db', 'node_modules/pkg/index.js']) {
      assert.equal(await exists(path.join(projectPath('copy'), relative)), false, `${relative} excluded`);
    }
    assert.equal((await readConfig(projectPath('copy'))).project.title, 'Copy');

    const wikiOnly = await service.clone('source', {
      id: 'wiki-only',
      name: 'Wiki Only',
      include: { wiki: true, raw: false, sources: false, notes: false, output: false, config: false },
    });
    assert.equal(wikiOnly.sourceProjectId, 'source');
    assert.equal(await exists(path.join(projectPath('wiki-only'), 'wiki', 'intro.md')), true);
    assert.equal(await exists(path.join(projectPath('wiki-only'), 'raw', 'doc.txt')), false);
    const fallbackConfig = await readConfig(projectPath('wiki-only'));
    assert.equal(fallbackConfig.project.name, 'wiki-only');
    assert.equal(fallbackConfig.paths.templates, 'templates');
  });

  it('archive moves the folder under .wiki-forge/archive and restore brings it back', async () => {
    await service.create('archived', 'Archived');
    const originalFile = path.join(projectPath('archived'), 'wiki', 'keep.md');
    await fs.writeFile(originalFile, 'keep me', 'utf-8');

    const { entry } = await service.archive('archived');
    const archiveFolder = path.join(tmpDir, '.wiki-forge', 'archive', entry.id);
    assert.equal(await exists(archiveFolder), true);
    assert.equal(await exists(projectPath('archived')), false);
    assert.equal((await service.get('archived'))?.archived, true);
    assert.equal((await service.list()).some((project) => project.id === 'archived'), false);
    assert.equal((await service.list({ includeArchived: true })).some((project) => project.id === 'archived'), true);
    assert.equal(await fs.readFile(path.join(archiveFolder, 'wiki', 'keep.md'), 'utf-8'), 'keep me');

    const restored = await service.restore('archived');
    assert.equal(restored.archived, undefined);
    assert.equal(await exists(archiveFolder), false);
    assert.equal(await fs.readFile(originalFile, 'utf-8'), 'keep me');
  });

  it('delete mode trash keeps the folder recoverable in safeFs trash', async () => {
    await service.create('trashed', 'Trashed');
    const file = path.join(projectPath('trashed'), 'wiki', 'recover.md');
    await fs.writeFile(file, 'recover me', 'utf-8');

    const result = await service.remove('trashed', 'trash');
    assert.equal(result.mode, 'trash');
    assert.ok(result.trashed?.id);
    assert.equal(await exists(projectPath('trashed')), false);
    assert.equal((await readRegistry()).some((item) => item.id === 'trashed'), false);

    const entries = await listTrash(tmpDir);
    assert.equal(entries[0].id, result.trashed!.id);
    const trashedFile = path.join(tmpDir, result.trashed!.trashedPath, 'wiki', 'recover.md');
    assert.equal(await fs.readFile(trashedFile, 'utf-8'), 'recover me');

    await restoreFromTrash(tmpDir, result.trashed!.id);
    assert.equal(await fs.readFile(file, 'utf-8'), 'recover me');
  });

  it('delete mode permanent requires an explicit confirm token and never touches default', async () => {
    await service.create('permanent', 'Permanent');

    await assert.rejects(() => service.remove('permanent', 'permanent'), /requires confirm/);
    await assert.rejects(() => service.remove('permanent', 'permanent', 'wrong'), /requires confirm/);
    assert.equal(await exists(projectPath('permanent')), true);

    await assert.rejects(() => service.remove('default', 'trash'), /Cannot delete default project/);
    await assert.rejects(() => service.remove('default', 'unregister'), /Cannot delete default project/);

    const result = await service.remove('permanent', 'permanent', 'permanent');
    assert.equal(result.mode, 'permanent');
    assert.equal(await exists(projectPath('permanent')), false);
    assert.equal((await readRegistry()).some((item) => item.id === 'permanent'), false);
  });

  it('export/import round-trips files, manifest metadata and stats', async () => {
    await service.create('origin', 'Origin');
    await fs.writeFile(path.join(projectPath('origin'), 'wiki', 'note.md'), '# Note', 'utf-8');
    await fs.writeFile(path.join(projectPath('origin'), 'raw', 'binary.dat'), Buffer.from([0, 1, 2, 255]));

    const json = await service.export('origin');
    const bundle = JSON.parse(json) as ProjectBundle;
    assert.equal(bundle.manifest.format, 'wikiforge-project');
    assert.equal(bundle.manifest.version, 1);
    assert.equal(bundle.manifest.id, 'origin');
    assert.equal(bundle.manifest.name, 'Origin');
    assert.ok(bundle.manifest.exportedAt);
    const paths = bundle.manifest.files.map((file) => file.path);
    assert.ok(paths.includes('wiki/note.md'));
    assert.ok(paths.includes('raw/binary.dat'));
    assert.ok(bundle.manifest.files.every((file) => file.encoding === 'base64'));

    const importedBundle: ProjectBundle = {
      ...bundle,
      manifest: { ...bundle.manifest, id: 'imported', name: 'Imported' },
    };
    const imported = await service.import(importedBundle);
    assert.equal(imported.id, 'imported');
    assert.equal(imported.name, 'Imported');
    assert.equal(await fs.readFile(path.join(projectPath('imported'), 'wiki', 'note.md'), 'utf-8'), '# Note');
    assert.deepEqual(await fs.readFile(path.join(projectPath('imported'), 'raw', 'binary.dat')), Buffer.from([0, 1, 2, 255]));
    assert.equal((await readConfig(projectPath('imported'))).project.title, 'Imported');

    const stats = await service.stats('imported');
    assert.equal(stats.notes, 1);
    assert.equal(stats.assets, 1);
    assert.ok(stats.totalBytes > 0);
  });

  it('rejects path traversal both from a poisoned registry and from an import bundle', async () => {
    await writeRegistry([{ id: 'evil', name: 'Evil', path: '../outside' }]);
    await assert.rejects(() => service.resolveRoot('evil'), /traversal/);

    const malicious: ProjectBundle = {
      manifest: {
        format: 'wikiforge-project',
        version: 1,
        id: 'bundle-evil',
        name: 'Bundle Evil',
        exportedAt: new Date().toISOString(),
        files: [{ path: '../escape.txt', encoding: 'base64' }],
      },
      files: { '../escape.txt': Buffer.from('escaped').toString('base64') },
    };
    await assert.rejects(() => service.import(malicious), /traversal/);
    assert.equal(await exists(path.join(tmpDir, '..', 'escape.txt')), false);
  });

  it('clone with a duplicate id leaves the registry and filesystem untouched', async () => {
    await service.create('clone-source', 'Clone Source');
    await service.create('taken', 'Taken');
    const before = await readRegistry();

    await assert.rejects(
      () => service.clone('clone-source', { id: 'taken', name: 'Should Not Exist' }),
      /already exists/
    );

    assert.deepEqual(await readRegistry(), before);
    assert.equal((await readConfig(projectPath('taken'))).project.title, 'Taken');
    assert.equal(await exists(path.join(tmpDir, 'projects', 'should-not-exist')), false);
  });

  it('HTTP routes delegate rename, clone, config merge, archive/restore, export/import and guarded delete', async () => {
    await service.create('route-source', 'Route Source');

    const agentServer = new AgentServer(tmpDir);
    const server = http.createServer((req, res) => {
      void agentServer.handleRequest(req, res).then((handled) => {
        if (!handled) {
          res.writeHead(404);
          res.end();
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as { port: number }).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const jsonRequest = (url: string, method: string, body?: unknown) =>
      fetch(`${baseUrl}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    try {
      const patch = await jsonRequest('/api/projects/route-source', 'PATCH', { name: 'Renamed By Route' });
      assert.equal(patch.status, 200);
      assert.equal(((await patch.json()) as any).project.name, 'Renamed By Route');

      const put = await jsonRequest('/api/projects/route-source/config', 'PUT', {
        project: { title: 'Patched Title' },
      });
      assert.equal(put.status, 200);
      const merged = await readConfig(projectPath('route-source'));
      assert.equal(merged.project.title, 'Patched Title');
      assert.equal(merged.agent.confirm_destructive, true, 'PUT merges instead of replacing');
      assert.equal((await readRegistry()).find((item) => item.id === 'route-source')?.name, 'Patched Title');

      const cloned = await jsonRequest('/api/projects/route-source/clone', 'POST', {
        id: 'route-copy',
        name: 'Route Copy',
      });
      assert.equal(cloned.status, 200);
      assert.equal(((await cloned.json()) as any).project.sourceProjectId, 'route-source');

      const stats = await (await fetch(`${baseUrl}/api/projects/route-copy/stats`)).json() as any;
      assert.equal(stats.success, true);
      assert.equal(typeof stats.stats.totalBytes, 'number');

      const exported = await (await fetch(`${baseUrl}/api/projects/route-source/export`)).json() as any;
      assert.equal(exported.success, true);
      assert.equal(exported.bundle.manifest.id, 'route-source');

      const imported = await jsonRequest('/api/projects/import', 'POST', {
        bundle: {
          ...exported.bundle,
          manifest: { ...exported.bundle.manifest, id: 'route-import', name: 'Route Import' },
        },
      });
      assert.equal(imported.status, 200);
      assert.equal(((await imported.json()) as any).project.id, 'route-import');

      const archived = await jsonRequest('/api/projects/route-import/archive', 'POST');
      assert.equal(archived.status, 200);
      assert.equal((await service.get('route-import'))?.archived, true);

      const restored = await jsonRequest('/api/projects/route-import/restore', 'POST');
      assert.equal(restored.status, 200);
      assert.equal((await service.get('route-import'))?.archived, undefined);

      const unconfirmed = await fetch(`${baseUrl}/api/projects/route-import?mode=permanent`, { method: 'DELETE' });
      assert.equal(unconfirmed.status, 400);

      const confirmed = await fetch(
        `${baseUrl}/api/projects/route-import?mode=permanent&confirm=route-import`,
        { method: 'DELETE' }
      );
      assert.equal(confirmed.status, 200);
      assert.equal(await exists(projectPath('route-import')), false);

      const listed = await (await fetch(`${baseUrl}/api/projects`)).json() as any;
      assert.ok(listed.projects.some((project: any) => project.id === 'route-source'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
