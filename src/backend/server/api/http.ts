/** Transport-neutral results returned by bus command handlers. */

import type * as http from 'node:http';

export interface JsonResult<T = unknown> {
  kind: 'json';
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export interface SseResult {
  kind: 'sse';
  /** The handler owns the stream lifecycle; the gateway only sets headers. */
  write: (res: http.ServerResponse) => Promise<void>;
}

export interface BinaryResult {
  kind: 'binary';
  contentType: string;
  body: Buffer | string;
  headers?: Record<string, string>;
}

export type ApiResult<T = unknown> = JsonResult<T> | SseResult | BinaryResult;

export function json<T>(body: T, status = 200, headers?: Record<string, string>): JsonResult<T> {
  return { kind: 'json', status, body, headers };
}

export function error(message: string, status = 500, extra: Record<string, unknown> = {}): JsonResult {
  return json({ success: false, error: message, ...extra }, status);
}

/** Pass through the exact bytes produced by a Python tool (e.g. its JSON output). */
export function binary(
  body: Buffer | string,
  contentType: string,
  headers?: Record<string, string>,
): BinaryResult {
  return { kind: 'binary', contentType, body, headers };
}

/** A command that owns a Server-Sent Events stream. */
export function sse(write: (res: http.ServerResponse) => Promise<void> | void): SseResult {
  return { kind: 'sse', write: async (res) => { await write(res); } };
}

export function sendApiResult(res: http.ServerResponse, result: ApiResult): void {
  if (res.headersSent) return;
  if (result.kind === 'json') {
    res.writeHead(result.status, {
      'Content-Type': 'application/json',
      ...(result.headers ?? {}),
    });
    res.end(JSON.stringify(result.body));
    return;
  }
  if (result.kind === 'binary') {
    res.writeHead(200, { 'Content-Type': result.contentType, ...(result.headers ?? {}) });
    res.end(result.body);
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  void result.write(res);
}

/** Parse a JSON request body while preserving the current error envelope. */
export async function readJsonBody<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`Invalid JSON body: ${String(err)}`);
  }
}
