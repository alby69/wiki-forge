import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KE_USE_CASES } from '@backend/server/agentServer';
import {
  describeSchedule,
  isValidTimezone,
  nextRunAt,
  parseSchedule,
} from '@backend/server/scheduler/cron';
import {
  loadScheduleConfig,
  parseScheduleConfig,
  UseCaseRegistryEntry,
} from '@backend/server/scheduler/jobStore';

const registry: Record<string, UseCaseRegistryEntry> = Object.fromEntries(
  Object.values(KE_USE_CASES).map((u) => [u.id, { id: u.id, steps: u.steps }])
);

describe('Scheduler cron parser (F1)', () => {
  it('resolves a 5-field cron in the configured timezone', () => {
    const schedule = parseSchedule('0 2 * * *', 'Europe/Rome');
    assert.strictEqual(schedule.kind, 'cron');
    // 02:00 CET = 01:00Z; from 01:30 CET the next occurrence is the next day.
    assert.strictEqual(
      nextRunAt(schedule, new Date('2026-11-19T00:30:00Z')).toISOString(),
      '2026-11-19T01:00:00.000Z'
    );
    // 02:00 CEST = 00:00Z, so the UTC instant changes across DST.
    assert.strictEqual(
      nextRunAt(schedule, new Date('2026-06-30T22:30:00Z')).toISOString(),
      '2026-07-01T00:00:00.000Z'
    );
  });

  it('rejects invalid cron expressions and timezones', () => {
    assert.throws(() => parseSchedule('not a cron', 'Europe/Rome'), /Invalid cron expression/);
    assert.throws(() => parseSchedule('0 2 * *'), /expected 5 fields/);
    assert.throws(() => parseSchedule('', 'UTC'), /empty/);
    assert.throws(() => parseSchedule('0 2 * * *', 'Mars/Olympus'), /Invalid timezone/);
    assert.strictEqual(isValidTimezone('Europe/Rome'), true);
    assert.strictEqual(isValidTimezone('Mars/Olympus'), false);
  });

  it('supports readable intervals', () => {
    const schedule = parseSchedule('every=6h', 'UTC');
    assert.strictEqual(schedule.kind, 'interval');
    assert.strictEqual(
      nextRunAt(schedule, new Date('2026-11-19T00:00:00Z')).toISOString(),
      '2026-11-19T06:00:00.000Z'
    );
    assert.strictEqual(describeSchedule(schedule), 'ogni 6 ore');
    assert.throws(() => parseSchedule('every=0h'), /must be positive/);
  });

  it('describes daily, weekly and monthly schedules for the UI', () => {
    assert.strictEqual(
      describeSchedule(parseSchedule('0 2 * * *', 'Europe/Rome')),
      'ogni giorno alle 02:00 (Europe/Rome)'
    );
    assert.strictEqual(
      describeSchedule(parseSchedule('0 3 * * 0', 'Europe/Rome')),
      'ogni domenica alle 03:00 (Europe/Rome)'
    );
    assert.strictEqual(
      describeSchedule(parseSchedule('0 4 1 * *', 'Europe/Rome')),
      'il giorno 1 del mese alle 04:00 (Europe/Rome)'
    );
  });
});

describe('Schedule configuration validation (F1)', () => {
  it('loads the shipped config with the confirmed safe defaults', async () => {
    const result = await loadScheduleConfig(process.cwd(), registry);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.config.timezone, 'Europe/Rome');
    assert.strictEqual(result.config.maxConcurrency, 1);
    assert.strictEqual(result.jobs.length, 9);
    assert.ok(result.jobs.every((job) => job.autoApply === false));
    assert.ok(result.jobs.filter((job) => job.enabled).length === 6);
    assert.strictEqual(result.config.policyEnabled, true, 'F5 policy is active by default');

    const exportJob = result.jobs.find((job) => job.id === 'weekly-rdf-export');
    assert.deepStrictEqual(exportJob?.steps, [0]);
    const maturityJob = result.jobs.find((job) => job.id === 'monthly-maturity');
    assert.deepStrictEqual(maturityJob?.steps, [1]);
    const eventJob = result.jobs.find((job) => job.id === 'note-created-review');
    assert.strictEqual(eventJob?.eventTrigger, 'note.created', 'F6 event job is configured');
    assert.strictEqual(eventJob?.debounceSeconds, 300);
    assert.strictEqual(eventJob?.enabled, false, 'the event job is opt-in');

    const driftJob = result.jobs.find((job) => job.id === 'weekly-docs-wiki-drift');
    assert.strictEqual(driftJob?.useCaseId, 'ke_docs_wiki_drift', 'Fase 75 drift job is configured');
    assert.deepStrictEqual(driftJob?.steps, [0], 'only the read-only drift step runs');
    assert.strictEqual(driftJob?.enabled, true);
    assert.strictEqual(driftJob?.autoApply, false);
  });

  it('skips invalid jobs but keeps the valid ones', () => {
    const result = parseScheduleConfig(
      {
        agent: {
          scheduler: {
            timezone: 'Europe/Rome',
            jobs: [
              { id: 'ok', use_case: 'ke_ontological_validation', schedule: '0 2 * * *' },
              { id: 'bad-cron', use_case: 'ke_ontological_validation', schedule: 'not a cron' },
              { id: 'bad-uc', use_case: 'does_not_exist', schedule: '0 2 * * *' },
              { id: 'ok', use_case: 'ke_cq_assessment', schedule: '0 3 * * *' },
              { id: 'auto', use_case: 'ke_cq_assessment', schedule: '0 4 * * *', auto_apply: true },
              { id: 'bad-steps', use_case: 'ke_cq_assessment', schedule: '0 5 * * *', steps: [9] },
            ],
          },
        },
      },
      registry
    );

    assert.deepStrictEqual(
      result.jobs.map((job) => job.id),
      ['ok', 'auto']
    );
    assert.ok(result.errors.some((e) => e.includes("Job 'bad-cron'")));
    assert.ok(result.errors.some((e) => e.includes('unknown use_case')));
    assert.ok(result.errors.some((e) => e.includes('Duplicate job id')));
    assert.ok(result.errors.some((e) => e.includes('auto_apply=true')));
    assert.ok(result.errors.some((e) => e.includes('steps must be')));
    assert.strictEqual(result.jobs[1].autoApply, false);
  });

  it('falls back to UTC for an invalid timezone', () => {
    const result = parseScheduleConfig(
      {
        agent: {
          scheduler: {
            timezone: 'Mars/Olympus',
            jobs: [{ id: 'job', use_case: 'ke_ontological_validation', schedule: '0 2 * * *' }],
          },
        },
      },
      registry
    );
    assert.strictEqual(result.config.timezone, 'UTC');
    assert.ok(result.errors.some((e) => e.includes('Invalid timezone')));
    assert.strictEqual(result.jobs.length, 1);
  });

  it('reports a missing section instead of throwing', () => {
    const result = parseScheduleConfig({}, registry);
    assert.deepStrictEqual(result.jobs, []);
    assert.ok(result.errors.some((e) => e.includes('Missing [agent.scheduler]')));
  });
});
