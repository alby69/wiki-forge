import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { runWorker } from '@backend/app/worker';
import { LockHeldError } from '@backend/server/scheduler/lock';
import { createStateLock } from '@backend/server/state/lock';
import { ApprovalOutbox } from '@backend/server/state/outbox';
import { createApprovalOutboxRelay } from '@backend/server/state/outboxRelay';
import { createMemoryStateStore } from '@backend/server/state/memoryStore';

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-outbox-relay-'));
  tempDirs.push(dir);
  return dir;
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for relay');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('approval outbox relay', () => {
  it('delivers only unseen events and persists the cursor', async () => {
    const store = createMemoryStateStore();
    const outbox = new ApprovalOutbox(store);
    await outbox.append({
      type: 'approval.staged', approvalId: 'a1', jobId: 'nightly',
      useCaseId: 'validation', project: 'default', at: '',
    });
    await outbox.append({
      type: 'approval.required', jobId: 'nightly', approvalIds: ['a1'],
      rationale: 'needs review', sources: [], at: '',
    });

    const seen: string[] = [];
    const relay = createApprovalOutboxRelay(outbox, (event) => { seen.push(event.type); }, { store });
    assert.equal(await relay.poll(), 2);
    assert.deepEqual(seen, ['approval.staged', 'approval.required']);
    assert.equal(await relay.cursor(), 2);
    assert.equal(await relay.poll(), 0);
    assert.deepEqual(seen, ['approval.staged', 'approval.required']);

    await outbox.append({
      type: 'approval.decided', approvalId: 'a1', jobId: 'nightly',
      status: 'approved', decidedBy: 'human:reviewer', at: '',
    });
    const resumed = createApprovalOutboxRelay(outbox, (event) => { seen.push(event.type); }, { store });
    assert.equal(await resumed.poll(), 1);
    assert.deepEqual(seen, ['approval.staged', 'approval.required', 'approval.decided']);
  });

  it('skips filtered events while advancing the cursor', async () => {
    const store = createMemoryStateStore();
    const outbox = new ApprovalOutbox(store);
    await outbox.append({
      type: 'approval.staged', approvalId: 'a1', jobId: 'nightly',
      useCaseId: 'validation', project: 'default', at: '',
    });
    await outbox.append({
      type: 'approval.required', jobId: 'nightly', approvalIds: ['a1'],
      rationale: 'needs review', sources: [], at: '',
    });
    const seen: string[] = [];
    const relay = createApprovalOutboxRelay(outbox, (event) => { seen.push(event.type); }, {
      store,
      filter: { type: 'approval.required' },
    });
    assert.equal(await relay.poll(), 2);
    assert.deepEqual(seen, ['approval.required']);
    assert.equal(await relay.cursor(), 2);
  });

  it('keeps the cursor on a failed handler and polls on a timer', async () => {
    const store = createMemoryStateStore();
    const outbox = new ApprovalOutbox(store);
    const errors: unknown[] = [];
    let fail = true;
    const seen: string[] = [];
    const relay = createApprovalOutboxRelay(outbox, (event) => {
      if (fail) throw new Error('handler failed');
      seen.push(event.type);
    }, { store, onError: (error) => errors.push(error) });

    await outbox.append({
      type: 'approval.required', jobId: 'nightly', approvalIds: ['a1'],
      rationale: 'needs review', sources: [], at: '',
    });
    await assert.rejects(() => relay.poll(), /handler failed/);
    assert.equal(await relay.cursor(), 0);
    assert.equal(errors.length, 0);

    fail = false;
    relay.start(25);
    try {
      await waitFor(() => seen.length === 1);
      assert.equal(await relay.cursor(), 1);
    } finally {
      relay.stop();
    }
    assert.deepEqual(seen, ['approval.required']);
  });
});

describe('worker outbox relay leadership', () => {
  it('does not consume approvals before acquiring the leader lease', async () => {
    const rootDir = await makeTempDir();
    const store = createMemoryStateStore();
    const outbox = new ApprovalOutbox(store);
    await outbox.append({
      type: 'approval.required', jobId: 'nightly', approvalIds: ['a1'],
      rationale: 'needs review', sources: [], at: '',
    });
    const holder = createStateLock(store, { key: 'leader/scheduler', owner: 'other', leaseMs: 60_000 });
    await holder.acquire();

    await assert.rejects(() => runWorker({
      rootDir,
      store,
      outbox,
      leaseMs: 100,
      executeJob: async () => ({ failedSteps: [], exitCodes: [0] }),
    }), LockHeldError);

    const relay = createApprovalOutboxRelay(outbox, () => {}, { store });
    assert.equal(await relay.cursor(), 0);
    await holder.release();
  });

  it('stops the worker when the leader lease is lost', async () => {
    const rootDir = await makeTempDir();
    const store = createMemoryStateStore();
    const handle = await runWorker({
      rootDir,
      store,
      leaseMs: 300,
      tickMs: 10_000,
      executeJob: async () => ({ failedSteps: [], exitCodes: [0] }),
    });
    try {
      assert.equal(handle.scheduler.getStatus().running, true);
      const entry = await store.get<Record<string, unknown>>('leader/scheduler');
      assert.ok(entry);
      await store.put('leader/scheduler', {
        ...entry.value,
        token: 'stolen',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      await waitFor(() => !handle.scheduler.getStatus().running);
    } finally {
      await handle.stop();
    }
  });
});
