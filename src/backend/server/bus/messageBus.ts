/**
 * In-process request/response bus for backend components.
 *
 * Components register commands by name (the same `operationId` used by the
 * OpenAPI catalogue) and communicate only through `dispatch`/`publish`.
 * The HTTP gateway is just one adapter: a CLI, scheduler or test can dispatch
 * the same commands without going through `AgentServer.handleRequest()`.
 */

import { error, json, type ApiResult } from '../api/http';
import type { RbacDecision } from '../auth/rbacConfig';

/**
 * B1 — identity of the caller, derived exclusively by the server-side adapter.
 *
 * `actor` uses the canonical `human:<id>` / `process:<id>` notation. In legacy
 * mode (no RBAC/IdP configured) every HTTP request is the shared process actor
 * `process:api-token` with no roles. Client-supplied `reviewer`/`user`/`actor`
 * body fields can never produce or overwrite a Principal.
 */
export interface Principal {
  actor: string;
  roles: string[];
  source: 'legacy-token' | 'idp' | 'process';
}

export interface CommandContext {
  /** Absolute repository/workspace root. */
  rootDir: string;
  /** Project selected by `X-Project-Id` / `?projectId=`. */
  projectId: string;
  /** Stable operation id of the originating HTTP route, when applicable. */
  operationId?: string;
  /** Server-trusted principal. Optional because non-HTTP callers have none. */
  principal?: Principal;
  /** B3 permission decision, set by the opt-in RBAC middleware only. */
  rbac?: RbacDecision;
  /** Correlation id useful for logs and audit trails. */
  correlationId: string;
  /** Optional lifecycle hook supplied by the HTTP adapter for SSE cleanup. */
  onClose?: (handler: () => void) => void;
}

export type CommandHandler<Payload = unknown, Result = unknown> = (
  payload: Payload,
  context: CommandContext,
) => Promise<ApiResult<Result>> | ApiResult<Result>;

export type EventHandler<Payload = unknown> = (payload: Payload, context: Partial<CommandContext>) => void | Promise<void>;

export interface DomainModule {
  readonly name: string;
  register(bus: MessageBus): void | Promise<void>;
}

let sequence = 0;
function nextCorrelationId(): string {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence.toString(36)}`;
}

export class MessageBus {
  private readonly handlers = new Map<string, Set<CommandHandler>>();
  private readonly observers = new Map<string, Set<EventHandler>>();
  private readonly middlewares: Array<
    (command: string, payload: unknown, context: CommandContext) => Promise<ApiResult> | ApiResult | undefined
  > = [];

  /** Register a command handler. Multiple handlers are dispatched in order; the first result wins. */
  register<Payload = unknown, Result = unknown>(
    command: string,
    handler: CommandHandler<Payload, Result>,
  ): () => void {
    const set = this.handlers.get(command) ?? new Set<CommandHandler>();
    set.add(handler as CommandHandler);
    this.handlers.set(command, set);
    return () => set.delete(handler as CommandHandler);
  }

  async registerModule(module: DomainModule): Promise<void> {
    await module.register(this);
  }

  use(
    middleware: (command: string, payload: unknown, context: CommandContext) => Promise<ApiResult> | ApiResult | undefined,
  ): void {
    this.middlewares.push(middleware);
  }

  on<Payload = unknown>(event: string, handler: EventHandler<Payload>): () => void {
    const set = this.observers.get(event) ?? new Set<EventHandler>();
    set.add(handler as EventHandler);
    this.observers.set(event, set);
    return () => set.delete(handler as EventHandler);
  }

  async publish<Payload = unknown>(event: string, payload: Payload, context: Partial<CommandContext> = {}): Promise<void> {
    for (const handler of [...(this.observers.get(event) ?? [])]) {
      await handler(payload, context);
    }
  }

  has(command: string): boolean {
    return this.handlers.has(command) && (this.handlers.get(command)?.size ?? 0) > 0;
  }

  commands(): string[] {
    return [...this.handlers.keys()].sort();
  }

  async dispatch<Result = unknown>(
    command: string,
    payload: unknown = {},
    overrides: Partial<CommandContext> = {},
  ): Promise<ApiResult<Result>> {
    const context: CommandContext = {
      rootDir: process.cwd(),
      projectId: 'default',
      correlationId: nextCorrelationId(),
      ...overrides,
    };

    for (const middleware of this.middlewares) {
      const result = await middleware(command, payload, context);
      if (result) return result as ApiResult<Result>;
    }

    for (const handler of [...(this.handlers.get(command) ?? [])]) {
      try {
        const result = await handler(payload, context);
        if (result) {
          await this.publish('command:handled', { command, correlationId: context.correlationId }, context);
          return result as ApiResult<Result>;
        }
      } catch (err) {
        await this.publish('command:failed', { command, error: String(err), correlationId: context.correlationId }, context);
        return error(`Command '${command}' failed: ${String(err)}`, 500) as ApiResult<Result>;
      }
    }

    return error(`No handler registered for command '${command}'`, 404) as ApiResult<Result>;
  }
}

/** Create an isolated bus; useful for tests and future worker processes. */
export function createMessageBus(): MessageBus {
  return new MessageBus();
}

/** Uniform success result for simple read commands. */
export function ok<T extends Record<string, unknown>>(body: T): ApiResult<T> {
  return json({ success: true, ...body });
}
