/**
 * Ingestion queue module: wraps the Python ingestion/conversion tools.
 *
 * Dependencies are injected so this module never imports `AgentServer` or any
 * HTTP type. The streaming command returns an `SseResult` that the gateway
 * adapts to the response, keeping the SSE frames byte-for-byte compatible.
 */

import { spawn } from 'node:child_process';
import { error, sse, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import { runPythonJson, type PythonTool } from './pythonTool';

export interface EnqueuePayload {
  filePath?: string;
}

export class IngestionModule implements DomainModule {
  readonly name = 'ingestion';

  constructor(private readonly tool: PythonTool) {}

  register(bus: MessageBus): void {
    bus.register('ingest.queue.list', (_payload, context) => this.list(context.projectId));
    bus.register<EnqueuePayload>('ingest.queue.add', (payload, context) => this.add(payload, context.projectId));
    bus.register('ingest.queue.process', (_payload, context) => this.process(context.projectId));
  }

  list(projectId: string): Promise<ApiResult> {
    return runPythonJson(this.tool, 'scripts/ingest_queue.py', ['list', '--json'], projectId, '{"items":[]}');
  }

  add(payload: EnqueuePayload, projectId: string): Promise<ApiResult> {
    return runPythonJson(
      this.tool,
      'scripts/ingest_queue.py',
      ['enqueue', '--file', payload.filePath as string, '--json'],
      projectId,
      '{"success":true}',
    );
  }

  async process(projectId: string): Promise<ApiResult> {
    try {
      const cwd = await this.tool.resolveRoot(projectId);
      const script = this.tool.pathFor('scripts/conv2md.py');
      return sse((res) => {
        res.write(`data: ${JSON.stringify({ type: 'start', message: 'Starting two-step CoT queue processing...' })}\n\n`);
        const child = spawn(this.tool.pythonCmd, [script, '--cot', '--json'], { cwd });
        child.stdout.on('data', (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'stdout', text: chunk.toString('utf-8') })}\n\n`);
        });
        child.stderr.on('data', (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'stderr', text: chunk.toString('utf-8') })}\n\n`);
        });
        child.on('close', (code) => {
          res.write(`data: ${JSON.stringify({ type: 'exit', code: code ?? 0 })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        });
      });
    } catch (err) {
      return error(String(err), 500);
    }
  }
}

export function createIngestionModule(tool: PythonTool): IngestionModule {
  return new IngestionModule(tool);
}
