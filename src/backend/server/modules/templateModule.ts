import { json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import { CANONICAL_TEMPLATES } from '@shared/domain/templates';

export class TemplateModule implements DomainModule {
  readonly name = 'templates';

  register(bus: MessageBus): void {
    bus.register('templates.list', () => this.list());
  }

  private async list(): Promise<ApiResult> {
    return json({ success: true, templates: CANONICAL_TEMPLATES });
  }
}

export function createTemplateModule(): TemplateModule {
  return new TemplateModule();
}
