import * as http from 'node:http';
import { AgentServer } from './agentServer';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const ROOT_DIR = process.cwd();

const agentServer = new AgentServer(ROOT_DIR);

const server = http.createServer((req, res) => {
  void agentServer.handleRequest(req, res);
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