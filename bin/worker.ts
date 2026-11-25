import { runWorkerCli } from '@backend/app/workerCli';

void runWorkerCli().catch((error: unknown) => {
  process.stderr.write(`[worker] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
