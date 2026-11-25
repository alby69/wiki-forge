/**
 * Shared derivation logic for the command manifest.
 *
 * Used by both `scripts/gen_command_manifest.mjs` and
 * `tests/commandManifest.test.ts` so the generated artefacts and the guard
 * test can never disagree about how the inventory is computed.
 */

import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROUTES } from '../../src/shared/api/contracts.ts';
import { LEGACY_MCP_TOOLS, mcpInputSchemaForRoute, mcpToolNameForRoute } from '../../src/shared/mcp/definitions.ts';
import { COMMAND_CATALOG } from '../../src/frontend/components/chat/commandCatalog.ts';
import { AgentServer } from '../../src/backend/server/agentServer.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');

const ENV_KEYS = [
  'WIKIFORGE_API_TOKEN',
  'WIKIFORGE_ADMIN_USERNAME',
  'WIKIFORGE_ADMIN_PASSWORD',
  'WIKIFORGE_SESSION_TTL_MS',
  'WIKIFORGE_USER_STORE_FILE',
  'WIKIFORGE_PROJECT_ID',
];

async function collectBusCommands() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'wf-manifest-'));
  const previous = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) delete process.env[key];
    for (const dir of ['config', 'wiki', 'raw', 'output', '.wiki-forge', 'skills']) {
      await mkdir(path.join(tempRoot, dir), { recursive: true });
    }
    await writeFile(
      path.join(tempRoot, 'config', 'config.toml'),
      '[enterprise]\nenable_rbac = false\n',
      'utf-8',
    );
    const server = new AgentServer(tempRoot);
    return server.getBus().commands();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function collectImplementedSlashCommands(source) {
  const methodStart = source.indexOf('async processChatCommand(this: Host,');
  if (methodStart < 0) throw new Error('processChatCommand not found in knowledgeService.ts');
  const switchStart = source.indexOf('switch (command) {', methodStart);
  if (switchStart < 0) throw new Error('slash command switch not found in knowledgeService.ts');
  const defaultStart = source.indexOf('\n      default: {', switchStart);
  const region = source.slice(switchStart, defaultStart < 0 ? switchStart + 8000 : defaultStart);
  return [...new Set([...region.matchAll(/case '([a-z0-9-]+)':/g)].map((match) => match[1]))].sort();
}

export async function deriveCommandManifest() {
  const [busCommands, agentSource] = await Promise.all([
    collectBusCommands(),
    readFile(path.join(REPO_ROOT, 'src', 'backend', 'server', 'services', 'knowledgeService.ts'), 'utf-8'),
  ]);

  const implementedSlashCommands = collectImplementedSlashCommands(agentSource);
  const routeTools = ROUTES.map((route) => ({
    name: mcpToolNameForRoute(route.id),
    operationId: route.id,
    description: `${route.summary} · ${route.method} ${route.path}`,
    inputSchema: mcpInputSchemaForRoute(route),
    mutating: route.method !== 'GET',
    legacy: false,
  }));
  const mcpTools = [...routeTools, ...LEGACY_MCP_TOOLS].map((tool) => ({
    name: tool.name,
    operationId: tool.operationId,
    description: tool.description,
    inputSchema: tool.inputSchema,
    mutating: tool.mutating,
    legacy: tool.legacy,
  }));
  const implementedSet = new Set(implementedSlashCommands);
  const busSet = new Set(busCommands);

  const routes = ROUTES.map((route) => ({
    id: route.id,
    method: route.method,
    path: route.path,
    command: route.command,
    tags: [...route.tags],
    projectScoped: route.projectScoped === true,
    stream: route.stream ?? null,
    hasBusHandler: busSet.has(route.command),
  }));

  const slashCommands = COMMAND_CATALOG.flatMap((category) =>
    category.commands.map((command) => ({
      id: command.cmd,
      category: category.id,
      verb: command.cmd.split(' ')[0],
      hasImplementation: implementedSet.has(command.cmd.split(' ')[0]),
    })),
  );

  const gaps = [
    ...routes
      .filter((route) => !route.hasBusHandler)
      .map((route) => ({
        kind: 'route-without-bus',
        id: route.id,
        detail: `command '${route.command}' has no bus handler`,
      })),
    ...slashCommands
      .filter((command) => !command.hasImplementation)
      .map((command) => ({
        kind: 'slash-without-implementation',
        id: command.id,
        detail: 'catalogued slash command has no dedicated case in processChatCommand',
      })),
  ].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));

  return {
    routes,
    busCommands: [...busCommands].sort(),
    slashCommands,
    implementedSlashCommands,
    mcpTools,
    gaps,
  };
}

