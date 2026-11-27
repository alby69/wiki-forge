/**
 * TypeScript mirror of src/backend/wikiforge/api/stream_protocol.py.
 *
 * Both sides validate the same frames from tests/fixtures/python_stream_frames.json.
 */

export type ReasoningTokenFrame = { token: string; is_thinking: boolean };
export type ReasoningDoneFrame = { done: true };
export type ReasoningErrorFrame = { error: string };
export type ReasoningFrame = ReasoningTokenFrame | ReasoningDoneFrame | ReasoningErrorFrame;

export type LlamaDeltaFrame = { delta: string };
export type LlamaErrorFrame = { error: string };
export type LlamaFrame = LlamaDeltaFrame | LlamaErrorFrame;

export const SAMPLE_REASONING_FRAMES: readonly ReasoningFrame[] = [
  { token: '<think>', is_thinking: true },
  { token: 'analisi', is_thinking: true },
  { token: '</think>', is_thinking: true },
  { token: 'finale', is_thinking: false },
  { done: true },
];

export const SAMPLE_LLAMA_FRAMES: readonly LlamaFrame[] = [
  { delta: 'ciao' },
  { delta: ' mondo' },
  { error: 'stop' },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keysAre(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function isReasoningFrame(value: unknown): value is ReasoningFrame {
  if (!isObject(value)) return false;
  if (keysAre(value, ['token', 'is_thinking'])) {
    return typeof value.token === 'string' && typeof value.is_thinking === 'boolean';
  }
  if (keysAre(value, ['done'])) return value.done === true;
  if (keysAre(value, ['error'])) return typeof value.error === 'string';
  return false;
}

export function isLlamaFrame(value: unknown): value is LlamaFrame {
  if (!isObject(value)) return false;
  if (keysAre(value, ['delta'])) return typeof value.delta === 'string';
  if (keysAre(value, ['error'])) return typeof value.error === 'string';
  return false;
}

export function reasoningTokenFrame(token: string, isThinking: boolean): ReasoningTokenFrame {
  return { token, is_thinking: isThinking };
}

export function reasoningDoneFrame(): ReasoningDoneFrame {
  return { done: true };
}

export function reasoningErrorFrame(message: string): ReasoningErrorFrame {
  return { error: message };
}

export function llamaDeltaFrame(delta: string): LlamaDeltaFrame {
  return { delta };
}

export function llamaErrorFrame(message: string): LlamaErrorFrame {
  return { error: message };
}

export function formatSseFrame(frame: ReasoningFrame): string {
  return `data: ${JSON.stringify(frame)}\n\n`;
}

export function formatLlamaFrame(frame: LlamaFrame): string {
  return `${JSON.stringify(frame)}\n`;
}

export function parseSseFrames(text: string): ReasoningFrame[] {
  const frames: ReasoningFrame[] = [];
  for (const chunk of text.split(/\r?\n\r?\n/)) {
    const line = chunk.split(/\r?\n/).find((part) => part.startsWith('data:'));
    if (!line) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    const value: unknown = JSON.parse(data);
    if (!isReasoningFrame(value)) throw new Error(`Invalid reasoning frame: ${data}`);
    frames.push(value);
  }
  return frames;
}

export function parseLlamaFrames(text: string): LlamaFrame[] {
  const frames: LlamaFrame[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const value: unknown = JSON.parse(line);
    if (!isLlamaFrame(value)) throw new Error(`Invalid llama.cpp frame: ${line}`);
    frames.push(value);
  }
  return frames;
}

/** Consume an SSE response frame by frame; returning false from onFrame stops the stream. */
export async function streamSseFrames(
  response: Response,
  onFrame: (frame: ReasoningFrame) => boolean | void,
): Promise<void> {
  if (!response.body) throw new Error('Reasoning stream has no response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handle = (chunk: string): boolean => {
    const parts = chunk.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      for (const frame of parseSseFrames(`${part}\n\n`)) {
        if (onFrame(frame) === false) return false;
      }
    }
    return true;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (!handle(buffer)) return;
    }
    if (buffer.trim() && !handle(`${buffer}\n\n`)) return;
  } finally {
    reader.releaseLock();
  }
}
