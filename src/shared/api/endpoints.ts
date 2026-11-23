/**
 * Typed endpoint map derived from the declarative catalogue (`contracts.ts`).
 *
 * `ROUTES` remains the single source of truth for paths, methods and payload
 * schemas; this module only attaches TypeScript request/response shapes to
 * every stable operation id. The compile-time assertion at the bottom fails
 * when a route is added to the catalogue without a corresponding entry here.
 */

import type {
  ApprovalRequestDto,
  AuthIdentityDto,
  ChangesetDto,
  ChangesetEditDto,
  HelpTopicDto,
  PolicyDecisionDto,
  ProjectBundleDto,
  ProjectEntryDto,
  ProjectStatsDto,
  SchedulerJobDto,
  SchedulerStatusDto,
  ScratchpadEntryDto,
  ScriptDefDto,
  SkillDto,
  TrashEntryDto,
  UseCaseDefDto,
} from './types';
import type {
  ResearchBacklinksResponse,
  ResearchConsultCitation,
  ResearchConsultResponse,
  ResearchDeepResearchResponse,
  ResearchPromoteAnswerResponse,
  ResearchRelatedResponse,
  ResearchSearchResponse,
  ResearchTraceResponse,
} from '@frontend/core/types/research';
import type {
  ReviewCritiqueResponse,
  ReviewDiffResponse,
  ReviewDigest,
  ReviewMetaResponse,
  ReviewSnapshot,
  ReviewVerifyResponse,
} from '@frontend/core/types/review';
import type {
  StudyMindmapResponse,
  StudyOutputResponse,
  StudyPromoteResponse,
  StudyQuickNoteResponse,
  StudyQuizResponse,
  StudyThesisResponse,
} from '@frontend/core/types/study';
import type { RenameResult, WikiNote } from '@frontend/core/types/wiki';
import type { EndpointId } from './contracts';

/** Generic transport request. Path params, query params and JSON body. */
export interface ApiRequest<
  P = Record<string, string | number>,
  Q = Record<string, string | number | boolean | undefined>,
  B = unknown,
> {
  params?: P;
  query?: Q;
  body?: B;
  headers?: Record<string, string>;
}

/** Request for an endpoint that takes no params, query or body (`{}` is valid). */
export type EmptyRequest = ApiRequest<Record<string, never>, Record<string, never>, never>;

type Json = Record<string, unknown>;
type Ok<T extends Json = Record<string, never>> = { success: boolean } & T;
type EmptyParams = Record<string, never>;
type EmptyQuery = Record<string, never>;

/** Request helpers that turn the populated section into a required property. */
type WithParams<P extends Record<string, string | number>> =
  ApiRequest<P, EmptyQuery, never> & { params: P };
type WithQuery<Q extends Record<string, string | number | boolean | undefined>> =
  ApiRequest<EmptyParams, Q, never> & { query: Q };
type WithBody<B> =
  ApiRequest<EmptyParams, EmptyQuery, B> & { body: B };
type WithParamsBody<P extends Record<string, string | number>, B> =
  ApiRequest<P, EmptyQuery, B> & { params: P; body: B };
type WithParamsQuery<
  P extends Record<string, string | number>,
  Q extends Record<string, string | number | boolean | undefined>,
> = ApiRequest<P, Q, never> & { params: P; query: Q };

/** A streaming endpoint (`scripts.execute`, downloads, …) resolves to the raw
 * fetch `Response` so callers can read the body themselves. Use
 * `TypedApiClient.stream()` for `text/event-stream` endpoints instead. */
export type StreamResponse = Response;

/**
 * Request/response type for every catalogue operation id.
 * `res` is the resolved JSON payload, except for `stream: 'sse'` / `stream:
 * 'binary'` routes and `docs.swagger` (HTML), which resolve to `Response` /
 * `string` respectively.
 */
