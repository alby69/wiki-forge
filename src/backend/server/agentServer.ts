import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { MarkdownParser } from '@shared/domain/markdownParser';
import { ensureOkfFrontmatter } from '@shared/domain/okfFrontmatter';
import type { WikiNote } from '@shared/domain/wiki';
import { LlmClient, LlmClientFactory } from './llmClient';
import {
  DocumentMove,
  DocumentRef,
  rewriteDocumentLinks,
  setDocumentTitle,
  slugifyDocumentTitle,
  updateLeadingHeading,
} from './wikiLinks';
import {
  findBacklinks,
  NoteRef,
  ResearchTraceNote,
  ResearchTraceResponse,
  ResearchTraceSource,
  searchNotes,
  suggestRelated,
  toNoteRef,
} from './researchHelpers';
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
} from './studyHelpers';
import {
  buildConsultAnswerNote,
  ConsultAnswerInput,
  validateOkfNote,
} from './researchAnswerNote';
import { runUseCase, UseCaseEvent } from './useCaseRunner';
import {
  JobExecutionContext,
  JobExecutionResult,
  PreflightResult,
  redactValue,
  Scheduler,
  SchedulerEvent,
  TriggerEvent,
} from './scheduler/scheduler';
import {
  buildSyntheticUseCases,
  loadScheduleConfig,
  SchedulerConfig,
  type ScheduleConfigResult,
} from './scheduler/jobStore';
import {
  createScriptJob,
  deleteScriptJob,
  type ScriptScheduleCreateInput,
} from './scheduler/scriptJobStore';
import { isMutatingScript, PolicyAgent, PolicyStep } from './scheduler/policyAgent';
import { ApprovalRequest, ApprovalStore } from './scheduler/approvalStore';
import { EventTriggerBus, isSupportedTriggerEvent } from './scheduler/eventTriggers';
import { EventQueue } from './scheduler/eventQueue';
import { GENERATED_SCRIPT_REGISTRY } from './generated/scriptRegistry.generated';
import { getScriptSafety } from './scheduler/scriptSafety';
import { resolveToolScript } from './toolPaths';
import { atomicWriteFile, listTrash, restoreFromTrash, softDelete, type TrashEntry } from './safeFs';
import {
  ProjectService,
  type CloneProjectOptions,
  type ProjectBundle,
  type ProjectDeleteMode,
  type ProjectEntry,
} from './projectService';
import { ChangesetStore, type ChangesetStatus, type StageChangesetInput } from './changesetStore';
import { AutonomyEngine, loadAutonomyConfigSync } from './autonomy';
import { collectRepairFindings, repairFindingToStageInput } from './orphanRepair';
import { GraphEventHub } from './graphEvents';
import { handleDocsRequest } from './api/docsBrowser';
import {
  correlationIdFor,
  json,
  maxBodyBytes,
  prepareCorrelationId,
  readJsonBody,
  readJsonBodyWithRaw,
  sendApiResult,
  writeApiError,
  writeHttpError,
} from './api/http';
import { corsHeadersFor, corsPolicyFromEnv } from './security/cors';
import { runWithRequestContext } from './observability/context';
import { httpLogger } from './observability/logger';
import { recordHttpRequest, renderPrometheus } from './observability/metrics';
import { getTelemetry } from './observability/telemetry';
import { createValidationMiddleware } from './api/validation';
import { createMessageBus, type MessageBus, type Principal } from './bus/messageBus';
import { authenticateRequest, deriveRequestPrincipal, legacyPrincipal } from './auth/principal';
import { bearerTokenFromRequest, UNAUTHORIZED_MESSAGE, apiTokenFromRequest } from './auth/apiToken';
import { actorKind, canonicalActor, PROCESS_FALLBACK_ACTOR } from './auth/actor';
import { createIdpAdapter, defaultIdpDependencies, type IdpAdapter, type IdpDependencies } from './auth/idp';
import { loadRbacConfigSync, type RbacConfig } from './auth/rbacConfig';
import { createRbacMiddleware } from './auth/rbacMiddleware';
import { buildAuthIdentity } from './auth/identity';
import { UserStore } from './auth/userStore';
import { UiModule } from './auth/uiModule';
import { UiPreferencesStore } from './auth/uiPreferencesStore';
import { createCatalogueModule, type CatalogueModule } from './modules/catalogueModule';
import { createToolsModule, type ToolsModule } from './modules/toolsModule';
import { createReviewModule, type ReviewModule } from './modules/reviewModule';
import { createIngestionModule, type IngestionModule } from './modules/ingestionModule';
import type { GraphModule } from './modules/graphModule';
import { GRAPH_PROXY_PATHS } from './modules/graphProxyModule';
import { createKernel } from '../app/createKernel';
import { portsFromServices } from '../app/ports';
import { UserModule } from './modules/userModule';
import type { DomainServices } from './modules/services';
import type { PythonTool } from './modules/pythonTool';
import { matchRoute } from '../../shared/api/router';
import { ROUTES as API_ROUTES } from '../../shared/api/contracts';

