import { defineConfig, Plugin } from 'vite';
import { AgentServer } from './src/server/agentServer';

function agentApiPlugin(): Plugin {
  const agentServer = new AgentServer();

  return {
    name: 'wiki-forge-agent-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          const handled = await agentServer.handleRequest(req, res);
          if (handled) return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
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
