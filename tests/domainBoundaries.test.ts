import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

const BACKEND = path.resolve('src/backend');
const SHARED = path.resolve('src/shared');
const FRONTEND = path.resolve('src/frontend');

async function tsFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) return tsFiles(full);
      return entry.isFile() && full.endsWith('.ts') ? [full] : [];
    }),
  );
  return nested.flat();
}

function importSpecifiers(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from|import)\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) found.push(match[1]);
  return found;
}

function rel(file: string): string {
  return path.relative(process.cwd(), file);
}

describe('Confini architetturali — Fase 1 del piano di disaccoppiamento', () => {
  it('backend e shared non importano moduli frontend', async () => {
    const offenders: string[] = [];
    for (const root of [BACKEND, SHARED]) {
      for (const file of await tsFiles(root)) {
        const source = await readFile(file, 'utf-8');
        for (const spec of importSpecifiers(source)) {
          if (spec.includes('@frontend/') || /(^|\/)frontend\//.test(spec)) {
            offenders.push(`${rel(file)} -> ${spec}`);
          }
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('frontend non importa moduli backend', async () => {
    const offenders: string[] = [];
    for (const file of await tsFiles(FRONTEND)) {
      const source = await readFile(file, 'utf-8');
      for (const spec of importSpecifiers(source)) {
        if (spec.includes('@backend/') || /(^|\/)backend\//.test(spec)) {
          offenders.push(`${rel(file)} -> ${spec}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('i tipi canonici risiedono in src/shared/domain', async () => {
    const canonical = [
      'wiki.ts',
      'research.ts',
      'review.ts',
      'study.ts',
      'markdownParser.ts',
      'okfFrontmatter.ts',
      'scripts.ts',
      'slashCommands.ts',
    ];
    for (const name of canonical) {
      const source = await readFile(path.join(SHARED, 'domain', name), 'utf-8');
      assert.ok(source.trim().length > 0, `${name} vuoto`);
    }
    const wikiShim = await readFile(path.join(FRONTEND, 'core', 'types', 'wiki.ts'), 'utf-8');
    assert.match(wikiShim, /@shared\/domain\/wiki/);
    const sharedClient = await readFile(path.join(SHARED, 'api', 'client.ts'), 'utf-8');
    assert.match(sharedClient, /export function createApiClient/);
    const frontendClient = await readFile(path.join(FRONTEND, 'api', 'client.ts'), 'utf-8');
    assert.match(frontendClient, /export \{[\s\S]*createApiClient[\s\S]*\} from '@shared\/api\/client'/);
  });

  it('AgentServer è un adapter HTTP sotto le 1500 righe', async () => {
    const source = await readFile(path.join(BACKEND, 'server', 'agentServer.ts'), 'utf-8');
    assert.ok(source.split('\n').length < 1500, 'agentServer.ts supera le 1500 righe');
    assert.match(source, /createKernel\(/);
    assert.match(source, /portsFromServices\(/);
  });

  it('i servizi estratti e le porte sono presenti', async () => {
    const files = [
      'app/ports.ts',
      'app/createKernel.ts',
      'server/services/schedulerService.ts',
      'server/services/vaultService.ts',
      'server/services/reviewService.ts',
      'server/services/knowledgeService.ts',
    ];
    for (const file of files) {
      const source = await readFile(path.join(BACKEND, file), 'utf-8');
      assert.ok(source.trim().length > 0, `${file} vuoto`);
    }
  });
});
