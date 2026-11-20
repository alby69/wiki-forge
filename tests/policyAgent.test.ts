import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LlmClient } from '@backend/server/llmClient';
import { isMutatingScript, PolicyAgent, PolicyContext } from '@backend/server/scheduler/policyAgent';

let tmpDir: string;

const CONTEXT: PolicyContext = {
  jobId: 'review-job',
  role: 'Ontology Guardian',
  useCaseId: 'ke_semantic_export',
  project: 'default',
  trigger: 'event',
  steps: [
    { index: 0, scriptId: 'export_semantic', title: 'Export', mutating: false },
    { index: 1, scriptId: 'okf_reindex', title: 'Reindex', mutating: true },
  ],
  lastStatus: 'success',
  lastError: undefined,
  consecutiveFailures: 0,
  event: 'note.created',
};

function clientResponding(response: string): LlmClient {
  return { complete: async () => response };
}

describe('F5 — Policy Agent decision log', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-policy-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('labels scripts that write inside wiki/ as mutating', () => {
    assert.strictEqual(isMutatingScript('okf_reindex'), true);
    assert.strictEqual(isMutatingScript('suggest_tags'), true);
    assert.strictEqual(isMutatingScript('maturity_calculator'), true);
    assert.strictEqual(isMutatingScript('promote_doc_answer'), true);
    assert.strictEqual(isMutatingScript('docs_wiki_drift'), true);
    assert.strictEqual(isMutatingScript('wiki_program_change_apply'), true);
    assert.strictEqual(isMutatingScript('wiki_program_change_propose'), false);
    assert.strictEqual(isMutatingScript('export_semantic'), false);
    assert.strictEqual(isMutatingScript(undefined), false);
  });

  it('accepts a valid LLM decision and logs rationale and sources', async () => {
    const logPath = path.join(tmpDir, 'output', 'scheduler', 'decisions.jsonl');
    const agent = new PolicyAgent({
      getClient: async () => clientResponding(
        JSON.stringify({
          action: 'allow',
          steps: [0],
          rationale: 'Report disponibile; indice rimandato all’approvazione.',
          sources: ['config/agent_schedule.toml', 'wiki/index.md'],
        })
      ),
      logPath,
    });

    const decision = await agent.decide(CONTEXT);
    assert.strictEqual(decision.origin, 'llm');
    assert.deepStrictEqual(decision.steps, [0]);
    assert.deepStrictEqual(decision.mutatingSteps, [1]);
    assert.match(decision.rationale, /approvazione/);
    assert.ok(decision.sources.length >= 2);
    assert.ok(decision.id.startsWith('dec-'));

    const lines = (await fs.readFile(logPath, 'utf-8')).trim().split(/\r?\n/);
    assert.strictEqual(lines.length, 1);
    const logged = JSON.parse(lines[0]);
    assert.strictEqual(logged.jobId, 'review-job');
    assert.ok(logged.rationale && logged.sources.length > 0, 'every decision is grounded');
  });

  it('never allows a mutating step even when the LLM asks for it', async () => {
    const agent = new PolicyAgent({
      getClient: async () => clientResponding(
        JSON.stringify({
          action: 'allow',
          steps: [0, 1],
          rationale: 'Applica subito il reindex.',
          sources: ['wiki/index.md'],
        })
      ),
      logPath: path.join(tmpDir, 'decisions.jsonl'),
    });

    const decision = await agent.decide(CONTEXT);
    assert.deepStrictEqual(decision.steps, [0], 'mutating step removed from runnable steps');
    assert.deepStrictEqual(decision.mutatingSteps, [1]);
    assert.match(decision.rationale, /spostati in approvazione/);
  });

  it('falls back deterministically and redacts secrets when the LLM is unusable', async () => {
    const agent = new PolicyAgent({
      getClient: async () => clientResponding('api_key=super-secret\nnot json'),
      logPath: path.join(tmpDir, 'decisions.jsonl'),
    });

    const decision = await agent.decide(CONTEXT);
    assert.strictEqual(decision.origin, 'fallback');
    assert.strictEqual(decision.action, 'require_approval');
    assert.deepStrictEqual(decision.steps, [0]);
    assert.ok(decision.rationale.length > 0);
    assert.ok(decision.sources.includes('config/agent_schedule.toml'));
    assert.ok(!decision.error?.includes('super-secret'));
    assert.ok(!decision.rationale.includes('super-secret'));
  });

  it('redacts secrets from an otherwise valid LLM decision', async () => {
    const agent = new PolicyAgent({
      getClient: async () => clientResponding(
        JSON.stringify({
          action: 'allow',
          steps: [0],
          rationale: 'token=abc123: verifica completata',
          sources: ['config/agent_schedule.toml'],
        })
      ),
      logPath: path.join(tmpDir, 'decisions.jsonl'),
    });
    const decision = await agent.decide(CONTEXT);
    assert.strictEqual(decision.origin, 'llm');
    assert.ok(!decision.rationale.includes('abc123'));
    assert.match(decision.rationale, /\[REDACTED\]/);
  });

  it('uses the read-only fallback for a read-only job with no LLM output', async () => {
    const agent = new PolicyAgent({
      getClient: async () => { throw new Error('LLM unavailable'); },
      logPath: path.join(tmpDir, 'decisions.jsonl'),
    });
    const decision = await agent.decide({
      ...CONTEXT,
      steps: [{ index: 0, scriptId: 'ontology_rules', mutating: false }],
    });
    assert.strictEqual(decision.action, 'allow');
    assert.deepStrictEqual(decision.steps, [0]);
    assert.deepStrictEqual(decision.mutatingSteps, []);
    assert.match(decision.rationale, /deterministica/);
  });

  it('reads decisions newest-first with job filtering and skips corrupt lines', async () => {
    const logPath = path.join(tmpDir, 'decisions.jsonl');
    await fs.writeFile(logPath, [
      JSON.stringify({ jobId: 'a', id: '1', rationale: 'r1', sources: ['s'] }),
      'not-json',
      JSON.stringify({ jobId: 'b', id: '2', rationale: 'r2', sources: ['s'] }),
      JSON.stringify({ jobId: 'a', id: '3', rationale: 'r3', sources: ['s'] }),
    ].join('\n'), 'utf-8');
    const agent = new PolicyAgent({ getClient: async () => clientResponding('{}'), logPath });

    const all = await agent.readDecisions();
    assert.deepStrictEqual(all.map(entry => entry.id), ['3', '2', '1']);
    const filtered = await agent.readDecisions({ jobId: 'a', limit: 1 });
    assert.deepStrictEqual(filtered.map(entry => entry.id), ['3']);
    assert.deepStrictEqual(await agent.readDecisions({ jobId: 'none' }), []);
  });
});
