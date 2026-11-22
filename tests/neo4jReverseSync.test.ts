import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ChangesetStore } from '@backend/server/changesetStore';
import {
  NEO4J_RECONCILE_SCHEMA,
  NEO4J_RECONCILER_ACTOR,
  parseReconcileResult,
  readCheckpoint,
  reconcileAndStage,
  stageNeo4jChangesets,
  writeCheckpoint,
  type Neo4jReconcileResult,
} from '@backend/server/neo4jReverseSync';

const ORIGINAL = '---\ntitle: Alpha\ntype: note\n---\n\n# Alpha\n\nTesto locale.\n';
const PROPOSED = [
  '---',
  'title: Alpha',
  'type: PermanentNote',
  'wf:',
  '  origin: neo4j',
  '  revision: 7',
  '---',
  '',
  '# Alpha',
  '',
  'Testo aggiornato nel database.',
  '',
].join('\n');

function envelope(overrides: Partial<Neo4jReconcileResult> = {}): Neo4jReconcileResult {
  return {
    schema: NEO4J_RECONCILE_SCHEMA,
    success: true,
    projectId: 'demo',
    checkpoint: 4,
    nextCheckpoint: 7,
    requiresConfirmation: true,
    mode: 'mock',
    proposals: [{
      id: 'alpha',
      findingId: 'neo4j-alpha-r7',
      path: 'wiki/alpha.md',
      title: 'Alpha',
      action: 'modify',
      revision: 7,
      origin: 'neo4j',
      baseHash: 'base-hash',
      contentHash: 'db-hash',
      localHash: 'local-hash',
      content: PROPOSED,
      requiresConfirmation: true,
    }],
    conflicts: [],
    count: 1,
    ...overrides,
  };
}

describe('C5 — reverse sync DB → vault via changeset', () => {
  let tmpDir: string;
  let notePath: string;
  let store: ChangesetStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-neo4j-reverse-'));
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
    notePath = path.join(tmpDir, 'wiki', 'alpha.md');
    await fs.writeFile(notePath, ORIGINAL, 'utf-8');
    store = new ChangesetStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('validates the reconciler envelope and rejects unsafe paths', () => {
    const parsed = parseReconcileResult(envelope());
    assert.equal(parsed.proposals[0].findingId, 'neo4j-alpha-r7');

    assert.throws(() => parseReconcileResult({ ...envelope(), schema: 'other/v1' }), /schema/);
    assert.throws(() => parseReconcileResult({ ...envelope(), proposals: [{ ...envelope().proposals[0], action: 'delete' }] }), /action/);
    assert.throws(() => parseReconcileResult({ ...envelope(), proposals: [{ ...envelope().proposals[0], path: '../escape.md' }] }), /Unsafe/);
  });

  it('stages one canonical proposal without writing the note before apply', async () => {
    const staged = await stageNeo4jChangesets(store, envelope());
    assert.equal(staged.created.length, 1);
    assert.equal(staged.conflicts.length, 0);

    const changeset = staged.created[0];
    assert.equal(changeset.status, 'pending');
    assert.equal(changeset.actor, NEO4J_RECONCILER_ACTOR);
    assert.equal(changeset.author, NEO4J_RECONCILER_ACTOR);
    assert.equal(changeset.finding?.findingId, 'neo4j-alpha-r7');
    assert.equal(changeset.edits[0].file, 'wiki/alpha.md');
    assert.equal(changeset.edits[0].action, 'modify');
    assert.equal(changeset.edits[0].requireOriginal, true);
    assert.equal(changeset.edits[0].original_content, ORIGINAL);
    assert.equal(changeset.edits[0].proposed_content, PROPOSED);
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);

    const applied = await store.apply(changeset.id, 'human:reviewer');
    assert.deepEqual(applied.appliedFiles, ['wiki/alpha.md']);
    const written = await fs.readFile(notePath, 'utf-8');
    assert.match(written, /^---\ntitle: Alpha/);
    assert.match(written, /origin: neo4j/);
    assert.match(written, /revision: 7/);
    assert.ok(written.includes('Testo aggiornato nel database.'));

    await store.rollback(changeset.id, 'human:reviewer');
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);
  });

  it('reports a conflict with zero changesets and zero vault writes', async () => {
    const result = await stageNeo4jChangesets(store, envelope({
      proposals: [],
      conflicts: [{
        id: 'alpha',
        path: 'wiki/alpha.md',
        revision: 7,
        findingId: 'neo4j-alpha-r7',
        localHash: 'local-hash',
        baseHash: 'base-hash',
        dbHash: 'db-hash',
        reason: 'local_hash_mismatch',
      }],
    }));

    assert.equal(result.created.length, 0);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].reason, 'local_hash_mismatch');
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);
    assert.deepEqual(await store.list(), []);
  });

  it('stages each revision once and advances the checkpoint without conflicts', async () => {
    const first = await reconcileAndStage(store, tmpDir, envelope());
    assert.equal(first.created.length, 1);
    assert.equal(await readCheckpoint(tmpDir), 7);

    const second = await reconcileAndStage(store, tmpDir, envelope());
    assert.equal(second.created.length, 0);
    assert.deepEqual(second.skipped, ['neo4j-alpha-r7']);
    assert.equal((await store.list()).length, 1);
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);
  });

  it('does not advance the checkpoint while a conflict is open', async () => {
    await writeCheckpoint(tmpDir, 3);
    assert.equal(await readCheckpoint(tmpDir), 3);

    const result = await reconcileAndStage(store, tmpDir, envelope({
      proposals: [],
      conflicts: [{
        id: 'alpha',
        path: 'wiki/alpha.md',
        revision: 7,
        findingId: 'neo4j-alpha-r7',
        localHash: 'local-hash',
        baseHash: 'base-hash',
        dbHash: 'db-hash',
        reason: 'local_hash_mismatch',
      }],
    }));

    assert.equal(result.created.length, 0);
    assert.equal(await readCheckpoint(tmpDir), 3);
  });
});
