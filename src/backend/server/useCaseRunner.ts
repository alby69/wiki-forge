import * as path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { KEUseCaseDef, ScriptDef } from './agentServer';
import { resolveToolScript } from './toolPaths';

/**
 * Events emitted while a KE Use Case runs. The SSE endpoint and the future
 * scheduler both consume this exact contract, so adding a trigger never means
 * duplicating the execution logic.
 */
export type UseCaseEvent =
  | { type: 'start'; useCase: string; objective: string }
  | {
      type: 'step_start';
      stepNumber: number;
      title: string;
      script: string;
      cmd: string;
    }
  | { type: 'stdout' | 'stderr'; stepNumber: number; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'step_end'; stepNumber: number; code: number }
  | { type: 'exit'; code: number; message: string };

/**
 * Dependencies are injected instead of imported from `agentServer.ts`: the
 * module that owns the registries also calls the runner, so a direct import
 * would create a circular dependency.
 */
export interface UseCaseRunnerDeps {
  rootDir: string;
  projectRoot: string;
  projectId: string;
  pythonCmd: string;
  scriptRegistry: Record<string, ScriptDef>;
  buildCliArgs: (scriptDef: ScriptDef, args: Record<string, any>) => string[];
}

export interface RunUseCaseOptions extends UseCaseRunnerDeps {
  useCase: KEUseCaseDef;
  /** Single step, used by the existing SSE endpoint (kept for compatibility). */
  stepIndex?: number;
  /** Explicit step list, used by scheduled jobs to skip wiki-writing steps. */
  stepIndices?: number[];
  args?: Record<string, any>;
  onEvent: (event: UseCaseEvent) => void;
  /** Optional abort signal used by the scheduler for timeout/shutdown. */
  signal?: AbortSignal;
}

export interface UseCaseRunResult {
  stepsExecuted: number;
  failedSteps: number[];
}

/**
 * Execute one Use Case (or a single step) and report progress through
 * `onEvent`. Extracted verbatim from the HTTP handler in F0: the emitted
 * events, argument precedence and child-process options are unchanged.
 */
export async function runUseCase(
  options: RunUseCaseOptions
): Promise<UseCaseRunResult> {
  const {
    useCase,
    stepIndex,
    stepIndices,
    args,
    onEvent,
    signal,
    rootDir,
    projectRoot,
    projectId,
    pythonCmd,
    scriptRegistry,
    buildCliArgs,
  } = options;

  onEvent({
    type: 'start',
    useCase: useCase.title,
    objective: useCase.objective,
  });

  const stepsToRun =
    Array.isArray(stepIndices) && stepIndices.length > 0
      ? stepIndices
          .filter(
            (index) =>
              Number.isInteger(index) && index >= 0 && index < useCase.steps.length
          )
          .map((index) => useCase.steps[index])
      : typeof stepIndex === 'number' &&
          stepIndex >= 0 &&
          stepIndex < useCase.steps.length
        ? [useCase.steps[stepIndex]]
        : useCase.steps;

  const failedSteps: number[] = [];
  let stepsExecuted = 0;

  for (const step of stepsToRun) {
    if (signal?.aborted) break;
    const scriptDef = scriptRegistry[step.scriptId];
    if (!scriptDef) {
      onEvent({
        type: 'stderr',
        text: `Script '${step.scriptId}' for step ${step.stepNumber} not found.`,
      });
      failedSteps.push(step.stepNumber);
      continue;
    }

    const userArgs = {
      ...(projectId !== 'default' ? { project: projectId } : {}),
      ...step.defaultArgs,
      ...(args || {}),
    };
    const cliArgs = buildCliArgs(scriptDef, userArgs);
    const scriptPath = resolveToolScript(rootDir, scriptDef.path);

    onEvent({
      type: 'step_start',
      stepNumber: step.stepNumber,
      title: step.title,
      script: scriptDef.displayName,
      // Kept as-is for backwards compatibility with the existing UI log.
      cmd: `python3 ${scriptDef.path} ${cliArgs.join(' ')}`,
    });

    const exitCode = await new Promise<number>((resolveStep) => {
      let settled = false;
      let aborted = false;
      let abortFallback: NodeJS.Timeout | undefined;
      let child: ChildProcessWithoutNullStreams;

      function finish(code: number): void {
        if (settled) return;
        settled = true;
        if (abortFallback) clearTimeout(abortFallback);
        signal?.removeEventListener('abort', onAbort);
        resolveStep(code);
      }

      function onAbort(): void {
        if (settled) return;
        aborted = true;
        onEvent({
          type: 'stderr',
          stepNumber: step.stepNumber,
          text: 'Use Case aborted (timeout or scheduler shutdown).',
        });
        try {
          child.kill('SIGTERM');
        } catch {
          // Already exited; the `close` handler settles the promise.
        }
        // Wait for `close` before resolving: on Windows a still-running child
        // keeps its cwd locked, which breaks temp-dir cleanup in callers.
        abortFallback = setTimeout(() => finish(124), 2_000);
        abortFallback.unref?.();
      }

      const projectEnv: NodeJS.ProcessEnv =
        projectId && projectId !== 'default'
          ? { WIKIFORGE_PROJECT_ID: projectId, WIKI_FORGE_WIKI_DIR: path.join(projectRoot, 'wiki') }
          : {};
      child = spawn(pythonCmd, [scriptPath, ...cliArgs], {
        cwd: projectRoot,
        // Force UTF-8 so script output containing emoji/accents never hits a
        // Windows `charmap` UnicodeEncodeError and fails an otherwise valid step.
        env: { ...process.env, ...projectEnv, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
        stdio: 'pipe',
      });

      child.stdout.on('data', (data: Buffer) => {
        if (settled) return;
        onEvent({
          type: 'stdout',
          stepNumber: step.stepNumber,
          text: data.toString('utf-8'),
        });
      });

      child.stderr.on('data', (data: Buffer) => {
        if (settled) return;
        onEvent({
          type: 'stderr',
          stepNumber: step.stepNumber,
          text: data.toString('utf-8'),
        });
      });

      child.on('error', (err: Error) => {
        if (settled) return;
        onEvent({
          type: 'stderr',
          stepNumber: step.stepNumber,
          text: `Failed to start process: ${err.message}`,
        });
        // F0 contract: the old handler resolved without a code, so `step_end`
        // still reported 0 when a process could not be started.
        finish(0);
      });

      child.on('close', (code: number | null) => {
        // 124 is the conventional timeout status; the scheduler maps any
        // non-zero step to a failed/cancelled run.
        finish(aborted ? 124 : (code ?? 0));
      });

      if (settled) return;
      if (signal?.aborted) {
        onAbort();
      } else {
        signal?.addEventListener('abort', onAbort, { once: true });
      }
    });

    stepsExecuted += 1;
    if (exitCode !== 0) failedSteps.push(step.stepNumber);
    onEvent({ type: 'step_end', stepNumber: step.stepNumber, code: exitCode });
  }

  onEvent({
    type: 'exit',
    code: 0,
    message: `Use Case '${useCase.title}' execution finished.`,
  });

  return { stepsExecuted, failedSteps };
}
