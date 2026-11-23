import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AutonomyEngine, AUTONOMY_ACTOR, type AutonomyConfig, type SafetyClass } from '@backend/server/autonomy';
import { ChangesetStore } from '@backend/server/changesetStore';
import type { Finding } from '@backend/server/findingChangeset';

const SAFETY_CLASSES: SafetyClass[] = ['read-only', 'report', 'workspace', 'wiki-write', 'blocked', 'unknown'];

function config(mode: AutonomyConfig['mode']): AutonomyConfig {
  return {
    mode,
    scripts: ['orphan_repair'],
    paths: ['wiki'],
    findingKinds: ['orphan_node'],
    revalidation: [],
  };
}

function finding(): Finding {
  return {
    findingId: 'orphan_node-target-a1b2c3d4e5f6',
    kind: 'orphan_node',
    confidence: 0.92,
    evidence: ['source=wiki/source.md', 'target=target'],
    targetPath: 'wiki/target.md',
    proposedAction: 'repair-orphan',
  };
}

function candidate(safety: SafetyClass) {
  return {
    finding: finding(),
    scriptId: 'orphan_repair',
    safety,
    stage: {
      description: '[A5] orphan_node — wiki/target.md',
      author: 'process:wiki-forge-autonomy',
      edits: [{
        file: 'wiki/target.md',
        action: 'create' as const,
        proposed_content: '---\ntitle: Target\ntype: Concept\nstatus: draft\n---\n\n# Target\n',
      }],
      finding: finding(),
    },
  };
}

describe('A4 — autonomy modes and safety classes', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wf-autonomy-'));
    await fs.mkdir(path.join(rootDir, 'wiki'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  for (const mode of ['off', 'propose', 'bounded'] as const) {
    for (const safety of SAFETY_CLASSES) {
      it(`${mode} + ${safety}`, async () => {
        const store = new ChangesetStore(rootDir);
        const engine = new AutonomyEngine(rootDir, config(mode), store, {
          revalidate: async () => ({ ok: true, failures: [] }),
          now: () => new Date('2026-11-23T10:00:00.000Z'),
        });
        const result = await engine.process(candidate(safety), rootDir);
        const expected = mode === 'off'
          ? 'skipped'
          : mode === 'propose'
            ? 'staged'
            : safety === 'read-only' || safety === 'report'
              ? 'applied'
              : 'skipped';
        assert.equal(result.outcome, expected);

        const stored = await store.list();
        assert.equal(stored.length, expected === 'skipped' ? 0 : 1);
        const fileExists = await fs.access(path.join(rootDir, 'wiki', 'target.md'))
          .then(() => true)
          .catch(() => false);
        assert.equal(fileExists, expected === 'applied');

        const audit = await fs.readFile(path.join(rootDir, '.wiki-forge', 'autonomy-audit.jsonl'), 'utf-8');
        const entry = JSON.parse(audit.trim().split('\n').at(-1) ?? '{}') as Record<string, unknown>;
        assert.equal(entry.actor, AUTONOMY_ACTOR);
        assert.equal(entry.outcome, expected);
        if (expected !== 'skipped') assert.equal(entry.changeSetId, stored[0].id);
      });
    }
  }

  it('rejects and rolls back when pre-validation fails', async () => {
    const store = new ChangesetStore(rootDir);
    const engine = new AutonomyEngine(rootDir, config('bounded'), store, {
      revalidate: async () => ({ ok: false, failures: ['okf_lint: missing type'] }),
    });
    const result = await engine.process(candidate('read-only'), rootDir);
    assert.equal(result.outcome, 'rolled_back');
    assert.match(result.reason, /okf_lint/);
    assert.equal((await store.list())[0].status, 'rejected');
    const fileExists = await fs.access(path.join(rootDir, 'wiki', 'target.md'))
      .then(() => true)
      .catch(() => false);
    assert.equal(fileExists, false);
  });

  it('rolls back the applied bytes when post-validation fails', async () => {
    const store = new ChangesetStore(rootDir);
    let calls = 0;
    const engine = new AutonomyEngine(rootDir, config('bounded'), store, {
      revalidate: async () => {
        calls += 1;
        return calls === 1
          ? { ok: true, failures: [] }
          : { ok: false, failures: ['schema_lint: violation'] };
      },
    });
    const result = await engine.process(candidate('read-only'), rootDir);
    assert.equal(result.outcome, 'rolled_back');
    assert.equal(calls, 2);
    const fileExists = await fs.access(path.join(rootDir, 'wiki', 'target.md'))
      .then(() => true)
      .catch(() => false);
    assert.equal(fileExists, false);
    assert.equal((await store.list())[0].rolled_back_by, AUTONOMY_ACTOR);
  });
});
