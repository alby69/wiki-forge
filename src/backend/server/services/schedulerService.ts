import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { MarkdownParser } from '@shared/domain/markdownParser';
import { ensureOkfFrontmatter } from '@shared/domain/okfFrontmatter';
import type { WikiNote } from '@shared/domain/wiki';
import type { ScriptDef } from '@shared/domain/scripts';
import { LlmClient, LlmClientFactory } from '../llmClient';
import {
  DocumentMove,
  DocumentRef,
  rewriteDocumentLinks,
  setDocumentTitle,
  slugifyDocumentTitle,
  updateLeadingHeading,
} from '../wikiLinks';
import {
  findBacklinks,
  NoteRef,
  ResearchTraceNote,
  ResearchTraceResponse,
  ResearchTraceSource,
  searchNotes,
  suggestRelated,
  toNoteRef,
} from '../researchHelpers';
import {
  buildAudioOverview,
  buildMindmap,
  buildQuiz,
  buildStudyGuide,
  buildThesis,
  slugifyTopic,
  StudyMindmapLink,
  StudyMindmapNode,
  StudyNoteRef,
  StudySource,
  StudyThesisChapter,
  StudyThesisSynthesis,
} from '../studyHelpers';
import {
  buildConsultAnswerNote,
  ConsultAnswerInput,
  validateOkfNote,
} from '../researchAnswerNote';
import { runUseCase, UseCaseEvent } from '../useCaseRunner';
import {
  JobExecutionContext,
  JobExecutionResult,
  PreflightResult,
  redactValue,
  Scheduler,
  SchedulerEvent,
  TriggerEvent,
} from '../scheduler/scheduler';
import {
  buildSyntheticUseCases,
  loadScheduleConfig,
  SchedulerConfig,
  type ScheduleConfigResult,
} from '../scheduler/jobStore';
import {
  createScriptJob,
  deleteScriptJob,
  type ScriptScheduleCreateInput,
} from '../scheduler/scriptJobStore';
import { isMutatingScript, PolicyAgent, PolicyStep } from '../scheduler/policyAgent';
import { ApprovalRequest, ApprovalStore } from '../scheduler/approvalStore';
import { EventTriggerBus, isSupportedTriggerEvent } from '../scheduler/eventTriggers';
import { EventQueue } from '../scheduler/eventQueue';
import { GENERATED_SCRIPT_REGISTRY } from '../generated/scriptRegistry.generated';
import { getScriptSafety } from '../scheduler/scriptSafety';
import { resolveToolScript } from '../toolPaths';
import { atomicWriteFile, listTrash, restoreFromTrash, softDelete, type TrashEntry } from '../safeFs';
import {
  ProjectService,
  type CloneProjectOptions,
  type ProjectBundle,
  type ProjectDeleteMode,
  type ProjectEntry,
} from '../projectService';
import { ChangesetStore, type ChangesetStatus, type StageChangesetInput } from '../changesetStore';
import { AutonomyEngine, loadAutonomyConfigSync } from '../autonomy';
import { collectRepairFindings, repairFindingToStageInput } from '../orphanRepair';
import { GraphEventHub } from '../graphEvents';
import { handleDocsRequest } from '../api/docsBrowser';
import { json, readJsonBody, readJsonBodyWithRaw, sendApiResult } from '../api/http';
import { createValidationMiddleware } from '../api/validation';
import { createMessageBus, type MessageBus, type Principal } from '../bus/messageBus';
import { authenticateRequest, deriveRequestPrincipal, legacyPrincipal } from '../auth/principal';
import { bearerTokenFromRequest, UNAUTHORIZED_MESSAGE, apiTokenFromRequest } from '../auth/apiToken';
import { actorKind, canonicalActor, PROCESS_FALLBACK_ACTOR } from '../auth/actor';
import { createIdpAdapter, defaultIdpDependencies, type IdpAdapter, type IdpDependencies } from '../auth/idp';
import { loadRbacConfigSync, type RbacConfig } from '../auth/rbacConfig';
import { createRbacMiddleware } from '../auth/rbacMiddleware';
import { buildAuthIdentity } from '../auth/identity';
import { UserStore } from '../auth/userStore';
import { UiModule } from '../auth/uiModule';
import { UiPreferencesStore } from '../auth/uiPreferencesStore';
import { createCatalogueModule, type CatalogueModule } from '../modules/catalogueModule';
import { createToolsModule, type ToolsModule } from '../modules/toolsModule';
import { createReviewModule, type ReviewModule } from '../modules/reviewModule';
import { createIngestionModule, type IngestionModule } from '../modules/ingestionModule';
import type { GraphModule } from '../modules/graphModule';
import { GRAPH_PROXY_PATHS } from '../modules/graphProxyModule';
import { createKernel } from '../../app/createKernel';
import { portsFromServices } from '../../app/ports';
import { UserModule } from '../modules/userModule';
import type { DomainServices } from '../modules/services';
import type { PythonTool } from '../modules/pythonTool';
import { matchRoute } from '../../../shared/api/router';
import { ROUTES as API_ROUTES } from '../../../shared/api/contracts';


