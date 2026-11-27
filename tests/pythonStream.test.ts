import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import {
  formatLlamaFrame,
  formatSseFrame,
  isLlamaFrame,
  isReasoningFrame,
  llamaDeltaFrame,
  llamaErrorFrame,
  parseLlamaFrames,
  parseSseFrames,
  reasoningDoneFrame,
  reasoningErrorFrame,
  reasoningTokenFrame,
  SAMPLE_LLAMA_FRAMES,
  SAMPLE_REASONING_FRAMES,
  streamSseFrames,
} from '@shared/api/pythonStream';

interface FrameFixture {
  reasoning_frames: unknown[];
  reasoning_sse: string[];
  reasoning_error: unknown;
  llama_frames: unknown[];
  llama_jsonl: string[];
}

const fixture = JSON.parse(
  readFileSync(path.resolve('tests/fixtures/python_stream_frames.json'), 'utf-8'),
) as FrameFixture;

function streamedResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }));
}

test('reasoning frames and SSE lines match the Python fixture byte for byte', () => {
  assert.deepEqual(fixture.reasoning_frames, SAMPLE_REASONING_FRAMES);
  assert.deepEqual(fixture.llama_frames, SAMPLE_LLAMA_FRAMES);
  assert.deepEqual(SAMPLE_REASONING_FRAMES.map(formatSseFrame), fixture.reasoning_sse);
  assert.deepEqual(SAMPLE_LLAMA_FRAMES.map(formatLlamaFrame), fixture.llama_jsonl);
  assert.deepEqual(parseSseFrames(fixture.reasoning_sse.join('')), fixture.reasoning_frames);
  assert.deepEqual(parseLlamaFrames(fixture.llama_jsonl.join('')), fixture.llama_frames);
});

test('frame guards accept every fixture frame and reject malformed variants', () => {
  for (const frame of fixture.reasoning_frames) assert.ok(isReasoningFrame(frame));
  assert.ok(isReasoningFrame(fixture.reasoning_error));
  for (const frame of fixture.llama_frames) assert.ok(isLlamaFrame(frame));
  assert.ok(isReasoningFrame(reasoningTokenFrame('x', true)));
  assert.ok(isReasoningFrame(reasoningDoneFrame()));
  assert.ok(isReasoningFrame(reasoningErrorFrame('stop')));
  assert.ok(isLlamaFrame(llamaDeltaFrame('x')));
  assert.ok(isLlamaFrame(llamaErrorFrame('stop')));

  assert.equal(isReasoningFrame({ token: 'x' }), false);
  assert.equal(isReasoningFrame({ token: 'x', is_thinking: 'yes' }), false);
  assert.equal(isReasoningFrame({ done: 1 }), false);
  assert.equal(isReasoningFrame({ error: 1 }), false);
  assert.equal(isReasoningFrame({ token: 'x', is_thinking: true, extra: 1 }), false);
  assert.equal(isReasoningFrame(null), false);
  assert.equal(isLlamaFrame({ delta: 1 }), false);
  assert.equal(isLlamaFrame({ delta: 'x', error: 'stop' }), false);
  assert.equal(isLlamaFrame('ciao'), false);
  assert.throws(() => parseSseFrames('data: {"content":"x"}\n\n'), /Invalid reasoning frame/);
  assert.throws(() => parseLlamaFrames('{"token":"x"}\n'), /Invalid llama.cpp frame/);
  assert.deepEqual(parseSseFrames('data: [DONE]\n\n\r\ndata: {"done":true}\r\n\r\n'), [{ done: true }]);
});

test('SSE reader handles chunk boundaries, error frames and early termination', async () => {
  const received: unknown[] = [];
  await streamSseFrames(streamedResponse(fixture.reasoning_sse), (frame) => {
    received.push(frame);
    if ('done' in frame) return false;
  });
  assert.deepEqual(received, fixture.reasoning_frames);

  const failure = streamedResponse(['data: {"error":"modello non disponibile"}\n\n']);
  await assert.rejects(
    streamSseFrames(failure, (frame) => {
      if ('error' in frame) throw new Error(frame.error);
    }),
    /modello non disponibile/,
  );

  const tail = streamedResponse(['data: {"done":', 'true}\n\n']);
  const tailFrames: unknown[] = [];
  await streamSseFrames(tail, (frame) => { tailFrames.push(frame); });
  assert.deepEqual(tailFrames, [{ done: true }]);

  await assert.rejects(streamSseFrames(new Response(null), () => {}), /no response body/);
});
