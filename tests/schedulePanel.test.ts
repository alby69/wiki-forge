import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatDuration,
  formatScheduleTime,
  parseSseEvents,
  POLICY_ACTION_META,
  schedulerEventToLogLine,
  statusLabel,
  toApprovalViews,
  toPolicyDecisionViews,
  toScheduleRunViews,
  toScheduleSnapshotView,
} from '@frontend/core/utils/schedulePanel';

const SNAPSHOT = {
  enabled: true,
  running: true,
  lockHeld: true,
  activeJobs: ['test-nightly'],
  jobs: [
    {
      job: {
        id: 'test-nightly',
        role: 'Ontology Guardian',
        useCaseId: 'ke_ontological_validation',
        schedule: { expression: '0 2 * * *', timezone: 'UTC' },
        enabled: true,
        steps: [0],
      },
      state: {
        last_status: 'success',
        last_run_at: '2026-11-19T02:00:00.000Z',
        next_run_at: '2026-11-20T02:00:00.000Z',
        consecutive_failures: 0,
      },
      description: 'ogni giorno alle 02:00 (UTC)',
    },
  ],
};

describe('KE Workbench schedule panel helpers (F4)', () => {
  it('maps the F3 snapshot into render-ready job cards', () => {
    const view = toScheduleSnapshotView(SNAPSHOT);
    assert.ok(view);
    assert.strictEqual(view.running, true);
    assert.strictEqual(view.jobs.length, 1);
    const job = view.jobs[0];
    assert.strictEqual(job.role, 'Ontology Guardian');
    assert.strictEqual(job.description, 'ogni giorno alle 02:00 (UTC)');
    assert.strictEqual(job.expression, '0 2 * * *');
    assert.strictEqual(job.lastStatus, 'success');
    assert.deepStrictEqual(job.steps, [0]);
    assert.strictEqual(job.active, true);
  });

  it('rejects malformed snapshots and defaults missing fields', () => {
    assert.strictEqual(toScheduleSnapshotView(null), null);
    assert.strictEqual(toScheduleSnapshotView({ jobs: 'nope' }), null);
    const view = toScheduleSnapshotView({ jobs: [{ job: {}, state: {} }] });
    assert.ok(view);
    assert.strictEqual(view.jobs[0].lastStatus, 'idle');
    assert.strictEqual(view.jobs[0].timezone, 'UTC');
    assert.strictEqual(view.jobs[0].active, false);
    assert.strictEqual(view.jobs[0].nextRunAt, '');
  });

  it('maps audit entries and falls back for unknown statuses', () => {
    const runs = toScheduleRunViews({
      runs: [
        {
          job: 'test-nightly',
          useCase: 'ke_ontological_validation',
          status: 'failed',
          startedAt: '2026-11-19T02:00:00.000Z',
          error: 'failed steps: 1',
        },
        { job: 'other', status: 'weird' },
      ],
    });
    assert.strictEqual(runs.length, 2);
    assert.strictEqual(runs[0].status, 'failed');
    assert.strictEqual(runs[0].error, 'failed steps: 1');
    assert.strictEqual(runs[1].status, 'idle');
    assert.deepStrictEqual(toScheduleRunViews({}), []);
  });

  it('formats dates in UTC and durations in Italian', () => {
    assert.strictEqual(formatScheduleTime('2026-11-19T02:00:00.000Z'), '19/11/2026, 02:00:00 UTC');
    assert.strictEqual(formatScheduleTime(undefined), '—');
    assert.strictEqual(formatScheduleTime('not-a-date'), '—');
    assert.strictEqual(formatDuration(450), '450 ms');
    assert.strictEqual(formatDuration(2_500), '2.5 s');
    assert.strictEqual(formatDuration(undefined), '—');
  });

  it('exposes Italian labels for every run status', () => {
    assert.strictEqual(statusLabel('running').label, 'In corso');
    assert.strictEqual(statusLabel('failed').color, '#f87171');
    assert.strictEqual(statusLabel('nope' as any).label, 'Mai eseguito');
  });

  it('parses SSE frames across chunk boundaries and reports [DONE]', () => {
    const first = parseSseEvents('data: {"type":"job_started","jobId":"a"}\n\ndata: {"typ', '');
    assert.strictEqual(first.events.length, 1);
    assert.strictEqual(first.done, false);
    assert.ok(first.rest.startsWith('data: {"typ'));

    const second = parseSseEvents('e":"job_finished","status":"success"}\n\ndata: [DONE]\n\n', first.rest);
    assert.strictEqual(second.events.length, 1);
    assert.strictEqual((second.events[0] as any).status, 'success');
    assert.strictEqual(second.done, true);
    assert.strictEqual(second.rest, '');
  });

  it('ignores keepalive comments and malformed SSE frames', () => {
    const result = parseSseEvents(': keepalive\n\ndata: not-json\n\ndata: {"type":"tick"}\n\n', '');
    assert.strictEqual(result.events.length, 1);
    assert.strictEqual((result.events[0] as any).type, 'tick');
  });

  it('maps scheduler events and nested Use Case events to console lines', () => {
    const started = schedulerEventToLogLine(
      { type: 'job_started', jobId: 'j1', attempt: 1 },
      '10:00:00'
    );
    assert.strictEqual(started?.type, 'start');
    assert.ok(started?.text.includes('j1'));

    const nested = schedulerEventToLogLine(
      {
        type: 'use_case_event',
        jobId: 'j1',
        event: { type: 'step_start', stepNumber: 2, title: 'Lint', cmd: 'python x.py' },
      },
      '10:00:01'
    );
    assert.strictEqual(nested?.type, 'start');
    assert.ok(nested?.text.includes('[Step 2] Lint'));

    const finished = schedulerEventToLogLine(
      { type: 'job_finished', jobId: 'j1', status: 'failed', durationMs: 1500 },
      '10:00:02'
    );
    assert.strictEqual(finished?.type, 'exit');
    assert.ok(finished?.text.includes('fallito'));
    assert.ok(finished?.text.includes('1.5 s'));

    assert.strictEqual(schedulerEventToLogLine({ type: 'tick' }, '10:00:00'), null);
  });

  it('maps F5 decisions and F6 approvals into render-ready view models', () => {
    const decisions = toPolicyDecisionViews({
      decisions: [
        {
          id: 'dec-1',
          jobId: 'nightly',
          action: 'require_approval',
          origin: 'llm',
          rationale: 'Step mutante rimandato.',
          sources: ['config/agent_schedule.toml'],
          steps: [0],
          mutatingSteps: [1],
          at: '2026-11-19T02:00:00.000Z',
        },
        { jobId: 'fallback', action: 'unknown' },
      ],
    });
    assert.strictEqual(decisions.length, 2);
    assert.strictEqual(decisions[0].action, 'require_approval');
    assert.deepStrictEqual(decisions[0].mutatingSteps, [1]);
    assert.strictEqual(decisions[1].action, 'allow', 'unknown actions default to allow');
    assert.strictEqual(decisions[1].origin, 'fallback');
    assert.deepStrictEqual(toPolicyDecisionViews({}), []);
    assert.strictEqual(toPolicyDecisionViews({ decisions: [decisions[0], decisions[1]] }, 1).length, 1);
    assert.strictEqual(POLICY_ACTION_META.require_approval.label, 'Approvazione richiesta');

    const approvals = toApprovalViews({
      approvals: [
        {
          id: 'appr-1',
          jobId: 'nightly',
          stepIndex: 1,
          scriptId: 'okf_reindex',
          status: 'pending',
          rationale: 'Richiede approvazione.',
          sources: ['output/scheduler/audit.jsonl'],
          createdAt: '2026-11-19T02:00:00.000Z',
        },
        { id: 'appr-2', status: 'weird', sources: 'not-an-array' },
      ],
    });
    assert.strictEqual(approvals.length, 2);
    assert.strictEqual(approvals[0].scriptId, 'okf_reindex');
    assert.strictEqual(approvals[0].status, 'pending');
    assert.strictEqual(approvals[1].status, 'pending', 'unknown status defaults to pending');
    assert.deepStrictEqual(approvals[1].sources, []);
    assert.deepStrictEqual(toApprovalViews({}), []);
  });

  it('maps policy, approval and event SSE events to console lines', () => {
    const policy = schedulerEventToLogLine(
      { type: 'policy_decision', jobId: 'j1', action: 'require_approval', rationale: 'Servono fonti.' },
      '10:00:01'
    );
    assert.strictEqual(policy?.type, 'info');
    assert.ok(policy?.text.includes('Approvazione richiesta'));
    assert.ok(policy?.text.includes('Servono fonti.'));

    const approval = schedulerEventToLogLine(
      { type: 'approval_required', jobId: 'j1', steps: [1], rationale: 'Step mutante.' },
      '10:00:02'
    );
    assert.ok(approval?.text.includes('step 1'));

    const queued = schedulerEventToLogLine(
      { type: 'event_queued', jobId: 'j1', event: { type: 'note.created' }, fireAt: '2026-11-19T10:05:00.000Z' },
      '10:00:03'
    );
    assert.ok(queued?.text.includes('note.created'));
    assert.ok(queued?.text.includes('10:05:00 UTC'));

    const triggered = schedulerEventToLogLine(
      { type: 'event_triggered', jobId: 'j1', event: { type: 'note.created', path: 'wiki/a.md' } },
      '10:05:00'
    );
    assert.strictEqual(triggered?.type, 'start');
    assert.ok(triggered?.text.includes('wiki/a.md'));

    const skipped = schedulerEventToLogLine(
      { type: 'job_skipped', jobId: 'j1', reason: 'policy skip' },
      '10:05:01'
    );
    assert.strictEqual(skipped?.type, 'stderr');
    assert.ok(skipped?.text.includes('policy skip'));
  });
});
