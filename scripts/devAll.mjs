#!/usr/bin/env node
/**
 * Local development: start the two runtimes with one command.
 *
 * A2/A3 — the API is a standalone process; Vite only proxies to it. This
 * launcher exists purely for developer convenience (no new dependencies):
 *
 *   npm run dev:all     # API on :3001 + Vite on :5173
 *
 * In Docker the two processes are separate compose services instead.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const children = [];
let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exitCode = code;
}

function start(name, args) {
  const child = spawn(node, args, { cwd: root, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[dev:all] ${name} exited (${signal ?? code}) — stopping the other process`);
      shutdown(code && code !== 0 ? code : 1);
    }
  });
  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('api', ['--import', 'tsx', 'src/backend/server/httpServer.ts']);
start('ui', ['node_modules/vite/bin/vite.js']);