// Backwards-compatible type exports: callers may still import ProjectEntry here.
export type { ProjectBundle, ProjectDeleteMode, ProjectEntry } from './projectService';

import type {
  ChatRequest,
  KEUseCaseDef,
  KEUseCaseStep,
  ScriptArgSafetyRule,
  ScriptAutomation,
  ScriptDef,
  ScriptParamDef,
  ScriptSafety,
} from '@shared/domain/scripts';
export type {
  ChatRequest,
  KEUseCaseDef,
  KEUseCaseStep,
  ScriptArgSafetyRule,
  ScriptAutomation,
  ScriptDef,
  ScriptParamDef,
  ScriptSafety,
} from '@shared/domain/scripts';

export interface ResearchConsultCitation {
  id: string;
  title: string;
  path: string;
}

export interface ResearchConsultResponse {
  success: boolean;
  markdown: string;
  fallback: boolean;
  citations: ResearchConsultCitation[];
  error?: string;
}

export interface ResearchPromoteAnswerResponse {
  success: boolean;
  path?: string;
  validation: string[];
  error?: string;
}

export interface ResearchDeepResearchResult {
  summary: string;
  report: string;
  outputPath: string;
  synthesisPath: string;
  articles: number;
  fallback: boolean;
  error?: string;
}

export interface ResearchDeepResearchResponse {
  success: boolean;
  markdown: string;
  outputPath?: string;
  synthesisPath?: string;
  articles: number;
  fallback: boolean;
  error?: string;
}

export interface StudyOutputResponse {
  success: boolean;
  markdown: string;
  outputPath: string;
  sources: StudySource[];
  error?: string;
}

export interface StudyQuizResponse extends StudyOutputResponse {
  count: number;
}

export interface StudyMindmapResponse extends StudyOutputResponse {
  note?: StudyNoteRef;
  nodes: StudyMindmapNode[];
  links: StudyMindmapLink[];
  headings: number;
  wikilinks: number;
}

export interface StudyQuickNoteResponse {
  success: boolean;
  markdown: string;
  entry?: ScratchpadEntry;
  entries: ScratchpadEntry[];
  error?: string;
}

export interface StudyPromoteResponse {
  success: boolean;
  markdown: string;
  note?: WikiNote;
  error?: string;
}

export interface StudyThesisResponse extends StudyOutputResponse {
  title: string;
  chapters: StudyThesisChapter[];
  syntheses: StudyThesisSynthesis[];
}

/**
 * Resolves the Python interpreter used by the script runners.
 * Prefers `python3`, falls back to `python` (e.g. Windows hosts where the
 * `python3` alias is unavailable). If neither is installed the probe is
 * skipped and `python3` is used so the spawn error stays actionable.
 */
import {
  resolvePythonCommand, PYTHON_CMD, buildCliArgsFromSchema, buildCliArgs, withoutApprovalFlags, SCRIPT_REGISTRY, SCRATCHPAD_INTRO, normalizeScratchpad, parseScratchpad, SaveNoteRequest, AttachNoteRequest, ApplyEditRequest, ScratchpadEntry, DeleteScratchpadRequest, CreateFolderRequest, CreateFileRequest, RenameRequest, MoveRequest, RenameLinkUpdate, RenameResult, DeleteRequest, UploadRequest, IngestRequest, WizardScenario, WIZARD_SCENARIOS, formatWizardList, KE_USE_CASES, formatKeUseCaseList
} from './agentServerCatalogs';
export * from './agentServerCatalogs';

