import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { ApiClientError, createApiClient } from '@shared/api/client';
import { ROUTES } from '@shared/api/contracts';
import type { EndpointId } from '@shared/api/contracts';
import { MCP_TOOL_DESCRIPTORS } from '@shared/mcp/tools';
import type { McpToolDescriptor } from '@shared/mcp/tools';

export interface McpAdapterOptions {
  baseUrl: string;
  projectId: string;
  token?: string;
  bearerToken?: string;
}

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function textResult(value: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function errorResult(error: unknown): ToolResult {
  if (error instanceof ApiClientError) {
    return textResult({
      error: error.message,
      status: error.status,
      body: error.body,
    }, true);
  }
  return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
}

function notesFrom(payload: unknown): Array<Record<string, any>> {
  const notes = payload && typeof payload === 'object' && 'notes' in payload
    ? (payload as { notes?: unknown }).notes
    : [];
  return Array.isArray(notes) ? notes as Array<Record<string, any>> : [];
}

function findNote(notes: Array<Record<string, any>>, id: string): Record<string, any> | undefined {
  return notes.find((note) =>
    [note.id, note.path, note.title, note.folder].some((candidate) =>
      typeof candidate === 'string' && candidate === id));
}

async function collectStream(
  client: ReturnType<typeof createApiClient>,
  id: EndpointId,
  request: Record<string, any>,
  extra: any,
): Promise<Array<Record<string, any>>> {
  const events: Array<Record<string, any>> = [];
  const token = extra?._meta?.progressToken as string | number | undefined;
  let progress = 0;
  await client.stream(id, request as never, (frame) => {
    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(frame.data) as Record<string, any>;
    } catch (_error) {
      parsed = { text: frame.data };
    }
    events.push({ event: frame.event, ...parsed });
    progress += 1;
    if (token !== undefined && typeof extra?.sendNotification === 'function') {
      void extra.sendNotification({
        method: 'notifications/progress',
        params: {
          progressToken: token,
          progress,
          message: String(frame.event ?? parsed.type ?? 'progress'),
        },
      });
    }
  }, extra?.signal as AbortSignal | undefined);
  return events;
}

function useCaseResult(useCaseId: string, events: Array<Record<string, any>>): ToolResult {
  const stdout = events
    .filter((event) => event.type === 'stdout' && typeof event.text === 'string')
    .map((event) => event.text as string)
    .join('');
  const stderr = events
    .filter((event) => event.type === 'stderr' && typeof event.text === 'string')
    .map((event) => event.text as string)
    .join('');
  const exit = events.find((event) => event.type === 'exit');
  const failed = typeof exit?.code === 'number' && exit.code !== 0;
  const executedSteps = events.filter((event) => event.type === 'step_end').length;
  const reports = [...stdout.matchAll(/(?:output\/[^\s]+\.(?:md|ttl|json|jsonld|txt|csv))/g)].map((match) => match[1]);
  return textResult({
    status: failed ? 'failed' : 'completed',
    use_case_id: useCaseId,
    executed_steps: executedSteps,
    reports: [...new Set(reports)],
    stdout: stdout.slice(0, 4000),
    stderr: stderr.slice(0, 2000),
  }, failed);
}

