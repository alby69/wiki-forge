import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { recordHttpRequest } from './metrics';

export class LlmBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmBudgetExceededError';
  }
}

export interface LlmBudgetConfig {
  dailyTokenLimit: number;
  softTokenLimit: number;
  hardTokenLimit: number;
}

export interface LlmUsageState {
  date: string;
  tokens: number;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function readLlmUsage(stateDir: string): Promise<LlmUsageState> {
  const file = path.join(stateDir, 'llm-usage.json');
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as LlmUsageState;
    if (parsed.date !== todayUtc()) return { date: todayUtc(), tokens: 0 };
    return parsed;
  } catch {
    return { date: todayUtc(), tokens: 0 };
  }
}

export async function writeLlmUsage(stateDir: string, usage: LlmUsageState): Promise<void> {
  const file = path.join(stateDir, 'llm-usage.json');
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(usage, null, 2), 'utf-8');
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export const llmMetrics = {
  calls: 0,
  tokens: 0,
  errors: 0,
  latencyMs: 0,
};

export function recordLlmCall(metric: { tokens: number; latencyMs: number; error: boolean }): void {
  llmMetrics.calls += 1;
  llmMetrics.tokens += metric.tokens;
  llmMetrics.latencyMs += metric.latencyMs;
  if (metric.error) llmMetrics.errors += 1;
}

export function renderLlmPrometheus(): string {
  return [
    '# HELP wikiforge_llm_calls_total Total LLM calls.',
    '# TYPE wikiforge_llm_calls_total counter',
    `wikiforge_llm_calls_total ${llmMetrics.calls}`,
    '# HELP wikiforge_llm_tokens_total Estimated LLM tokens consumed.',
    '# TYPE wikiforge_llm_tokens_total counter',
    `wikiforge_llm_tokens_total ${llmMetrics.tokens}`,
    '# HELP wikiforge_llm_latency_ms_total Total LLM latency in milliseconds.',
    '# TYPE wikiforge_llm_latency_ms_total counter',
    `wikiforge_llm_latency_ms_total ${llmMetrics.latencyMs}`,
    '# HELP wikiforge_llm_errors_total Total LLM call errors.',
    '# TYPE wikiforge_llm_errors_total counter',
    `wikiforge_llm_errors_total ${llmMetrics.errors}`,
    '',
  ].join('\n');
}