import { schedulerMethods, type SchedulerMethods } from './services/schedulerService';
import { vaultMethods, type VaultMethods } from './services/vaultService';
import { reviewMethods, type ReviewMethods } from './services/reviewService';
import { knowledgeMethods, type KnowledgeMethods } from './services/knowledgeService';
export class AgentServer {
  private parser = new MarkdownParser();
  private rootDir: string;
  private llmClient?: LlmClient;
  private systemPromptCache?: string;
  private scheduler?: Scheduler;
  private schedulerConfig?: SchedulerConfig;
  /** KE Use Cases plus the one-step synthetic entries generated for script jobs. */
  private scheduledUseCases: Record<string, KEUseCaseDef> = {};
  /** Immutable catalog projection; reused on every S3 hot-reload. */
  private readonly baseUseCases: Record<string, KEUseCaseDef> = Object.fromEntries(
    Object.values(KE_USE_CASES).map((useCase) => [
      useCase.id,
      { id: useCase.id, title: useCase.title, steps: useCase.steps },
    ])
  ) as Record<string, KEUseCaseDef>;
  private policyAgent?: PolicyAgent;
  private approvalStore?: ApprovalStore;
  private eventBus?: EventTriggerBus;
  private scheduleConfigErrors: string[] = [];
  private readonly scheduleClients = new Set<http.ServerResponse>();
  private scheduleHeartbeat?: NodeJS.Timeout;
  private readonly graphEvents = new GraphEventHub();
  private readonly projects: ProjectService;
  private readonly rbacConfig: RbacConfig;
  private readonly corsPolicy = corsPolicyFromEnv();
  private readonly telemetry = getTelemetry();
  private readonly strictProvenance: boolean;
  /** B6 — absent unless `[enterprise.auth].provider` is configured. */
  private readonly idp?: IdpAdapter;
  private readonly userStore: UserStore;
  private readonly uiStore: UiPreferencesStore;
  private readonly bus: MessageBus;
  private readonly catalogue: CatalogueModule;
  private readonly tools: ToolsModule;
  private readonly reviews: ReviewModule;
  private readonly ingestion: IngestionModule;
  private readonly graph: GraphModule;

