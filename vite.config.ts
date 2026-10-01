import { defineConfig, Plugin } from 'vite';
import { AgentServer } from './src/server/agentServer';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Browser-facing API origin, baked into the client bundle. From the user's
// browser 127.0.0.1:3001 is the published host port, so this is correct.
const API_BASE_URL = process.env.VITE_API_BASE_URL;

// Server-side proxy target used by the dev server itself. Inside the UI
// container 127.0.0.1 does NOT reach the API container, so Docker sets this to
// the compose service name (http://api:3001). Falls back to the browser origin
// for single-host local development.
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || API_BASE_URL;

function getOriginalUrl(req: IncomingMessage): string {
  const url = (req as any).originalUrl || req.url || '';
  // Connect strips the mount path ('/api') from req.url, so restore it before
  // forwarding; otherwise the upstream would receive /scripts/list and 404.
  return url.startsWith('/api') ? url : `/api${url}`;
}

function agentApiPlugin(): Plugin {
  const agentServer = new AgentServer();

  return {
    name: 'wiki-forge-agent-api',
    configureServer(server) {
          if (PROXY_TARGET) {
        // Proxy API requests to external backend
        server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const targetUrl = `${PROXY_TARGET}${getOriginalUrl(req)}`;
          const headers: Record<string, string> = {};
          Object.entries(req.headers).forEach(([key, value]) => {
            if (value !== undefined) {
              headers[key] = Array.isArray(value) ? value[0] : value;
            }
          });
          delete headers.host;

          let body: string | undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
              body = Buffer.concat(chunks).toString();
              doFetch();
            });
          } else {
            doFetch();
          }

          function doFetch() {
            fetch(targetUrl, {
              method: req.method,
              headers,
              body,
            })
              .then(response => {
                res.statusCode = response.status;
                response.headers.forEach((value, key) => {
                  res.setHeader(key, value);
                });
                return response.arrayBuffer();
              })
              .then(buffer => {
                res.end(Buffer.from(buffer));
              })
              .catch(err => {
                console.error('API proxy error:', err);
                res.statusCode = 502;
                res.end('Bad Gateway');
              });
          }
        });
        return;
      }

      // Local dev mode: handle API inline
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          const handled = await agentServer.handleRequest(req, res);
          if (handled) return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
          if (PROXY_TARGET) {
        server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const targetUrl = `${PROXY_TARGET}${getOriginalUrl(req)}`;
          const headers: Record<string, string> = {};
          Object.entries(req.headers).forEach(([key, value]) => {
            if (value !== undefined) {
              headers[key] = Array.isArray(value) ? value[0] : value;
            }
          });
          delete headers.host;

          let body: string | undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
              body = Buffer.concat(chunks).toString();
              doFetch();
            });
          } else {
            doFetch();
          }

          function doFetch() {
            fetch(targetUrl, {
              method: req.method,
              headers,
              body,
            })
              .then(response => {
                res.statusCode = response.status;
                response.headers.forEach((value, key) => {
                  res.setHeader(key, value);
                });
                return response.arrayBuffer();
              })
              .then(buffer => {
                res.end(Buffer.from(buffer));
              })
              .catch(err => {
                console.error('API proxy error:', err);
                res.statusCode = 502;
                res.end('Bad Gateway');
              });
          }
        });
        return;
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          const handled = await agentServer.handleRequest(req, res);
          if (handled) return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  server: { host: true, port: 5173, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [agentApiPlugin()],
});
