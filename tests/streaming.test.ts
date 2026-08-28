import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '../src/server/agentServer';
import { LlmClient, LlmCompletionParams } from '../src/server/llmClient';
import { ApiStorage } from '../src/storage/ApiStorage';

test('LLM Response Streaming Test Suite', async t => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp-vault-stream-' + Date.now());
  const wikiDir = path.join(tmpDir, 'wiki');

  await fs.mkdir(wikiDir, { recursive: true });
  await fs.writeFile(
    path.join(wikiDir, 'streaming-note.md'),
    '# Streaming Note\n\nTest note for streaming test.',
    'utf-8'
  );

  const mockStreamingClient: LlmClient = {
    complete: async () => 'Full answer fallback',
    completeStream: async (_params: LlmCompletionParams, onChunk: (chunk: string) => void) => {
      onChunk('Chunk 1: Hello ');
      onChunk('Chunk 2: World ');
      onChunk('Chunk 3: [[streaming-note]]');
      return 'Chunk 1: Hello Chunk 2: World Chunk 3: [[streaming-note]]';
    },
  };

  const serverInstance = new AgentServer(tmpDir, mockStreamingClient);

  const server = http.createServer(async (req, res) => {
    const handled = await serverInstance.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;
  const apiStorage = new ApiStorage(baseUrl);

  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  await t.test('sendChatStream streams SSE response chunks progressively', async () => {
    const receivedChunks: string[] = [];
    await apiStorage.sendChatStream(
      'Test streaming query',
      (chunk: string) => {
        receivedChunks.push(chunk);
      }
    );

    assert.ok(receivedChunks.length >= 3);
    const combined = receivedChunks.join('');
    assert.ok(combined.includes('Chunk 1: Hello '));
    assert.ok(combined.includes('Chunk 2: World '));
    assert.ok(combined.includes('[[streaming-note]]'));
  });
});
