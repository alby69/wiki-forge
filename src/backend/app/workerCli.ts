import { runWorker } from './worker';
import { readStateStoreConfig } from '../server/state';
import { STATE_BACKEND_ENV_CONTRACT } from '../server/state/types';

export const WORKER_ENV_CONTRACT = {
  ...STATE_BACKEND_ENV_CONTRACT,
} as const;

export interface WorkerCliArgs {
  root?: string;
  concurrency?: number;
  leaseMs?: number;
  help?: boolean;
}

export function parseWorkerArgs(argv: string[]): WorkerCliArgs {
  const args: WorkerCliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') args.help = true;
    else if (flag === '--root') args.root = argv[++index];
    else if (flag === '--concurrency') args.concurrency = Number(argv[++index]);
    else if (flag === '--lease-ms') args.leaseMs = Number(argv[++index]);
    else throw new Error(`Unknown worker option '${flag}'`);
  }
  return args;
}

export async function runWorkerCli(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const args = parseWorkerArgs(argv);
  if (args.help) {
    process.stdout.write(`${JSON.stringify(WORKER_ENV_CONTRACT, null, 2)}\n`);
    return;
  }
  const rootDir = args.root ?? process.cwd();
  const config = readStateStoreConfig(env, rootDir);
  let resolveShutdown: () => void = () => undefined;
  const shutdown = new Promise<void>((resolve) => { resolveShutdown = resolve; });
  const onSignal = (): void => resolveShutdown();
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);

  try {
    const worker = await runWorker({
      rootDir,
      concurrency: args.concurrency ?? Number(env.WIKIFORGE_WORKER_CONCURRENCY),
      leaseMs: args.leaseMs ?? Number(env.WIKIFORGE_WORKER_LEASE_MS),
      owner: env.WIKIFORGE_WORKER_ID,
      shutdown,
      onHeartbeatError: (err) => process.stderr.write(`[worker] heartbeat: ${String(err)}\n`),
      onOutboxError: (err) => process.stderr.write(`[worker] outbox: ${String(err)}\n`),
    });
    process.stdout.write(`${JSON.stringify({
      type: 'worker.started',
      backend: config.backend,
      concurrency: worker.pool.concurrency,
    })}\n`);
    await worker.done;
    process.stdout.write(`${JSON.stringify({ type: 'worker.stopped' })}\n`);
  } finally {
    process.removeListener('SIGTERM', onSignal);
    process.removeListener('SIGINT', onSignal);
  }
}
