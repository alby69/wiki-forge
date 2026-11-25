/**
 * Chat domain module.
 *
 * The legacy `/api/chat` handler is split by transport: JSON answers become a
 * `JsonResult`, while SSE frames are written by an `SseResult` whose callback
 * owns the stream. The request shape is imported as a type only, so there is no
 * runtime dependency on `AgentServer`.
 */

import { error, json, sse, type ApiResult } from '../api/http';
import type { CommandContext, DomainModule, MessageBus } from '../bus/messageBus';
import type { ChatPort } from '../../app/ports';
import type { ChatRequest } from '@shared/domain/scripts';

type Payload = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export class ChatModule implements DomainModule {
  readonly name = 'chat';

  constructor(private readonly services: ChatPort) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('chat.send', (payload, context) => this.send(payload, context));
  }

  private async send(payload: Payload, context: CommandContext): Promise<ApiResult> {
    const projectId = context.projectId;
    const body: ChatRequest = {
      message: asString(payload.message),
      command: asString(payload.command),
      contextNoteId: asString(payload.contextNoteId),
      stream: asBool(payload.stream),
    };
    const isStream = payload.stream === true || String(payload.Accept ?? '').includes('text/event-stream');

    if (isStream) {
      return sse(async (res) => {
        try {
          await this.services.processChatCommandStream(body, (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          }, projectId, context.principal);
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (err) {
          // Headers have already been sent, so the legacy handler emitted an
          // in-stream error frame instead of a JSON 500.
          res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
          res.end();
        }
      });
    }

    try {
      const response = await this.services.processChatCommand(body, projectId, context.principal);
      return json({ success: true, response });
    } catch (err) {
      return error(String(err), 500);
    }
  }
}

export function createChatModule(services: ChatPort): ChatModule {
  return new ChatModule(services);
}
