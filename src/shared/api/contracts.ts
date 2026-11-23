/**
 * Declarative API catalogue — the single source of truth for Wiki-Forge HTTP.
 *
 * Every endpoint is declared exactly once here. The backend derives routing,
 * 400-validation and the OpenAPI 3.1 document from this file; the frontend
 * derives its typed client from the same declarations. No hand-maintained
 * endpoint table should be added elsewhere.
 */

import type {
  ApiErrorBody,
  ApprovalRequestDto,
  AuthIdentityDto,
  BacklinkResultDto,
  ChangesetDto,
  DeepResearchDto,
  HelpTopicDto,
  PolicyDecisionDto,
  ProjectBundleDto,
  ProjectEntryDto,
  ProjectStatsDto,
  RelatedNoteDto,
  ResearchAnswerDto,
  ResearchPromoteDto,
  ReviewDiffDto,
  ReviewDigestDto,
  ReviewMetaDto,
  ReviewSnapshotDto,
  SchedulerEventDto,
  SchedulerStatusDto,
  ScratchpadEntryDto,
  ScriptDefDto,
  SearchResultDto,
  SkillDto,
  SseEventDto,
  StudyMindmapDto,
  StudyOutputDto,
  StudyPromoteDto,
  StudyQuickNoteDto,
  StudyQuizDto,
  StudyThesisDto,
  SuccessDto,
  TraceResultDto,
  TrashEntryDto,
  UseCaseDefDto,
  UseCaseEventDto,
  WikiNoteDto,
} from './types';
import type { EndpointTypes, TypedApiClient } from './endpoints';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** JSON Schema subset used by the API catalogue (OpenAPI 3.1 compatible). */
export interface JsonSchema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  additionalProperties?: boolean | JsonSchema;
  $ref?: string;
  nullable?: boolean;
  [key: string]: unknown;
}

export interface ApiParam {
  name: string;
  in: 'path' | 'query' | 'header';
  required?: boolean;
  description?: string;
  schema: JsonSchema;
  example?: unknown;
}

export interface ApiRoute<Req = unknown, Res = unknown> {
  /** Stable operation id; also the bus command name from Fase 2 onward. */
  readonly id: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly tags: string[];
  readonly summary: string;
  readonly description?: string;
  readonly command: string;
  readonly projectScoped?: boolean;
  readonly stream?: 'sse' | 'binary';
  readonly status?: number;
  readonly deprecated?: boolean;
  readonly request: {
    readonly params?: ApiParam[];
    readonly query?: ApiParam[];
    readonly headers?: ApiParam[];
    readonly body?: JsonSchema;
    readonly bodyRequired?: boolean;
  };
  readonly response: {
    readonly schema: JsonSchema;
    readonly description?: string;
  };
  /** Phantom carrier: types flow into the generated client without runtime code. */
  readonly __types?: { readonly request: Req; readonly response: Res };
}

export function defineRoute<
  Req = unknown,
  Res = unknown,
  const T extends ApiRoute<Req, Res> = ApiRoute<Req, Res>,
>(route: T): T & ApiRoute<Req, Res> {
  return route;
}

const str = (description?: string, values?: readonly string[]): JsonSchema => ({
  type: 'string',
  ...(description ? { description } : {}),
  ...(values ? { enum: [...values] } : {}),
});
const int = (description?: string): JsonSchema => ({ type: 'integer', ...(description ? { description } : {}) });
const num = (description?: string): JsonSchema => ({ type: 'number', ...(description ? { description } : {}) });
const bool = (description?: string): JsonSchema => ({ type: 'boolean', ...(description ? { description } : {}) });
const arr = (items: JsonSchema, description?: string): JsonSchema => ({
  type: 'array', items, ...(description ? { description } : {}),
});
const obj = (properties: Record<string, JsonSchema>, required: string[] = [], description?: string): JsonSchema => ({
  type: 'object', properties, required, ...(description ? { description } : {}),
});
const free = (description?: string): JsonSchema => ({
  type: 'object', additionalProperties: true, ...(description ? { description } : {}),
});
const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });
const ok = (extra: Record<string, JsonSchema> = {}, description?: string): JsonSchema =>
  obj({ success: bool('True on success'), ...extra }, ['success'], description);
const sse = (description: string): JsonSchema => str(description);
const q = (name: string, schema: JsonSchema, description?: string, required = false): ApiParam => ({
  name, in: 'query', schema, description, required,
});
const pathParam = (name: string, description?: string): ApiParam => ({
  name, in: 'path', required: true, schema: str(), description,
});

