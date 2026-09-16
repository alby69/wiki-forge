import { defineConfig, Plugin } from 'vite';
import { AgentServer } from './src/server/agentServer';
import type { IncomingMessage, ServerResponse } from 'node:http';

const API_BASE_URL = process.env.VITE_API_BASE_URL;

function getOriginalUrl(req: IncomingMessage): string {
  return (req as any).originalUrl || req.url || '';
}

function agentApiPlugin(): Plugin {
  const agentServer = new AgentServer();

  return {
    name: 'wiki-forge-agent-api',
    configureServer(server) {
      if (API_BASE_URL) {
        // Proxy API requests to external backend
        server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const targetUrl = `${API_BASE_URL}${getOriginalUrl(req)}`;
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
      if (API_BASE_URL) {
        server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const targetUrl = `${API_BASE_URL}${getOriginalUrl(req)}`;
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
