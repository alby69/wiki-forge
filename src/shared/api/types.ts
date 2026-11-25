/**
 * Shared API DTOs — transport shapes only.
 *
 * These types carry no runtime dependency: they are imported by the backend
 * (contracts, OpenAPI generation) and by the frontend (typed API client).
 * Keeping them outside `frontend/` and `backend/` makes the API boundary
 * explicit and prevents the two runtimes from importing each other.
 */

export interface ApiErrorBody {
  success: false;
  error: string;
  [key: string]: unknown;
}

export interface BacklinkDto {
  sourceId: string;
  sourceTitle: string;
  contextSnippet?: string;
}

export interface WikiGraphNodeDto {
  id: string;
  label: string;
  group?: string;
  val: number;
  color?: string;
  tags?: string[];
}

export interface WikiGraphLinkDto {
  source: string;
  target: string;
  type?: string;
}

export interface WikiGraphDto {
  nodes: WikiGraphNodeDto[];
  links: WikiGraphLinkDto[];
}

export interface TemplateDefinitionDto {
  id: string;
  name: string;
  description: string;
  content: string;
  builtIn: boolean;
}

export interface WikiNoteDto {
  id: string;
  title: string;
  content: string;
  frontmatterRaw?: string;
  rawContent?: string;
  folder?: string;
  path: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  outboundLinks: string[];
  backlinks: BacklinkDto[];
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  verified?: string[];
  staleAfter?: string;
  trustTier?: 'human-reviewed' | 'machine-confirmed' | 'unverified';
}

export interface ProjectEntryDto {
  id: string;
  name: string;
  path: string;
  archived?: boolean;
  docsManaged?: boolean;
  [key: string]: unknown;
}

export interface ProjectBundleDto {
  manifest: Record<string, unknown>;
  files: Record<string, string>;
  [key: string]: unknown;
}

export interface ProjectStatsDto {
  notes: number;
  sources: number;
  assets: number;
  bytes: number;
  [key: string]: unknown;
}

export interface HelpTopicDto {
  id: string;
  title: string;
  icon: string;
  order: number;
  group: string;
  mode: 'focus' | 'dev' | 'both';
  keywords: string[];
  context: string[];
  markdown?: string;
}

export interface SkillDto {
  id: string;
  name: string;
  description: string;
  path: string;
}

export interface ScratchpadEntryDto {
  id: string;
  timestamp: string;
  text: string;
}

export interface ScriptParamDefDto {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  default?: unknown;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
  positional?: boolean;
  cliFlag?: string;
}

export interface ScriptArgSafetyRuleDto {
  when: Record<string, unknown>;
  safety: 'read-only' | 'report' | 'workspace' | 'wiki-write' | 'blocked';
}

export interface ScriptAutomationDto {
  safety: 'read-only' | 'report' | 'workspace' | 'wiki-write' | 'blocked';
  schedulable: boolean;
  enabledDefault: boolean;
  defaultSchedule: string;
  defaultArgs: Record<string, unknown>;
  argSafety?: ScriptArgSafetyRuleDto[];
  requires: string[];
  notes: string;
}

export interface ScriptDefDto {
  id: string;
  path: string;
  displayName: string;
  category: string;
  description: string;
  parameters: ScriptParamDefDto[];
  automation?: ScriptAutomationDto;
}

export interface UseCaseStepDto {
  id?: string;
  scriptId?: string;
  title?: string;
  stage?: string;
  [key: string]: unknown;
}

export interface UseCaseDefDto {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  steps: UseCaseStepDto[];
  [key: string]: unknown;
}

export interface UseCaseEventDto {
  type: string;
  [key: string]: unknown;
}

export interface ChangesetEditDto {
  path: string;
  find?: string;
  replace?: string;
  proposed_content?: string;
  action?: string;
  [key: string]: unknown;
}