/** Reusable component schemas, emitted under `components.schemas`. */
export const SCHEMAS: Record<string, JsonSchema> = {
  ApiError: {
    type: 'object',
    description: 'Uniform error envelope returned by every non-2xx response.',
    properties: { success: { type: 'boolean', enum: [false] }, error: str() },
    required: ['success', 'error'],
  },
  AuthIdentity: obj({
    actor: str('Canonical server-derived actor, e.g. human:<id> or process:api-token'),
    roles: arr(str('Canonical RBAC role')),
    source: str('legacy-token | idp | process', ['legacy-token', 'idp', 'process']),
    authenticated: bool('True when a verified credential was supplied'),
    rbacEnabled: bool('enterprise.enable_rbac'),
    strict: bool('Strict provenance mode'),
    idpConfigured: bool('An IdP adapter is active'),
  }, ['actor', 'roles', 'source', 'authenticated', 'rbacEnabled', 'strict', 'idpConfigured']),
  WikiNote: obj({
    id: str('Stable note id or wiki-relative path'),
    title: str(),
    content: str('Markdown body without YAML frontmatter'),
    frontmatterRaw: str('Exact original YAML block, preserved byte-for-byte'),
    rawContent: str('Full document used on save (frontmatter + body)'),
    path: str('Vault-relative path, e.g. wiki/ai/note.md'),
    folder: str(),
    tags: arr(str()),
    frontmatter: free('Parsed OKF frontmatter'),
    outboundLinks: arr(str()),
    backlinks: arr(free()),
    status: str('OKF status'),
    trustTier: str('unverified | machine-confirmed | human-reviewed', ['unverified', 'machine-confirmed', 'human-reviewed']),
    createdAt: str(),
    updatedAt: str(),
    staleAfter: str(),
  }, ['id', 'title', 'content', 'path', 'tags', 'frontmatter', 'outboundLinks', 'backlinks']),
  ProjectEntry: obj({
    id: str(), name: str(), path: str(), archived: bool(), docsManaged: bool(),
  }, ['id', 'name', 'path']),
  ProjectStats: obj({ notes: int(), sources: int(), assets: int(), bytes: int() }, ['notes', 'sources', 'assets', 'bytes']),
  ProjectBundle: obj({ manifest: free(), files: free('Map of relative path to file contents') }, ['manifest', 'files']),
  HelpTopic: obj({
    id: str(), title: str(), icon: str(), order: int(), group: str(),
    mode: str('focus | dev | both', ['focus', 'dev', 'both']),
    keywords: arr(str()), context: arr(str()), markdown: str('Present only on GET /api/help/{id}'),
  }, ['id', 'title', 'icon', 'order', 'group', 'mode', 'keywords', 'context']),
  Skill: obj({ id: str(), name: str(), description: str(), path: str() }, ['id', 'name', 'description', 'path']),
  ScratchpadEntry: obj({ id: str(), timestamp: str(), text: str() }, ['id', 'timestamp', 'text']),
  ScriptArgSafetyRule: obj({
    when: free('Arg name -> expected resolved value'),
    safety: str('read-only | report | workspace | wiki-write | blocked', ['read-only', 'report', 'workspace', 'wiki-write', 'blocked']),
  }, ['when', 'safety']),
  ScriptAutomation: obj({
    safety: str('read-only | report | workspace | wiki-write | blocked', ['read-only', 'report', 'workspace', 'wiki-write', 'blocked']),
    schedulable: bool(), enabledDefault: bool(), defaultSchedule: str(),
    defaultArgs: free('Validated against ScriptDef.parameters by the generator'),
    argSafety: arr(ref('ScriptArgSafetyRule')),
    requires: arr(str('llm | network | pandoc | tty')), notes: str(),
  }, ['safety', 'schedulable', 'enabledDefault', 'defaultSchedule', 'defaultArgs', 'requires', 'notes']),
  ScriptDef: obj({
    id: str(), path: str(), displayName: str(), category: str(), description: str(),
    parameters: arr(obj({
      name: str(), label: str(),
      type: str('text | number | boolean | select', ['text', 'number', 'boolean', 'select']),
      default: free(), required: bool(), options: arr(str()), placeholder: str(),
      description: str(), positional: bool(), cliFlag: str(),
    }, ['name', 'label', 'type'])),
    automation: ref('ScriptAutomation'),
  }, ['id', 'path', 'displayName', 'category', 'description', 'parameters']),
  UseCaseDef: obj({
    id: str(), name: str(), description: str(), steps: arr(free('Use Case step (scriptId, stage, readOnly …)')),
  }, ['id', 'steps']),
  Changeset: obj({
    id: str(), description: str(), rationale: str(), sources: arr(str()),
    status: str('pending | applied | rejected', ['pending', 'applied', 'rejected']),
    edits: arr(free('Exact find/replace or proposed_content with a wiki-relative path')),
    createdAt: str(),
  }, ['id', 'description', 'status', 'edits']),
  TrashEntry: obj({ id: str(), originalPath: str(), trashedAt: str() }, ['id', 'originalPath', 'trashedAt']),
  ReviewGateItem: obj({
    key: str(), label: str(), ok: bool(), value: free(), detail: str(),
  }, ['key', 'label', 'ok']),
  ReviewMeta: obj({
    success: bool(), note: ref('WikiNote'), qualityGate: arr(ref('ReviewGateItem')),
    snapshotCount: int(), history: arr(free()), error: str(),
  }, ['success']),
  ReviewDigest: obj({ success: bool(), days: int(), scope: str(), entries: arr(free()), summary: str(), markdown: str() }, ['success']),
  ReviewSnapshot: obj({ id: str(), at: str(), reason: str(), bytes: int() }, ['id', 'at', 'reason', 'bytes']),
  ReviewDiff: obj({
    success: bool(),
    rows: arr(obj({ type: str('ctx | add | del', ['ctx', 'add', 'del']), leftNo: int(), rightNo: int(), left: str(), right: str() }, ['type'])),
    stats: obj({ added: int(), removed: int(), context: int() }, ['added', 'removed', 'context']),
  }, ['success']),
  SearchHit: obj({
    note: ref('WikiNote'), score: num(), matchCount: int(),
    matches: arr(obj({ line: int(), text: str() }, ['line', 'text'])),
  }, ['note', 'score', 'matchCount', 'matches']),
  SearchResult: obj({
    query: str(), total: int(), totalMatches: int(), scanned: int(), tookMs: num(), results: arr(ref('SearchHit')),
  }, ['query', 'total', 'totalMatches', 'scanned', 'tookMs', 'results']),
  BacklinkResult: obj({ note: ref('WikiNote'), line: int(), snippet: str() }, ['note']),
  RelatedNote: obj({ note: ref('WikiNote'), score: num(), sharedTags: arr(str()) }, ['note', 'score']),
  TraceResult: obj({ query: str(), matches: arr(free('Note with matchedIn, outbound links and raw source passages')) }, ['query', 'matches']),
  ResearchCitation: obj({ id: str(), title: str(), path: str() }, ['id', 'title', 'path']),
  ResearchAnswer: obj({
    success: bool(), markdown: str(), fallback: bool('True when the LLM was unavailable'),
    citations: arr(ref('ResearchCitation')), error: str(),
  }, ['success', 'markdown', 'fallback', 'citations']),
  ResearchPromote: obj({ success: bool(), path: str(), validation: arr(str()), error: str() }, ['success', 'validation']),
  DeepResearch: obj({
    success: bool(), markdown: str(), outputPath: str(), synthesisPath: str(),
    articles: int(), fallback: bool(), error: str(),
  }, ['success', 'markdown', 'articles', 'fallback']),
  StudyOutput: obj({
    success: bool(), markdown: str(), outputPath: str(), sources: arr(free()), error: str(),
  }, ['success', 'markdown', 'outputPath', 'sources']),
  StudyMindmap: obj({
    success: bool(), markdown: str(), outputPath: str(), sources: arr(free()),
    note: free(), nodes: arr(free()), links: arr(free()), headings: int(), wikilinks: int(),
  }, ['success', 'nodes', 'links']),
  StudyQuickNote: obj({
    success: bool(), markdown: str(), entry: ref('ScratchpadEntry'), entries: arr(ref('ScratchpadEntry')), error: str(),
  }, ['success', 'markdown', 'entries']),
  SchedulerJob: obj({ job: free(), nextRun: str(), lastRun: str() }, ['job']),
  SchedulerStatus: obj({ enabled: bool(), jobs: arr(ref('SchedulerJob')), activeJobs: arr(str()) }, ['jobs', 'activeJobs']),
  SchedulerEvent: obj({ type: str(), jobId: str() }, ['type']),
  ApprovalRequest: obj({ id: str(), status: str(), jobId: str() }, ['id', 'status']),
  PolicyDecision: obj({ id: str(), job: str(), decision: str(), at: str() }, ['id']),
  SseEvent: obj({ type: str(), chunk: str(), code: int(), error: str(), data: free() }, ['type']),
};

const PROJECT_HEADER: ApiParam = {
  name: 'X-Project-Id', in: 'header', required: false,
  description: 'Project id; defaults to `default`. `?projectId=` is accepted as a fallback.',
  schema: str(),
};

