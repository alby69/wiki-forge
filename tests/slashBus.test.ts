import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { GENERIC_SLASH_COMMANDS, IMPLEMENTED_SLASH_COMMANDS } from '@shared/domain/slashCommands';
import { COMMAND_CATALOG } from '@frontend/components/chat/commandCatalog';
import { deriveCommandManifest } from '../scripts/lib/commandManifest.mjs';

const KNOWLEDGE_SERVICE = path.resolve('src/backend/server/services/knowledgeService.ts');

function switchCases(source: string): string[] {
  const methodStart = source.indexOf('async processChatCommand(this: Host,');
  const switchStart = source.indexOf('switch (command) {', methodStart);
  assert.ok(switchStart > methodStart, 'switch (command) non trovato');
  const defaultStart = source.indexOf('\n      default: {', switchStart);
  const region = source.slice(switchStart, defaultStart < 0 ? switchStart + 8000 : defaultStart);
  return [...new Set([...region.matchAll(/case '([a-z0-9-]+)':/g)].map((match) => match[1]))].sort();
}

describe('Slash command sul bus — Fase 2 del piano di disaccoppiamento', () => {
  it('la lista condivisa coincide con i case implementati', async () => {
    const source = await readFile(KNOWLEDGE_SERVICE, 'utf-8');
    assert.deepEqual([...IMPLEMENTED_SLASH_COMMANDS].sort(), switchCases(source));
  });

  it('ogni slash implementato è dispatchabile senza HTTP', async () => {
    const manifest = await deriveCommandManifest();
    const busCommands = new Set(manifest.busCommands);
    for (const verb of IMPLEMENTED_SLASH_COMMANDS) {
      assert.ok(busCommands.has(`cmd.${verb}`), `cmd.${verb} mancante sul bus`);
    }
    assert.ok(busCommands.has('chat.command'), 'chat.command mancante sul bus');
  });

  it('la lista generica copre esattamente i comandi del catalogo senza case dedicato', async () => {
    const catalog = COMMAND_CATALOG.flatMap((category) => category.commands.map((command) => command.cmd));
    const implemented = new Set<string>(IMPLEMENTED_SLASH_COMMANDS);
    const expected = [...new Set(catalog.filter((command) => !implemented.has(command)))].sort();
    assert.deepEqual([...GENERIC_SLASH_COMMANDS].sort(), expected);
  });

  it('ogni slash catalogato è dispatchabile senza HTTP', async () => {
    const manifest = await deriveCommandManifest();
    const busCommands = new Set(manifest.busCommands);
    for (const command of manifest.slashCommands) {
      assert.ok(busCommands.has(`cmd.${command.id}`), `cmd.${command.id} mancante sul bus`);
    }
  });
});