export interface ChangesetDto {
  id: string;
  description: string;
  rationale?: string;
  sources?: string[];
  status: 'pending' | 'applied' | 'rejected';
  edits: ChangesetEditDto[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface TrashEntryDto {
  id: string;
  originalPath: string;
  trashedAt: string;
  [key: string]: unknown;
}

export interface ReviewGateItemDto {
  key: string;
  label: string;
  ok: boolean;
  value?: unknown;
  detail?: string;
}

export interface ReviewMetaDto {
  success: boolean;
  note?: WikiNoteDto;
  qualityGate?: ReviewGateItemDto[];
  snapshotCount?: number;
  history?: Array<{ actor: string; at?: string }>;
  error?: string;
}

export interface ReviewDigestDto {
  success: boolean;
  days?: number;
  scope?: string;
  entries?: Array<Record<string, unknown>>;
  summary?: string;
  markdown?: string;
  error?: string;
}

export interface ReviewSnapshotDto {
  id: string;
  at: string;
  reason: string;
  bytes: number;
}

export interface ReviewDiffRowDto {
  type: 'ctx' | 'add' | 'del';
  leftNo?: number;
  rightNo?: number;
  left?: string;
  right?: string;
}

export interface ReviewDiffDto {
  success: boolean;
  rows?: ReviewDiffRowDto[];
  stats?: { added: number; removed: number; context: number };
  error?: string;
}

export interface SearchMatchDto {
  line: number;
  text: string;
  [key: string]: unknown;
}

export interface SearchHitDto {
  note: WikiNoteDto;
  score: number;
  matchCount: number;
  matches: SearchMatchDto[];
}

export interface SearchResultDto {
  query: string;
  total: number;
  totalMatches: number;
  scanned: number;
  tookMs: number;
  results: SearchHitDto[];
}

export interface BacklinkResultDto {
  note: WikiNoteDto;
  line?: number;
  snippet?: string;
  [key: string]: unknown;
}

export interface RelatedNoteDto {
  note: WikiNoteDto;
  score: number;
  sharedTags?: string[];
  [key: string]: unknown;
}

export interface TraceSourceDto {
  path: string;
  exists: boolean;
  inferred?: boolean;
  passage?: string;
  [key: string]: unknown;
}

export interface TraceMatchDto {
  note: WikiNoteDto;
  matchedIn: string[];
  links?: string[];
  sources?: TraceSourceDto[];
}

export interface TraceResultDto {
  query: string;
  matches: TraceMatchDto[];
  [key: string]: unknown;
}

export interface ResearchCitationDto {
  id: string;
  title: string;
  path: string;
}

export interface ResearchAnswerDto {
  success: boolean;
  markdown: string;
  fallback: boolean;
  citations: ResearchCitationDto[];
  error?: string;
}

export interface ResearchPromoteDto {
  success: boolean;
  path?: string;
  validation: string[];
  error?: string;
}

export interface DeepResearchDto {
  success: boolean;
  markdown: string;
  outputPath?: string;
  synthesisPath?: string;
  articles: number;
  fallback: boolean;
  error?: string;
}

export interface StudySourceDto {
  path: string;
  title?: string;
  [key: string]: unknown;
}

export interface StudyOutputDto {
  success: boolean;
  markdown: string;
  outputPath: string;
  sources: StudySourceDto[];
  error?: string;
}

export interface StudyQuizDto extends StudyOutputDto {
  count: number;
}

export interface StudyMindmapNodeDto {
  id: string;
  label: string;
  children?: StudyMindmapNodeDto[];
  [key: string]: unknown;
}

export interface StudyMindmapLinkDto {
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface StudyMindmapDto extends StudyOutputDto {
  note?: { id: string; title: string; path: string };
  nodes: StudyMindmapNodeDto[];
  links: StudyMindmapLinkDto[];
  headings: number;
  wikilinks: number;
}

export interface StudyQuickNoteDto {
  success: boolean;
  markdown: string;
  entry?: ScratchpadEntryDto;
  entries: ScratchpadEntryDto[];
  error?: string;
}

export interface StudyPromoteDto {
  success: boolean;
  markdown: string;
  note?: WikiNoteDto;
  error?: string;
}

export interface StudyThesisDto extends StudyOutputDto {
  title: string;
  chapters: Array<Record<string, unknown>>;
  syntheses: Array<Record<string, unknown>>;
}

export interface SchedulerJobDto {
  job: Record<string, unknown>;
  nextRun?: string | null;
  lastRun?: string | null;
  [key: string]: unknown;
}

export interface SchedulerStatusDto {
  enabled: boolean;
  jobs: SchedulerJobDto[];
  activeJobs: string[];
  [key: string]: unknown;
}

export interface SchedulerEventDto {
  type: string;
  jobId?: string;
  [key: string]: unknown;
}

export interface ApprovalRequestDto {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  jobId?: string;
  [key: string]: unknown;
}

export interface PolicyDecisionDto {
  id: string;
  job?: string;
  decision?: string;
  at?: string;
  [key: string]: unknown;
}

export interface SseEventDto {
  type?: string;
  chunk?: string;
  code?: number;
  error?: string;
  data?: unknown;
  [key: string]: unknown;
}

/** Generic success envelope used by most write endpoints. */
export interface SuccessDto {
  success: true;
  [key: string]: unknown;
}

/**
 * B7 — identity resolved by the server for `GET /api/auth/me`.
 *
 * `authenticated=false` with `idpConfigured=true` means the browser has no
 * credential yet: the UI can offer sign-in without any privileged data being
 * exposed. In legacy mode the actor is `process:api-token` and the UI renders
 * exactly as before.
 */
export type ManagedUserRole = 'Reader' | 'Contributor' | 'KnowledgeEngineer' | 'Admin';

export interface ManagedUserDto {
  id: string;
  username: string;
  roles: ManagedUserRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthIdentityDto {
  actor: string;
  roles: string[];
  source: 'legacy-token' | 'idp' | 'local' | 'process';
  authenticated: boolean;
  rbacEnabled: boolean;
  strict: boolean;
  idpConfigured: boolean;
  userStoreConfigured?: boolean;
}

/**
 * UI access view model. Every field is computed by the server from the trusted
 * Principal and the declarative RBAC catalogue: the browser never supplies it.
 */
export interface UiAccessDto {
  actor: string;
  source: AuthIdentityDto['source'];
  authenticated: boolean;
  /** Global roles of the verified caller. */
  roles: string[];
  /** Projects whose ACL grants at least one effective role to the caller. */
  visibleProjects: string[];
  /** Effective roles (caller roles ∩ project/folder ACL) per visible project. */
  projectRoles: Record<string, string[]>;
  /** Action ids from ACTION_MIN_ROLE that the caller may render. */
  actions: string[];
  /** Operation ids from OPERATION_MIN_ROLE that the caller may dispatch. */
  operations: string[];
}

/** Presentation-only preferences. They can never widen RBAC permissions. */
export interface UiPreferencesDto {
  version: 1;
  pinnedActionIds: string[];
  filesVisible: boolean;
  viewMode: 'editor' | 'graph' | 'split' | 'scratchpad' | 'closed';
  theme: 'dark' | 'light';
  density: 'comfortable' | 'compact';
  language: 'it' | 'en';
  hiddenPanels: string[];
}