/** Route definitions, grouped exactly like the API documentation browser. */
export const ROUTES = [
  // ---------------------------------------------------------------------------
  // Documentation (Fase 1)
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'docs.openapi', method: 'GET', path: '/api/openapi.json', tags: ['Documentation'],
    summary: 'Get the merged OpenAPI 3.1 specification',
    description: 'Node gateway operations plus the FastAPI knowledge-graph operations and MCP tool metadata.',
    command: 'docs.openapi',
    request: {}, response: { schema: free('OpenAPI 3.1 document'), description: 'OpenAPI 3.1 document' },
  }),
  defineRoute({
    id: 'docs.swagger', method: 'GET', path: '/api/docs', tags: ['Documentation'],
    summary: 'Open the self-hosted Swagger UI browser',
    command: 'docs.swagger',
    request: {}, response: { schema: str('HTML page'), description: 'HTML page' },
  }),

  // ---------------------------------------------------------------------------
  // Identity (B7) — additive, public so the UI can discover sign-in availability
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'auth.me', method: 'GET', path: '/api/auth/me', tags: ['Identity'],
    summary: 'Resolve the server-derived identity of the current request',
    description: 'Public identity introspection: without credentials it reports authenticated=false. An invalid credential still returns the standard 401 envelope.',
    command: 'auth.me',
    request: {}, response: { schema: ok({ auth: ref('AuthIdentity') }) },
  }),

  // ---------------------------------------------------------------------------
  // Knowledge graph (proxied to FastAPI)
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'graph.sync', method: 'POST', path: '/api/v1/graph/sync', tags: ['Knowledge Graph'],
    summary: 'Convert wiki notes to an RDF/Turtle knowledge graph',
    description: 'Proxied verbatim to the FastAPI kg-api service. GET is also accepted for legacy clients.',
    command: 'graph.proxy',
    request: {
      body: obj({ wiki_dir: str('Default: wiki'), output_ttl: str('Default: knowledge_graph.ttl') }, [], 'Sync request'),
    },
    response: { schema: free('SyncResponse from FastAPI') },
  }),
  defineRoute({
    id: 'graph.validate', method: 'POST', path: '/api/v1/graph/validate', tags: ['Knowledge Graph'],
    summary: 'Validate the RDF graph against W3C SHACL shapes',
    command: 'graph.proxy',
    request: {
      body: obj({
        graph_path: str('Default: knowledge_graph.ttl'),
        shapes_path: str('Default: src/backend/wikiforge/config/shapes.ttl'),
      }, [], 'Validation request'),
    },
    response: { schema: free('conforms, report and violations') },
  }),
  defineRoute({
    id: 'graph.rag', method: 'POST', path: '/api/v1/graph/rag', tags: ['Knowledge Graph'],
    summary: 'Run the stateful GraphRAG pipeline on a question',
    command: 'graph.proxy',
    request: { body: obj({ question: str() }, ['question'], 'RAG query') },
    response: { schema: free('question, entities, cypher_query, final_answer') },
  }),
  defineRoute({
    id: 'graph.clusters', method: 'GET', path: '/api/v1/graph/clusters', tags: ['Knowledge Graph'],
    summary: 'Compute Louvain communities over the wiki graph',
    command: 'graph.clusters', projectScoped: true,
    request: {}, response: { schema: free('clusters') },
  }),
  defineRoute({
    id: 'graph.insights', method: 'GET', path: '/api/v1/graph/insights', tags: ['Knowledge Graph'],
    summary: 'Report surprising connections and knowledge gaps',
    command: 'graph.insights', projectScoped: true,
    request: {}, response: { schema: ok({ surprisingConnections: arr(free()), knowledgeGaps: arr(free()) }) },
  }),
  // C4 — additive declarative routes. They are dispatched through the bus like
  // every other catalogue operation, so the B4 token gate applies to them too.
  defineRoute({
    id: 'graph.cypher', method: 'POST', path: '/api/v1/graph/cypher', tags: ['Knowledge Graph'],
    summary: 'Execute one validated read-only Cypher query',
    description: 'C4 — read-only execution through the C3 service. Writes are rejected with a typed error.',
    command: 'graph.cypher', projectScoped: true,
    request: {
      body: obj({
        cypher: str('A single MATCH / OPTIONAL MATCH statement with RETURN'),
        params: free('Cypher parameter map; values are bound by name'),
        projectId: str('Optional project id selecting the configured Neo4j database'),
      }, ['cypher'], 'Read-only Cypher request'),
      bodyRequired: true,
    },
    response: {
      schema: ok({
        mode: str('live when a driver was used, mock otherwise', ['live', 'mock']),
        rows: arr(free('Result row')),
        count: int(),
      }),
    },
  }),
  defineRoute({
    id: 'graph.sync.neo4j', method: 'POST', path: '/api/v1/graph/sync/neo4j', tags: ['Knowledge Graph'],
    summary: 'Synchronize a project wiki into Neo4j',
    description: 'C4 — full vault scan through the idempotent C2 handler; never writes to the vault.',
    command: 'graph.sync.neo4j', projectScoped: true,
    request: {
      body: obj({ projectId: str('Optional project id; defaults to X-Project-Id') }, [], 'Neo4j sync request'),
    },
    response: {
      schema: ok({
        projectId: str(), wikiDir: str(), notes: int(), synced: int(),
        mode: str('live when a driver was used, mock otherwise', ['live', 'mock']),
      }),
    },
  }),
  defineRoute({
    id: 'graph.status', method: 'GET', path: '/api/v1/graph/status', tags: ['Knowledge Graph'],
    summary: 'Report Neo4j configuration without connecting',
    description: 'C4 — reports enabled/configured/driverInstalled/mode; never opens a socket.',
    command: 'graph.status', projectScoped: true,
    request: {},
    response: {
      schema: ok({
        enabled: bool(), configured: bool(), driverInstalled: bool(),
        mode: str('live when a driver is configured, mock otherwise', ['live', 'mock']),
        database: str(), projectId: str(),
      }),
    },
  }),
  defineRoute({
    id: 'graph.events', method: 'GET', path: '/api/v1/graph/events', tags: ['Knowledge Graph'],
    summary: 'Subscribe to graph change events (SSE)',
    description: 'C7 — additive graph:changed frames; the UI updates through apiBus.stream().',
    command: 'graph.events', stream: 'sse', projectScoped: true,
    request: {}, response: { schema: sse('Initial snapshot frame, then GraphChanged frames and 15s keepalives') },
  }),
  defineRoute({
    id: 'graph.reconcile', method: 'POST', path: '/api/v1/graph/reconcile', tags: ['Knowledge Graph'],
    summary: 'Reconcile Neo4j revisions into reviewable changesets',
    description: 'C6 — read-only DB query plus stage-only reconciliation; a human must still apply the changeset.',
    command: 'graph.reconcile', projectScoped: true,
    request: {
      body: obj({
        projectId: str('Accepted for compatibility; staging always uses X-Project-Id'),
      }, [], 'Reconcile request'),
    },
    response: {
      schema: ok({
        staged: int(), skipped: arr(free()), skippedEvents: arr(free()),
        proposals: arr(free()), conflicts: arr(free()),
      }),
    },
  }),

  // ---------------------------------------------------------------------------
  // Catalogues: skills, help, scripts, use cases
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'skills.list', method: 'GET', path: '/api/skills', tags: ['Catalogues'],
    summary: 'List installed agent skill packages',
    command: 'skills.list',
    request: {}, response: { schema: ok({ skills: arr(ref('Skill')) }) },
  }),
  defineRoute({
    id: 'help.list', method: 'GET', path: '/api/help', tags: ['Catalogues'],
    summary: 'List in-app help topics',
    command: 'help.list',
    request: {}, response: { schema: ok({ topics: arr(ref('HelpTopic')) }) },
  }),
  defineRoute({
    id: 'help.get', method: 'GET', path: '/api/help/:topicId', tags: ['Catalogues'],
    summary: 'Get one help topic with Markdown body',
    command: 'help.get',
    request: { params: [pathParam('topicId', 'Slug of docs/help/<id>.md')] },
    response: { schema: ok({ topic: ref('HelpTopic') }) },
  }),
  defineRoute({
    id: 'scripts.list', method: 'GET', path: '/api/scripts/list', tags: ['Catalogues'],
    summary: 'List executable Python scripts generated from SCRIPT_SCHEMAS',
    description: '/api/scripts/registry is an alias returning the same payload.',
    command: 'scripts.list',
    request: {}, response: { schema: ok({ registry: free(), scripts: arr(ref('ScriptDef')) }) },
  }),
  defineRoute({
    id: 'scripts.registry', method: 'GET', path: '/api/scripts/registry', tags: ['Catalogues'],
    summary: 'Alias of GET /api/scripts/list kept for older tools',
    command: 'scripts.list', deprecated: true,
    request: {}, response: { schema: ok({ registry: free(), scripts: arr(ref('ScriptDef')) }) },
  }),
  defineRoute({
    id: 'scripts.schedule', method: 'POST', path: '/api/scripts/schedule', tags: ['Catalogues', 'Scheduler'],
    summary: 'Create a persisted script job and activate it immediately (S3)',
    description: 'Writes config/script_schedules.toml atomically, then hot-reloads the scheduler, synthetic Use Cases and event bus. Mutating scripts are always created disabled.',
    command: 'scripts.schedule',
    request: {
      body: obj({
        id: str('Stable job id (letters, digits, dot, dash or underscore)'),
        scriptId: str('Script id from /api/scripts/list'),
        schedule: str('Optional 5-field cron expression; defaults to the catalog value'),
        args: free('Optional script argument overrides'),
        project: str('Project id, default "default"'),
        role: str('Optional job role'),
        enabled: bool('Mutating scripts are forced to false'),
        eventTrigger: str('Optional note.created | note.modified | note.deleted trigger'),
        debounceSeconds: int('Event debounce in seconds (1–3600)'),
        maxRetries: int('Retries 0–5, default 1'),
      }, ['id', 'scriptId'], 'Script job to schedule'),
    },
    response: { schema: ok({ job: ref('SchedulerJob'), errors: arr(str()), warnings: arr(str()) }) },
  }),
  defineRoute({
    id: 'scripts.unschedule', method: 'DELETE', path: '/api/scripts/schedule/:jobId', tags: ['Catalogues', 'Scheduler'],
    summary: 'Remove a persisted script job and deactivate it immediately (S3)',
    description: 'Only jobs with jobKind = script can be removed; Use Case jobs from agent_schedule.toml are untouched.',
    command: 'scripts.unschedule',
    request: { params: [pathParam('jobId')] },
    response: { schema: ok({ removed: bool(), errors: arr(str()) }) },
  }),
  defineRoute({
    id: 'scripts.execute', method: 'POST', path: '/api/scripts/execute', tags: ['Catalogues'],
    summary: 'Execute a Python script and stream stdout/stderr as SSE',
    description: 'SSE frames: start, stdout, stderr, exit, then `data: [DONE]`. Mutating scripts require F6 approval when run by the scheduler.',
    command: 'scripts.execute', projectScoped: true, stream: 'sse',
    request: {
      body: obj({
        scriptId: str('Script id from /api/scripts/list'), script: str('Legacy alias of scriptId'),
        args: free('Arguments validated against the script schema'), projectId: str('Fallback when no X-Project-Id header is sent'),
      }, [], 'Script execution request'),
    },
    response: { schema: sse('Each `data:` frame is a JSON SseEvent'), description: 'text/event-stream' },
  }),
  defineRoute({
    id: 'ke.useCases.list', method: 'GET', path: '/api/ke/use-cases', tags: ['Catalogues'],
    summary: 'List the 8 Knowledge Engineering Use Cases',
    command: 'ke.useCases.list',
    request: {}, response: { schema: ok({ useCases: arr(ref('UseCaseDef')) }) },
  }),
  defineRoute({
    id: 'ke.useCases.execute', method: 'POST', path: '/api/ke/use-cases/execute', tags: ['Knowledge Engineering'],
    summary: 'Execute a KE Use Case and stream its step events',
    command: 'ke.useCases.execute', projectScoped: true, stream: 'sse',
    request: {
      body: obj({
        useCaseId: str(), stepIndex: int('Execute a single step (0-based)'),
        args: free(), projectId: str('Fallback when no X-Project-Id header is sent'),
      }, ['useCaseId'], 'Use Case execution request'),
    },
    response: { schema: sse('UseCaseEvent frames followed by `data: [DONE]`') },
  }),

  // ---------------------------------------------------------------------------
  // Legacy review queue and ingestion queue
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'reviews.list', method: 'GET', path: '/api/reviews', tags: ['Review Queue'],
    summary: 'List pending review items from .llm-wiki/reviews.json',
    command: 'reviews.list', projectScoped: true,
    request: {}, response: { schema: ok({ reviews: arr(free()) }) },
  }),
  defineRoute({
    id: 'reviews.add', method: 'POST', path: '/api/reviews/add', tags: ['Review Queue'],
    summary: 'Add a review item',
    command: 'reviews.add', projectScoped: true,
    request: {
      body: obj({
        title: str(), sourceFile: str(), recommendedAction: str(), reason: str(),
      }, ['title', 'sourceFile'], 'Review item'),
    },
    response: { schema: ok({ review: free() }) },
  }),
  defineRoute({
    id: 'reviews.action', method: 'POST', path: '/api/reviews/action', tags: ['Review Queue'],
    summary: 'Approve or reject (remove) a review item',
    command: 'reviews.action', projectScoped: true,
    request: { body: obj({ id: str(), action: str('approve | reject', ['approve', 'reject']) }, ['id', 'action']) },
    response: { schema: ok() },
  }),
  defineRoute({
    id: 'ingest.queue.list', method: 'GET', path: '/api/ingest/queue', tags: ['Ingestion'],
    summary: 'List the SQLite ingestion queue',
    command: 'ingest.queue.list', projectScoped: true,
    request: {}, response: { schema: free('Queue items from ingest_queue.py --json') },
  }),
  defineRoute({
    id: 'ingest.queue.add', method: 'POST', path: '/api/ingest/queue/add', tags: ['Ingestion'],
    summary: 'Enqueue a raw file for conversion',
    command: 'ingest.queue.add', projectScoped: true,
    request: { body: obj({ filePath: str('Path relative to the project root') }, ['filePath']) },
    response: { schema: ok() },
  }),
  defineRoute({
    id: 'ingest.queue.process', method: 'POST', path: '/api/ingest/queue/process', tags: ['Ingestion'],
    summary: 'Process the queue with two-step CoT conversion (SSE)',
    command: 'ingest.queue.process', projectScoped: true, stream: 'sse',
    request: {}, response: { schema: sse('start, stdout, stderr, exit frames then `data: [DONE]`') },
  }),

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'projects.list', method: 'GET', path: '/api/projects', tags: ['Projects'],
    summary: 'List projects in the workspace',
    command: 'projects.list',
    request: { query: [q('includeArchived', bool('Include archived projects'), 'Set to true to include archived projects')] },
    response: { schema: ok({ projects: arr(ref('ProjectEntry')) }) },
  }),
  defineRoute({
    id: 'projects.create', method: 'POST', path: '/api/projects', tags: ['Projects'],
    summary: 'Create and scaffold a project',
    command: 'projects.create',
    request: { body: obj({ id: str(), name: str() }, ['id', 'name']) },
    response: { schema: ok({ project: ref('ProjectEntry') }) },
  }),
  defineRoute({
    id: 'projects.import', method: 'POST', path: '/api/projects/import', tags: ['Projects'],
    summary: 'Import a project bundle',
    command: 'projects.import',
    request: { body: free('ProjectBundle, optionally wrapped in a `bundle` property') },
    response: { schema: ok({ project: ref('ProjectEntry') }) },
  }),
  defineRoute({
    id: 'projects.clone', method: 'POST', path: '/api/projects/:id/clone', tags: ['Projects'],
    summary: 'Clone a project with optional content includes',
    command: 'projects.clone',
    request: {
      params: [pathParam('id')],
      body: obj({ id: str('New project id'), name: str(), include: free('Directory include flags') }, ['id']),
    },
    response: { schema: ok({ project: ref('ProjectEntry') }) },
  }),
  defineRoute({
    id: 'projects.archive', method: 'POST', path: '/api/projects/:id/archive', tags: ['Projects'],
    summary: 'Archive a project under .wiki-forge/archive/',
    command: 'projects.archive',
    request: { params: [pathParam('id')] },
    response: { schema: ok({ project: ref('ProjectEntry'), trashed: ref('TrashEntry') }) },
  }),
  defineRoute({
    id: 'projects.restore', method: 'POST', path: '/api/projects/:id/restore', tags: ['Projects'],
    summary: 'Restore an archived project',
    command: 'projects.restore',
    request: { params: [pathParam('id')] },
    response: { schema: ok({ project: ref('ProjectEntry') }) },
  }),
  defineRoute({
    id: 'projects.export', method: 'GET', path: '/api/projects/:id/export', tags: ['Projects'],
    summary: 'Export a project as a JSON bundle',
    command: 'projects.export',
    request: { params: [pathParam('id')] },
    response: { schema: ok({ bundle: ref('ProjectBundle') }) },
  }),
  defineRoute({
    id: 'projects.stats', method: 'GET', path: '/api/projects/:id/stats', tags: ['Projects'],
    summary: 'Get note, source and asset counts for a project',
    command: 'projects.stats',
    request: { params: [pathParam('id')] },
    response: { schema: ok({ stats: ref('ProjectStats') }) },
  }),
  defineRoute({
    id: 'projects.config.get', method: 'GET', path: '/api/projects/:id/config', tags: ['Projects'],
    summary: 'Read a project config.toml as JSON',
    command: 'projects.config.get',
    request: { params: [pathParam('id')] },
    response: { schema: ok({ config: free() }) },
  }),
  defineRoute({
    id: 'projects.config.put', method: 'PUT', path: '/api/projects/:id/config', tags: ['Projects'],
    summary: 'Merge sections into a project config.toml',
    command: 'projects.config.put',
    request: { params: [pathParam('id')], body: free('Partial config object') },
    response: { schema: ok({ config: free() }) },
  }),
  defineRoute({
    id: 'projects.rename', method: 'PATCH', path: '/api/projects/:id', tags: ['Projects'],
    summary: 'Rename a project display name',
    command: 'projects.rename',
    request: { params: [pathParam('id')], body: obj({ name: str() }, ['name']) },
    response: { schema: ok({ project: ref('ProjectEntry') }) },
  }),
  defineRoute({
    id: 'projects.delete', method: 'DELETE', path: '/api/projects/:id', tags: ['Projects'],
    summary: 'Unregister, trash or permanently delete a project',
    description: 'Default mode is `trash`; `permanent` requires `confirm=<id>` and never targets the `default` project.',
    command: 'projects.delete',
    request: {
      params: [pathParam('id')],
      query: [
        q('mode', str('unregister | trash | permanent', ['unregister', 'trash', 'permanent']), 'Defaults to trash'),
        q('deleteFolder', bool(), 'Legacy flag: true=trash, false=unregister'),
        q('confirm', str(), 'Confirmation token required for permanent deletion'),
      ],
      headers: [{ name: 'X-Confirm-Token', in: 'header', schema: str(), description: 'Alternative to the confirm query parameter' }],
    },
    response: { schema: ok({ mode: str(), trashed: free() }) },
  }),

  // ---------------------------------------------------------------------------
  // Changesets
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'changesets.list', method: 'GET', path: '/api/v1/changesets', tags: ['Changesets'],
    summary: 'List staged changesets',
    command: 'changesets.list', projectScoped: true,
    request: { query: [q('status', str('pending | applied | rejected', ['pending', 'applied', 'rejected']))] },
    response: { schema: ok({ changesets: arr(ref('Changeset')) }) },
  }),
  defineRoute({
    id: 'changesets.stage', method: 'POST', path: '/api/v1/changesets', tags: ['Changesets'],
    summary: 'Stage proposed edits without touching the wiki',
    command: 'changesets.stage', projectScoped: true, status: 201,
    request: {
      body: obj({
        description: str(), rationale: str(), sources: arr(str()),
        edits: arr(free('path plus find/replace or proposed_content'), 'Edits to stage'),
      }, ['description', 'edits'], 'Changeset proposal'),
    },
    response: { schema: ok({ changeset: ref('Changeset') }) },
  }),
  defineRoute({
    id: 'changesets.get', method: 'GET', path: '/api/v1/changesets/:id', tags: ['Changesets'],
    summary: 'Get one changeset',
    command: 'changesets.get', projectScoped: true,
    request: { params: [pathParam('id')] },
    response: { schema: ok({ changeset: ref('Changeset') }) },
  }),
  defineRoute({
    id: 'changesets.apply', method: 'POST', path: '/api/v1/changesets/:id/apply', tags: ['Changesets'],
    summary: 'Apply a reviewed changeset (atomic; deletes go through trash)',
    command: 'changesets.apply', projectScoped: true,
    request: { params: [pathParam('id')] },
    response: { schema: ok() },
  }),
  defineRoute({
    id: 'changesets.reject', method: 'POST', path: '/api/v1/changesets/:id/reject', tags: ['Changesets'],
    summary: 'Reject a changeset with an optional reason',
    command: 'changesets.reject', projectScoped: true,
    request: { params: [pathParam('id')], body: obj({ reason: str() }, [], 'Rejection reason') },
    response: { schema: ok({ changeset: ref('Changeset') }) },
  }),

  // ---------------------------------------------------------------------------
  // KE scheduler F3/F5/F6
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'schedule.status', method: 'GET', path: '/api/ke/schedule', tags: ['Scheduler'],
    summary: 'Get scheduler config, validation errors and live snapshot',
    command: 'schedule.status',
    request: {}, response: { schema: ok({ config: free(), errors: arr(str()), snapshot: ref('SchedulerStatus') }) },
  }),
  defineRoute({
    id: 'schedule.events', method: 'GET', path: '/api/ke/schedule/events', tags: ['Scheduler'],
    summary: 'Subscribe to the live scheduler event stream (SSE)',
    command: 'schedule.events', stream: 'sse',
    request: {}, response: { schema: sse('Initial snapshot frame, then SchedulerEvent frames and 15s keepalives') },
  }),
  defineRoute({
    id: 'schedule.runs', method: 'GET', path: '/api/ke/schedule/runs', tags: ['Scheduler'],
    summary: 'Read the scheduler audit log (newest first)',
    command: 'schedule.runs',
    request: {
      query: [q('jobId', str(), 'Filter by job id'), q('limit', int('1–1000, default 100'))],
    },
    response: { schema: ok({ runs: arr(free()) }) },
  }),
  defineRoute({
    id: 'schedule.run', method: 'POST', path: '/api/ke/schedule/:jobId/run', tags: ['Scheduler'],
    summary: 'Run a scheduled job now and stream its events (SSE)',
    command: 'schedule.run', stream: 'sse',
    request: { params: [pathParam('jobId')] },
    response: { schema: sse('SchedulerEvent frames followed by `data: [DONE]`') },
  }),
  defineRoute({
    id: 'schedule.cancel', method: 'POST', path: '/api/ke/schedule/:jobId/cancel', tags: ['Scheduler'],
    summary: 'Cancel a running job',
    command: 'schedule.cancel',
    request: { params: [pathParam('jobId')] },
    response: { schema: ok() },
  }),
  defineRoute({
    id: 'schedule.patch', method: 'PATCH', path: '/api/ke/schedule/:jobId', tags: ['Scheduler'],
    summary: 'Enable/disable a job or change its cron schedule at runtime',
    command: 'schedule.patch',
    request: {
      params: [pathParam('jobId')],
      body: obj({ enabled: bool(), schedule: str('5-field cron expression') }, [], 'Partial job update'),
    },
    response: { schema: ok({ job: ref('SchedulerJob') }) },
  }),
  defineRoute({
    id: 'schedule.decisions', method: 'GET', path: '/api/ke/schedule/decisions', tags: ['Scheduler'],
    summary: 'Read the F5 policy decision log',
    command: 'schedule.decisions',
    request: { query: [q('jobId', str()), q('limit', int('Default 50'))] },
    response: { schema: ok({ decisions: arr(ref('PolicyDecision')) }) },
  }),
  defineRoute({
    id: 'schedule.approvals', method: 'GET', path: '/api/ke/schedule/approvals', tags: ['Scheduler'],
    summary: 'List F6 approval requests and debounced events',
    command: 'schedule.approvals',
    request: {
      query: [
        q('jobId', str()),
        q('status', str('pending | approved | rejected | failed', ['pending', 'approved', 'rejected', 'failed'])),
      ],
    },
    response: { schema: ok({ approvals: arr(ref('ApprovalRequest')), pending: arr(free()) }) },
  }),
  defineRoute({
    id: 'schedule.trigger', method: 'POST', path: '/api/ke/schedule/trigger', tags: ['Scheduler'],
    summary: 'Publish a debounced note event (webhook)',
    command: 'schedule.trigger',
    request: {
      body: obj({
        event: str('note.created | note.modified | note.deleted', ['note.created', 'note.modified', 'note.deleted']),
        project: str(), path: str('Wiki-relative note path'),
      }, ['event'], 'Trigger event'),
    },
    response: { schema: ok({ queued: arr(free()), pending: arr(free()) }) },
  }),
  defineRoute({
    id: 'schedule.approvalDecision', method: 'POST', path: '/api/ke/schedule/approvals/:id/:action', tags: ['Scheduler'],
    summary: 'Approve or reject a pending F6 request',
    command: 'schedule.approvalDecision',
    request: {
      params: [pathParam('id'), pathParam('action', 'approve | reject')],
      body: obj({ reviewer: str('Defaults to "human"'), reason: str() }, [], 'Decision metadata'),
    },
    response: { schema: ok({ approval: ref('ApprovalRequest') }) },
  }),

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'files.download', method: 'GET', path: '/api/files/download', tags: ['Files'],
    summary: 'Download a project file (path must stay inside the project root)',
    command: 'files.download', projectScoped: true, stream: 'binary',
    request: { query: [q('path', str(), 'Project-relative file path', true)] },
    response: { schema: str('application/octet-stream'), description: 'Binary file with Content-Disposition: attachment' },
  }),

  // ---------------------------------------------------------------------------
  // Review Studio
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'review.meta', method: 'GET', path: '/api/notes/review/meta', tags: ['Review Studio'],
    summary: 'Get note identity, OKF quality gate, verification history and snapshot count',
    command: 'review.meta', projectScoped: true,
    request: { query: [q('note', str('Note id, title or wiki-relative path'), '', true)] },
    response: { schema: ref('ReviewMeta') },
  }),
  defineRoute({
    id: 'review.verify', method: 'POST', path: '/api/notes/review/verify', tags: ['Review Studio'],
    summary: 'Record human verification and optionally promote the note to stable',
    command: 'review.verify', projectScoped: true,
    request: {
      body: obj({
        note: str(), reviewer: str(), comment: str(), setStable: bool(),
      }, ['note'], 'Verification request'),
    },
    response: { schema: ok({ note: free(), actor: str(), timestamp: str(), changed: bool(), meta: ref('ReviewMeta') }) },
  }),
  defineRoute({
    id: 'review.digest', method: 'GET', path: '/api/notes/review/digest', tags: ['Review Studio'],
    summary: 'Deterministic activity digest from wiki/log.md',
    command: 'review.digest', projectScoped: true,
    request: {
      query: [
        q('days', int('Clamped to 1–365, default 7')),
        q('scope', str('all | folder | note', ['all', 'folder', 'note'])),
        q('note', str()),
      ],
    },
    response: { schema: ref('ReviewDigest') },
  }),
  defineRoute({
    id: 'review.critique', method: 'POST', path: '/api/notes/review/critique', tags: ['Review Studio'],
    summary: 'LLM critique of a note with deterministic offline fallback',
    command: 'review.critique', projectScoped: true,
    request: {
      body: obj({
        note: str(), depth: str('fast | standard | deep', ['fast', 'standard', 'deep']),
        focus: arr(str()), instructions: str(),
      }, ['note'], 'Critique request'),
    },
    response: { schema: ok({ markdown: str(), fallback: bool(), error: str() }) },
  }),
  defineRoute({
    id: 'review.snapshots', method: 'GET', path: '/api/notes/review/snapshots', tags: ['Review Studio'],
    summary: 'List local snapshots of a note (newest first, 25 retained)',
    command: 'review.snapshots', projectScoped: true,
    request: { query: [q('note', str(), '', true)] },
    response: { schema: ok({ snapshots: arr(ref('ReviewSnapshot')) }) },
  }),
  defineRoute({
    id: 'review.diff', method: 'GET', path: '/api/notes/review/diff', tags: ['Review Studio'],
    summary: 'Row-based diff between a note and one of its snapshots',
    command: 'review.diff', projectScoped: true,
    request: { query: [q('note', str(), '', true), q('snapshot', str(), 'Snapshot id', true)] },
    response: { schema: ref('ReviewDiff') },
  }),
  defineRoute({
    id: 'review.restore', method: 'POST', path: '/api/notes/review/restore', tags: ['Review Studio'],
    summary: 'Restore a snapshot (the current content is snapshotted first)',
    command: 'review.restore', projectScoped: true,
    request: { body: obj({ note: str(), snapshot: str() }, ['note', 'snapshot']) },
    response: { schema: ok({ note: ref('WikiNote') }) },
  }),

  // ---------------------------------------------------------------------------
  // Research Studio
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'research.search', method: 'GET', path: '/api/notes/research/search', tags: ['Research Studio'],
    summary: 'Deterministic weighted full-text search over wiki notes',
    command: 'research.search', projectScoped: true,
    request: { query: [q('q', str(), 'Search query', true), q('limit', int('1–100, default 30'))] },
    response: { schema: ok({ query: str(), total: int(), totalMatches: int(), scanned: int(), tookMs: num(), results: arr(ref('SearchHit')) }) },
  }),
  defineRoute({
    id: 'research.backlinks', method: 'GET', path: '/api/notes/research/backlinks', tags: ['Research Studio'],
    summary: 'List notes that link to the target note',
    command: 'research.backlinks', projectScoped: true,
    request: { query: [q('note', str(), '', true)] },
    response: { schema: ok({ note: ref('WikiNote'), backlinks: arr(ref('BacklinkResult')) }) },
  }),
  defineRoute({
    id: 'research.related', method: 'GET', path: '/api/notes/research/related', tags: ['Research Studio'],
    summary: 'Suggest notes sharing tags/vocabulary that are not linked yet',
    command: 'research.related', projectScoped: true,
    request: { query: [q('note', str(), '', true), q('limit', int('1–50, default 12'))] },
    response: { schema: ok({ related: arr(ref('RelatedNote')) }) },
  }),
  defineRoute({
    id: 'research.trace', method: 'GET', path: '/api/notes/research/trace', tags: ['Research Studio'],
    summary: 'Trace a claim to notes, wikilinks and line-anchored raw sources',
    command: 'research.trace', projectScoped: true,
    request: { query: [q('q', str(), '', true)] },
    response: { schema: ok({ query: str(), matches: arr(free()) }) },
  }),
  defineRoute({
    id: 'research.consult', method: 'POST', path: '/api/notes/research/consult', tags: ['Research Studio'],
    summary: 'LLM answer grounded in the best-matching notes, with offline fallback',
    command: 'research.consult', projectScoped: true,
    request: { body: obj({ question: str() }, ['question']) },
    response: { schema: ref('ResearchAnswer') },
  }),
  defineRoute({
    id: 'research.promoteAnswer', method: 'POST', path: '/api/notes/research/promote-answer', tags: ['Research Studio'],
    summary: 'Save a consult answer as an OKF Reference note or a scratchpad entry',
    command: 'research.promoteAnswer', projectScoped: true,
    request: {
      body: obj({
        question: str(), markdown: str('Answer markdown (alias: answer)'), answer: str(),
        citations: arr(ref('ResearchCitation')), fallback: bool(),
      }, ['question'], 'Promotion request'),
    },
    response: { schema: ref('ResearchPromote') },
  }),
  defineRoute({
    id: 'research.deepResearch', method: 'POST', path: '/api/notes/research/deep-research', tags: ['Research Studio'],
    summary: 'Generate a multi-source report and synthesis note',
    command: 'research.deepResearch', projectScoped: true,
    request: { body: obj({ question: str() }, ['question']) },
    response: { schema: ref('DeepResearch') },
  }),

  // ---------------------------------------------------------------------------
  // Study Studio
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'study.guide', method: 'POST', path: '/api/notes/study/guide', tags: ['Study Studio'],
    summary: 'Build a deterministic study guide and write output/study-guide-*.md',
    command: 'study.guide', projectScoped: true,
    request: { body: obj({ topic: str() }, [], 'Study topic') },
    response: { schema: ref('StudyOutput') },
  }),
  defineRoute({
    id: 'study.quiz', method: 'POST', path: '/api/notes/study/quiz', tags: ['Study Studio'],
    summary: 'Build a multiple-choice quiz (count clamped to 1–25, default 5)',
    command: 'study.quiz', projectScoped: true,
    request: { body: obj({ topic: str(), count: int() }, [], 'Quiz request') },
    response: { schema: obj({ success: bool(), markdown: str(), outputPath: str(), sources: arr(free()), count: int() }, ['success', 'count']) },
  }),
  defineRoute({
    id: 'study.mindmap', method: 'POST', path: '/api/notes/study/mindmap', tags: ['Study Studio'],
    summary: 'Extract headings and wikilinks of a note into a mindmap',
    command: 'study.mindmap', projectScoped: true,
    request: { body: obj({ target: str('Note id, title or path') }, [], 'Mindmap target') },
    response: { schema: ref('StudyMindmap') },
  }),
  defineRoute({
    id: 'study.audioOverview', method: 'POST', path: '/api/notes/study/audio-overview', tags: ['Study Studio'],
    summary: 'Build a Host A / Host B dialogue script',
    command: 'study.audioOverview', projectScoped: true,
    request: { body: obj({ topic: str() }, [], 'Audio topic') },
    response: { schema: ref('StudyOutput') },
  }),
  defineRoute({
    id: 'study.note', method: 'POST', path: '/api/notes/study/note', tags: ['Study Studio'],
    summary: 'Append a timestamped entry to notes/quick-notes.md',
    command: 'study.note', projectScoped: true,
    request: { body: obj({ text: str() }, ['text'], 'Quick note text') },
    response: { schema: ref('StudyQuickNote') },
  }),
  defineRoute({
    id: 'study.promoteNote', method: 'POST', path: '/api/notes/study/promote-note', tags: ['Study Studio'],
    summary: 'Promote a scratchpad entry into a wiki note and refresh indexes',
    command: 'study.promoteNote', projectScoped: true,
    request: { body: obj({ noteId: str(), folder: str('Default: general') }, ['noteId']) },
    response: { schema: ref('StudyPromote') },
  }),
  defineRoute({
    id: 'study.thesisChapter', method: 'POST', path: '/api/notes/study/thesis-chapter', tags: ['Study Studio'],
    summary: 'Aggregate thesis chapters and mature syntheses into output/thesis_compiled.md',
    command: 'study.thesisChapter', projectScoped: true,
    request: { body: obj({ topic: str(), title: str(), minMaturity: num() }, [], 'Thesis request') },
    response: { schema: ref('StudyThesis') },
  }),

  // ---------------------------------------------------------------------------
  // Vault / notes / chat
  // ---------------------------------------------------------------------------
  defineRoute({
    id: 'wiki.notes.list', method: 'GET', path: '/api/wiki/notes', tags: ['Vault'],
    summary: 'Read every wiki note with backlinks computed',
    command: 'wiki.notes.list', projectScoped: true,
    request: {}, response: { schema: ok({ notes: arr(ref('WikiNote')) }) },
  }),
  defineRoute({
    id: 'wiki.folders.list', method: 'GET', path: '/api/wiki/folders', tags: ['Vault'],
    summary: 'List wiki folders',
    command: 'wiki.folders.list', projectScoped: true,
    request: {}, response: { schema: ok({ folders: arr(str()) }) },
  }),
  defineRoute({
    id: 'wiki.scratchpad.list', method: 'GET', path: '/api/wiki/scratchpad', tags: ['Vault'],
    summary: 'Parse notes/quick-notes.md into scratchpad entries',
    command: 'wiki.scratchpad.list', projectScoped: true,
    request: {}, response: { schema: ok({ entries: arr(ref('ScratchpadEntry')) }) },
  }),
  defineRoute({
    id: 'wiki.scratchpad.delete', method: 'POST', path: '/api/wiki/scratchpad/delete', tags: ['Vault'],
    summary: 'Delete one scratchpad entry by id',
    command: 'wiki.scratchpad.delete', projectScoped: true,
    request: { body: obj({ id: str() }, ['id']) }, response: { schema: ok() },
  }),
  defineRoute({
    id: 'wiki.note.save', method: 'POST', path: '/api/wiki/save', tags: ['Vault'],
    summary: 'Save a note atomically (rawContent preserves OKF frontmatter byte-for-byte)',
    command: 'wiki.note.save', projectScoped: true,
    request: {
      body: obj({
        id: str(), content: str(), rawContent: str('Exact full document to write'),
        path: str(), folder: str(), title: str(),
      }, ['id', 'content'], 'Save note request'),
    },
    response: { schema: ok({ note: ref('WikiNote') }) },
  }),
  defineRoute({
    id: 'wiki.note.applyEdit', method: 'POST', path: '/api/wiki/apply-edit', tags: ['Vault'],
    summary: 'Apply an exact, unique find/replace to one note',
    command: 'wiki.note.applyEdit', projectScoped: true,
    request: { body: obj({ file: str(), find: str(), replace: str() }, ['file', 'find', 'replace']) },
    response: { schema: ok({ note: ref('WikiNote') }) },
  }),
  defineRoute({
    id: 'wiki.note.attach', method: 'POST', path: '/api/wiki/attach', tags: ['Vault'],
    summary: 'Attach generated content to a note (append, create or overwrite)',
    command: 'wiki.note.attach', projectScoped: true,
    request: {
      body: obj({
        noteId: str(), title: str(), folder: str(), content: str(),
        mode: str('append | create | overwrite', ['append', 'create', 'overwrite']),
      }, ['content'], 'Attach request'),
    },
    response: { schema: ok({ note: ref('WikiNote') }) },
  }),
  defineRoute({
    id: 'chat.send', method: 'POST', path: '/api/chat', tags: ['Chat'],
    summary: 'Send a chat command (plain JSON or SSE when stream=true)',
    description: 'SSE frames are `{ "chunk": "..." }`, then `data: [DONE]`. An in-stream error frame uses `{ "error": "..." }`.',
    command: 'chat.send', projectScoped: true,
    request: {
      body: obj({
        message: str(), command: str(), contextNoteId: str(),
        stream: bool('Set true or send Accept: text/event-stream to stream'),
      }, [], 'Chat request'),
      headers: [{ name: 'Accept', in: 'header', schema: str(), description: 'Use text/event-stream for SSE' }],
    },
    response: {
      schema: obj({ success: bool(), response: str() }, ['success', 'response']),
      description: 'JSON response, or text/event-stream when streaming',
    },
  }),
  defineRoute({
    id: 'wiki.folder.create', method: 'POST', path: '/api/wiki/folder/create', tags: ['Vault'],
    summary: 'Create a folder inside the wiki',
    command: 'wiki.folder.create', projectScoped: true,
    request: { body: obj({ path: str('Wiki-relative folder path') }, ['path']) },
    response: { schema: ok({ folder: str() }) },
  }),
  defineRoute({
    id: 'wiki.file.create', method: 'POST', path: '/api/wiki/file/create', tags: ['Vault'],
    summary: 'Create a note, optionally from an OKF template',
    command: 'wiki.file.create', projectScoped: true,
    request: {
      body: obj({ folder: str(), name: str('File name'), content: str('Full note content') }, ['name', 'content']),
    },
    response: { schema: ok({ note: ref('WikiNote') }) },
  }),
  defineRoute({
    id: 'wiki.rename', method: 'POST', path: '/api/wiki/rename', tags: ['Vault'],
    summary: 'Rename a note/folder and rewrite all inbound wikilinks',
    command: 'wiki.rename', projectScoped: true,
    request: {
      body: obj({
        from: str('Current path'), to: str('New path'), type: str('file | folder', ['file', 'folder']),
        dryRun: bool('Preview link rewrites without writing'),
        newTitle: str('Legacy title rename: slugify the name and update frontmatter'),
        newName: str('Legacy raw name rename'),
        extraAliases: arr(str(), 'Additional aliases to rewrite'),
      }, ['from', 'to']),
    },
    response: { schema: ok({ renamed: free(), updatedFiles: arr(free()), totalReplacements: int() }) },
  }),
  defineRoute({
    id: 'wiki.move', method: 'POST', path: '/api/wiki/move', tags: ['Vault'],
    summary: 'Move a note/folder and rewrite all inbound wikilinks',
    command: 'wiki.move', projectScoped: true,
    request: { body: obj({ from: str(), to: str(), type: str('file | folder', ['file', 'folder']), dryRun: bool() }, ['from', 'to']) },
    response: { schema: ok({ renamed: free(), updatedFiles: arr(free()), totalReplacements: int() }) },
  }),
  defineRoute({
    id: 'wiki.delete', method: 'POST', path: '/api/wiki/delete', tags: ['Vault'],
    summary: 'Soft-delete a note/folder into .wiki-forge/trash/',
    command: 'wiki.delete', projectScoped: true,
    request: { body: obj({ path: str('Wiki-relative path'), type: str('file | folder') }, ['path']) },
    response: { schema: ok({ trashed: ref('TrashEntry') }) },
  }),
  defineRoute({
    id: 'wiki.trash.list', method: 'GET', path: '/api/wiki/trash', tags: ['Vault'],
    summary: 'List trashed files',
    command: 'wiki.trash.list', projectScoped: true,
    request: {}, response: { schema: ok({ entries: arr(ref('TrashEntry')) }) },
  }),
  defineRoute({
    id: 'wiki.trash.restore', method: 'POST', path: '/api/wiki/trash/restore', tags: ['Vault'],
    summary: 'Restore a trashed file by id',
    command: 'wiki.trash.restore', projectScoped: true,
    request: { body: obj({ id: str('Trash entry id') }, ['id']) },
    response: { schema: ok({ originalPath: str() }) },
  }),
  defineRoute({
    id: 'wiki.upload', method: 'POST', path: '/api/wiki/upload', tags: ['Vault'],
    summary: 'Upload text or base64 content into raw/assets',
    command: 'wiki.upload', projectScoped: true,
    request: {
      body: obj({
        path: str('Destination path'), content: str(), encoding: str('utf-8 | base64'),
      }, ['path', 'content']),
    },
    response: { schema: ok() },
  }),
  defineRoute({
    id: 'wiki.ingest', method: 'POST', path: '/api/wiki/ingest', tags: ['Ingestion'],
    summary: 'Stage + compile a markdown source into a wiki note',
    command: 'wiki.ingest', projectScoped: true,
    request: {
      body: obj({ content: str(), fileName: str(), folder: str('Target wiki folder') }, ['content', 'fileName']),
    },
    response: { schema: ok({ path: str(), note: ref('WikiNote') }) },
  }),
];

