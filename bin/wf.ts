import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';

import { ApiClientError, createApiClient } from '@shared/api/client';
import type { EndpointId } from '@shared/api/contracts';
import { COMMAND_MANIFEST } from '@shared/api/generated/commandManifest.generated';
import { interpolatePath } from '@shared/api/router';

interface GlobalOptions {
  json?: boolean;
  project: string;
  token?: string;
  output?: string;
  dryRun?: boolean;
  yes?: boolean;
  baseUrl?: string;
}

interface RequestOptions {
  input?: string;
  body?: string;
}

class CliError extends Error {
  readonly code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'CliError';
    this.code = code;
  }
}

const OPERATION_IDS = new Set(COMMAND_MANIFEST.routes.map((route) => route.id));
const MCP_ENTRYPOINT = fileURLToPath(new URL('./mcp.ts', import.meta.url));

async function loadPayload(options: RequestOptions): Promise<Record<string, any>> {
  const text = options.body ?? (options.input ? await readFile(options.input, 'utf-8') : undefined);
  if (!text || !text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new CliError('Il payload deve essere un oggetto JSON', 2);
    }
    return value as Record<string, any>;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`JSON non valido: ${String(error)}`, 2);
  }
}

function emit(value: unknown, globals: GlobalOptions): void {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (globals.output) {
    writeFileSync(globals.output, text, 'utf-8');
    return;
  }
  process.stdout.write(text);
}

function makeClient(globals: GlobalOptions) {
  return createApiClient({
    baseUrl: globals.baseUrl ?? process.env.WIKI_FORGE_API_URL ?? 'http://127.0.0.1:3001',
    getProjectId: () => globals.project,
    getToken: () => globals.token ?? process.env.WIKI_FORGE_TOKEN,
    getBearerToken: () => process.env.WIKI_FORGE_BEARER,
  });
}

async function callRoute(
  id: string,
  request: Record<string, any>,
  globals: GlobalOptions,
): Promise<void> {
  if (!OPERATION_IDS.has(id)) throw new CliError(`OperationId sconosciuto: ${id}`, 2);
  const route = COMMAND_MANIFEST.routes.find((item) => item.id === id)!;
  const params = (request.params ?? {}) as Record<string, string | number>;
  const query = (request.query ?? {}) as Record<string, unknown>;

  if (globals.dryRun) {
    emit({
      operationId: id,
      method: route.method,
      url: `${globals.baseUrl ?? process.env.WIKI_FORGE_API_URL ?? 'http://127.0.0.1:3001'}${interpolatePath(route.path, params)}`,
      query,
      request,
    }, globals);
    return;
  }

  const client = makeClient(globals);
  if (route.stream) {
    await client.stream(
      id as EndpointId,
      request as never,
      (event) => emit(event, globals),
    );
    return;
  }
  emit(await client.call(id as EndpointId, request as never), globals);
}

function withPayload(command: Command): Command {
  return command
    .addOption(new Option('--input <file>', 'payload JSON da file'))
    .addOption(new Option('--body <json>', 'payload JSON inline'));
}

function requireYes(globals: GlobalOptions): void {
  if (!globals.dryRun && !globals.yes) {
    throw new CliError('Operazione distruttiva: conferma con --yes', 2);
  }
}

function mergePayload(payload: Record<string, any>, values: Record<string, unknown>): Record<string, any> {
  return { ...payload, ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) };
}

