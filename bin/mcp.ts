import { parseMcpConfig, runMcpHttp, runMcpStdio } from '@backend/mcp/adapter';

async function main(): Promise<void> {
  const config = parseMcpConfig();
  if (config.http) await runMcpHttp(config.options, config.port, config.host);
  else await runMcpStdio(config.options);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
