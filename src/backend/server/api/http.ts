/** Transport-neutral results returned by bus command handlers. */

import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import { currentRequestContext } from '../observability/context';
import { HttpError } from '../security/httpError';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

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
  status?: number;
}

export type ApiResult<T = unknown> = JsonResult<T> | SseResult | BinaryResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function correlationIdFor(res: http.ServerResponse): string {
  const header = res.getHeader(CORRELATION_ID_HEADER);
  if (typeof header === 'string' && header.trim()) return header;
  return currentRequestContext()?.correlationId ?? randomUUID();
}

export function prepareCorrelationId(res: http.ServerResponse): string {
  const header = res.getHeader(CORRELATION_ID_HEADER);
  if (typeof header === 'string' && header.trim()) return header;
  const id = randomUUID();
  res.setHeader(CORRELATION_ID_HEADER, id);
  return id;
}

export function json<T>(body: T, status = 200, headers?: Record<string, string>): JsonResult<T> {
  return { kind: 'json', status, body, headers };
}

export function error(message: string, status = 500, extra: Record<string, unknown> = {}): JsonResult {
  return json({
    success: false,
    error: message,
    correlationId: currentRequestContext()?.correlationId ?? randomUUID(),
    ...extra,
  }, status);
}

export function writeApiError(
  res: http.ServerResponse,
  message: string,
  status = 500,
  correlationId = correlationIdFor(res),
  extra: Record<string, unknown> = {},
): void {
  if (res.headersSent) return;
  sendApiResult(res, error(message, status, { correlationId, ...extra }));
}

export function writeHttpError(
  res: http.ServerResponse,
  err: unknown,
  correlationId = correlationIdFor(res),
): void {
  const status = err instanceof HttpError ? err.status : 500;
  const extra = err instanceof HttpError && err.code ? { code: err.code } : {};
  writeApiError(res, err instanceof Error ? err.message : String(err), status, correlationId, extra);
}

/** Pass through the exact bytes produced by a Python tool (e.g. its JSON output). */
export function binary(
  body: Buffer | string,
  contentType: string,
  headers?: Record<string, string>,
  status?: number,
): BinaryResult {
  return { kind: 'binary', contentType, body, headers, status };
}

/** A command that owns a Server-Sent Events stream. */
export function sse(write: (res: http.ServerResponse) => Promise<void> | void): SseResult {
  return { kind: 'sse', write: async (res) => { await write(res); } };
}

export function sendApiResult(res: http.ServerResponse, result: ApiResult): void {
  if (res.headersSent) return;
  if (result.kind === 'json') {
    const body = isRecord(result.body)
      && result.body.success === false
      && typeof result.body.correlationId !== 'string'
      ? { ...result.body, correlationId: correlationIdFor(res) }
      : result.body;
    res.writeHead(result.status, {
      'Content-Type': 'application/json',
      ...(result.headers ?? {}),
    });
    res.end(JSON.stringify(body));
    return;
  }
  if (result.kind === 'binary') {
    res.writeHead(result.status ?? 200, { 'Content-Type': result.contentType, ...(result.headers ?? {}) });
    res.end(result.body);
    return;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
  const allowOrigin = res.getHeader('Access-Control-Allow-Origin');
  if (typeof allowOrigin === 'string') headers['Access-Control-Allow-Origin'] = allowOrigin;
  res.writeHead(200, headers);
  void result.write(res);
}

export function maxBodyBytes(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.WIKIFORGE_MAX_BODY_BYTES ?? '');
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MAX_BODY_BYTES;
}

/** Parse a JSON request body while preserving the current error envelope. */
export async function readJsonBody<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  const { body } = await readJsonBodyWithRaw<T>(req);
  return body;
}

export async function readJsonBodyWithRaw<T = Record<string, unknown>>(
  req: http.IncomingMessage,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ body: T; raw: string }> {
  const limit = maxBodyBytes(env);
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) {
      tooLarge = true;
      continue;
    }
    chunks.push(buffer);
  }
  if (tooLarge) {
    throw new HttpError(`Request body too large: limit is ${limit} bytes`, 413, 'body_too_large');
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw.trim()) return { body: {} as T, raw };
  try {
    return { body: JSON.parse(raw) as T, raw };
  } catch (err) {
    throw new HttpError(`Invalid JSON body: ${String(err)}`, 400, 'invalid_json');
  }
}