/** Stable operation ids, also used as bus command names. */
export type EndpointId = (typeof ROUTES)[number]['id'];

/** Typed client surface generated from the catalogue (Fase 3). */
export type ApiClient = TypedApiClient;

export type { EndpointTypes, EndpointRequest, EndpointResponse, TypedApiClient } from './endpoints';

export const PROJECT_SCOPED_ROUTE_COUNT: number = ROUTES.filter((route) => route.projectScoped).length;

/** Kinds of import above are kept as a type-only reference for documentation generation. */
export type ContractDtos =
  | ApiErrorBody | ApprovalRequestDto | AuthIdentityDto | ChangesetDto | HelpTopicDto | PolicyDecisionDto
  | ProjectBundleDto | ProjectEntryDto | ProjectStatsDto | ReviewMetaDto | ReviewDigestDto
  | ReviewDiffDto | ReviewSnapshotDto | SchedulerEventDto | SchedulerStatusDto | SkillDto
  | SseEventDto | SuccessDto | TrashEntryDto | WikiNoteDto | SearchResultDto | TraceResultDto
  | ScratchpadEntryDto | ScriptDefDto | UseCaseDefDto | UseCaseEventDto | RelatedNoteDto
  | BacklinkResultDto | DeepResearchDto | ResearchAnswerDto | ResearchPromoteDto
  | StudyOutputDto | StudyQuizDto | StudyMindmapDto | StudyQuickNoteDto | StudyPromoteDto
  | StudyThesisDto;

// Re-export aliases used by the generated client and by the backend bus.
export type {
  ResearchAnswerDto as ResearchAnswerContract,
  SearchResultDto as SearchResultContract,
  TraceResultDto as TraceResultContract,
  ScratchpadEntryDto as ScratchpadEntryContract,
  ScriptDefDto as ScriptDefContract,
  UseCaseDefDto as UseCaseContract,
  UseCaseEventDto as UseCaseEventContract,
  RelatedNoteDto as RelatedNoteContract,
  BacklinkResultDto as BacklinkResultContract,
  DeepResearchDto as DeepResearchContract,
  ResearchAnswerDto as ResearchAnswerBody,
  ResearchPromoteDto as ResearchPromoteBody,
  StudyOutputDto as StudyOutputBody,
  StudyQuizDto as StudyQuizBody,
  StudyMindmapDto as StudyMindmapBody,
  StudyQuickNoteDto as StudyQuickNoteBody,
  StudyPromoteDto as StudyPromoteBody,
  StudyThesisDto as StudyThesisBody,
} from './types';
