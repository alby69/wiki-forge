import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ChangesetStore } from '@backend/server/changesetStore';
import { GraphEventHub } from '@backend/server/graphEvents';
import { GraphModule } from '@backend/server/modules/graphModule';
import {
  classifyGraphEvent,
  emptyLedger,
  eventKey,
  readLedger,
  reconcileGraphChanges,
  writeLedger,
  type GraphChangeEvent,
} from '@backend/server/graphReconciliation';
import {
  NEO4J_RECONCILE_SCHEMA,
  readCheckpoint,
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
  '  baseHash: base-hash',
  '  dbHash: db-hash',
  '  localHash: body-hash',
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
      dbHash: 'db-hash',
      localHash: 'local-hash',
      content: PROPOSED,
      requiresConfirmation: true,
    }],
    conflicts: [],
    count: 1,
    ...overrides,
  };
}

function event(overrides: Partial<GraphChangeEvent> = {}): GraphChangeEvent {
  return {
    id: 'alpha',
    path: 'wiki/alpha.md',
    origin: 'neo4j',
    revision: 7,
    action: 'MODIFIED',
    localHash: 'body-hash',
    dbHash: 'db-hash',
    ...overrides,
  };
}

describe('C6 — reconciliation and echo suppression', () => {
  let tmpDir: string;
  let notePath: string;
  let store: ChangesetStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-graph-reconciliation-'));
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
    notePath = path.join(tmpDir, 'wiki', 'alpha.md');
    await fs.writeFile(notePath, ORIGINAL, 'utf-8');
    store = new ChangesetStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('classifies events by stable id, duplicate and applied revision', async () => {
    const first = event();
    const ledger = emptyLedger();
    assert.equal(classifyGraphEvent(first, ledger), 'new');
    assert.equal(eventKey(first), 'alpha|7|neo4j|MODIFIED');

    ledger.seen.push(eventKey(first));
    assert.equal(classifyGraphEvent(first, ledger), 'duplicate');
    assert.equal(classifyGraphEvent(event({ eventId: 'event-42' }), ledger), 'new');
    ledger.revisions.alpha = 7;
    assert.equal(classifyGraphEvent(event({ action: 'CREATED' }), ledger), 'echo');
    assert.equal(classifyGraphEvent(event({ origin: 'browser', action: 'CREATED' }), ledger), 'new');

    await writeLedger(tmpDir, ledger);
    assert.equal((await readLedger(tmpDir)).revisions.alpha, 7);
  });

  it('vault → DB: a local change records the event without staging anything', async () => {
    const localEvent = event({ origin: 'watcher', action: 'MODIFIED', revision: 8 });
    const result = await reconcileGraphChanges({
      store,
      projectRoot: tmpDir,
      envelope: envelope({ proposals: [], conflicts: [], count: 0, nextCheckpoint: 7 }),
      events: [localEvent],
    });

    assert.deepEqual(result.created, []);
    assert.deepEqual(result.processedEvents, [localEvent]);
    assert.equal(result.ledger.seen.length, 1);
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);
  });

  it('DB → vault: stages a reviewable changeset, then suppresses the echo event', async () => {
    const first = await reconcileGraphChanges({
      store,
      projectRoot: tmpDir,
      envelope: envelope(),
      events: [event({ eventId: 'db-1' })],
    });
    assert.equal(first.created.length, 1);
    assert.equal(first.created[0].finding?.findingId, 'neo4j-alpha-r7');
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);
    assert.equal(await readCheckpoint(tmpDir), 7);

    await store.apply(first.created[0].id, 'human:reviewer');
    assert.match(await fs.readFile(notePath, 'utf-8'), /Testo aggiornato nel database/);

    const echo = await reconcileGraphChanges({
      store,
      projectRoot: tmpDir,
      envelope: envelope({ proposals: [], conflicts: [], count: 0, checkpoint: 7, nextCheckpoint: 7 }),
      events: [event({ eventId: 'echo-1', origin: 'neo4j', revision: 7, action: 'MODIFIED' })],
    });
    assert.deepEqual(echo.created, []);
    assert.deepEqual(echo.skippedEvents.map((item) => item.reason), ['echo']);
    assert.equal((await store.list()).length, 1);
  });

  it('both sides changed: the conflict stays visible with zero writes and no checkpoint advance', async () => {
    const conflicting = envelope({
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
    });
    const result = await reconcileGraphChanges({
      store,
      projectRoot: tmpDir,
      envelope: conflicting,
      events: [event({ origin: 'browser', revision: 8 })],
    });

    assert.deepEqual(result.created, []);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.ledger.revisions.alpha, undefined);
    assert.equal(await readCheckpoint(tmpDir), 0);
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);
  });

  it('a repeated event and a second run never duplicate the changeset', async () => {
    const first = await reconcileGraphChanges({
      store,
      projectRoot: tmpDir,
      envelope: envelope(),
      events: [event({ eventId: 'evt-1' })],
    });
    const second = await reconcileGraphChanges({
      store,
      projectRoot: tmpDir,
      envelope: envelope(),
      events: [event({ eventId: 'evt-1' })],
    });

    assert.equal(first.created.length, 1);
    assert.deepEqual(second.created, []);
    assert.deepEqual(second.skippedEvents.map((item) => item.reason), ['duplicate']);
    assert.equal((await store.list()).length, 1);
    assert.equal(await fs.readFile(notePath, 'utf-8'), ORIGINAL);
  });

  it('ignores a body project override and keeps reconcile stage-scoped', async () => {
    const allowedRoot = await fs.mkdtemp(path.join(process.cwd(), 'tmp-reconcile-allowed-'));
    const otherRoot = await fs.mkdtemp(path.join(process.cwd(), 'tmp-reconcile-other-'));
    const script = path.join(allowedRoot, 'fake-tool.js');
    const empty = envelope({ proposals: [], conflicts: [], count: 0 });
    await fs.writeFile(script, `process.stdout.write(${JSON.stringify(JSON.stringify(empty))});`, 'utf-8');
    const resolved: string[] = [];
    const stores: string[] = [];
    const tool = {
      resolveRoot: async (id: string) => {
        resolved.push(id);
        return id === 'allowed' ? allowedRoot : otherRoot;
      },
      pathFor: () => script,
      pythonCmd: process.execPath,
    };
    const hub = new GraphEventHub();
    const module = new GraphModule(tool, hub, {
      resolveRoot: async (id) => {
        resolved.push(id);
        return id === 'allowed' ? allowedRoot : otherRoot;
      },
      changesets: async (id) => {
        stores.push(id);
        return new ChangesetStore(id === 'allowed' ? allowedRoot : otherRoot);
      },
    });

    try {
      const result = await module.reconcile({ body: { projectId: 'other' } }, 'allowed');
      assert.equal(result.kind, 'json');
      assert.equal(result.status, 200);
      assert.ok(resolved.length >= 2);
      assert.ok(resolved.every((id) => id === 'allowed'));
      assert.deepEqual(stores, ['allowed']);
      const body = (result as { body: Record<string, unknown> }).body;
      assert.equal(body.staged, 0);
      assert.deepEqual(body.skipped, []);
      assert.deepEqual(body.skippedEvents, []);
      assert.equal(await fs.readFile(path.join(otherRoot, '.wiki-forge', 'graph-reconciliation.json'), 'utf-8').catch(() => ''), '');
    } finally {
      hub.close();
      await fs.rm(allowedRoot, { recursive: true, force: true });
      await fs.rm(otherRoot, { recursive: true, force: true });
    }
  });
});
