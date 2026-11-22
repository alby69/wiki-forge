import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

/**
 * A2/A3 — explicit runtime boundary.
 *
 * Vite is a *static asset server + reverse proxy only*. It never instantiates
 * `AgentServer`: importing backend domain code into the dev server coupled the
 * two runtimes and made `npm run dev` behave differently from production.
 * The API always runs as its own process (`npm run api` / compose `api`).
 *
 * Browser-facing origin vs. server-side target are kept distinct:
 *   - VITE_API_BASE_URL: baked into the client bundle (published host port)
 *   - VITE_PROXY_TARGET: used by this process (compose service name in Docker)
 */
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001';
const PROXY_TARGET = (process.env.VITE_PROXY_TARGET || API_BASE_URL).replace(/\/$/, '');

function originalUrl(req: IncomingMessage): string {
  const url = (req as IncomingMessage & { originalUrl?: string }).originalUrl || req.url || '/';
  // Connect strips the '/api' mount path; restore it for the upstream router.
  return url.startsWith('/api') ? url : `/api${url}`;
}

/**
 * One proxy implementation shared by dev and preview servers (DRY).
 * The response body is piped, not buffered, so SSE endpoints such as
 * /api/scripts/execute and /api/chat/stream keep streaming.
 */
function apiProxy(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const headers: Record<string, string> = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value !== undefined) headers[key] = Array.isArray(value) ? value[0] : value;
  });
  delete headers.host;

  let body: string | undefined;
  const forward = (): void => {
    fetch(`${PROXY_TARGET}${originalUrl(req)}`, {
      method: req.method,
      headers,
      body,
    })
      .then((upstream) => {
        res.statusCode = upstream.status;
        upstream.headers.forEach((value, key) => {
          // Let Node recompute hop-by-hop framing for the piped body.
          if (key !== 'transfer-encoding' && key !== 'content-length') res.setHeader(key, value);
        });
        if (upstream.body) {
          Readable.fromWeb(upstream.body as unknown as WebReadableStream).pipe(res);
        } else {
          res.end();
        }
      })
      .catch((err: unknown) => {
        if (res.headersSent) {
          res.end();
          return;
        }
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: `API non raggiungibile su ${PROXY_TARGET} (${String(err)}). Avvia 'npm run api' oppure 'npm run dev:all'.`,
        }));
      });
  };

  if (req.method === 'GET' || req.method === 'HEAD') {
    forward();
    return;
  }
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    body = Buffer.concat(chunks).toString();
    forward();
  });
  req.on('error', next);
}

function proxyPlugin(): Plugin {
  return {
    name: 'wiki-forge-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api', apiProxy);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', apiProxy);
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@frontend': path.resolve(__dirname, './src/frontend'),
      '@backend': path.resolve(__dirname, './src/backend'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: { host: true, port: 5173, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [proxyPlugin()],
});
