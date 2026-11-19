import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseSchedule } from '@backend/server/scheduler/cron';
import { JobDef } from '@backend/server/scheduler/jobStore';
import { EventTriggerBus, isSupportedTriggerEvent } from '@backend/server/scheduler/eventTriggers';
import { SchedulerEvent, TriggerEvent } from '@backend/server/scheduler/scheduler';

function makeJob(overrides: Partial<JobDef> = {}): JobDef {
  return {
    id: 'event-review',
    role: 'Schema Modeler',
    useCaseId: 'ke_schema_modeling',
    schedule: parseSchedule('0 5 * * 1', 'UTC'),
    enabled: true,
    project: 'default',
    args: {},
    autoApply: false,
    maxRetries: 1,
    debounceSeconds: 300,
    eventTrigger: 'note.created',
    ...overrides,
  };
}

interface Timer {
  id: number;
  callback: () => void;
  ms: number;
  cleared: boolean;
}

function makeBus(jobs: JobDef[]) {
  const timers: Timer[] = [];
  const events: SchedulerEvent[] = [];
  const triggered: Array<{ jobId: string; event: TriggerEvent; events: TriggerEvent[] }> = [];
  let nextId = 1;
  const bus = new EventTriggerBus({
    jobs,
    onTrigger: async (jobId, event, batched) => { triggered.push({ jobId, event, events: batched }); },
    onEvent: (event) => events.push(event),
    now: () => new Date('2026-11-19T10:00:00.000Z'),
    setTimeoutFn: (fn, ms) => {
      const timer: Timer = { id: nextId++, callback: fn, ms, cleared: false };
      timers.push(timer);
      return timer.id;
    },
    clearTimeoutFn: (handle) => {
      const timer = timers.find((item) => item.id === handle);
      if (timer) timer.cleared = true;
    },
  });
  return { bus, timers, events, triggered };
}

describe('F6 — debounced event triggers', () => {
  it('accepts only known note events', () => {
    assert.strictEqual(isSupportedTriggerEvent('note.created'), true);
    assert.strictEqual(isSupportedTriggerEvent('note.deleted'), true);
    assert.strictEqual(isSupportedTriggerEvent('unknown'), false);
    assert.strictEqual(isSupportedTriggerEvent(undefined), false);
  });

  it('batches several notes into one run after the quiet period', async () => {
    const { bus, timers, events, triggered } = makeBus([makeJob()]);
    const queued = bus.publish({
      type: 'note.created',
      project: 'default',
      path: 'wiki/a.md',
      source: 'webhook',
    });
    assert.deepStrictEqual(queued, ['event-review']);
    bus.publish({
      type: 'note.created',
      project: 'default',
      path: 'wiki/b.md',
      source: 'watcher',
    });

    assert.strictEqual(bus.getPending().length, 1);
    assert.strictEqual(bus.getPending()[0].events.length, 2);
    assert.strictEqual(timers.length, 2, 'the quiet period is reset by the second note');
    assert.strictEqual(timers[0].cleared, true);
    assert.strictEqual(timers[1].ms, 300_000);
    assert.strictEqual(events.filter(event => event.type === 'event_queued').length, 2);

    timers[1].callback();
    await Promise.resolve();
    assert.strictEqual(triggered.length, 1);
    assert.strictEqual(triggered[0].jobId, 'event-review');
    assert.strictEqual(triggered[0].events.length, 2);
    assert.strictEqual(triggered[0].event.type, 'note.created');
    assert.strictEqual(bus.getPending().length, 0);
    bus.stop();
  });

  it('deduplicates repeated events for the same note', () => {
    const { bus } = makeBus([makeJob()]);
    bus.publish({ type: 'note.created', project: 'default', path: 'wiki/a.md', source: 'webhook' });
    bus.publish({ type: 'note.created', project: 'default', path: 'wiki/a.md', source: 'webhook' });
    assert.strictEqual(bus.getPending()[0].events.length, 1);
    bus.stop();
  });

  it('ignores disabled jobs, other event types and other projects', () => {
    const jobs = [
      makeJob({ id: 'disabled', enabled: false }),
      makeJob({ id: 'other-event', eventTrigger: 'note.deleted' }),
      makeJob({ id: 'other-project', project: 'tesi' }),
      makeJob({ id: 'wildcard', project: '*' }),
    ];
    const { bus, timers } = makeBus(jobs);
    const queued = bus.publish({
      type: 'note.created',
      project: 'default',
      path: 'wiki/a.md',
      source: 'webhook',
    });
    assert.deepStrictEqual(queued, ['wildcard']);
    assert.strictEqual(timers.length, 1);
    bus.stop();
  });

  it('stop cancels pending timers', () => {
    const { bus, timers } = makeBus([makeJob()]);
    bus.publish({ type: 'note.created', project: 'default', source: 'webhook' });
    bus.stop();
    assert.strictEqual(bus.getPending().length, 0);
    assert.strictEqual(timers[0].cleared, true);
  });
});
