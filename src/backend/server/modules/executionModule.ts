/**
 * Script / Knowledge-Engine Use Case execution module.
 *
 * Both commands stream their progress as SSE; the gateway owns only the
 * response headers, while this module writes every frame and the terminal
 * `[DONE]` exactly as the legacy inline handlers did. All registries and
 * process settings come from the injected `ExecutionPort`, so there is no
 * runtime dependency on `AgentServer` or on HTTP request/response types.
 */

import * as path from 'node:path';
import { error, sse, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import { spawnManaged } from '../process/scriptRunner';
import { resolveToolScript } from '../toolPaths';
import { runUseCase, type UseCaseEvent } from '../useCaseRunner';
import type { ExecutionPort } from '../../app/ports';

type Payload = Record<string, unknown>;
/** Avoid a runtime import of `agentServer` just for the Use Case shape. */
type UseCaseDef = Parameters<typeof runUseCase>[0]['useCase'];

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Payload | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : undefined;
}

/** Header/query project wins; the JSON body is only a fallback for `default`. */
function effectiveProject(contextProjectId: string, payload: Payload): string {
  const bodyProjectId = (asString(payload.projectId) ?? '').trim();
  return contextProjectId !== 'default' ? contextProjectId : (bodyProjectId || 'default');
}

export class ExecutionModule implements DomainModule {
  readonly name = 'execution';

  constructor(private readonly services: ExecutionPort) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('scripts.execute', (payload, context) => this.executeScript(payload, context.projectId));
    bus.register<Payload>('ke.useCases.execute', (payload, context) => this.executeUseCase(payload, context.projectId));
  }

  private async executeScript(payload: Payload, contextProjectId: string): Promise<ApiResult> {
    try {
      const scriptId = asString(payload.scriptId) ?? asString(payload.script);
      const scriptDef = scriptId ? this.services.registry[scriptId] : undefined;
      if (!scriptDef) {
        return error(`Invalid or unregistered script ID '${scriptId}'`, 400);
      }

      const supportsProject = scriptDef.parameters.some((param) => param.name === 'project');
      const args = asRecord(payload.args);
      const safeArgs = scriptId === 'wiki_program_change_apply'
        ? this.services.withoutApprovalFlags(args)
        : args;
      const projectId = effectiveProject(contextProjectId, payload);
      const projectArgs: Payload = projectId !== 'default' && supportsProject
        ? { project: projectId }
        : {};
      const userArgs = { ...(safeArgs ?? {}), ...projectArgs };
      const cliArgs = this.services.buildCliArgs(scriptDef, userArgs);
      const projRoot = await this.services.resolveRoot(projectId);
      const scriptPath = resolveToolScript(this.services.rootDir, scriptDef.path);

      return sse((res) => {
        res.write(`data: ${JSON.stringify({
          type: 'start',
          script: scriptDef.displayName,
          projectId,
          cwd: projRoot,
          cmd: `python3 ${scriptDef.path} ${cliArgs.join(' ')}`,
        })}\n\n`);

        const scriptEnv: NodeJS.ProcessEnv = {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8',
        };
        if (projectId !== 'default') {
          // Python helpers resolve bare paths such as `wiki` via these vars.
          scriptEnv.WIKIFORGE_PROJECT_ID = projectId;
          scriptEnv.WIKI_FORGE_WIKI_DIR = path.join(projRoot, 'wiki');
        }

        const managed = spawnManaged({
          command: this.services.pythonTool.pythonCmd,
          args: [scriptPath, ...cliArgs],
          cwd: projRoot,
          extraEnv: scriptEnv,
          onStdout: (text) => {
            res.write(`data: ${JSON.stringify({ type: 'stdout', text })}\n\n`);
          },
          onStderr: (text) => {
            res.write(`data: ${JSON.stringify({ type: 'stderr', text })}\n\n`);
          },
        });

        void managed.done.then((result) => {
          if (result.error) {
            res.write(`data: ${JSON.stringify({ type: 'stderr', text: `Failed to start process: ${result.error.message}` })}\n\n`);
          }
          if (result.truncated) {
            res.write(`data: ${JSON.stringify({ type: 'stderr', text: 'Output truncated by subprocess limit' })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({ type: 'exit', code: result.code })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        });
      });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async executeUseCase(payload: Payload, contextProjectId: string): Promise<ApiResult> {
    try {
      const useCaseId = asString(payload.useCaseId);
      const entry = useCaseId ? this.services.useCases[useCaseId] : undefined;
      const useCase = entry ? entry as UseCaseDef : undefined;
      if (!useCaseId || !useCase) {
        return error(`Invalid or unregistered Knowledge Engineer Use Case ID '${useCaseId}'`, 400);
      }

      const projectId = effectiveProject(contextProjectId, payload);
      const projRoot = await this.services.resolveRoot(projectId);
      const needsF6 = useCase.steps.some((step) => step.scriptId === 'wiki_program_change_apply');
      const args = asRecord(payload.args);
      const safeArgs = needsF6 ? this.services.withoutApprovalFlags(args) : args;
      const stepIndex = typeof payload.stepIndex === 'number' ? payload.stepIndex : undefined;

      return sse(async (res) => {
        try {
          await runUseCase({
            useCase,
            stepIndex,
            args: safeArgs,
            onEvent: (event: UseCaseEvent) => {
              res.write(`data: ${JSON.stringify(event)}\n\n`);
            },
            rootDir: this.services.rootDir,
            projectRoot: projRoot,
            projectId,
            pythonCmd: this.services.pythonTool.pythonCmd,
            scriptRegistry: this.services.registry,
            buildCliArgs: this.services.buildCliArgs,
          });
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (err) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: String(err) }));
          }
        }
      });
    } catch (err) {
      return error(String(err), 500);
    }
  }
}

export function createExecutionModule(services: ExecutionPort): ExecutionModule {
  return new ExecutionModule(services);
}
