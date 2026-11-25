import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { COMMAND_MANIFEST } from '@shared/api/generated/commandManifest.generated';

const CLI = path.resolve('bin/wf.ts');

const NOTES = [
  {
    id: 'c64',
    title: 'C64 Assembly',
    path: 'wiki/c64.md',
    content: 'Assembly per Commodore 64',
    rawContent: '---\nstatus: stable\n---\nline one\nline two\n',
    frontmatter: { status: 'stable' },
    tags: ['retro'],
    status: 'stable',
    trustTier: 'human-reviewed',
    backlinks: [],
  },
  {
    id: 'ai',
    title: 'AI Tools',
    path: 'wiki/ai.md',
    content: 'Strumenti di intelligenza artificiale',
    rawContent: '---\nstatus: draft\n---\nline one\n',
    frontmatter: { status: 'draft' },
    tags: ['ai'],
    status: 'draft',
    trustTier: 'unverified',
    backlinks: [],
  },
];

async function withMcp(
  handler: (client: Client) => Promise<void>,
  respond?: (reqUrl: string, res: ServerResponse, req: IncomingMessage) => void,
): Promise<void> {
  const server = createServer((req, res) => {
    if (respond) {
      respond(req.url ?? '', res, req);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.url === '/api/wiki/notes') {
      res.end(JSON.stringify({ success: true, notes: NOTES }));
      return;
    }
    res.end(JSON.stringify({ success: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const client = new Client({ name: 'wf-mcp-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import', 'tsx', CLI, 'mcp',
      '--base-url', `http://127.0.0.1:${address.port}`,
      '--project', 'demo',
      '--token', 'tok',
    ],
    cwd: process.cwd(),
    env: { ...process.env } as Record<string, string>,
    stderr: 'pipe',
  });

  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });
  try {
    await client.connect(transport);
    await handler(client);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nSTDERR: ${stderr}`);
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function parseContent(result: any): any {
  return JSON.parse(result.content[0].text);
}

describe('MCP adapter — Fase 4 del piano di disaccoppiamento', () => {
  it('deriva tools/list dal manifest e conserva gli alias legacy', async () => {
    await withMcp(async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);
      assert.equal(names.length, COMMAND_MANIFEST.mcpTools.length);
      for (const descriptor of COMMAND_MANIFEST.mcpTools) {
        assert.ok(names.includes(descriptor.name), `${descriptor.name} mancante`);
      }
    });
  });

  it('chiama l\'API HTTP con project e token tramite un tool generato', async () => {
    const seen: Array<{ url: string; project?: string; token?: string }> = [];
    await withMcp(
      async (client) => {
        const result = await client.callTool({ name: 'wf_wiki_notes_list', arguments: {} });
        assert.equal(result.isError, undefined);
        assert.equal(parseContent(result).notes.length, 2);
        assert.deepEqual(seen, [{
          url: '/api/wiki/notes',
          project: 'demo',
          token: 'tok',
        }]);
      },
      (reqUrl, res, req) => {
        if (reqUrl === '/api/wiki/notes') {
          seen.push({
            url: reqUrl,
            project: req.headers['x-project-id'] as string | undefined,
            token: req.headers['x-wikiforge-token'] as string | undefined,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, notes: NOTES }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      },
    );
  });

  it('filtra search_wiki senza accedere al filesystem', async () => {
    await withMcp(async (client) => {
      const result = await client.callTool({ name: 'search_wiki', arguments: { query: 'c64' } });
      const payload = parseContent(result);
      assert.equal(payload.results.length, 1);
      assert.equal(payload.results[0].title, 'C64 Assembly');
    });
  });

  it('segnala isError quando l\'API rifiuta un tool mutante', async () => {
    await withMcp(
      async (client) => {
        const result = await client.callTool({
          name: 'wf_wiki_delete',
          arguments: { body: { targetPath: 'wiki/c64.md' } },
        });
        assert.equal(result.isError, true);
        assert.equal(parseContent(result).status, 403);
      },
      (reqUrl, res) => {
        if (reqUrl.startsWith('/api/wiki/delete')) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'policy denied' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      },
    );
  });
});
