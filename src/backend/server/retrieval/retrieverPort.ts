/**
 * Retriever port for Research Studio routes.
 *
 * The Python implementation owns BM25/RRF/graph expansion; this module only
 * adapts it to the bus-facing code. When the CLI is unavailable or returns an
 * invalid payload, ranking falls back to the existing deterministic lexical
 * helper so every route keeps working with zero new runtime dependencies.
 */

import { spawnSync } from 'node:child_process';
import type { WikiNote } from '@shared/domain/wiki';
import { searchNotes } from '../researchHelpers';
import { buildAllowedEnv } from '../process/scriptRunner';
import { resolveToolScript } from '../toolPaths';

export interface RetrievalHit {
  id: string;
  score: number;
  channel: string;
}

export interface RetrieveOptions {
  limit?: number;
  projectId?: string;
  hops?: number;
}

export interface UpdateOptions {
  projectId?: string;
  deletedIds?: string[];
}

/** Port consumed by /consult, /search, /related and Deep Research. */
export interface Retriever {
  retrieve(query: string, notes: WikiNote[], options?: RetrieveOptions): Promise<RetrievalHit[]>;
  update(notes: WikiNote | WikiNote[], options?: UpdateOptions): Promise<boolean>;
}

export interface RetrieverRunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export type RetrieverRunner = (
  command: string,
  args: string[],
  options: { cwd: string; input: string; env: NodeJS.ProcessEnv },
) => RetrieverRunResult;

export interface HybridRetrieverOptions {
  rootDir?: string;
  pythonCmd?: string;
  scriptPath?: string;
  runner?: RetrieverRunner;
}

function serializeNotes(notes: WikiNote[]): string {
  return JSON.stringify({
    notes: notes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      path: note.path,
      tags: note.tags || [],
      links: note.outboundLinks || [],
    })),
  });
}

/** Deterministic lexical fallback: the pre-Phase-94 ranking, unchanged. */
export function lexicalFallback(query: string, notes: WikiNote[], limit: number): RetrievalHit[] {
  return searchNotes(notes, query, limit).results.map(result => ({
    id: result.note.id,
    score: result.score,
    channel: 'lexical-fallback',
  }));
}

export class HybridRetriever implements Retriever {
  constructor(private readonly options: HybridRetrieverOptions = {}) {}

  private run(commandArgs: string[], input: string): RetrieverRunResult | null {
    const rootDir = this.options.rootDir || process.cwd();
    const command = this.options.pythonCmd || process.env.WIKIFORGE_PYTHON || 'python3';
    const script = resolveToolScript(rootDir, this.options.scriptPath || 'scripts/retrieve.py');
    const spawnOptions = { cwd: rootDir, input, env: buildAllowedEnv() };
    try {
      if (this.options.runner) return this.options.runner(command, [script, ...commandArgs], spawnOptions);
      const result = spawnSync(command, [script, ...commandArgs], {
        ...spawnOptions,
        encoding: 'utf-8',
        maxBuffer: 16 * 1024 * 1024,
      });
      return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        error: result.error?.message,
      };
    } catch (err) {
      return { status: null, stdout: '', stderr: '', error: String(err) };
    }
  }

  private parse(result: RetrieverRunResult | null): Record<string, unknown> | null {
    if (!result || result.status !== 0 || result.error) return null;
    try {
      const payload = JSON.parse(result.stdout) as Record<string, unknown>;
      return payload && payload.status === 'success' ? payload : null;
    } catch {
      return null;
    }
  }

  async retrieve(query: string, notes: WikiNote[], options: RetrieveOptions = {}): Promise<RetrievalHit[]> {
    const limit = Math.max(1, options.limit ?? 5);
    const args = [
      'query',
      '--root', this.options.rootDir || process.cwd(),
      '--scope', options.projectId || 'default',
      '--query', query,
      '--limit', String(limit),
      '--hops', String(options.hops ?? 1),
    ];
    const payload = this.parse(this.run(args, serializeNotes(notes)));
    if (!Array.isArray(payload?.results)) return lexicalFallback(query, notes, limit);

    const byId = new Map(notes.map(note => [note.id, note]));
    const hits: RetrievalHit[] = [];
    const seen = new Set<string>();
    for (const raw of payload.results as Array<Record<string, unknown>>) {
      const id = typeof raw.id === 'string' ? raw.id : '';
      const score = typeof raw.score === 'number' ? raw.score : Number.NaN;
      if (!id || !byId.has(id) || seen.has(id) || !Number.isFinite(score)) continue;
      seen.add(id);
      hits.push({ id, score, channel: typeof raw.channel === 'string' ? raw.channel : 'hybrid' });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  async update(notes: WikiNote | WikiNote[], options: UpdateOptions = {}): Promise<boolean> {
    const list = Array.isArray(notes) ? notes : [notes];
    const args = [
      'update',
      '--root', this.options.rootDir || process.cwd(),
      '--scope', options.projectId || 'default',
    ];
    if (options.deletedIds?.length) args.push('--delete-ids', ...options.deletedIds);
    const payload = this.parse(this.run(args, serializeNotes(list)));
    return payload !== null;
  }
}

export const defaultRetriever: Retriever = new HybridRetriever();
