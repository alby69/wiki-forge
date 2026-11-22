/** Read-only tool catalogues: script registry and Knowledge Engineering Use Cases. */

import { json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';

type Registry = Record<string, object>;

export class ToolsModule implements DomainModule {
  readonly name = 'tools';

  constructor(
    private readonly registry: Registry,
    private readonly useCases: Registry,
  ) {}

  register(bus: MessageBus): void {
    bus.register('scripts.list', () => this.listScripts());
    bus.register('scripts.registry', () => this.listScripts());
    bus.register('ke.useCases.list', () => this.listUseCases());
  }

  listScripts(): ApiResult {
    return json({
      success: true,
      registry: this.registry,
      scripts: Object.values(this.registry),
    });
  }

  listUseCases(): ApiResult {
    return json({ success: true, useCases: Object.values(this.useCases) });
  }
}

export function createToolsModule(registry: Registry, useCases: Registry): ToolsModule {
  return new ToolsModule(registry, useCases);
}