async function invokeLegacyTool(
  name: string,
  args: Record<string, any>,
  client: ReturnType<typeof createApiClient>,
  extra: any,
): Promise<ToolResult> {
  if (name === 'search_wiki') {
    const query = String(args.query ?? '').toLowerCase();
    const notes = notesFrom(await client.call('wiki.notes.list', {})).filter((note) =>
      [note.title, note.path, note.content].some((value) =>
        typeof value === 'string' && value.toLowerCase().includes(query)));
    const limit = typeof args.limit === 'number' ? args.limit : 30;
    return textResult({ results: notes.slice(0, limit).map((note) => ({
      title: note.title,
      path: note.path,
      excerpt: typeof note.content === 'string' ? note.content.slice(0, 500) : '',
    })) });
  }

  if (name === 'get_concept_metadata') {
    const note = findNote(notesFrom(await client.call('wiki.notes.list', {})), String(args.note_id ?? ''));
    if (!note) return textResult({ error: `Nota non trovata: ${String(args.note_id)}` }, true);
    return textResult({
      note_id: note.id,
      title: note.title,
      path: note.path,
      frontmatter: note.frontmatter,
      tags: note.tags,
      status: note.status,
      trustTier: note.trustTier,
      backlinks: note.backlinks,
    });
  }

  if (name === 'get_line_anchored_citation') {
    const note = findNote(notesFrom(await client.call('wiki.notes.list', {})), String(args.note_id ?? ''));
    if (!note) return textResult({ error: `Nota non trovata: ${String(args.note_id)}` }, true);
    const lines = String(note.rawContent ?? note.content ?? '').split('\n');
    const start = Math.max(1, Number(args.line_start));
    const end = Math.max(start, Number(args.line_end));
    return textResult({
      note_id: note.id,
      path: note.path,
      line_start: start,
      line_end: end,
      text: lines.slice(start - 1, end).join('\n'),
    });
  }

  if (name === 'list_trust_tiers') {
    const notes = notesFrom(await client.call('wiki.notes.list', {}));
    const tiers: Record<string, Array<Record<string, any>>> = {
      'human-reviewed': [],
      'machine-confirmed': [],
      unverified: [],
    };
    for (const note of notes) {
      const tier = typeof note.trustTier === 'string' ? note.trustTier : 'unverified';
      (tiers[tier] ??= []).push({ id: note.id, title: note.title, path: note.path });
    }
    return textResult(tiers);
  }

  if (name === 'get_version_history') {
    const response = await client.call('review.snapshots', {
      query: { note: String(args.note_id ?? '') },
    });
    return textResult({ note_id: args.note_id, snapshots: (response as any)?.snapshots ?? [] });
  }

  if (name === 'validate_competency_question') {
    const events = await collectStream(client, 'ke.useCases.execute', {
      body: {
        useCaseId: 'ke_cq_assessment',
        args: { question: String(args.question ?? '') },
      },
    }, extra);
    const result = useCaseResult('ke_cq_assessment', events);
    const content = result.isError ? '' : result.content[0].text;
    const match = content.match(/(CQ[-_ ]?\d+)/i);
    return textResult({
      cq_id: match?.[1] ?? 'CQ-1',
      question: String(args.question ?? ''),
      status: result.isError ? 'failed' : 'completed',
      coverage: result.isError ? 'unknown' : 'assessed',
      report: result.content[0].text,
    }, result.isError);
  }

  if (name === 'get_ontology_gaps') {
    const events = await collectStream(client, 'ke.useCases.execute', {
      body: {
        useCaseId: 'ke_ontological_validation',
        args: { gaps: true },
      },
    }, extra);
    const result = useCaseResult('ke_ontological_validation', events);
    return textResult({
      summary: result.isError ? 'validation failed' : 'validation completed',
      gaps: [],
      report: result.content[0].text,
    }, result.isError);
  }

  if (name === 'execute_ke_use_case') {
    const useCaseId = String(args.use_case_id ?? '');
    const events = await collectStream(client, 'ke.useCases.execute', {
      body: { useCaseId, args: args.args ?? {} },
    }, extra);
    return useCaseResult(useCaseId, events);
  }

  return textResult({ error: `Tool legacy sconosciuto: ${name}` }, true);
}

function registerTool(
  server: McpServer,
  descriptor: McpToolDescriptor,
  options: McpAdapterOptions,
): void {
  const client = createApiClient({
    baseUrl: options.baseUrl,
    getProjectId: () => options.projectId,
    getToken: () => options.token,
    getBearerToken: () => options.bearerToken,
  });

  server.registerTool(
    descriptor.name,
    {
      title: descriptor.name,
      description: descriptor.description,
      inputSchema: z.fromJSONSchema(descriptor.inputSchema as any) as any,
      annotations: {
        readOnlyHint: !descriptor.mutating,
        destructiveHint: /delete|restore|move|rename/i.test(descriptor.name),
        idempotentHint: !descriptor.mutating,
        openWorldHint: false,
      },
    },
    async (args: Record<string, any>, extra: any) => {
      try {
        if (descriptor.legacy) {
          return await invokeLegacyTool(descriptor.name, args ?? {}, client, extra);
        }
        const route = ROUTES.find((item) => item.id === descriptor.operationId);
        if (route?.stream === 'sse') {
          const events = await collectStream(client, descriptor.operationId as EndpointId, args ?? {}, extra);
          return textResult({ events });
        }
        return textResult(await client.call(descriptor.operationId as EndpointId, args ?? {}));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

export function createMcpServer(options: McpAdapterOptions): McpServer {
  const server = new McpServer({
    name: 'wiki-forge',
    version: '4.1.0',
  });
  for (const descriptor of MCP_TOOL_DESCRIPTORS) {
    registerTool(server, descriptor, options);
  }
  return server;
}

export async function runMcpStdio(options: McpAdapterOptions): Promise<void> {
  const server = createMcpServer(options);
  await server.connect(new StdioServerTransport());
}

async function readJsonBody(req: any): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf-8');
  if (!text) return undefined;
  return JSON.parse(text) as unknown;
}

export async function runMcpHttp(
  options: McpAdapterOptions,
  port: number,
  host = '0.0.0.0',
): Promise<void> {
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();
  const httpServer = createServer(async (req, res) => {
    try {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, transport: 'streamable-http', sessions: sessions.size }));
        return;
      }

      const body = await readJsonBody(req);
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      const session = sessionId ? sessions.get(sessionId) : undefined;

      if (session) {
        await session.transport.handleRequest(req, res, body);
        return;
      }

      if (!sessionId && body && isInitializeRequest(body)) {
        const server = createMcpServer(options);
        let transport!: StreamableHTTPServerTransport;
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { server, transport });
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      res.writeHead(sessionId ? 404 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: sessionId ? -32001 : -32000,
          message: sessionId ? 'Session not found' : 'Initialize request required',
        },
        id: null,
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  process.stderr.write(`Wiki-Forge MCP Streamable HTTP in ascolto su http://${host}:${port}/mcp\n`);
}
