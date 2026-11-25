import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentServer } from './agentServer';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const EMBED_SCHEDULER = process.env.WIKIFORGE_EMBED_SCHEDULER !== 'false';

const STATIC_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveStaticFile(url: string | undefined): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.startsWith('/api/')) return null;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_DIR, relative);
  const fromDist = path.relative(DIST_DIR, candidate);
  if (fromDist.startsWith('..') || path.isAbsolute(fromDist)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (path.extname(relative)) return null;
  const fallback = path.join(DIST_DIR, 'index.html');
  return fs.existsSync(fallback) ? fallback : null;
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const file = resolveStaticFile(req.url);
  if (!file) return false;
  res.writeHead(200, {
    'Content-Type': STATIC_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: `Cannot serve ${path.basename(file)}` }));
  });
  stream.pipe(res);
  return true;
}

const agentServer = new AgentServer(ROOT_DIR);

const server = http.createServer((req, res) => {
  if (serveStatic(req, res)) return;
  void agentServer.handleRequest(req, res).then((handled) => {
    if (!handled && !res.headersSent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: `Not found: ${req.method} ${req.url}` }));
    }
  }).catch((err) => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: String(err) }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Wiki-Forge API] Server running on http://0.0.0.0:${PORT}`);
});

if (EMBED_SCHEDULER) {
  void agentServer.startScheduler().then(() => {
    if (agentServer.getScheduler()) {
      console.log('[Wiki-Forge API] KE scheduler started');
    } else {
      console.warn('[Wiki-Forge API] KE scheduler idle: no valid jobs configured (see /api/ke/schedule)');
    }
  }).catch((err) => {
    console.error('[Wiki-Forge API] Failed to start KE scheduler:', err);
  });
} else {
  console.log('[Wiki-Forge API] KE scheduler disabled (WIKIFORGE_EMBED_SCHEDULER=false)');
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Wiki-Forge API] ${signal} received: stopping scheduler and server`);
  try {
    await agentServer.stopScheduler({ cancelActive: true });
  } catch (err) {
    console.error('[Wiki-Forge API] Error while stopping scheduler:', err);
  }
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
