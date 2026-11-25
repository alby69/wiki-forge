import type { CommandContext, MessageBus } from '../bus/messageBus';
import { createLogger, type StructuredLogger } from './logger';

interface CommandEvent {
  readonly command: string;
  readonly correlationId?: string;
  readonly error?: unknown;
}

function auditFields(event: CommandEvent, status: 'handled' | 'failed', context: Partial<CommandContext>): Record<string, unknown> {
  const actor = context.principal?.actor;
  return {
    command: event.command,
    status,
    correlationId: event.correlationId ?? null,
    ...(actor ? { actor } : {}),
    ...(status === 'failed' ? { error: String(event.error ?? '') } : {}),
  };
}

export function installCommandAudit(
  bus: MessageBus,
  logger: StructuredLogger = createLogger('command-audit'),
): () => void {
  const unsubscribeHandled = bus.on<CommandEvent>('command:handled', (event, context) => {
    logger.info('command.audit', auditFields(event, 'handled', context));
  });
  const unsubscribeFailed = bus.on<CommandEvent>('command:failed', (event, context) => {
    logger.error('command.audit', auditFields(event, 'failed', context));
  });
  return () => {
    unsubscribeHandled();
    unsubscribeFailed();
  };
}
