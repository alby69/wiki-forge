import * as http from 'node:http';
import { AgentServer } from './agentServer';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const ROOT_DIR = process.cwd();

const agentServer = new AgentServer(ROOT_DIR);

const server = http.createServer((req, res) => {
  void agentServer.handleRequest(req, res).then((handled) => {
    // handleRequest resolves false when no route matched. Without this the
    // request would never receive a response and the client would hang.
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

// The scheduler lives in the API process, not in the browser: it keeps
// running when the Workbench UI (or the Tauri shell) is closed. Configuration
// problems are reported through `/api/ke/schedule` and never stop the server.
void agentServer.startScheduler().then(() => {
  if (agentServer.getScheduler()) {
    console.log('[Wiki-Forge API] KE scheduler started');
  } else {
    console.warn('[Wiki-Forge API] KE scheduler idle: no valid jobs configured (see /api/ke/schedule)');
  }
}).catch((err) => {
  console.error('[Wiki-Forge API] Failed to start KE scheduler:', err);
});

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