  constructor(
    rootDir: string = process.cwd(),
    llmClient?: LlmClient,
    idpAdapter?: IdpAdapter,
    idpDependencies?: IdpDependencies,
  ) {
    this.rootDir = rootDir;
    this.llmClient = llmClient;
    this.projects = new ProjectService(rootDir);
    this.rbacConfig = loadRbacConfigSync(rootDir);
    this.strictProvenance = this.rbacConfig.enabled;
    // B6 — the IdP shares the B3 opt-in flag: `enable_rbac=false` keeps every
    // legacy response byte-identical even if a provider was pre-configured.
    // Adapter creation is pure/config-only; discovery/JWKS/metadata are fetched
    // lazily on the first verified request, never at startup.
    this.idp = this.rbacConfig.enabled
      ? idpAdapter ?? createIdpAdapter(
          this.rbacConfig.auth,
          this.rbacConfig.roles,
          idpDependencies ?? defaultIdpDependencies(),
        )
      : undefined;
    this.userStore = new UserStore({ rootDir });
    this.bus = createMessageBus();
    // B3 — opt-in gate. With `enable_rbac=false` this middleware returns
    // `undefined` on every dispatch, so the legacy behaviour is byte-identical.
    // The catalogue is read once at construction; no connection is opened.
    this.bus.use(createRbacMiddleware(this.rbacConfig));
    this.bus.use(createValidationMiddleware());
    // B7 — identity introspection. The gateway injects `authenticated` after a
    // best-effort credential check; the actor itself is always server-derived.
    this.bus.register<{ authenticated?: boolean }>('auth.me', (payload, context) => {
      const principal = context.principal ?? legacyPrincipal();
      return json({
        success: true,
        auth: buildAuthIdentity(principal, payload.authenticated === true, {
          rbacEnabled: this.rbacConfig.enabled,
          strict: this.strictProvenance,
          idpConfigured: Boolean(this.idp),
          userStoreConfigured: this.userStore.isEnabledSync(),
        }),
      });
    });
    const userModule = new UserModule({
      store: this.userStore,
      rbac: this.rbacConfig,
      idpConfigured: Boolean(this.idp),
      strict: this.strictProvenance,
    });
    userModule.register(this.bus);
    this.uiStore = new UiPreferencesStore({ rootDir });
    new UiModule({ rbac: this.rbacConfig, store: this.uiStore }).register(this.bus);
    this.catalogue = createCatalogueModule(rootDir);
    this.catalogue.register(this.bus);
    this.tools = createToolsModule(SCRIPT_REGISTRY, KE_USE_CASES);
    this.tools.register(this.bus);
    this.reviews = createReviewModule((projectId) => this.resolveProjectRoot(projectId));
    this.reviews.register(this.bus);

    const pythonTool: PythonTool = {
      resolveRoot: (projectId) => this.resolveProjectRoot(projectId),
      pathFor: (relativePath) => resolveToolScript(this.rootDir, relativePath),
      pythonCmd: PYTHON_CMD,
    };
    this.ingestion = createIngestionModule(pythonTool);
    this.ingestion.register(this.bus);

    const jsonRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
    const services: DomainServices = {
      bus: this.bus,
      projects: this.projects,
      isStrictProvenance: () => this.strictProvenance,
      provenanceActor: (principal, rawActor) => this.provenanceActorFor(principal, rawActor),
      changesets: async (projectId) => new ChangesetStore(await this.resolveProjectRoot(projectId), {
        // A3 — every changeset write gets a pre-write snapshot for the Review
        // Studio diff/restore flow. Best-effort: a snapshot failure never blocks apply.
        snapshot: async (file, content, reason) => {
          const projectRoot = await this.resolveProjectRoot(projectId);
          return this.writeSnapshotFile(projectRoot, file, content, reason);
        },
      }),
      rootDir: this.rootDir,
      registry: SCRIPT_REGISTRY,
      useCases: KE_USE_CASES as unknown as Record<string, unknown>,
      pythonTool,
      resolveRoot: (projectId) => this.resolveProjectRoot(projectId),
      buildCliArgs: (scriptDef, args) => buildCliArgs(scriptDef, args),
      withoutApprovalFlags: (args) => withoutApprovalFlags(args),

      readAllWikiNotes: (projectId) => this.readAllWikiNotes(projectId),
      readScratchpadEntries: (projectId) => this.readScratchpadEntries(projectId),
      deleteScratchpadEntry: (id, projectId) => this.deleteScratchpadEntry(id, projectId),
      getAllFolders: (projectId) => this.getAllFolders(projectId),
      saveWikiNote: (data, projectId) => this.saveWikiNote(data as any, projectId),
      applyWikiEdit: (data, projectId) => this.applyWikiEdit(data as any, projectId),
      attachToNote: (data, projectId) => this.attachToNote(data as any, projectId),
      createFolderHandler: (data, projectId) => this.createFolderHandler(data as any, projectId),
      createFileHandler: (data, projectId) => this.createFileHandler(data as any, projectId),
      renameHandler: (data, projectId) => this.renameHandler(data as any, projectId),
      moveHandler: (data, projectId) => this.moveHandler(data as any, projectId),
      deleteHandler: (data, projectId) => this.deleteHandler(data as any, projectId),
      uploadHandler: (data, projectId) => this.uploadHandler(data as any, projectId),
      ingestMarkdownHandler: (data, projectId) => this.ingestMarkdownHandler(data as any, projectId),
      listTrash: async (projectId) => listTrash(await this.resolveProjectRoot(projectId)),
      restoreTrash: async (id, projectId) => restoreFromTrash(await this.resolveProjectRoot(projectId), id),
      downloadFile: async (filePath, projectId) => {
        const projRoot = await this.resolveProjectRoot(projectId);
        const absPath = path.resolve(projRoot, filePath);
        return { filename: path.basename(absPath), data: await fs.readFile(absPath) };
      },
      publishNoteCreated: (projectId, notePath) => this.publishNoteCreated(projectId, notePath),

      getReviewMeta: (noteRef, projectId) => this.getReviewMeta(noteRef, projectId).then(jsonRecord),
      recordHumanVerification: (options, principal) =>
        this.recordHumanVerification({ ...options, principal } as any).then(jsonRecord),
      getReviewDigest: (projectId, days, scope, noteRef) =>
        this.getReviewDigest(projectId, days, scope as any, noteRef).then(jsonRecord),
      critiqueNote: (options) => this.critiqueNote(options as any).then(jsonRecord),
      listReviewSnapshots: (noteRef, projectId) => this.listReviewSnapshots(noteRef, projectId).then((rows) => rows.map(jsonRecord)),
      getReviewDiff: (noteRef, snapshotId, projectId) =>
        this.getReviewDiff(noteRef, snapshotId, projectId).then(jsonRecord),
      restoreReviewSnapshot: (noteRef, snapshotId, projectId) =>
        this.restoreReviewSnapshot(noteRef, snapshotId, projectId),

      resolveReviewTarget: (noteRef, notes) => this.resolveReviewTarget(noteRef, notes),
      traceClaim: (query, projectId) => this.traceClaim(query, projectId).then(jsonRecord),
      consultWiki: (question, projectId) => this.consultWiki(question, projectId).then(jsonRecord),
      promoteConsultAnswer: (input, projectId) => this.promoteConsultAnswer(input as any, projectId).then(jsonRecord),
      generateDeepResearch: (question, projectId) => this.generateDeepResearch(question, projectId).then(jsonRecord),

      generateStudyGuide: (topic, projectId) => this.generateStudyGuide(topic, projectId).then(jsonRecord),
      generateQuiz: (topic, count, projectId) => this.generateQuiz(topic, count, projectId).then(jsonRecord),
      generateMindmap: (target, projectId) => this.generateMindmap(target, projectId).then(jsonRecord),
      generateAudioOverview: (topic, projectId) => this.generateAudioOverview(topic, projectId).then(jsonRecord),
      addQuickNote: (text, projectId) => this.addQuickNote(text, projectId).then(jsonRecord),
      promoteQuickNote: (noteId, folder, projectId) => this.promoteQuickNote(noteId, folder, projectId).then(jsonRecord),
      generateThesisChapter: (input, projectId) => this.generateThesisChapter(input as any, projectId).then(jsonRecord),

      processChatCommand: (req, projectId, principal) => this.processChatCommand(req, projectId, principal),
      processChatCommandStream: (req, onChunk, projectId, principal) =>
        this.processChatCommandStream(req, onChunk, projectId, principal),

      getScheduler: () => this.scheduler,
      getSchedulerConfig: () => this.schedulerConfig as unknown as Record<string, unknown> | null,
      getScheduleErrors: () => this.scheduleConfigErrors,
      getEventBus: () => this.eventBus,
      getApprovalStore: () => this.approvalStore,
      readDecisionLog: async (options) => (await this.readDecisionLog(options)).map(jsonRecord),
      decideApproval: async (approvalId, decision, reviewer, reason, principal) => {
        const result = await this.decideApproval(approvalId, decision, reviewer, reason, principal);
        return { approval: result.approval ? jsonRecord(result.approval) : undefined, error: result.error };
      },
      addScheduleClient: (res) => this.addScheduleClient(res),
      snapshotStatus: () => (this.scheduler?.getStatus() as unknown as Record<string, unknown> | undefined) ?? null,
      createScriptJob: (input) => this.createScriptJob(input),
      deleteScriptJob: (jobId) => this.deleteScriptJob(jobId),
    };

    const kernel = createKernel({
      bus: this.bus,
      ports: portsFromServices(services),
      pythonTool,
      graphEvents: this.graphEvents,
    });
    this.graph = kernel.graph;
  }