import type {
  ChatRequest,
  ResearchConsultCitation,
  ResearchConsultResponse,
  ResearchDeepResearchResult,
  ResearchDeepResearchResponse,
  ResearchPromoteAnswerResponse,
  StudyMindmapResponse,
  StudyOutputResponse,
  StudyPromoteResponse,
  StudyQuickNoteResponse,
  StudyQuizResponse,
  StudyThesisResponse,
} from '../agentServer';
import { resolvePythonCommand, PYTHON_CMD, buildCliArgsFromSchema, buildCliArgs, withoutApprovalFlags, SCRIPT_REGISTRY, SCRATCHPAD_INTRO, normalizeScratchpad, parseScratchpad, SaveNoteRequest, AttachNoteRequest, ApplyEditRequest, ScratchpadEntry, DeleteScratchpadRequest, CreateFolderRequest, CreateFileRequest, RenameRequest, MoveRequest, RenameLinkUpdate, RenameResult, DeleteRequest, UploadRequest, IngestRequest, WizardScenario, WIZARD_SCENARIOS, formatWizardList, KE_USE_CASES, formatKeUseCaseList } from '../agentServerCatalogs';

type Host = Record<string, any>;

export const schedulerMethods = {
  getScheduler(this: Host, ): Scheduler | undefined {
    return this.scheduler;
  },

  /** Load both schedule files and start the KE scheduler. Idempotent. */

  async startScheduler(this: Host, ): Promise<void> {
    if (this.scheduler) return;
    const loaded = await loadScheduleConfig(this.rootDir, this.baseUseCases);
    await this.activateSchedule(loaded, []);
  },

  /**
   * S3 — apply a freshly loaded schedule to the live process. `scheduledUseCases`
   * and `Scheduler.jobs` are mutated in place because both are shared by
   * reference with the running scheduler and the event trigger bus.
   */

  async activateSchedule(this: Host,
    loaded: ScheduleConfigResult,
    previousIds: string[]
  ): Promise<{ added: string[]; removed: string[] }> {
    const synthetic = buildSyntheticUseCases(loaded.jobs);
    const nextUseCases = { ...this.baseUseCases, ...synthetic };
    for (const key of Object.keys(this.scheduledUseCases)) delete this.scheduledUseCases[key];
    Object.assign(this.scheduledUseCases, nextUseCases);
    this.schedulerConfig = loaded.config;
    this.scheduleConfigErrors = loaded.errors;

    const before = new Set(previousIds);
    const after = new Set(loaded.jobs.map((job) => job.id));
    const added = loaded.jobs.map((job) => job.id).filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    for (const id of removed) this.eventBus?.cancelJob(id);

    if (this.scheduler) {
      await this.scheduler.replaceJobs(loaded.jobs);
      return { added, removed };
    }
    if (loaded.jobs.length === 0) return { added, removed };

    this.approvalStore = new ApprovalStore({
      filePath: path.join(this.rootDir, '.wiki-forge', 'scheduler-approvals.json'),
    });
    if (loaded.config.policyEnabled) {
      this.policyAgent = new PolicyAgent({
        getClient: () => this.getOrInitLlmClient(),
        logPath: path.join(this.rootDir, loaded.config.logDir, 'decisions.jsonl'),
      });
    }

    const scheduler = new Scheduler({
      config: loaded.config,
      jobs: loaded.jobs,
      useCases: this.scheduledUseCases,
      rootDir: this.rootDir,
      executeJob: (ctx) => this.executeScheduledJob(ctx),
      preflight: this.policyAgent ? (ctx) => this.runPolicy(ctx) : undefined,
      onEvent: (event) => this.broadcastScheduleEvent(event),
    });
    this.scheduler = scheduler;
    this.eventBus = new EventTriggerBus({
      jobs: loaded.jobs,
      queue: new EventQueue({
        filePath: path.join(this.rootDir, '.wiki-forge', 'event-queue.jsonl'),
      }),
      onTrigger: async (jobId, event) => {
        if (scheduler.isRunning(jobId)) return;
        await scheduler.runJobNow(jobId, 'event', event);
        this.broadcastScheduleEvent({ type: 'event_triggered', jobId, event, at: new Date().toISOString() });
      },
      onEvent: (event) => this.broadcastScheduleEvent(event),
    });
    await scheduler.start();
    return { added, removed };
  },

  /** S3: share the persistence + reload flow with the schedule API module. */

  async createScriptJob(this: Host, input: ScriptScheduleCreateInput): Promise<{ job: Record<string, unknown>; warnings: string[] }> {
    const before = this.scheduler?.getStatus().jobs.map((entry: any) => entry.job.id as string) ?? [];
    const timezone = this.schedulerConfig?.timezone ?? 'UTC';
    const result = await createScriptJob(this.rootDir, input, this.baseUseCases, timezone);
    const changes = await this.reloadSchedule(before);
    const job = this.scheduler?.getStatus().jobs
      .find((entry: any) => entry.job.id === result.job.id)
      ?.job as Record<string, unknown> | undefined;
    this.publishScheduleChange(changes);
    return { job: job ?? (result.job as unknown as Record<string, unknown>), warnings: result.warnings };
  },

  /** S3: share the persistence + reload flow with the schedule API module. */

  async deleteScriptJob(this: Host, jobId: string): Promise<{ removed: boolean }> {
    const before = this.scheduler?.getStatus().jobs.map((entry: any) => entry.job.id as string) ?? [];
    const timezone = this.schedulerConfig?.timezone ?? 'UTC';
    const result = await deleteScriptJob(this.rootDir, jobId, this.baseUseCases, timezone);
    const changes = await this.reloadSchedule(before);
    this.publishScheduleChange(changes);
    return { removed: result.removed };
  },

  /** Send a schedule mutation to SSE clients and local scheduler subscribers. */

  publishScheduleChange(this: Host, changes: { added: string[]; removed: string[] }): void {
    const event = {
      type: 'jobs_changed' as const,
      at: new Date().toISOString(),
      added: changes.added,
      removed: changes.removed,
    };
    if (this.scheduler) this.scheduler.publishEvent(event);
    else this.broadcastScheduleEvent(event);
  },

  /** Re-read both TOML files after an S3 mutation and reconcile live state. */

  async reloadSchedule(this: Host, previousIds: string[]): Promise<{ added: string[]; removed: string[] }> {
    const loaded = await loadScheduleConfig(this.rootDir, this.baseUseCases);
    return this.activateSchedule(loaded, previousIds);
  },

  /**
   * F5 preflight — the LLM policy is advisory and can only narrow the step set.
   * Mutating steps are staged as approval requests instead of being executed.
   */

  async runPolicy(this: Host, ctx: JobExecutionContext): Promise<PreflightResult> {
    if (!this.policyAgent || !this.approvalStore) return { run: true };

    const stepIndices = ctx.job.steps ?? ctx.useCase.steps.map((_step, index) => index);
    const stepDetails: PolicyStep[] = stepIndices.map((index) => {
      const def = ctx.useCase.steps[index] as
        | { scriptId?: string; title?: string; defaultArgs?: Record<string, unknown> }
        | undefined;
      // Same precedence as useCaseRunner: step defaults, then job overrides.
      // Arg-aware rules (e.g. docs_wiki_drift --check) need the resolved values.
      const args: Record<string, unknown> = { ...(def?.defaultArgs ?? {}), ...ctx.job.args };
      return {
        index,
        scriptId: def?.scriptId,
        title: def?.title,
        args,
        mutating: isMutatingScript(def?.scriptId, args),
      };
    });
    const decision = await this.policyAgent.decide({
      jobId: ctx.job.id,
      role: ctx.job.role,
      useCaseId: ctx.job.useCaseId,
      project: ctx.job.project,
      trigger: ctx.trigger,
      steps: stepDetails,
      lastStatus: this.scheduler?.getStatus().jobs.find((job: any) => job.job.id === ctx.job.id)?.state.last_status,
      lastError: this.scheduler?.getStatus().jobs.find((job: any) => job.job.id === ctx.job.id)?.state.last_error,
      consecutiveFailures:
        this.scheduler?.getStatus().jobs.find((job: any) => job.job.id === ctx.job.id)?.state.consecutive_failures ?? 0,
      event: ctx.event?.type,
    });
    ctx.notify({
      type: 'policy_decision',
      jobId: ctx.job.id,
      action: decision.action,
      rationale: decision.rationale,
      sources: decision.sources,
      at: decision.at,
    });

    if (decision.action !== 'skip' && decision.mutatingSteps.length > 0) {
      const approvalIds: string[] = [];
      const scriptIds: string[] = [];
      for (const stepIndex of decision.mutatingSteps) {
        const def = ctx.useCase.steps[stepIndex] as
          | { scriptId?: string; title?: string; defaultArgs?: Record<string, unknown> }
          | undefined;
        // S2: the reviewer must see the exact invocation, not only the script id.
        const args: Record<string, unknown> = { ...(def?.defaultArgs ?? {}), ...ctx.job.args };
        if (def?.scriptId) scriptIds.push(def.scriptId);
        const request = await this.approvalStore.stage({
          jobId: ctx.job.id,
          useCaseId: ctx.job.useCaseId,
          project: ctx.job.project,
          stepIndex,
          jobKind: ctx.job.jobKind ?? 'use_case',
          scriptId: def?.scriptId,
          scriptArgs: ctx.job.jobKind === 'script'
            ? redactValue(args) as Record<string, unknown>
            : undefined,
          title: def?.title,
          trigger: ctx.trigger,
          event: ctx.event?.type,
          rationale: decision.rationale,
          sources: decision.sources,
        });
        approvalIds.push(request.id);
      }
      ctx.notify({
        type: 'approval_required',
        jobId: ctx.job.id,
        approvalIds,
        steps: decision.mutatingSteps,
        jobKind: ctx.job.jobKind ?? 'use_case',
        ...(scriptIds.length > 0 ? { scriptIds } : {}),
        rationale: decision.rationale,
        sources: decision.sources,
        at: new Date().toISOString(),
      });
    }

    return {
      run: decision.steps.length > 0,
      steps: decision.steps,
      reason: decision.steps.length > 0 ? undefined : decision.rationale,
    };
  },

  /** F5: decisions remain readable even after the scheduler/policy is stopped. */

  async readDecisionLog(this: Host, options: { jobId?: string; limit?: number } = {}): Promise<unknown[]> {
    if (this.policyAgent) return this.policyAgent.readDecisions(options);
    const logPath = path.join(
      this.rootDir,
      this.schedulerConfig?.logDir ?? 'output/scheduler',
      'decisions.jsonl'
    );
    try {
      const lines = (await fs.readFile(logPath, 'utf-8')).split(/\r?\n/).filter(Boolean);
      const entries = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((entry) => entry !== null)
        .filter((entry) => !options.jobId || (entry as any).jobId === options.jobId)
        .reverse();
      return entries.slice(0, Math.min(Math.max(options.limit ?? 50, 1), 500));
    } catch {
      return [];
    }
  },

  /** F6 watcher hook: called after a note is created through the API. */

  publishNoteCreated(this: Host, projectId: string, notePath: string): void {
    this.eventBus?.publish({
      type: 'note.created',
      project: projectId,
      path: notePath,
      source: 'watcher',
    });
  },

  /** A2: an existing note changed through an API write (save or apply-edit). */

  publishNoteModified(this: Host, projectId: string, notePath: string): void {
    this.eventBus?.publish({
      type: 'note.modified',
      project: projectId,
      path: notePath,
      source: 'watcher',
    });
  },

  /** A2: a markdown note was moved to the recoverable trash through the API. */

  publishNoteDeleted(this: Host, projectId: string, notePath: string): void {
    this.eventBus?.publish({
      type: 'note.deleted',
      project: projectId,
      path: notePath,
      source: 'watcher',
    });
  },

  /** F6: execute a withheld mutating step only after explicit human approval. */

  async decideApproval(this: Host,
    approvalId: string,
    decision: 'approved' | 'rejected',
    reviewer: string = 'human',
    reason?: string,
    principal?: Principal
  ): Promise<{ approval: ApprovalRequest | undefined; error?: string }> {
    // B5: strict mode ignores the client reviewer and binds every written
    // field to the server-derived Principal. Legacy mode keeps the raw value.
    const actor = this.strictProvenance
      ? canonicalActor(principal?.actor, PROCESS_FALLBACK_ACTOR)
      : reviewer;
    const store = this.approvalStore;
    if (!store) return { approval: undefined, error: 'Scheduler non avviato' };
    const request = await store.get(approvalId);
    if (!request) return { approval: undefined, error: `Unknown approval '${approvalId}'` };
    if (request.status !== 'pending' && request.status !== 'failed') {
      return { approval: request, error: `Approval '${approvalId}' is ${request.status}` };
    }
    if (decision === 'rejected') {
      return { approval: await store.update(approvalId, { status: 'rejected', decidedBy: actor, reason }) };
    }

    // S2: script jobs run through one-step synthetic Use Cases, so the approval
    // must resolve the combined registry (not only the static KE catalog).
    const useCase = this.scheduledUseCases[request.useCaseId] ?? KE_USE_CASES[request.useCaseId];
    const job = this.scheduler?.getStatus().jobs.find((item: any) => item.job.id === request.jobId)?.job;
    if (!useCase || !job) {
      return { approval: undefined, error: `Use Case or job not available for '${approvalId}'` };
    }
    const stepDef = useCase.steps[request.stepIndex];
    if (!stepDef) return { approval: undefined, error: `Unknown step ${request.stepIndex}` };

    try {
      // Snapshot every wiki note before a human-authorised mutation.
      const projectRoot = await this.resolveProjectRoot(request.project);
      const wikiDir = path.join(projectRoot, 'wiki');
      for (const file of await this.listWikiMarkdownFiles(wikiDir)) {
        const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
        const content = await fs.readFile(file, 'utf-8');
        await this.writeReviewSnapshot(request.project, rel, content, `approvazione ${approvalId}`);
      }

      // Fase 76: the program-change apply step is mutating and can only run
      // with an explicit actor. `decideApproval` is reached exclusively from
      // the F6 endpoint, so inject the reviewer and the confirmation flag
      // here; a direct run of the Use Case cannot supply them.
      // B5: in strict mode the actor is server-trusted; a process principal is
      // accepted by the Python script only with the injected F6-only flag.
      const isProgramApply = stepDef.scriptId === 'wiki_program_change_apply';
      const injectedActor = this.strictProvenance
        ? actor
        : /^human:/.test(reviewer) ? reviewer : `human:${reviewer}`;
      // Same precedence as the scheduler/runner: step defaults, then job args.
      // Synthetic script steps carry the resolved defaults; a job override still wins.
      const stepArgs: Record<string, any> = {
        ...((stepDef as { defaultArgs?: Record<string, unknown> }).defaultArgs ?? {}),
        ...(job.args as Record<string, any>),
      };
      const approvedArgs: Record<string, any> = isProgramApply
        ? {
            ...stepArgs,
            reviewer: injectedActor,
            confirm: true,
            ...(this.strictProvenance && actorKind(actor) === 'process'
              ? { allow_process_actor: true }
              : {}),
          }
        : stepArgs;

      const startedAt = new Date();
      const chunks: string[] = [];
      const result = await runUseCase({
        useCase,
        stepIndices: [request.stepIndex],
        args: approvedArgs,
        onEvent: (event) => {
          if (event.type === 'stdout' || event.type === 'stderr') chunks.push(event.text);
        },
        rootDir: this.rootDir,
        projectRoot,
        projectId: request.project,
        pythonCmd: PYTHON_CMD,
        scriptRegistry: SCRIPT_REGISTRY,
        buildCliArgs,
      });
      const endedAt = new Date();
      const failed = result.failedSteps.length > 0;
      const approval = await store.update(approvalId, {
        status: failed ? 'failed' : 'approved',
        decidedBy: actor,
        error: failed ? `failed steps: ${result.failedSteps.join(', ')}` : undefined,
      });
      await this.scheduler?.recordApprovalRun({
        job: request.jobId,
        useCase: request.useCaseId,
        jobKind: request.jobKind ?? 'use_case',
        scriptId: request.scriptId,
        attempt: 1,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        status: failed ? 'failed' : 'success',
        exitCodes: failed ? [1] : [0],
        failedSteps: result.failedSteps,
        error: failed ? `failed steps: ${result.failedSteps.join(', ')}` : undefined,
        actor: this.strictProvenance ? actorKind(actor) : 'human',
        approvalId,
        approvedBy: actor,
        steps: [request.stepIndex],
      });
      return failed
        ? { approval, error: `failed steps: ${result.failedSteps.join(', ')}` }
        : { approval };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        approval: await store.update(approvalId, { status: 'failed', decidedBy: actor, error }),
        error,
      };
    }
  },

  /** Stop the tick loop, close SSE clients and release the PID lock. */

  async stopScheduler(this: Host, options: { cancelActive?: boolean } = {}): Promise<void> {
    this.eventBus?.stop();
    this.eventBus = undefined;
    if (this.scheduleHeartbeat) {
      clearInterval(this.scheduleHeartbeat);
      this.scheduleHeartbeat = undefined;
    }
    for (const client of this.scheduleClients) client.end();
    this.scheduleClients.clear();
    this.graphEvents.close();
    if (this.scheduler) {
      await this.scheduler.stop(options);
      this.scheduler = undefined;
    }
    this.scheduledUseCases = {};
    this.policyAgent = undefined;
  },

  /** Adapter between the scheduler engine and the shared Use Case runner. */

  async executeScheduledJob(this: Host, ctx: JobExecutionContext): Promise<JobExecutionResult> {
    const useCase = this.scheduledUseCases[ctx.job.useCaseId] ?? KE_USE_CASES[ctx.job.useCaseId];
    if (!useCase) throw new Error(`Unknown Use Case '${ctx.job.useCaseId}'`);
    const projectRoot = await this.resolveProjectRoot(ctx.job.project);

    const result = await runUseCase({
      useCase,
      // Honour the steps narrowed by the F5 policy preflight. Using ctx.job.steps
      // here would silently re-run a mutating step the policy withheld.
      stepIndices: ctx.steps ?? ctx.job.steps,
      args: ctx.job.args as Record<string, any>,
      signal: ctx.signal,
      onEvent: (event) => {
        ctx.onRunnerEvent(event);
        if (event.type === 'stdout' || event.type === 'stderr') {
          ctx.onOutput(event.text);
        } else if (event.type === 'step_start') {
          ctx.onOutput(
            `\n[step ${event.stepNumber}] ${event.title} (${event.script})\n$ ${event.cmd}\n`
          );
        }
      },
      rootDir: this.rootDir,
      projectRoot,
      projectId: ctx.job.project,
      pythonCmd: PYTHON_CMD,
      scriptRegistry: SCRIPT_REGISTRY,
      buildCliArgs,
    });

    if (result.failedSteps.length === 0) {
      await this.runAutonomyAfterJob(ctx, projectRoot);
    }

    return {
      failedSteps: result.failedSteps,
      exitCodes: result.failedSteps.length > 0 ? [1] : [0],
    };
  },

  async runAutonomyAfterJob(this: Host, ctx: JobExecutionContext, projectRoot: string): Promise<void> {
    const config = loadAutonomyConfigSync(this.rootDir);
    if (config.mode === 'off') return;

    const scriptId = ctx.job.scriptId ?? 'orphan_repair';
    const safety = scriptId === 'orphan_repair' ? 'read-only' : getScriptSafety(scriptId);
    try {
      const envelope = collectRepairFindings(
        this.rootDir,
        path.join(projectRoot, 'wiki'),
        'wiki',
        PYTHON_CMD,
      );
      const store = new ChangesetStore(projectRoot, {
        snapshot: async (file, content, reason) => this.writeSnapshotFile(projectRoot, file, content, reason),
      });
      const engine = new AutonomyEngine(this.rootDir, config, store);
      for (const finding of envelope.findings) {
        await engine.process({
          finding,
          scriptId,
          safety,
          stage: await repairFindingToStageInput(finding, projectRoot),
        }, projectRoot);
      }
    } catch (error) {
      ctx.notify({
        type: 'job_output',
        jobId: ctx.job.id,
        text: `[autonomy] ${error instanceof Error ? error.message : String(error)}\n`,
      });
    }
  },

  broadcastScheduleEvent(this: Host, event: SchedulerEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.scheduleClients) {
      try {
        client.write(payload);
      } catch {
        this.scheduleClients.delete(client);
      }
    }
  },

  /** Register an SSE client and keep a single shared keepalive timer. */

  addScheduleClient(this: Host, res: http.ServerResponse): () => void {
    this.scheduleClients.add(res);
    if (!this.scheduleHeartbeat) {
      this.scheduleHeartbeat = setInterval(() => {
        for (const client of this.scheduleClients) {
          try {
            client.write(': keepalive\n\n');
          } catch {
            this.scheduleClients.delete(client);
          }
        }
        if (this.scheduleClients.size === 0 && this.scheduleHeartbeat) {
          clearInterval(this.scheduleHeartbeat);
          this.scheduleHeartbeat = undefined;
        }
      }, 15_000);
      this.scheduleHeartbeat.unref?.();
    }
    return () => {
      this.scheduleClients.delete(res);
    };
  },
};

export type SchedulerMethods = typeof schedulerMethods;
