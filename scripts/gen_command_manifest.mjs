#!/usr/bin/env node
/**
 * gen_command_manifest.mjs — generate the command inventory from code.
 *
 * Mirrors the codegen pattern already used by gen_script_registry.py:
 *   source code (routes, catalog, bus, router, MCP) -> generated TS + generated MD
 *
 * USAGE
 *   npm run manifest          # write the generated files
 *   npm run manifest:check    # fail if the generated files are stale
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import {
  REPO_ROOT,
  deriveCommandManifest,
  renderTypescript,
  renderMarkdown,
} from './lib/commandManifest.mjs';

const CHECK = process.argv.includes('--check');
const TS_OUTPUT = path.join(REPO_ROOT, 'src', 'shared', 'api', 'generated', 'commandManifest.generated.ts');
const MD_OUTPUT = path.join(REPO_ROOT, 'docs', 'riferimenti', 'COMMAND_MANIFEST.md');

async function main() {
  const manifest = await deriveCommandManifest();
  const outputs = [
    { file: TS_OUTPUT, content: renderTypescript(manifest) },
    { file: MD_OUTPUT, content: renderMarkdown(manifest) },
  ];

  if (CHECK) {
    const busGaps = manifest.gaps.filter((gap) => gap.kind === 'route-without-bus');
    if (busGaps.length > 0) {
      console.error(`Command manifest has route-without-bus gaps: ${busGaps.map((gap) => gap.id).join(', ')}`);
      process.exitCode = 1;
    }
    const stale = [];
    for (const output of outputs) {
      let current = null;
      try {
        current = await readFile(output.file, 'utf-8');
      } catch {
        current = null;
      }
      if (current !== output.content) stale.push(path.relative(REPO_ROOT, output.file));
    }
    if (stale.length > 0) {
      console.error(`Command manifest is stale: ${stale.join(', ')}`);
      console.error('Run `npm run manifest` to regenerate.');
      process.exitCode = 1;
      return;
    }
    console.log(`Command manifest up to date (${manifest.routes.length} routes, ${manifest.gaps.length} gaps).`);
    return;
  }

  await mkdir(path.dirname(TS_OUTPUT), { recursive: true });
  await mkdir(path.dirname(MD_OUTPUT), { recursive: true });
  for (const output of outputs) {
    await writeFile(output.file, output.content, 'utf-8');
    console.log(`Wrote ${path.relative(REPO_ROOT, output.file)}`);
  }
  console.log(`Manifest: ${manifest.routes.length} routes, ${manifest.busCommands.length} bus commands, ${manifest.gaps.length} gaps.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