export type EndpointTypes = {
  // Documentation
  'docs.openapi': { req: EmptyRequest; res: Json };
  'docs.swagger': { req: EmptyRequest; res: string };

  // Identity (B7)
  'auth.me': { req: EmptyRequest; res: Ok<{ auth: AuthIdentityDto }> };

  // Knowledge graph (proxied to FastAPI)
  'graph.sync': { req: WithBody<{ wiki_dir?: string; output_ttl?: string }>; res: Json };
  'graph.validate': { req: WithBody<{ graph_path?: string; shapes_path?: string }>; res: Json };
  'graph.rag': { req: WithBody<{ question: string }>; res: Json };
  'graph.clusters': { req: EmptyRequest; res: Json };
  'graph.insights': { req: EmptyRequest; res: Ok<{ surprisingConnections?: Json[]; knowledgeGaps?: Json[] }> };
  // C4 — additive Neo4j routes (read-only query, sync, status)
  'graph.cypher': {
    req: WithBody<{ cypher: string; params?: Record<string, unknown>; projectId?: string }>;
    res: Ok<{ mode: 'live' | 'mock'; rows: Json[]; count: number }>;
  };
  'graph.sync.neo4j': {
    req: ApiRequest<EmptyParams, EmptyQuery, { projectId?: string }>;
    res: Ok<{ projectId: string; wikiDir: string; notes: number; synced: number; mode: 'live' | 'mock' }>;
  };
  'graph.status': {
    req: EmptyRequest;
    res: Ok<{
      enabled: boolean; configured: boolean; driverInstalled: boolean;
      mode: 'live' | 'mock'; database: string; projectId: string;
    }>;
  };
  'graph.events': { req: EmptyRequest; res: StreamResponse };
  'graph.reconcile': {
    req: ApiRequest<EmptyParams, EmptyQuery, { projectId?: string }>;
    res: Ok<{ staged: number; skipped: Json[]; proposals: Json[]; conflicts: Json[] }>;
  };

  // Catalogues
  'skills.list': { req: EmptyRequest; res: Ok<{ skills: SkillDto[] }> };
  'help.list': { req: EmptyRequest; res: Ok<{ topics: HelpTopicDto[] }> };
  'help.get': { req: WithParams<{ topicId: string | number }>; res: Ok<{ topic: HelpTopicDto }> };
  'scripts.list': { req: EmptyRequest; res: Ok<{ registry: Json; scripts: ScriptDefDto[] }> };
  'scripts.registry': { req: EmptyRequest; res: Ok<{ registry: Json; scripts: ScriptDefDto[] }> };
  'scripts.execute': {
    req: WithBody<{ scriptId?: string; script?: string; args?: Json; projectId?: string }>;
    res: StreamResponse;
  };
  'scripts.schedule': {
    req: WithBody<{
      id: string;
      scriptId: string;
      schedule?: string;
      args?: Json;
      project?: string;
      role?: string;
      enabled?: boolean;
      eventTrigger?: string;
      debounceSeconds?: number;
      maxRetries?: number;
    }>;
    res: Ok<{ job: SchedulerJobDto; errors?: string[]; warnings?: string[] }>;
  };
  'scripts.unschedule': {
    req: WithParams<{ jobId: string | number }>;
    res: Ok<{ removed: boolean; errors?: string[] }>;
  };
  'ke.useCases.list': { req: EmptyRequest; res: Ok<{ useCases: UseCaseDefDto[] }> };
  'ke.useCases.execute': {
    req: WithBody<{ useCaseId: string; stepIndex?: number; args?: Json; projectId?: string }>;
    res: StreamResponse;
  };

  // Review queue and ingestion queue
  'reviews.list': { req: EmptyRequest; res: Ok<{ reviews: Json[] }> };
  'reviews.add': {
    req: WithBody<{ title: string; sourceFile: string; recommendedAction?: string; reason?: string }>;
    res: Ok<{ review: Json }>;
  };
  'reviews.action': { req: WithBody<{ id: string; action: 'approve' | 'reject' }>; res: Ok };
  'ingest.queue.list': { req: EmptyRequest; res: Json };
  'ingest.queue.add': { req: WithBody<{ filePath: string }>; res: Ok };
  'ingest.queue.process': { req: EmptyRequest; res: StreamResponse };

  // Projects
  'projects.list': { req: WithQuery<{ includeArchived?: boolean }>; res: Ok<{ projects: ProjectEntryDto[] }> };
  'projects.create': { req: WithBody<{ id: string; name: string }>; res: Ok<{ project: ProjectEntryDto }> };
  'projects.import': {
    req: WithBody<ProjectBundleDto | { bundle: ProjectBundleDto }>;
    res: Ok<{ project: ProjectEntryDto }>;
  };
  'projects.clone': {
    req: WithParamsBody<{ id: string }, { id: string; name?: string; include?: Json }>;
    res: Ok<{ project: ProjectEntryDto }>;
  };
  'projects.archive': {
    req: WithParams<{ id: string | number }>;
    res: Ok<{ project: ProjectEntryDto; trashed?: TrashEntryDto }>;
  };
  'projects.restore': { req: WithParams<{ id: string | number }>; res: Ok<{ project: ProjectEntryDto }> };
  'projects.export': { req: WithParams<{ id: string | number }>; res: Ok<{ bundle: ProjectBundleDto }> };
  'projects.stats': { req: WithParams<{ id: string | number }>; res: Ok<{ stats: ProjectStatsDto }> };
  'projects.config.get': { req: WithParams<{ id: string | number }>; res: Ok<{ config: Json }> };
  'projects.config.put': { req: WithParamsBody<{ id: string | number }, Json>; res: Ok<{ config: Json }> };
  'projects.rename': {
    req: WithParamsBody<{ id: string | number }, { name: string }>;
    res: Ok<{ project: ProjectEntryDto }>;
  };
  'projects.delete': {
    req: WithParamsQuery<
      { id: string | number },
      { mode?: 'unregister' | 'trash' | 'permanent'; deleteFolder?: boolean; confirm?: string }
    >;
    res: Ok<{ mode?: string; trashed?: Json }>;
  };

  // Changesets
  'changesets.list': {
    req: WithQuery<{ status?: 'pending' | 'applied' | 'rejected' }>;
    res: Ok<{ changesets: ChangesetDto[] }>;
  };
  'changesets.stage': {
    req: WithBody<{
      description: string;
      rationale?: string;
      sources?: string[];
      edits: ChangesetEditDto[];
    }>;
    res: Ok<{ changeset: ChangesetDto }>;
  };
  'changesets.get': { req: WithParams<{ id: string | number }>; res: Ok<{ changeset: ChangesetDto }> };
  'changesets.apply': { req: WithParams<{ id: string | number }>; res: Ok };
  'changesets.reject': {
    req: WithParamsBody<{ id: string | number }, { reason?: string }>;
    res: Ok<{ changeset: ChangesetDto }>;
  };

  // Scheduler
  'schedule.status': {
    req: EmptyRequest;
    res: Ok<{ config: Json; errors?: string[]; snapshot?: SchedulerStatusDto }>;
  };
  'schedule.events': { req: EmptyRequest; res: StreamResponse };
  'schedule.runs': { req: WithQuery<{ jobId?: string; limit?: number }>; res: Ok<{ runs: Json[] }> };
  'schedule.run': { req: WithParams<{ jobId: string | number }>; res: StreamResponse };
  'schedule.cancel': { req: WithParams<{ jobId: string | number }>; res: Ok };
  'schedule.patch': {
    req: WithParamsBody<{ jobId: string | number }, { enabled?: boolean; schedule?: string }>;
    res: Ok<{ job: SchedulerJobDto }>;
  };
  'schedule.decisions': {
    req: WithQuery<{ jobId?: string; limit?: number }>;
    res: Ok<{ decisions: PolicyDecisionDto[] }>;
  };
  'schedule.approvals': {
    req: WithQuery<{ jobId?: string; status?: 'pending' | 'approved' | 'rejected' | 'failed' }>;
    res: Ok<{ approvals: ApprovalRequestDto[]; pending: Json[] }>;
  };
  'schedule.trigger': {
    req: WithBody<{
      event: 'note.created' | 'note.modified' | 'note.deleted';
      project?: string;
      path?: string;
    }>;
    res: Ok<{ queued: Json[]; pending: Json[] }>;
  };
  'schedule.approvalDecision': {
    req: WithParamsBody<
      { id: string | number; action: 'approve' | 'reject' },
      { reviewer?: string; reason?: string }
    >;
    res: Ok<{ approval: ApprovalRequestDto }>;
  };

  // Files
  'files.download': { req: WithQuery<{ path: string }>; res: StreamResponse };

  // Review Studio
  'review.meta': { req: WithQuery<{ note: string }>; res: ReviewMetaResponse };
  'review.verify': {
    req: WithBody<{ note: string; reviewer?: string; comment?: string; setStable?: boolean }>;
    res: ReviewVerifyResponse;
  };
  'review.digest': {
    req: WithQuery<{ days?: number; scope?: 'all' | 'folder' | 'note'; note?: string }>;
    res: ReviewDigest;
  };
  'review.critique': {
    req: WithBody<{
      note: string;
      depth?: 'fast' | 'standard' | 'deep';
      focus?: string[];
      instructions?: string;
    }>;
    res: ReviewCritiqueResponse;
  };
  'review.snapshots': { req: WithQuery<{ note: string }>; res: Ok<{ snapshots: ReviewSnapshot[] }> };
  'review.diff': { req: WithQuery<{ note: string; snapshot: string }>; res: ReviewDiffResponse };
  'review.restore': { req: WithBody<{ note: string; snapshot: string }>; res: Ok<{ note: WikiNote }> };

  // Research Studio
  'research.search': { req: WithQuery<{ q: string; limit?: number }>; res: ResearchSearchResponse };
  'research.backlinks': { req: WithQuery<{ note: string }>; res: ResearchBacklinksResponse };
  'research.related': { req: WithQuery<{ note: string; limit?: number }>; res: ResearchRelatedResponse };
  'research.trace': { req: WithQuery<{ q: string }>; res: ResearchTraceResponse };
  'research.consult': { req: WithBody<{ question: string }>; res: ResearchConsultResponse };
  'research.promoteAnswer': {
    req: WithBody<{
      question: string;
      markdown?: string;
      answer?: string;
      citations?: ResearchConsultCitation[];
      fallback?: boolean;
    }>;
    res: ResearchPromoteAnswerResponse;
  };
  'research.deepResearch': { req: WithBody<{ question: string }>; res: ResearchDeepResearchResponse };

  // Study Studio
  'study.guide': { req: WithBody<{ topic?: string }>; res: StudyOutputResponse };
  'study.quiz': { req: WithBody<{ topic?: string; count?: number }>; res: StudyQuizResponse };
  'study.mindmap': { req: WithBody<{ target?: string }>; res: StudyMindmapResponse };
  'study.audioOverview': { req: WithBody<{ topic?: string }>; res: StudyOutputResponse };
  'study.note': { req: WithBody<{ text: string }>; res: StudyQuickNoteResponse };
  'study.promoteNote': { req: WithBody<{ noteId: string; folder?: string }>; res: StudyPromoteResponse };
  'study.thesisChapter': {
    req: WithBody<{ topic?: string; title?: string; minMaturity?: number }>;
    res: StudyThesisResponse;
  };

  // Vault / notes / chat
  'wiki.notes.list': { req: EmptyRequest; res: Ok<{ notes: WikiNote[] }> };
  'wiki.folders.list': { req: EmptyRequest; res: Ok<{ folders: string[] }> };
  'wiki.scratchpad.list': { req: EmptyRequest; res: Ok<{ entries: ScratchpadEntryDto[] }> };
  'wiki.scratchpad.delete': { req: WithBody<{ id: string }>; res: Ok };
  'wiki.note.save': {
    req: WithBody<{
      id: string;
      content: string;
      rawContent?: string;
      path?: string;
      folder?: string;
      title?: string;
    }>;
    res: Ok<{ note: WikiNote }>;
  };
  'wiki.note.applyEdit': {
    req: WithBody<{ file: string; find: string; replace: string }>;
    res: Ok<{ note: WikiNote }>;
  };
  'wiki.note.attach': {
    req: WithBody<{
      noteId?: string;
      title?: string;
      folder?: string;
      content: string;
      mode?: 'append' | 'create' | 'overwrite';
    }>;
    res: Ok<{ note: WikiNote }>;
  };
  'chat.send': {
    req: WithBody<{ message?: string; command?: string; contextNoteId?: string; stream?: boolean }>;
    res: Ok<{ response?: string }>;
  };
  'wiki.folder.create': { req: WithBody<{ path: string }>; res: Ok<{ folder: string }> };
  'wiki.file.create': { req: WithBody<{ folder?: string; name: string; content: string }>; res: Ok<{ note: WikiNote }> };
  'wiki.rename': {
    req: WithBody<{
      from: string;
      to: string;
      type?: 'file' | 'folder';
      dryRun?: boolean;
      /** Legacy aliases: `newTitle` slugifies and rewrites frontmatter, `newName` is a raw filename. */
      newTitle?: string;
      newName?: string;
      extraAliases?: string[];
    }>;
    res: RenameResult;
  };
  'wiki.move': {
    req: WithBody<{ from: string; to: string; type?: 'file' | 'folder'; dryRun?: boolean }>;
    res: RenameResult;
  };
  'wiki.delete': { req: WithBody<{ path: string; type?: 'file' | 'folder' }>; res: Ok<{ trashed: TrashEntryDto }> };
  'wiki.trash.list': { req: EmptyRequest; res: Ok<{ entries: TrashEntryDto[] }> };
  'wiki.trash.restore': { req: WithBody<{ id: string }>; res: Ok<{ originalPath: string }> };
  'wiki.upload': { req: WithBody<{ path: string; content: string; encoding?: 'utf-8' | 'base64' }>; res: Ok };
  'wiki.ingest': {
    req: WithBody<{ content: string; fileName: string; folder?: string }>;
    res: Ok<{ path?: string; note?: WikiNote; compiled?: boolean; targetFolder?: string; message?: string }>;
  };
};

/** Request payload for a catalogue operation id. */
export type EndpointRequest<K extends EndpointId> = EndpointTypes[K]['req'];

/** Response payload for a catalogue operation id. */
export type EndpointResponse<K extends EndpointId> = EndpointTypes[K]['res'];

/** Typed frontend surface: one method per route plus generic `call`/`stream`. */
export type TypedApiClient = {
  [K in EndpointId]: (request: EndpointRequest<K>) => Promise<EndpointResponse<K>>;
} & {
  call<K extends EndpointId>(id: K, request: EndpointRequest<K>): Promise<EndpointResponse<K>>;
  stream<K extends EndpointId>(
    id: K,
    request: EndpointRequest<K>,
    onEvent: (event: { event?: string; data: string }) => void,
    signal?: AbortSignal,
  ): Promise<void>;
};

type IsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

/** Fails to compile if a catalogue route is missing from `EndpointTypes`. */
type _EndpointTypesCoverEveryId = Assert<IsExact<keyof EndpointTypes, EndpointId>>;
