import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { AgentServer } from '@backend/server/agentServer';

const ROOT = process.cwd();
const read = (relative: string): Promise<string> => fs.readFile(path.join(ROOT, relative), 'utf-8');

describe('A2/A3 — explicit runtime boundary', () => {
  let upstream: http.Server;
  let gateway: http.Server;
  let gatewayUrl: string;
  let previousFastApiUrl: string | undefined;

  before(async () => {
    // Fake FastAPI upstream so the proxy contract is tested without uvicorn.
    upstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          proxied: true,
          url: req.url,
          method: req.method,
          body: Buffer.concat(chunks).toString(),
        }));
      });
    });
    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', () => resolve()));
    const upstreamPort = (upstream.address() as { port: number }).port;

    previousFastApiUrl = process.env.FASTAPI_SERVER_URL;
    process.env.FASTAPI_SERVER_URL = `http://127.0.0.1:${upstreamPort}`;

    const agentServer = new AgentServer(ROOT);
    gateway = http.createServer((req, res) => {
      void agentServer.handleRequest(req, res).then((handled) => {
        if (!handled) { res.writeHead(404); res.end(); }
      });
    });
    await new Promise<void>(resolve => gateway.listen(0, '127.0.0.1', () => resolve()));
    gatewayUrl = `http://127.0.0.1:${(gateway.address() as { port: number }).port}`;
  });

  after(async () => {
    await new Promise<void>(resolve => gateway.close(() => resolve()));
    await new Promise<void>(resolve => upstream.close(() => resolve()));
    if (previousFastApiUrl === undefined) delete process.env.FASTAPI_SERVER_URL;
    else process.env.FASTAPI_SERVER_URL = previousFastApiUrl;
  });

  it('Vite is a pure proxy: it does not import or instantiate AgentServer', async () => {
    const source = await read('vite.config.ts');
    assert.doesNotMatch(source, /from ['"]\.\/src\/backend\/server\/agentServer['"]/);
    assert.doesNotMatch(source, /new AgentServer/);
    assert.match(source, /VITE_PROXY_TARGET/);
  });

  it('dev and preview servers share one proxy implementation', async () => {
    const source = await read('vite.config.ts');
    const uses = source.match(/middlewares\.use\('\/api'/g) || [];
    assert.equal(uses.length, 2, 'one registration for dev, one for preview, same function');
    assert.equal((source.match(/function apiProxy\(/g) || []).length, 1);
  });

  it('Vite exposes every TypeScript path alias to the browser bundler', async () => {
    const [vite, tsconfigSource] = await Promise.all([
      read('vite.config.ts'),
      read('tsconfig.json'),
    ]);
    const tsconfig = JSON.parse(tsconfigSource) as {
      compilerOptions: { paths?: Record<string, string[]> };
    };
    const aliases = Object.keys(tsconfig.compilerOptions.paths ?? {})
      .filter((alias) => alias.endsWith('/*'))
      .map((alias) => alias.slice(0, -2));
    assert.ok(aliases.length > 0);
    for (const alias of aliases) {
      assert.ok(
        vite.includes(`'${alias}':`),
        `vite.config.ts must resolve the '${alias}/*' TypeScript alias`,
      );
    }
  });

  it('standalone processes are exposed by npm scripts', async () => {
    const pkg = JSON.parse(await read('package.json')) as { scripts: Record<string, string> };
    assert.match(pkg.scripts.api, /httpServer\.ts/);
    assert.match(pkg.scripts['dev:all'], /devAll/);
    assert.equal(pkg.scripts.dev, 'vite');
  });

  it('compose runs the Python KG API as its own service and wires the gateway', async () => {
    const compose = await read('docker-compose.yml');
    assert.match(compose, /^\s{2}kg-api:/m);
    assert.match(compose, /"uvicorn",\s*"src\.backend\.wikiforge\.api\.api_server:app"/);
    assert.match(compose, /FASTAPI_SERVER_URL=http:\/\/kg-api:8000/);
  });

  it('gateway forwards /api/v1/graph/* to FASTAPI_SERVER_URL', async () => {
    const res = await fetch(`${gatewayUrl}/api/v1/graph/sync?project=wikiforge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wiki_dir: 'projects/wikiforge/wiki' }),
    });
    assert.equal(res.status, 200);
    const payload = await res.json() as any;
    assert.equal(payload.proxied, true);
    assert.equal(payload.method, 'POST');
    assert.match(payload.url, /^\/api\/v1\/graph\/sync/);
    assert.match(payload.body, /wikiforge/);
  });
});
