import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PYTHON_CMD, ScriptDef, KEUseCaseDef } from '@backend/server/agentServer';
import { runUseCase, UseCaseEvent } from '@backend/server/useCaseRunner';

describe('Shared KE Use Case runner (F0)', () => {
  let tmpDir: string;
  let scriptDef: ScriptDef;
  let useCase: KEUseCaseDef;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-runner-test-'));
    const scriptPath = path.join(tmpDir, 'echo_script.py');
    await fs.writeFile(
      scriptPath,
      'import sys\nprint("hello-from-stdout")\nprint("hello-from-stderr", file=sys.stderr)\n',
      'utf-8'
    );

    scriptDef = {
      id: 'echo_script',
      path: scriptPath,
      displayName: 'Echo Script',
      category: 'Analysis & Metrics',
      description: 'Test script',
      parameters: [],
    };

    useCase = {
      id: 'test_use_case',
      title: 'Test Use Case',
      role: 'Knowledge Engineer',
      category: 'Validation & Governance',
      summary: 'Test',
      objective: 'Verify the shared runner event contract',
      steps: [
        {
          stepNumber: 1,
          title: 'First step',
          description: 'First',
          scriptId: 'echo_script',
          defaultArgs: {},
        },
        {
          stepNumber: 2,
          title: 'Second step',
          description: 'Second',
          scriptId: 'echo_script',
          defaultArgs: {},
        },
      ],
    };
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function collect(events: UseCaseEvent[], event: UseCaseEvent): void {
    events.push(event);
  }

  it('emits the same event sequence as the previous SSE handler', async () => {
    const events: UseCaseEvent[] = [];
    const result = await runUseCase({
      useCase,
      rootDir: tmpDir,
      projectRoot: tmpDir,
      projectId: 'default',
      pythonCmd: PYTHON_CMD,
      scriptRegistry: { echo_script: scriptDef },
      buildCliArgs: () => [],
      onEvent: (event) => collect(events, event),
    });

    assert.strictEqual(events[0].type, 'start');
    assert.strictEqual(events[1].type, 'step_start');
    assert.strictEqual(events[events.length - 1].type, 'exit');
    assert.strictEqual(events[events.length - 2].type, 'step_end');
    assert.deepStrictEqual(result, { stepsExecuted: 2, failedSteps: [] });

    const stdout = events.find((e) => e.type === 'stdout');
    const stderr = events.find((e) => e.type === 'stderr');
    assert.ok(stdout && stdout.type === 'stdout');
    assert.ok(stderr && stderr.type === 'stderr');
    assert.ok((stdout as { text: string }).text.includes('hello-from-stdout'));
    assert.ok((stderr as { text: string }).text.includes('hello-from-stderr'));
  });

  it('runs only the requested step', async () => {
    const events: UseCaseEvent[] = [];
    await runUseCase({
      useCase,
      stepIndex: 1,
      rootDir: tmpDir,
      projectRoot: tmpDir,
      projectId: 'default',
      pythonCmd: PYTHON_CMD,
      scriptRegistry: { echo_script: scriptDef },
      buildCliArgs: () => [],
      onEvent: (event) => collect(events, event),
    });

    const stepStarts = events.filter((e) => e.type === 'step_start');
    assert.strictEqual(stepStarts.length, 1);
    assert.strictEqual((stepStarts[0] as { stepNumber: number }).stepNumber, 2);
  });

  it('reports a missing script without aborting the Use Case', async () => {
    const events: UseCaseEvent[] = [];
    const result = await runUseCase({
      useCase,
      stepIndex: 0,
      rootDir: tmpDir,
      projectRoot: tmpDir,
      projectId: 'default',
      pythonCmd: PYTHON_CMD,
      scriptRegistry: {},
      buildCliArgs: () => [],
      onEvent: (event) => collect(events, event),
    });

    const error = events.find((e) => e.type === 'stderr');
    assert.ok(error && error.type === 'stderr');
    assert.ok((error as { text: string }).text.includes('not found'));
    assert.strictEqual(events[events.length - 1].type, 'exit');
    assert.deepStrictEqual(result.failedSteps, [1]);
  });

  it('aborts a running step via AbortSignal and reports the failure', async () => {
    const slowPath = path.join(tmpDir, 'slow_script.py');
    await fs.writeFile(
      slowPath,
      'import time\nprint("started", flush=True)\ntime.sleep(10)\n',
      'utf-8'
    );
    const slowDef: ScriptDef = {
      id: 'slow_script',
      path: slowPath,
      displayName: 'Slow Script',
      category: 'Analysis & Metrics',
      description: 'Test script that sleeps',
      parameters: [],
    };
    const slowUseCase: KEUseCaseDef = {
      ...useCase,
      id: 'slow_use_case',
      steps: [{ ...useCase.steps[0], scriptId: 'slow_script' }],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300);
    const startedAt = Date.now();
    const events: UseCaseEvent[] = [];
    const result = await runUseCase({
      useCase: slowUseCase,
      rootDir: tmpDir,
      projectRoot: tmpDir,
      projectId: 'default',
      pythonCmd: PYTHON_CMD,
      scriptRegistry: { slow_script: slowDef },
      buildCliArgs: () => [],
      onEvent: (event) => collect(events, event),
      signal: controller.signal,
    });
    clearTimeout(timer);

    assert.ok(Date.now() - startedAt < 5_000, 'abort stops the child promptly');
    assert.deepStrictEqual(result.failedSteps, [1]);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'stderr' &&
          'text' in event &&
          (event as { text: string }).text.includes('aborted')
      )
    );
    assert.strictEqual(events[events.length - 1].type, 'exit');
  });
});
