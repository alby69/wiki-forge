import { json } from '../api/http';
import type { CommandContext, DomainModule, MessageBus } from '../bus/messageBus';
import { GENERIC_SLASH_COMMANDS, IMPLEMENTED_SLASH_COMMANDS } from '@shared/domain/slashCommands';
import type { SlashPort } from '../../app/ports';

type SlashPayload = {
  command?: string;
  args?: string;
  message?: string;
};

export class SlashCommandModule implements DomainModule {
  readonly name = 'slash';

  constructor(private readonly services: SlashPort) {}

  register(bus: MessageBus): void {
    bus.register<SlashPayload>('chat.command', (payload, context) =>
      this.dispatch(payload.command ?? '', payload.args ?? payload.message ?? '', context),
    );

    for (const verb of [...IMPLEMENTED_SLASH_COMMANDS, ...GENERIC_SLASH_COMMANDS]) {
      bus.register<SlashPayload>(`cmd.${verb}`, (payload, context) =>
        this.dispatch(verb, payload.args ?? payload.message ?? '', context),
      );
    }
  }

  private async dispatch(verb: string, args: string, context: CommandContext) {
    const normalized = verb.replace(/^\//, '').toLowerCase();
    const answer = await this.services.processChatCommand(
      { command: normalized, message: args },
      context.projectId,
      context.principal,
    );
    return json({ success: true, command: normalized, answer });
  }
}

export function createSlashModule(services: SlashPort): SlashCommandModule {
  return new SlashCommandModule(services);
}