function literal(value) {
  return JSON.stringify(value, null, 2);
}

export function renderTypescript(manifest) {
  return `// GENERATED FILE — do not edit by hand.
// Run \`npm run manifest\` to regenerate; \`npm run manifest:check\` verifies freshness.

export interface CommandManifestRoute {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly command: string;
  readonly tags: readonly string[];
  readonly projectScoped: boolean;
  readonly stream: string | null;
  readonly hasBusHandler: boolean;
}

export interface CommandManifestSlash {
  readonly id: string;
  readonly category: string;
  readonly verb: string;
  readonly hasImplementation: boolean;
}

export interface CommandManifestGap {
  readonly kind: 'route-without-bus' | 'slash-without-implementation';
  readonly id: string;
  readonly detail: string;
}

export interface CommandManifestMcpTool {
  readonly name: string;
  readonly operationId: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly mutating: boolean;
  readonly legacy: boolean;
}

export interface CommandManifest {
  readonly routes: readonly CommandManifestRoute[];
  readonly busCommands: readonly string[];
  readonly slashCommands: readonly CommandManifestSlash[];
  readonly implementedSlashCommands: readonly string[];
  readonly mcpTools: readonly CommandManifestMcpTool[];
  readonly gaps: readonly CommandManifestGap[];
}

export const COMMAND_MANIFEST: CommandManifest = ${literal(manifest)};

export const OPERATION_IDS: readonly string[] = COMMAND_MANIFEST.routes.map((route) => route.id);
export const COMMAND_GAPS: readonly CommandManifestGap[] = COMMAND_MANIFEST.gaps;
`;
}

export function renderMarkdown(manifest) {
  const routeRows = manifest.routes
    .map((route) => `| \`${route.id}\` | ${route.method} | \`${route.path}\` | ${route.hasBusHandler ? 'sì' : '**no**'} |`)
    .join('\n');
  const slashRows = manifest.slashCommands
    .map((command) => `| \`${command.id}\` | ${command.category} | ${command.hasImplementation ? 'sì' : '**no**'} |`)
    .join('\n');
  const gapRows = manifest.gaps
    .map((gap) => `| ${gap.kind} | \`${gap.id}\` | ${gap.detail} |`)
    .join('\n');

  return `# Command Manifest (generato)

> GENERATED FILE — non modificare a mano. Rigenera con \`npm run manifest\`.
> Fonte: \`scripts/gen_command_manifest.mjs\`, derivata da \`src/shared/api/contracts.ts\`,
> \`src/frontend/components/chat/commandCatalog.ts\`, \`src/backend/server/agentServer.ts\`
> e \`src/shared/mcp/definitions.ts\`.

- Route HTTP: **${manifest.routes.length}**
- Handler bus: **${manifest.busCommands.length}**
- Comandi slash catalogati: **${manifest.slashCommands.length}**
- Comandi slash con case dedicato: **${manifest.implementedSlashCommands.length}**
- Tool MCP: **${manifest.mcpTools.length}**
- Gap noti: **${manifest.gaps.length}**

## Route HTTP

| Operazione | Metodo | Path | Handler bus |
|---|---|---|---|
${routeRows}

## Comandi slash

| Comando | Categoria | Case dedicato |
|---|---|---|
${slashRows}

## Tool MCP

| Tool | OperationId | Mutante | Legacy |
|---|---|---|---|
${manifest.mcpTools.map((tool) => `| \`${tool.name}\` | \`${tool.operationId}\` | ${tool.mutating ? 'sì' : 'no'} | ${tool.legacy ? 'sì' : 'no'} |`).join('\n')}

## Gap noti

| Tipo | ID | Dettaglio |
|---|---|---|
${gapRows}
`;
}
