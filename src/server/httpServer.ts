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

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});