  /** Backend components communicate through this bus (additive public accessor). */
  public getBus(): MessageBus {
    return this.bus;
  }

  /** B5 — strict provenance is active only with `enterprise.enable_rbac=true`. */
  public isStrictProvenance(): boolean {
    return this.strictProvenance;
  }

  /**
   * B5 — resolve the actor written by a bus command.
   *
   * Legacy mode preserves the old raw-body behaviour exactly. Strict mode
   * ignores `rawActor` and always uses the server-derived Principal, falling
   * back to the canonical process actor if the principal is absent/malformed.
   */
  public provenanceActorFor(principal?: Principal, _rawActor?: string): string {
    if (this.strictProvenance) return canonicalActor(principal?.actor, PROCESS_FALLBACK_ACTOR);
    if (principal?.actor && actorKind(principal.actor) === 'human') {
      return canonicalActor(principal.actor);
    }
    return canonicalActor(`human:${process.env.WIKIFORGE_LOCAL_ACTOR?.trim() || 'local'}`);
  }

  private proxyTransportFields(req: http.IncomingMessage, url: URL): Record<string, unknown> {
    const headers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers[key] = value;
    }
    return { method: req.method ?? 'POST', search: url.search, headers };
  }

  /** Dispatch a catalogue command and write its transport-neutral result. */
  private async dispatchApiCommand(
    command: string,
    payload: unknown,
    projectId: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    principal?: Principal,
  ): Promise<boolean> {
    if (!this.bus.has(command)) return false;
    // B1: a body field named `principal` must never reach handlers as if it
    // were the server-derived identity. Other body fields are untouched so
    // legacy payloads and envelopes stay byte-identical.
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      delete (payload as Record<string, unknown>).principal;
    }
    const result = await this.bus.dispatch(command, payload, {
      rootDir: this.rootDir,
      projectId,
      operationId: command,
      correlationId: correlationIdFor(res),
      principal: principal ?? deriveRequestPrincipal(req),
      onClose: (handler) => { req.on('close', handler); },
    });
    sendApiResult(res, result);
    return true;
  }

  // ---------------------------------------------------------------- scheduler

  public getConfigPath(dir: string): string {
    return this.projects.getConfigPath(dir);
  }

  public getProjectsJsonPath(): string {
    return this.projects.getProjectsJsonPath();
  }

  public async getWikiDir(projectId: string = 'default'): Promise<string> {
    const projRoot = await this.resolveProjectRoot(projectId);
    return path.join(projRoot, 'wiki');
  }

  public async getRawDir(projectId: string = 'default'): Promise<string> {
    const projRoot = await this.resolveProjectRoot(projectId);
    return path.join(projRoot, 'raw');
  }

  /**
   * Returns the single script registry, generated from the Python SSOT by
   * `scripts/gen_script_registry.py`. Keeping the method async preserves the
   * existing call sites; there is no longer a per-script `--json-schema`
   * probe (29 subprocesses on first request) nor a second hand-written copy
   * that could drift from `SCRIPT_SCHEMAS`.
   */
  public async fetchDynamicScriptRegistry(): Promise<Record<string, ScriptDef>> {
    return SCRIPT_REGISTRY;
  }

  public setLlmClient(client: LlmClient): void {
    this.llmClient = client;
  }

  private async getOrInitLlmClient(): Promise<LlmClient> {
    if (!this.llmClient) {
      const configPath = this.getConfigPath(this.rootDir);
      const { client } = await LlmClientFactory.createFromTomlFile(configPath);
      this.llmClient = client;
    }
    return this.llmClient;
  }

  /**
   * The repository root `AGENT.md` is often just a one-line pointer to the
   * real operating manual (e.g. `docs/AGENT.md`). Following the pointer makes
   * the manual actually reach the LLM instead of the bare pointer string.
   */
  private async resolveAgentManual(content: string): Promise<string> {
    const trimmed = content.trim();
    if (!trimmed || /\s/.test(trimmed)) return content;
    if (!/\.md$/i.test(trimmed) || trimmed.includes(':')) return content;
    const candidate = path.resolve(this.rootDir, trimmed);
    const rel = path.relative(this.rootDir, candidate);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return content;
    try {
      const resolved = await fs.readFile(candidate, 'utf-8');
      return resolved.trim() ? resolved : content;
    } catch (_e) {
      return content;
    }
  }

  public async getSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache;
    }

    let agentMd = '';
    try {
      agentMd = await fs.readFile(path.join(this.rootDir, 'AGENT.md'), 'utf-8');
      agentMd = await this.resolveAgentManual(agentMd);
    } catch (_e) {
      agentMd = 'You are the librarian of a personal knowledge base (an LLM Wiki). Synthesize answers from wiki notes in Markdown with [[wikilinks]].';
    }

    let projectContext = '';
    try {
      const configPath = this.getConfigPath(this.rootDir);
      const { projectContext: ctx, projectTitle } = await LlmClientFactory.createFromTomlFile(configPath);
      if (projectTitle || ctx) {
        projectContext = `Project Title: ${projectTitle}\nProject Context: ${ctx}\n\n`;
      }
    } catch (_e) {
      // Ignore
    }

    this.systemPromptCache = `${projectContext}=== OPERATING MANUAL (AGENT.md) ===\n${agentMd}${this.getEditProtocol()}`;
    return this.systemPromptCache;
  }

  /**
   * Protocol appended to every system prompt so agents propose file changes in
   * a machine-readable form the UI can apply deterministically (see
   * /api/wiki/apply-edit). Without it, edits live only in the chat as prose and
   * a confirmation like "sì, procedi" cannot be turned into a file write.
   */
  private getEditProtocol(): string {
    return [
      '',
      '=== EDIT PROPOSAL PROTOCOL ===',
      'When you propose a concrete change to an existing wiki note and you expect the user to confirm it, include ONE fenced block per change, in exactly this format:',
      '',
      '```wiki-edit',
      'file: capitoli/01-introduzione.md',
      'find: |',
      '  <exact text currently present in the file, copied verbatim>',
      'replace: |',
      '  <the new text>',
      '```',
      '',
      'Rules:',
      '- `file` is the note path relative to the wiki directory (e.g. `capitoli/01-introduzione.md`).',
      '- `find` MUST be copied verbatim from the file and MUST match exactly once; include enough surrounding lines to be unique.',
      '- The user can approve with a short reply (e.g. "sì, procedi"); on approval the system applies the block deterministically.',
      '- Never claim you already modified the file: propose the block and wait for confirmation.',
      '- If you only answer a question, do NOT emit a wiki-edit block.',
    ].join('\n');
  }

  private parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolve(body ? (JSON.parse(body) as T) : ({} as T));
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * B0–B5 used only the shared token here; B6 keeps the same 401 envelope but
   * lets the configured IdP produce a verified Principal. No network call is
   * made unless an IdP is explicitly configured.
   */
  private authenticate(req: http.IncomingMessage) {
    return authenticateRequest(req, this.idp, process.env, this.userStore);
  }

  private getProjectIdFromRequest(req: http.IncomingMessage, url: URL): string {
    const headerVal = req.headers['x-project-id'];
    if (typeof headerVal === 'string' && headerVal.trim()) {
      return headerVal.trim();
    }
    const queryVal = url.searchParams.get('projectId');
    if (queryVal && queryVal.trim()) {
      return queryVal.trim();
    }
    return 'default';
  }

  /** Compatibility helper: internal callers historically saw every registry entry. */
  public async getProjects(): Promise<ProjectEntry[]> {
    return this.projects.list({ includeArchived: true });
  }

  public async saveProjects(projects: ProjectEntry[]): Promise<void> {
    await this.projects.saveProjects(projects);
  }

  public async resolveProjectRoot(projectId: string = 'default'): Promise<string> {
    return this.projects.resolveRoot(projectId);
  }

  public async createProject(id: string, name: string): Promise<ProjectEntry> {
    return this.projects.create(id, name);
  }

  /**
   * Legacy signature kept for ApiStorage. `deleteFolder=true` used to mean an
   * irreversible rm; it now maps to the recoverable trash mode.
   */
  public async deleteProject(id: string, deleteFolder: boolean = false): Promise<void> {
    await this.projects.remove(id, deleteFolder ? 'trash' : 'unregister');
  }

  public renameProject(id: string, name: string) {
    return this.projects.rename(id, name);
  }

  public cloneProject(sourceId: string, options: CloneProjectOptions) {
    return this.projects.clone(sourceId, options);
  }

  public archiveProject(id: string) {
    return this.projects.archive(id);
  }

  public restoreProject(id: string) {
    return this.projects.restore(id);
  }

  public exportProject(id: string) {
    return this.projects.export(id);
  }

  public importProject(bundle: ProjectBundle | string | Buffer) {
    return this.projects.import(bundle);
  }

  public getProjectStats(id: string) {
    return this.projects.stats(id);
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<boolean> {
    const correlationId = prepareCorrelationId(res);
    const tracer = this.telemetry.trace.getTracer('wikiforge.http', '1.0.0');
    const startedAt = Date.now();
    return tracer.startActiveSpan('wikiforge.http.request', {
      attributes: {
        'http.method': req.method ?? 'GET',
        'http.target': req.url ?? '/',
        'wikiforge.correlation_id': correlationId,
      },
    }, async (span) => {
      let handled = false;
      try {
        handled = await runWithRequestContext(
          { correlationId },
          () => this.handleRequestCore(req, res, correlationId),
        );
        return handled;
      } catch (err) {
        span.recordException(err);
        if (!res.headersSent) writeHttpError(res, err, correlationId);
        return true;
      } finally {
        const status = res.statusCode || 500;
        const durationMs = Date.now() - startedAt;
        const outcome = status >= 500 ? 'server_error' : status >= 400 ? 'client_error' : 'success';
        span.setAttribute('http.response.status_code', status);
        span.setAttribute('http.request.duration_ms', durationMs);
        span.setAttribute('wikiforge.outcome', outcome);
        span.end();
        recordHttpRequest({ method: req.method ?? 'GET', status, outcome, durationMs });
        httpLogger.info('http.request', {
          method: req.method ?? 'GET',
          path: req.url ?? '/',
          status,
          durationMs,
          outcome,
          handled,
        });
      }
    });
  }

  private async handleRequestCore(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    correlationId: string,
  ): Promise<boolean> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const projectId = this.getProjectIdFromRequest(req, url);

    // CORS preflight is public on every route, graph proxy included. It must
    // be answered before the token check or browsers could never call the API.
    for (const [name, value] of Object.entries(corsHeadersFor(req, this.corsPolicy))) {
      res.setHeader(name, value);
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    const limit = maxBodyBytes();
    const declaredLength = Number(req.headers['content-length'] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > limit) {
      req.resume();
      writeApiError(res, `Request body too large: limit is ${limit} bytes`, 413, correlationId, {
        code: 'body_too_large',
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/healthz') {
      sendApiResult(res, json({
        success: true,
        status: 'ok',
        uptimeSeconds: process.uptime(),
        correlationId,
      }));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/readyz') {
      try {
        await fs.access(this.rootDir);
        sendApiResult(res, json({
          success: true,
          status: 'ok',
          checks: { filesystem: 'ok' },
          correlationId,
        }));
      } catch (err) {
        writeApiError(res, `Not ready: ${String(err)}`, 503, correlationId);
      }
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(renderPrometheus());
      return true;
    }

    // Documentation is public (the browser injects a token for "Try it out").
    if (await handleDocsRequest(req, res, pathname)) return true;

    // B7 — identity introspection is the only additive public data route: it
    // lets the browser discover whether sign-in exists before it has a token.
    // It exposes no privileged data; a *supplied* invalid credential is still
    // rejected with the exact B0 envelope, so no auth bypass is introduced.
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const hasCredential = Boolean(
        bearerTokenFromRequest(req) || apiTokenFromRequest(req),
      );
      if (!hasCredential) {
        return this.dispatchApiCommand('auth.me', { authenticated: false }, projectId, req, res);
      }
      const viewed = await this.authenticate(req);
      if (!viewed.ok) {
        writeApiError(res, UNAUTHORIZED_MESSAGE, 401, correlationId);
        return true;
      }
      return this.dispatchApiCommand(
        'auth.me', { authenticated: true }, projectId, req, res, viewed.principal,
      );
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      let body: Record<string, unknown>;
      try {
        body = await readJsonBody<Record<string, unknown>>(req);
      } catch (err) {
        writeHttpError(res, err, correlationId);
        return true;
      }
      return this.dispatchApiCommand('auth.login', { ...body, body }, projectId, req, res);
    }

    // B4/B6 — authenticate BEFORE any other ingress, the FastAPI graph proxy
    // included. Missing/invalid tokens always get the exact B0 envelope.
    const authentication = await this.authenticate(req);
    if (!authentication.ok) {
      writeApiError(res, UNAUTHORIZED_MESSAGE, 401, correlationId);
      return true;
    }

    const legacyGraphProxyCommand = GRAPH_PROXY_PATHS[pathname];
    if (req.method === 'GET' && legacyGraphProxyCommand) {
      return this.dispatchApiCommand(
        legacyGraphProxyCommand,
        this.proxyTransportFields(req, url),
        projectId,
        req,
        res,
        authentication.principal,
      );
    }

    // Every catalogue operation whose command is registered on the bus is now
    // an HTTP-neutral dispatch. The adapter only translates transport details
    // (path/query/body/headers) into a flat payload and writes the ApiResult.
    const catalogueMatch = matchRoute(API_ROUTES, req.method ?? '', pathname);
    if (catalogueMatch && this.bus.has(catalogueMatch.route.command)) {
      const payload: Record<string, unknown> = {};
      const isGraphProxy = Object.values(GRAPH_PROXY_PATHS).some(
        (command) => command === catalogueMatch.route.command,
      );
      for (const [key, value] of url.searchParams) payload[key] = value;
      for (const header of catalogueMatch.route.request.headers ?? []) {
        const value = req.headers[header.name.toLowerCase()];
        if (value !== undefined) payload[header.name] = value;
      }
      const accept = req.headers.accept ?? '';
      if (accept.includes('text/event-stream')) payload.stream = true;
      if (catalogueMatch.route.request.body) {
        try {
          const parsed = await readJsonBodyWithRaw(req);
          Object.assign(payload, parsed.body);
          payload.body = parsed.body;
          if (isGraphProxy) payload.bodyText = parsed.raw;
        } catch (err) {
          writeHttpError(res, err, correlationId);
          return true;
        }
      }
      // Path parameters are authoritative: a body field named `id` (e.g. the
      // new project id on clone) must never shadow the source `:id` in the URL.
      Object.assign(payload, catalogueMatch.params);
      if (await this.dispatchApiCommand(
        catalogueMatch.route.command,
        payload,
        projectId,
        req,
        res,
        authentication.principal,
      )) return true;
    }

    // All catalogue routes are dispatched to domain modules through the bus.
    return false;
  }
}

export interface AgentServer extends SchedulerMethods, VaultMethods, ReviewMethods, KnowledgeMethods {}
Object.assign(AgentServer.prototype, schedulerMethods, vaultMethods, reviewMethods, knowledgeMethods);
