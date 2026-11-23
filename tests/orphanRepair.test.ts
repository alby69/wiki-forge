import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { PYTHON_CMD } from '@backend/server/agentServer';
import { ChangesetStore } from '@backend/server/changesetStore';
import type { FindingsEnvelope, Finding } from '@backend/server/findingChangeset';
import {
  AUTONOMY_ACTOR,
  collectRepairFindings,
  stageRepairChangesets,
} from '@backend/server/orphanRepair';

function findings(): Finding[] {
  return [
    {
      findingId: 'orphan_node-nested-target-a1b2c3d4e5f6',
      kind: 'orphan_node',
      confidence: 0.92,
      evidence: ['source=wiki/source.md', 'target=deep/nested/target'],
      targetPath: 'wiki/deep-nested-target.md',
      proposedAction: 'repair-orphan',
    },
    {
      findingId: 'inconsistency-source-bad-status-b2c3d4e5f6a7',
      kind: 'inconsistency',
      confidence: 1,
      evidence: ['wiki/source.md: Invalid status'],
      targetPath: 'wiki/source.md',
      proposedAction: 'fix-okf-frontmatter',
    },
  ];
}

function envelope(): FindingsEnvelope {
  const items = findings();
  return { schema: 'wikiforge.finding/v1', count: items.length, findings: items };
}

describe('A5 — deterministic orphan and frontmatter repair', () => {
  let rootDir: string;
  let store: ChangesetStore;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wf-orphan-repair-'));
    await fs.mkdir(path.join(rootDir, 'wiki'), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, 'wiki', 'source.md'),
      '---\ntitle: Source\ntype: note\nstatus: invalid\n---\n\n# Source\n\n[[deep/nested/target]]\n',
      'utf-8',
    );
    store = new ChangesetStore(rootDir);
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('stages deterministic edits once and applies them', async () => {
    const first = await stageRepairChangesets(store, envelope(), rootDir);
    assert.equal(first.created.length, 2);
    assert.deepEqual(first.skipped, []);

    const second = await stageRepairChangesets(store, envelope(), rootDir);
    assert.equal(second.created.length, 0);
    assert.deepEqual(second.skipped, findings().map((item) => item.findingId));

    for (const changeset of first.created) {
      assert.equal(changeset.author, AUTONOMY_ACTOR);
      assert.equal(changeset.actor, AUTONOMY_ACTOR);
      await store.apply(changeset.id, AUTONOMY_ACTOR);
    }

    const stub = await fs.readFile(path.join(rootDir, 'wiki', 'deep-nested-target.md'), 'utf-8');
    assert.match(stub, /^title: "deep nested target"$/m);
    assert.match(stub, /^type: Concept$/m);
    assert.match(stub, /^status: draft$/m);
    assert.doesNotMatch(stub, /\d{4}-\d{2}-\d{2}/);

    const source = await fs.readFile(path.join(rootDir, 'wiki', 'source.md'), 'utf-8');
    assert.match(source, /^type: "Concept"$/m);
    assert.match(source, /^status: "draft"$/m);
    assert.match(source, /\[\[deep\/nested\/target\]\]/);

    const reapplied = await stageRepairChangesets(store, envelope(), rootDir);
    assert.equal(reapplied.created.length, 0);
  });

  it('repairs three orphans idempotently and keeps okf_lint green', async () => {
    const wikiDir = path.join(rootDir, 'wiki');
    await fs.writeFile(
      path.join(wikiDir, 'source.md'),
      '---\ntitle: Source\ntype: Concept\nstatus: draft\n---\n\n'
        + '# Source\n\n[[Missing One]] [[deep/nested/target]] [[Third Page]]\n',
      'utf-8',
    );

    const firstEnvelope = collectRepairFindings(
      process.cwd(), wikiDir, 'wiki', PYTHON_CMD,
    );
    assert.equal(firstEnvelope.count, 3);
    const first = await stageRepairChangesets(store, firstEnvelope, rootDir);
    assert.equal(first.created.length, 3);
    for (const changeset of first.created) await store.apply(changeset.id, AUTONOMY_ACTOR);

    const secondEnvelope = collectRepairFindings(
      process.cwd(), wikiDir, 'wiki', PYTHON_CMD,
    );
    assert.equal(secondEnvelope.count, 0);
    const second = await stageRepairChangesets(store, secondEnvelope, rootDir);
    assert.equal(second.created.length, 0);

    const lint = spawnSync(
      PYTHON_CMD,
      [path.resolve('scripts/okf_lint.py'), '--json', wikiDir],
      { cwd: process.cwd(), encoding: 'utf-8' },
    );
    assert.equal(lint.status, 0, lint.stderr);
    const report = JSON.parse(lint.stdout || '{}') as { status?: string };
    assert.equal(report.status, 'success');
  });

  it('stages zero writes on conflict', async () => {
    const target = path.join(rootDir, 'wiki', 'deep-nested-target.md');
    await fs.writeFile(target, 'original\n', 'utf-8');
    const input = await stageRepairChangesets(store, {
      schema: 'wikiforge.finding/v1',
      count: 1,
      findings: [findings()[0]],
    }, rootDir);
    assert.equal(input.created.length, 1);

    await fs.writeFile(target, 'concurrent edit\n', 'utf-8');
    await assert.rejects(
      () => store.apply(input.created[0].id, AUTONOMY_ACTOR),
      /stale: wiki\/deep-nested-target\.md changed after staging/,
    );
    assert.equal(await fs.readFile(target, 'utf-8'), 'concurrent edit\n');
    assert.equal((await store.list())[0].status, 'pending');
  });
});