function parseNumber(value: string | undefined, fallback?: number): number | undefined {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new CliError(`Numero non valido: ${value}`, 2);
  return parsed;
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name('wf')
    .description('Wiki-Forge CLI — HTTP-only client per il catalogo API')
    .option('--json', 'output JSON')
    .option('--project <id>', 'project id', 'default')
    .option('--token <token>', 'shared API token')
    .option('--output <file>', 'scrivi il risultato su file')
    .option('--dry-run', 'mostra la richiesta senza inviarla')
    .option('--yes', 'conferma operazioni distruttive')
    .option('--base-url <url>', 'API base URL');

  const api = withPayload(program.command('api <operationId>'))
    .description('chiama un operationId del catalogo')
    .action(async (operationId: string, options: RequestOptions) => {
      await callRoute(operationId, await loadPayload(options), program.opts<GlobalOptions>());
    });

  const wiki = program.command('wiki').description('vault e operazioni sulle note');

  withPayload(wiki.command('list'))
    .description('elenca le note wiki')
    .action(async (options: RequestOptions) => {
      await callRoute('wiki.notes.list', await loadPayload(options), program.opts<GlobalOptions>());
    });

  withPayload(wiki.command('save [id]'))
    .description('salva una nota')
    .option('--content <text>', 'contenuto della nota')
    .option('--folder <folder>', 'cartella wiki')
    .option('--title <title>', 'titolo')
    .action(async (id: string | undefined, options: RequestOptions & { content?: string; folder?: string; title?: string }) => {
      const payload = await loadPayload(options);
      await callRoute('wiki.note.save', mergePayload(payload, {
        id: id ?? payload.id,
        content: options.content ?? payload.content,
        folder: options.folder ?? payload.folder,
        title: options.title ?? payload.title,
      }), program.opts<GlobalOptions>());
    });

  withPayload(wiki.command('move <from> <to>'))
    .description('sposta una nota o una cartella riscrivendo i wikilink')
    .option('--type <file|folder>', 'tipo di destinazione', 'file')
    .option('--dry-run-request', 'dry-run lato backend')
    .action(async (from: string, to: string, options: RequestOptions & { type: string; dryRunRequest?: boolean }) => {
      const payload = await loadPayload(options);
      await callRoute('wiki.move', mergePayload(payload, {
        from,
        to,
        type: options.type,
        dryRun: options.dryRunRequest ?? payload.dryRun,
      }), program.opts<GlobalOptions>());
    });

  withPayload(wiki.command('delete <path>'))
    .description('sposta una nota nel trash')
    .option('--type <file|folder>', 'tipo di destinazione', 'file')
    .action(async (targetPath: string, options: RequestOptions & { type: string }) => {
      const globals = program.opts<GlobalOptions>();
      requireYes(globals);
      const payload = await loadPayload(options);
      await callRoute('wiki.delete', mergePayload(payload, {
        targetPath,
        type: options.type,
      }), globals);
    });

  withPayload(wiki.command('ingest <file>'))
    .description('acquisizione e compilazione di un markdown')
    .option('--folder <folder>', 'cartella wiki di destinazione')
    .action(async (file: string, options: RequestOptions & { folder?: string }) => {
      const payload = await loadPayload(options);
      await callRoute('wiki.ingest', mergePayload(payload, {
        content: await readFile(file, 'utf-8'),
        fileName: payload.fileName ?? file,
        folder: options.folder ?? payload.folder,
      }), program.opts<GlobalOptions>());
    });

  const review = program.command('review').description('Review Studio');

  withPayload(review.command('verify <note>'))
    .description('registra una verifica umana')
    .option('--reviewer <id>', 'reviewer')
    .option('--comment <text>', 'commento')
    .option('--stable', 'promuovi la nota a stable')
    .action(async (note: string, options: RequestOptions & { reviewer?: string; comment?: string; stable?: boolean }) => {
      const payload = await loadPayload(options);
      await callRoute('review.verify', mergePayload(payload, {
        note,
        reviewer: options.reviewer ?? payload.reviewer,
        comment: options.comment ?? payload.comment,
        setStable: options.stable ?? payload.setStable,
      }), program.opts<GlobalOptions>());
    });

  withPayload(review.command('digest'))
    .description('digest determinstico delle attività')
    .option('--days <n>', 'giorni', '7')
    .option('--scope <all|folder|note>', 'ambito', 'all')
    .option('--note <ref>', 'nota')
    .action(async (options: RequestOptions & { days: string; scope: string; note?: string }) => {
      const payload = await loadPayload(options);
      await callRoute('review.digest', {
        ...payload,
        query: mergePayload(payload.query ?? {}, {
          days: parseNumber(options.days, 7),
          scope: options.scope,
          note: options.note,
        }),
      }, program.opts<GlobalOptions>());
    });

  withPayload(review.command('diff <note> <snapshot>'))
    .description('diff tra nota e snapshot')
    .action(async (note: string, snapshot: string, options: RequestOptions) => {
      const payload = await loadPayload(options);
      await callRoute('review.diff', {
        ...payload,
        query: mergePayload(payload.query ?? {}, { note, snapshot }),
      }, program.opts<GlobalOptions>());
    });

  withPayload(review.command('restore <note> <snapshot>'))
    .description('ripristina uno snapshot')
    .action(async (note: string, snapshot: string, options: RequestOptions) => {
      const globals = program.opts<GlobalOptions>();
      requireYes(globals);
      const payload = await loadPayload(options);
      await callRoute('review.restore', mergePayload(payload, { note, snapshot }), globals);
    });

  const study = program.command('study').description('Study Studio');

  const studyCommand = (name: string, operationId: string, argument: string, field: string) => {
    return withPayload(study.command(`${name} <${argument}>`))
      .description(`${name} determinstico`)
      .action(async (value: string, options: RequestOptions & { count?: string }) => {
        const payload = await loadPayload(options);
        await callRoute(operationId, mergePayload(payload, {
          [field]: value,
          count: options.count === undefined ? undefined : parseNumber(options.count),
        }), program.opts<GlobalOptions>());
      });
  };
  studyCommand('quiz', 'study.quiz', 'topic', 'topic').option('--count <n>', 'numero domande', '5');
  studyCommand('guide', 'study.guide', 'topic', 'topic');
  studyCommand('mindmap', 'study.mindmap', 'target', 'target');
  studyCommand('note', 'study.note', 'text', 'text');

  const ke = program.command('ke').description('Knowledge Engineering');
  withPayload(ke.command('run <script>'))
    .description('esegue uno script registrato')
    .option('--args <json>', 'argomenti JSON')
    .action(async (script: string, options: RequestOptions & { args?: string }) => {
      const payload = await loadPayload(options);
      const args = options.args ? JSON.parse(options.args) : payload.args;
      await callRoute('scripts.execute', mergePayload(payload, {
        scriptId: script,
        args: args ?? {},
      }), program.opts<GlobalOptions>());
    });

  const schedule = program.command('schedule').description('scheduler e approvals');

  withPayload(schedule.command('status'))
    .description('stato scheduler')
    .action(async (options: RequestOptions) => {
      await callRoute('schedule.status', await loadPayload(options), program.opts<GlobalOptions>());
    });

  withPayload(schedule.command('approvals'))
    .description('approval pending')
    .action(async (options: RequestOptions) => {
      await callRoute('schedule.approvals', await loadPayload(options), program.opts<GlobalOptions>());
    });

  withPayload(schedule.command('approve <id>'))
    .description('approva una richiesta')
    .option('--reviewer <id>', 'reviewer', 'human')
    .option('--reason <text>', 'motivazione')
    .action(async (id: string, options: RequestOptions & { reviewer: string; reason?: string }) => {
      const payload = await loadPayload(options);
      await callRoute('schedule.approvalDecision', mergePayload(payload, {
        params: { id, action: 'approve' },
        body: { reviewer: options.reviewer, reason: options.reason ?? payload.reason },
      }), program.opts<GlobalOptions>());
    });

  const cmd = program.command('cmd').description('slash command via chat.send');
  for (const [name, message] of [['compile', '/compile'], ['audit', '/audit'], ['reindex', '/reindex']] as const) {
    withPayload(cmd.command(name))
      .description(`esegue ${message}`)
      .action(async (options: RequestOptions) => {
        const payload = await loadPayload(options);
        await callRoute('chat.send', mergePayload(payload, {
          body: mergePayload(payload.body ?? {}, { message }),
        }), program.opts<GlobalOptions>());
      });
  }
  for (const [name, prefix] of [['wizard', '/wizard'], ['deep-research', '/deep-research']] as const) {
    withPayload(cmd.command(`${name} <value>`))
      .description(`esegue ${prefix} <value>`)
      .action(async (value: string, options: RequestOptions) => {
        const payload = await loadPayload(options);
        await callRoute('chat.send', mergePayload(payload, {
          body: mergePayload(payload.body ?? {}, { message: `${prefix} ${value}` }),
        }), program.opts<GlobalOptions>());
      });
  }

  program.command('mcp')
    .description('avvia l\'adapter MCP HTTP-only (stdio di default)')
    .option('--http', 'usa Streamable HTTP invece di stdio')
    .option('--port <n>', 'porta HTTP', '8080')
    .option('--host <host>', 'host HTTP', '0.0.0.0')
    .action(async (options: { http?: boolean; port: string; host: string }) => {
      const globals = program.opts<GlobalOptions>();
      const args = [
        '--base-url', globals.baseUrl ?? process.env.WIKI_FORGE_API_URL ?? 'http://127.0.0.1:3001',
        '--project', globals.project,
      ];
      if (globals.token) args.push('--token', globals.token);
      if (options.http) args.push('--http');
      args.push('--port', options.port, '--host', options.host);
      const childEnv: NodeJS.ProcessEnv = {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        TMPDIR: process.env.TMPDIR ?? '',
        NODE_ENV: process.env.NODE_ENV ?? '',
      };
      for (const key of ['WIKI_FORGE_API_URL', 'WIKI_FORGE_TOKEN', 'WIKI_FORGE_BEARER'] as const) {
        if (process.env[key] !== undefined) childEnv[key] = process.env[key];
      }
      const child = spawn(process.execPath, ['--import', 'tsx', MCP_ENTRYPOINT, ...args], {
        stdio: 'inherit',
        env: childEnv,
      });
      await new Promise<void>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => {
          if (code === 0) resolve();
          else reject(new CliError(`MCP adapter terminated (${signal ?? `exit ${code ?? 1}`})`, code ?? 5));
        });
      });
    });

  program.command('manifest')
    .description('stampa il manifest generato')
    .option('--format <json|text>', 'formato output', 'json')
    .action((options: { format: string }) => {
      const globals = program.opts<GlobalOptions>();
      if (options.format === 'json') {
        emit(COMMAND_MANIFEST, globals);
        return;
      }
      if (options.format !== 'text') throw new CliError(`Formato non supportato: ${options.format}`, 2);
      process.stdout.write(`${COMMAND_MANIFEST.routes.length} routes, ${COMMAND_MANIFEST.busCommands.length} comandi bus, ${COMMAND_MANIFEST.gaps.length} gap\n`);
    });

  return program;
}

function exitCodeFor(error: unknown): number {
  if (error instanceof CliError) return error.code;
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 3;
    if (error.status === 403) return 4;
    if (error.status === 400 || error.status === 422) return 2;
    if (error.status === 409 || error.status === 412) return 4;
    return 5;
  }
  return 5;
}

async function main(): Promise<void> {
  try {
    await buildProgram().parseAsync(process.argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = exitCodeFor(error);
  }
}

void main();
