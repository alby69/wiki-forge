import type { LlmClient, LlmCompletionParams } from '../llmClient';
import {
  LlmBudgetExceededError,
  type LlmBudgetConfig,
  readLlmUsage,
  writeLlmUsage,
  estimateTokens,
  recordLlmCall,
} from './llmObservability';

export class InstrumentedLlmClient implements LlmClient {
  constructor(
    private readonly inner: LlmClient,
    private readonly provider: string,
    private readonly model: string,
    private readonly budget: LlmBudgetConfig,
    private readonly stateDir: string,
  ) {}

  async complete(params: LlmCompletionParams): Promise<string> {
    const start = Date.now();
    const promptText = `${params.systemPrompt}\n${params.userMessage}\n${(params.contextNotes ?? []).map(n => n.content).join('\n')}`;
    const estimated = estimateTokens(promptText);
    // Budget check
    if (this.budget.hardTokenLimit > 0) {
      const usage = await readLlmUsage(this.stateDir);
      if (usage.tokens + estimated > this.budget.hardTokenLimit) {
        throw new LlmBudgetExceededError(
          `LLM daily hard limit exceeded (${usage.tokens}/${this.budget.hardTokenLimit} tokens)`,
        );
      }
      if (this.budget.softTokenLimit > 0 && usage.tokens + estimated > this.budget.softTokenLimit) {
        // eslint-disable-next-line no-console
        console.warn(`[llm] soft budget exceeded: ${usage.tokens + estimated}/${this.budget.softTokenLimit}`);
      }
    }

    let error = false;
    try {
      const result = await this.inner.complete(params);
      const totalTokens = estimated + estimateTokens(result);
      recordLlmCall({ tokens: totalTokens, latencyMs: Date.now() - start, error: false });
      if (this.budget.hardTokenLimit > 0) {
        const usage = await readLlmUsage(this.stateDir);
        await writeLlmUsage(this.stateDir, { date: usage.date, tokens: usage.tokens + totalTokens });
      }
      // eslint-disable-next-line no-console
      console.info('[llm]', {
        provider: this.provider,
        model: this.model,
        command: params.command ?? 'unknown',
        correlationId: params.correlationId ?? 'unknown',
        tokens: totalTokens,
        latencyMs: Date.now() - start,
        outcome: 'ok',
      });
      return result;
    } catch (err) {
      error = true;
      recordLlmCall({ tokens: estimated, latencyMs: Date.now() - start, error: true });
      // eslint-disable-next-line no-console
      console.info('[llm]', {
        provider: this.provider,
        model: this.model,
        command: params.command ?? 'unknown',
        correlationId: params.correlationId ?? 'unknown',
        tokens: estimated,
        latencyMs: Date.now() - start,
        outcome: 'error',
      });
      throw err;
    }
  }

  async completeStream(params: LlmCompletionParams, onChunk: (chunk: string) => void): Promise<string> {
    if (this.inner.completeStream) {
      return this.inner.completeStream(params, onChunk);
    }
    const result = await this.complete(params);
    onChunk(result);
    return result;
  }
}
