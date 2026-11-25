import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);
const CLI = path.resolve('bin/wf.ts');

async function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return execFileAsync(process.execPath, ['--import', 'tsx', CLI, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
  });
}

describe('CLI wf — Fase 3 del piano di disaccoppiamento', () => {
  it('stampa il manifest generato', async () => {
    const { stdout } = await runCli(['manifest', '--format', 'text']);
    assert.match(stdout, /routes, \d+ comandi bus, \d+ gap/);
  });

  it('non invia richieste in dry-run', async () => {
    const { stdout } = await runCli(['wiki', 'list', '--dry-run', '--project', 'demo']);
    const output = JSON.parse(stdout) as Record<string, unknown>;
    assert.equal(output.operationId, 'wiki.notes.list');
    assert.equal(output.method, 'GET');
  });

  it('chiama l\'API via HTTP con progetto e token', async () => {
    const seen: Array<{ url?: string; method?: string; project?: string; token?: string }> = [];
    const server = createServer((req, res) => {
      seen.push({
        url: req.url,
        method: req.method,
        project: req.headers['x-project-id'] as string | undefined,
        token: req.headers['x-wikiforge-token'] as string | undefined,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, notes: [] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');

    try {
      const { stdout } = await runCli(
        ['api', 'wiki.notes.list', '--body', '{"query":{"limit":2}}', '--project', 'demo', '--token', 'tok'],
        { WIKI_FORGE_API_URL: `http://127.0.0.1:${address.port}` },
      );
      assert.deepEqual(JSON.parse(stdout), { success: true, notes: [] });
      assert.deepEqual(seen, [{
        url: '/api/wiki/notes?limit=2',
        method: 'GET',
        project: 'demo',
        token: 'tok',
      }]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('usa exit code 2 per input non valido', async () => {
    await assert.rejects(
      () => runCli(['api', 'unknown.operation']),
      (error: { code?: number }) => error.code === 2,
    );
  });
});
