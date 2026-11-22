import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { KE_USE_CASES } from '@backend/server/agentServer';
import {
  describeSchedule,
  isValidTimezone,
  nextRunAt,
  parseSchedule,
} from '@backend/server/scheduler/cron';
import {
  buildSyntheticUseCases,
  loadScheduleConfig,
  parseScheduleConfig,
  scriptUseCaseId,
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
    assert.strictEqual(result.jobs.filter((job) => job.jobKind !== 'script').length, 9,
      'the original 9 Use Case jobs are unchanged');
    assert.strictEqual(result.jobs.length, 11);
    assert.ok(result.jobs.every((job) => job.autoApply === false));
    assert.strictEqual(result.jobs.filter((job) => job.enabled).length, 6);

    const scriptJobs = result.jobs.filter((job) => job.jobKind === 'script');
    assert.deepStrictEqual(
      scriptJobs.map((job) => job.scriptId),
      ['okf_lint', 'docs_wiki_drift'],
      'the shipped script examples are loaded but disabled'
    );
    assert.ok(scriptJobs.every((job) => job.enabled === false));
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

describe('Script jobs (S1)', () => {
  it('accepts a script job and generates its one-step Use Case', () => {
    const result = parseScheduleConfig(
      {
        agent: {
          scheduler: {
            jobs: [{ id: 'lint-script', script: 'okf_lint' }],
          },
        },
      },
      registry
    );

    assert.deepStrictEqual(result.errors, []);
    const job = result.jobs[0];
    assert.strictEqual(job.jobKind, 'script');
    assert.strictEqual(job.scriptId, 'okf_lint');
    assert.strictEqual(job.useCaseId, scriptUseCaseId('okf_lint'));
    assert.strictEqual(job.enabled, true, 'read-only scripts may be enabled');
    assert.deepStrictEqual(job.steps, [0]);
    assert.strictEqual(job.schedule.kind, 'cron');

    const synthetic = buildSyntheticUseCases(result.jobs);
    assert.strictEqual(synthetic[job.useCaseId].steps.length, 1);
    assert.strictEqual(synthetic[job.useCaseId].steps[0].scriptId, 'okf_lint');
  });

  it('rejects ambiguous, unknown, blocked and mutating-enabled script jobs', () => {
    const result = parseScheduleConfig(
      {
        agent: {
          scheduler: {
            timezone: 'UTC',
            jobs: [
              { id: 'both', use_case: 'ke_ontological_validation', script: 'okf_lint', schedule: '0 2 * * *' },
              { id: 'none', schedule: '0 2 * * *' },
              { id: 'unknown', script: 'nope_script', schedule: '0 2 * * *' },
              { id: 'blocked', script: 'wizard', schedule: '0 2 * * *' },
              {
                id: 'mutating',
                script: 'docs_wiki_drift',
                schedule: '0 2 * * *',
                enabled: true,
                args: { docs_dir: 'docs', wiki_dir: 'projects/wikiforge/wiki' },
              },
            ],
          },
        },
      },
      registry
    );

    // Mutating jobs are kept (disabled) so the UI can show and approve them.
    assert.deepStrictEqual(result.jobs.map((job) => job.id), ['mutating']);
    assert.strictEqual(result.jobs[0].enabled, false);
    assert.ok(result.errors.some((e) => e.includes("Job 'both' must define exactly one")));
    assert.ok(result.errors.some((e) => e.includes("Job 'none' must define exactly one")));
    assert.ok(result.errors.some((e) => e.includes("unknown script 'nope_script'")));
    assert.ok(result.errors.some((e) => e.includes("script 'wizard' is not schedulable")));
    assert.ok(result.errors.some((e) => e.includes("forcing enabled=false (F6 approval required)")));
  });

  it('merges both config files and rejects ids duplicated across them', async () => {
    const rootDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-jobstore-'));
    try {
      await fs.mkdir(path.join(rootDir, 'config'), { recursive: true });
      await fs.writeFile(
        path.join(rootDir, 'config', 'agent_schedule.toml'),
        '[agent.scheduler]\nenabled = true\ntimezone = "UTC"\n\n' +
          '[[agent.scheduler.jobs]]\nid = "shared"\nuse_case = "ke_ontological_validation"\nschedule = "0 2 * * *"\n',
        'utf-8'
      );
      await fs.writeFile(
        path.join(rootDir, 'config', 'script_schedules.toml'),
        '[[script_jobs]]\nid = "shared"\nscript = "okf_lint"\nschedule = "0 3 * * *"\n\n' +
          '[[script_jobs]]\nid = "script-only"\nscript = "okf_stats"\n',
        'utf-8'
      );

      const result = await loadScheduleConfig(rootDir, registry);
      assert.deepStrictEqual(result.jobs.map((job) => job.id), ['shared', 'script-only']);
      assert.ok(
        result.errors.some((e) => e.includes("Duplicate job id 'shared'")),
        'main config wins on id collisions'
      );
      assert.strictEqual(result.jobs[1].jobKind, 'script');
      assert.strictEqual(result.jobs[1].useCaseId, scriptUseCaseId('okf_stats'));
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
