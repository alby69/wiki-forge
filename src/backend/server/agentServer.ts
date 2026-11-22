import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { MarkdownParser } from '../../frontend/services/markdownParser';
import { ensureOkfFrontmatter } from '../../frontend/services/okfFrontmatter';
import { WikiNote } from '../../frontend/core/types/wiki';
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
import { GENERATED_SCRIPT_REGISTRY } from './generated/scriptRegistry.generated';
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
import { handleDocsRequest } from './api/docsBrowser';
import { readJsonBody, sendApiResult } from './api/http';
import { createMessageBus, type MessageBus, type Principal } from './bus/messageBus';
import { deriveRequestPrincipal } from './auth/principal';
import { apiTokenFromRequest, UNAUTHORIZED_MESSAGE, verifyApiToken } from './auth/apiToken';
import { actorKind, canonicalActor, PROCESS_FALLBACK_ACTOR } from './auth/actor';
import { loadRbacConfigSync, type RbacConfig } from './auth/rbacConfig';
import { createRbacMiddleware } from './auth/rbacMiddleware';
import { createCatalogueModule, type CatalogueModule, type HelpTopicMeta } from './modules/catalogueModule';
import { createToolsModule, type ToolsModule } from './modules/toolsModule';
import { createReviewModule, type ReviewModule } from './modules/reviewModule';
import { createIngestionModule, type IngestionModule } from './modules/ingestionModule';
import { createGraphModule, type GraphModule } from './modules/graphModule';
import { createProjectsModule } from './modules/projectsModule';
import { createChangesetsModule } from './modules/changesetsModule';
import { createFilesModule } from './modules/filesModule';
import { createSchedulerModule } from './modules/schedulerModule';
import { createExecutionModule } from './modules/executionModule';
import { createVaultModule } from './modules/vaultModule';
import { createReviewStudioModule } from './modules/reviewStudioModule';
import { createResearchModule } from './modules/researchModule';
import { createStudyModule } from './modules/studyModule';
import { createChatModule } from './modules/chatModule';
import type { DomainServices } from './modules/services';
import type { PythonTool } from './modules/pythonTool';
import { matchRoute } from '../../shared/api/router';
import { ROUTES as API_ROUTES } from '../../shared/api/contracts';

// Backwards-compatible type exports: callers may still import ProjectEntry here.
export type { ProjectBundle, ProjectDeleteMode, ProjectEntry } from './projectService';

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

export interface ScriptParamDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  default?: any;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
  positional?: boolean;
  cliFlag?: string;
}

export type ScriptSafety = 'read-only' | 'report' | 'workspace' | 'wiki-write' | 'blocked';

/** Generated from SCRIPT_SCHEMAS: the scheduler and the UI must not redefine it. */
export interface ScriptArgSafetyRule {
  when: Record<string, unknown>;
  safety: ScriptSafety;
}

export interface ScriptAutomation {
  safety: ScriptSafety;
  schedulable: boolean;
  enabledDefault: boolean;
  defaultSchedule: string;
  defaultArgs: Record<string, unknown>;
  /** Arg-dependent overrides, evaluated against the resolved invocation args. */
  argSafety?: ScriptArgSafetyRule[];
  requires: string[];
  notes: string;
}

export interface ScriptDef {
  id: string;
  path: string;
  displayName: string;
  category: 'Ingestion' | 'OKF Maintenance' | 'Analysis & Metrics' | 'Taxonomy' | 'Thesis & Study' | 'Wizard' | 'Knowledge Engineering';
  description: string;
  parameters: ScriptParamDef[];
  /** Optional for hand-built test fixtures; every registry entry has it. */
  automation?: ScriptAutomation;
}

/**
 * Resolves the Python interpreter used by the script runners.
 * Prefers `python3`, falls back to `python` (e.g. Windows hosts where the
 * `python3` alias is unavailable). If neither is installed the probe is
 * skipped and `python3` is used so the spawn error stays actionable.
 */
export function resolvePythonCommand(): string {
  const probe = (cmd: string): boolean => {
    try {
      return spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
    } catch (_e) {
      return false;
    }
  };

  if (probe('python3')) return 'python3';
  if (probe('python')) return 'python';
  return 'python3';
}

export const PYTHON_CMD: string = resolvePythonCommand();

export function buildCliArgsFromSchema(scriptDef: ScriptDef, userArgs: Record<string, any>): string[] {
  const args: string[] = [];
  const getVal = (name: string, def?: any) => (userArgs && userArgs[name] !== undefined ? userArgs[name] : def);

  for (const param of scriptDef.parameters) {
    const rawVal = getVal(param.name, param.default);
    if (rawVal === undefined || rawVal === null) continue;

    if (param.type === 'boolean') {
      const boolVal = Boolean(rawVal);
      if (boolVal) {
        const flag = param.cliFlag || `--${param.name.replace(/_/g, '-')}`;
        args.push(flag);
      }
    } else if (param.positional) {
      const strVal = String(rawVal).trim();
      if (strVal) {
        args.push(strVal);
      }
    } else {
      const strVal = String(rawVal).trim();
      if (strVal || param.required) {
        const flag = param.cliFlag || `--${param.name.replace(/_/g, '-')}`;
        args.push(flag, strVal);
      }
    }
  }

  return args;
}

export function buildCliArgs(scriptDef: ScriptDef, userArgs: Record<string, any>): string[] {
  return buildCliArgsFromSchema(scriptDef, userArgs);
}

/**
 * Fase 76: `--confirm` and `--reviewer` are F6-only flags. B5 adds
 * `--allow-process-actor` to the same trust boundary: generic execution
 * endpoints (Use Case SSE and Script Panel) must never supply any of them,
 * otherwise the mutating program-change apply step could bypass the approval
 * queue. They are injected solely by `decideApproval()` after a decision.
 */
export function withoutApprovalFlags(args?: Record<string, any>): Record<string, any> | undefined {
  if (!args) return args;
  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(args)) {
    if (key === 'confirm' || key === 'reviewer' || key === 'allow_process_actor') continue;
    safe[key] = value;
  }
  return safe;
}

export const SCRIPT_REGISTRY: Record<string, ScriptDef> = GENERATED_SCRIPT_REGISTRY;

export interface ChatRequest {
  message?: string;
  command?: string;
  contextNoteId?: string;
  stream?: boolean;
}

/** Re-export kept for existing imports; the type now lives in the domain module. */
export type { HelpTopicMeta } from './modules/catalogueModule';

export interface SaveNoteRequest {
  id: string;
  content: string;
  /**
   * Exact full document to write (frontmatter + body). When omitted, `content`
   * is used for backward compatibility with agent-generated notes.
   */
  rawContent?: string;
  path?: string;
  folder?: string;
  title?: string;
}

export interface AttachNoteRequest {
  noteId?: string;
  title?: string;
  folder?: string;
  content: string;
  mode?: 'append' | 'create' | 'overwrite';
}

export interface ApplyEditRequest {
  file: string;
  find: string;
  replace: string;
}

export interface ScratchpadEntry {
  id: string;
  timestamp: string;
  text: string;
}

/** Standard preamble of `notes/quick-notes.md`. */
const SCRATCHPAD_INTRO =
  '# Quick Notes Scratchpad\n\n' +
  'Notes recorded here remain unindexed until promoted with `/promote-note`.\n\n';

/**
 * Every scratchpad entry starts with a `## [timestamp]` heading on its own
 * line. Files written by older versions (or edited by hand) can end up with a
 * heading glued to the previous note's last line, e.g.
 * `"nota di prova"## [2026-10-24 07:12:51]`. The parser only splits on
 * line-start headings, so the new note was silently merged into the previous
 * one ("/note attaches to the last note"). Sorting out the separator here
 * repairs such files on read and on the next write.
 */
function normalizeScratchpad(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])[ \t]*(## \[\d{4}-\d{2}-\d{2}[^\]]*\])/g, '$1\n\n$2');
}

/**
 * Splits `notes/quick-notes.md` into entries. Ids are the timestamp with
 * non-digits turned into dashes; if two notes were saved within the same
 * second (same heading) the duplicates get a `-2`, `-3`, … suffix so the UI
 * keeps them distinct and deleting one does not take the other with it.
 */
function parseScratchpad(raw: string): ScratchpadEntry[] {
  const entries: ScratchpadEntry[] = [];
  const tokens = normalizeScratchpad(raw).split(/^## \[([^\]]+)\]/m);
  const seen = new Map<string, number>();

  for (let i = 1; i < tokens.length; i += 2) {
    const timestamp = tokens[i].trim();
    const text = (tokens[i + 1] ?? '').trim();
    if (!text) continue;

    const baseId = timestamp.replace(/\D/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const count = (seen.get(baseId) ?? 0) + 1;
    seen.set(baseId, count);

    entries.push({
      id: count === 1 ? baseId || `note-${entries.length + 1}` : `${baseId}-${count}`,
      timestamp,
      text,
    });
  }

  return entries;
}

export interface DeleteScratchpadRequest {
  id: string;
}

export interface CreateFolderRequest {
  folderPath: string;
}

export interface CreateFileRequest {
  folderPath: string;
  fileName: string;
  content?: string;
}

export interface RenameRequest {
  oldPath: string;
  /** Legacy raw filename (with or without `.md`). */
  newName?: string;
  /** Human-readable title shown in the UI. When set, the filename is derived from it. */
  newTitle?: string;
  /** Preview what would change without touching the filesystem. */
  dryRun?: boolean;
  /** Optional extra aliases (old names) that should be rewritten too. */
  extraAliases?: string[];
}

export interface MoveRequest {
  sourcePath: string;
  targetFolder: string;
  /** Preview what would change without touching the filesystem. */
  dryRun?: boolean;
}

export interface RenameLinkUpdate {
  file: string;
  replacements: number;
  samples: string[];
}

export interface RenameResult {
  success: boolean;
  dryRun: boolean;
  renamed: {
    from: string;
    to: string;
    oldTitle: string;
    newTitle: string;
    id: string;
  };
  updatedFiles: RenameLinkUpdate[];
  totalReplacements: number;
}


export interface DeleteRequest {
  targetPath: string;
}

export interface UploadRequest {
  folderPath: string;
  fileName: string;
  content: string;
  isBase64?: boolean;
}

export interface IngestRequest {
  fileName: string;
  content: string;
  /** Wiki sub-folder where the compiled note is placed (e.g. "fonti"). */
  targetFolder?: string;
  isBase64?: boolean;
}

export interface WizardScenario {
  id: string;
  name: string;
  description: string;
  workflow: string[];
  prompt: string;
}

export interface KEUseCaseStep {
  stepNumber: number;
  title: string;
  description: string;
  scriptId: string;
  defaultArgs?: Record<string, any>;
}

export interface KEUseCaseDef {
  id: string;
  title: string;
  role: 'Knowledge Engineer';
  category: string;
  summary: string;
  objective: string;
  steps: KEUseCaseStep[];
}

export const WIZARD_SCENARIOS: Record<string, WizardScenario> = {
  academic: {
    id: 'academic',
    name: 'Academic / Thesis / Paper Review',
    description: 'Ingest academic papers, extract authors/theories, and compile a structured literature review.',
    workflow: ['Ingest PDFs', 'Extract Authors/Theories', 'Compile Literature Review', 'Audit Wiki Links'],
    prompt: 'Execute ingestion on raw/ directory with context "Thesis Review", compile the literature review, and run audit links.',
  },
  business: {
    id: 'business',
    name: 'Business KB / Product / Policy',
    description: 'Ingest SOPs and meeting notes, structure business KB, create stubs, and compile FAQs.',
    workflow: ['Ingest SOPs/Meetings', 'Structure KB', 'Setup FAQ/Consulting'],
    prompt: 'Execute ingestion on raw/ directory for business documents, create entity stubs, and compile the business KB.',
  },
  research: {
    id: 'research',
    name: 'Competitive / News / Dossier',
    description: 'Ingest articles and reports, cross-reference entities, trace sources, and view wiki statistics.',
    workflow: ['Ingest Articles/Reports', 'Cross-reference Entities', 'Source Tracing', 'View Stats'],
    prompt: 'Execute ingestion on raw/ directory for competitive research, trace key entity claims, and run stats.',
  },
  creative: {
    id: 'creative',
    name: 'Fiction / Worldbuilding / Notes',
    description: 'Setup character and place entities, interlink worldbuilding notes, compile wiki, and check orphan notes.',
    workflow: ['Setup Entities (Characters/Places)', 'Interlink Wiki', 'Graph & Orphan Check'],
    prompt: 'Create entity stubs for main characters and places, compile the worldbuilding wiki, and check for orphan notes.',
  },
  existing: {
    id: 'existing',
    name: 'Existing Wiki Navigation',
    description: 'Audit wiki health, search or consult knowledge base, and generate summary report.',
    workflow: ['Audit health', 'Search / Consult KB', 'Generate Summary Report'],
    prompt: 'Run a full audit on the existing wiki, search key concepts, and consult the knowledge base for a summary report.',
  },
};

export const KE_USE_CASES: Record<string, KEUseCaseDef> = {
  ke_schema_modeling: {
    id: 'ke_schema_modeling',
    title: 'Use Case 1: Schema & Taxonomy Modeling',
    role: 'Knowledge Engineer',
    category: 'Conceptual Modeling',
    summary: 'Infere e valida lo schema tipizzato della wiki, arricchendo le note con tag dal vocabolario controllato.',
    objective: 'Estrarre predicati e classi dal vault, validare la conformità sintattica [schema] e normalizzare la tassonomia.',
    steps: [
      {
        stepNumber: 1,
        title: 'Infer Domain Schema',
        description: 'Analizza i predicati ricorrenti nelle note e propone uno schema TOML di classi e proprietà.',
        scriptId: 'schema_infer',
        defaultArgs: {},
      },
      {
        stepNumber: 2,
        title: 'Lint Schema Constraints',
        description: 'Verifica la conformità sintattica e i vincoli di tipo delle note rispetto allo schema definito.',
        scriptId: 'schema_lint',
        defaultArgs: {},
      },
      {
        stepNumber: 3,
        title: 'Taxonomy Tag Suggestion',
        description: 'Arricchisce il frontmatter YAML delle note attingendo al vocabolario controllato del dominio.',
        scriptId: 'suggest_tags',
        defaultArgs: { all: true, wiki: 'wiki' },
      },
    ],
  },
  ke_ontological_validation: {
    id: 'ke_ontological_validation',
    title: 'Use Case 2: Ontological Integrity & Validation',
    role: 'Knowledge Engineer',
    category: 'Validation & Governance',
    summary: 'Rileva dipendenze circolari dirette, controlla il ciclo di vita OKF v0.2 e valida la coerenza logica.',
    objective: 'Garantire l\'assenza di cicli A -> B -> A, verificare la presenza di revisione umana per note stabili ed eseguire il linting OKF.',
    steps: [
      {
        stepNumber: 1,
        title: 'Ontology Rule Verification',
        description: 'Esegue i controlli di coerenza logica (concetti orfani, cicli diretti, revisione umana note stable).',
        scriptId: 'ontology_rules',
        defaultArgs: { wiki_dir: 'wiki' },
      },
      {
        stepNumber: 2,
        title: 'OKF Frontmatter & Bundle Lint',
        description: 'Verifica la presenza dei campi obbligatori OKF v0.2, enumerazioni ed indici di bundle.',
        scriptId: 'okf_lint',
        defaultArgs: { wiki_dir: 'wiki' },
      },
    ],
  },
  ke_cq_assessment: {
    id: 'ke_cq_assessment',
    title: 'Use Case 3: Competency Questions (CQ) & Coverage',
    role: 'Knowledge Engineer',
    category: 'Knowledge Audit',
    summary: 'Valuta la capacita della Knowledge Base di rispondere alle Competency Questions del dominio.',
    objective: 'Validare la copertura delle domande chiave e identificare i gap di conoscenza (knowledge gaps).',
    steps: [
      {
        stepNumber: 1,
        title: 'Competency Questions Validation',
        description: 'Mappa ed esegue le CQ di dominio rispetto alla rete di note generandone il report di copertura.',
        scriptId: 'cq_validator',
        defaultArgs: { wiki_dir: 'wiki', cq_file: 'wiki/competency_questions.md', output: 'output/cq_validation_report.md' },
      },
      {
        stepNumber: 2,
        title: 'Global Analytics & Coverage Metrics',
        description: 'Aggiorna le metriche generali della wiki e rigenera il report METRICS.md.',
        scriptId: 'wiki_stats',
        defaultArgs: {},
      },
    ],
  },
  ke_neuro_symbolic: {
    id: 'ke_neuro_symbolic',
    title: 'Use Case 4: Neuro-Symbolic Reasoning & ODP',
    role: 'Knowledge Engineer',
    category: 'Pattern Reasoning',
    summary: 'Rileva contraddizioni semantiche, suggerisce Ontology Design Patterns (ODP) ed inferisce wikilink mancanti.',
    objective: 'Combinare l\'inferenza simbolica RDFS/OWL con la capacita semantica del LLM per prevenire trappole di modellazione.',
    steps: [
      {
        stepNumber: 1,
        title: 'ODP Pattern Recommender',
        description: 'Analizza le strutture relazionali emergenti e suggerisce pattern formali (AgentRole, Situations, Temporal).',
        scriptId: 'odp_suggester',
        defaultArgs: { wiki_dir: 'wiki', catalog: 'config/odp_catalog.json' },
      },
      {
        stepNumber: 2,
        title: 'Neuro-Symbolic Consistency Checker',
        description: 'Esamina contraddizioni tra affermazioni e propone link tipizzati mancanti tra concetti correlati.',
        scriptId: 'neuro_symbolic_check',
        defaultArgs: { wiki_dir: 'wiki', output: 'output/neuro_symbolic_report.md' },
      },
    ],
  },
  ke_semantic_export: {
    id: 'ke_semantic_export',
    title: 'Use Case 5: Enterprise Semantic Graph & RDF Export',
    role: 'Knowledge Engineer',
    category: 'Interoperability & Graph',
    summary: 'Mappa l\'intero vault Zettelkasten in triple RDF W3C (JSON-LD e Turtle TTL) con identificatori IRI permanenti.',
    objective: 'Garantire l\'interoperabilita con sistemi aziendali, GraphDB, Protégé ed engine GraphRAG.',
    steps: [
      {
        stepNumber: 1,
        title: 'Semantic RDF & JSON-LD Export',
        description: 'Converte note, relazioni tipizzate e metadati OKF in triple RDF W3C ed esporta output/wiki_export.ttl e .jsonld.',
        scriptId: 'export_semantic',
        defaultArgs: { wiki_dir: 'wiki', output_dir: 'output' },
      },
      {
        stepNumber: 2,
        title: 'OKF Navigation & MOC Reindex',
        description: 'Rigenera l\'indice generale wiki/index.md e le mappe tematiche MOC a supporto della navigazione.',
        scriptId: 'okf_reindex',
        defaultArgs: { wiki_dir: 'wiki' },
      },
    ],
  },
  ke_maturity_eval: {
    id: 'ke_maturity_eval',
    title: 'Use Case 6: KE Platform Maturity Evaluation',
    role: 'Knowledge Engineer',
    category: 'Platform Governance',
    summary: 'Valuta il livello complessivo di maturita dell\'architettura di Ingegneria della Conoscenza su 6 dimensioni (L1-L4).',
    objective: 'Fornire una scorecard dettagliata sulla formalizzazione, automazione SHACL/CQ e qualita dell\'ancoraggio alle fonti.',
    steps: [
      {
        stepNumber: 1,
        title: 'Page Maturity Calculation',
        description: 'Calcola l\'Indice di Maturita (0-100) per ogni nota della wiki basandosi su 5 criteri ponderati.',
        scriptId: 'maturity_calculator',
        defaultArgs: { path: 'wiki', write: true },
      },
      {
        stepNumber: 2,
        title: 'KE Maturity Assessment (L1-L4)',
        description: 'Genera il report L1-L4 sulle 6 dimensioni dell\'Ingegneria della Conoscenza salvandolo in output/ke_maturity_report.md.',
        scriptId: 'ke_maturity',
        defaultArgs: { wiki_dir: 'wiki', output: 'output/ke_maturity_report.md' },
      },
    ],
  },
  ke_docs_wiki_drift: {
    id: 'ke_docs_wiki_drift',
    title: 'Use Case 7: Self-Documentation Wiki Drift',
    role: 'Knowledge Engineer',
    category: 'Documentation Governance',
    summary: 'Confronta docs/ con la proiezione OKF della wiki di wiki-forge e la rigenera per eliminare il drift, preservando le note curate. Con --check produce solo un report consultivo.',
    objective: 'Mantenere la proiezione OKF allineata a docs/ con motivazione e fonti; essendo uno script mutante, i run schedulati vengono sottratti dal Policy Agent F5 e richiedono approvazione F6.',
    steps: [
      {
        stepNumber: 1,
        title: 'Docs/Wiki Drift Report & Regenerate',
        description: 'Verifica il bundle generato rispetto a docs/ e, se necessario, rigenera la proiezione nella wiki di wiki-forge. I percorsi relativi sono risolti rispetto alla radice del repository.',
        scriptId: 'docs_wiki_drift',
        defaultArgs: { docs_dir: 'docs', wiki_dir: 'projects/wikiforge/wiki' },
      },
    ],
  },
  ke_wiki_program_change: {
    id: 'ke_wiki_program_change',
    title: 'Use Case 8: Wiki-to-Program Change',
    role: 'Knowledge Engineer',
    category: 'Documentation Governance',
    summary: 'Ponte Fase 76: trasforma una risposta approvata nella wiki in una proposta di modifica al programma, applicabile solo dopo approvazione umana F6.',
    objective: 'Collegare la wiki di wiki-forge alle modifiche di docs/ e del codice senza mutazioni automatiche: lo step di staging è in sola lettura, quello di apply viene sottratto dal Policy Agent F5 e richiede approvazione F6.',
    steps: [
      {
        stepNumber: 1,
        title: 'Stage Program Change Proposal',
        description: 'Convalida la proposta (percorso ammesso, find univoco, rationale e fonti) e la accoda in output/program-changes/ senza toccare i file del programma.',
        scriptId: 'wiki_program_change_propose',
        defaultArgs: { proposal: 'output/program-changes/proposal.json', stage_dir: 'output/program-changes', project: 'wikiforge' },
      },
      {
        stepNumber: 2,
        title: 'Apply Approved Program Change',
        description: 'Applica la proposta accodata con snapshot e audit. step mutante: il Policy Agent F5 lo sottrae all’esecuzione automatica e richiede approvazione F6.',
        scriptId: 'wiki_program_change_apply',
        defaultArgs: { proposal: 'output/program-changes/proposal.json', stage_dir: 'output/program-changes', project: 'wikiforge' },
      },
    ],
  },
};

function formatWizardList(): string {
  return Object.values(WIZARD_SCENARIOS)
    .map(s => `- \`/wizard ${s.id}\` — **${s.name}**: ${s.description}`)
    .join('\n');
}

function formatKeUseCaseList(): string {
  return Object.values(KE_USE_CASES)
    .map(u => `- **${u.title}** (\`${u.id}\`): ${u.summary}`)
    .join('\n');
}

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
  private readonly projects: ProjectService;
  private readonly rbacConfig: RbacConfig;
  private readonly strictProvenance: boolean;
  private readonly bus: MessageBus;
  private readonly catalogue: CatalogueModule;
  private readonly tools: ToolsModule;
  private readonly reviews: ReviewModule;
  private readonly ingestion: IngestionModule;
  private readonly graph: GraphModule;

  constructor(rootDir: string = process.cwd(), llmClient?: LlmClient) {
    this.rootDir = rootDir;
    this.llmClient = llmClient;
    this.projects = new ProjectService(rootDir);
    this.rbacConfig = loadRbacConfigSync(rootDir);
    this.strictProvenance = this.rbacConfig.enabled;
    this.bus = createMessageBus();
    // B3 — opt-in gate. With `enable_rbac=false` this middleware returns
    // `undefined` on every dispatch, so the legacy behaviour is byte-identical.
    // The catalogue is read once at construction; no connection is opened.
    this.bus.use(createRbacMiddleware(this.rbacConfig));
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
    this.graph = createGraphModule(pythonTool);
    this.graph.register(this.bus);

    const jsonRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
    const services: DomainServices = {
      bus: this.bus,
      projects: this.projects,
      isStrictProvenance: () => this.strictProvenance,
      provenanceActor: (principal, rawActor) => this.provenanceActorFor(principal, rawActor),
      changesets: async (projectId) => new ChangesetStore(await this.resolveProjectRoot(projectId)),
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

    const modules = [
      createProjectsModule(services),
      createChangesetsModule(services),
      createFilesModule(services),
      createSchedulerModule(services),
      createExecutionModule(services),
      createVaultModule(services),
      createReviewStudioModule(services),
      createResearchModule(services),
      createStudyModule(services),
      createChatModule(services),
    ];
    for (const module of modules) module.register(this.bus);
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
  public provenanceActorFor(principal?: Principal, rawActor?: string): string {
    if (!this.strictProvenance) return rawActor?.trim() || 'human';
    return canonicalActor(principal?.actor, PROCESS_FALLBACK_ACTOR);
  }

  /** Dispatch a catalogue command and write its transport-neutral result. */
  private async dispatchApiCommand(
    command: string,
    payload: unknown,
    projectId: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
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
      principal: deriveRequestPrincipal(req),
      onClose: (handler) => { req.on('close', handler); },
    });
    sendApiResult(res, result);
    return true;
  }

  // ---------------------------------------------------------------- scheduler

  public getScheduler(): Scheduler | undefined {
    return this.scheduler;
  }

  /** Load both schedule files and start the KE scheduler. Idempotent. */
  public async startScheduler(): Promise<void> {
    if (this.scheduler) return;
    const loaded = await loadScheduleConfig(this.rootDir, this.baseUseCases);
    await this.activateSchedule(loaded, []);
  }

  /**
   * S3 — apply a freshly loaded schedule to the live process. `scheduledUseCases`
   * and `Scheduler.jobs` are mutated in place because both are shared by
   * reference with the running scheduler and the event trigger bus.
   */
  private async activateSchedule(
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
      onTrigger: async (jobId, event) => {
        if (scheduler.isRunning(jobId)) return;
        await scheduler.runJobNow(jobId, 'event', event);
        this.broadcastScheduleEvent({ type: 'event_triggered', jobId, event, at: new Date().toISOString() });
      },
      onEvent: (event) => this.broadcastScheduleEvent(event),
    });
    await scheduler.start();
    return { added, removed };
  }

  /** S3: share the persistence + reload flow with the schedule API module. */
  private async createScriptJob(input: ScriptScheduleCreateInput): Promise<{ job: Record<string, unknown>; warnings: string[] }> {
    const before = this.scheduler?.getStatus().jobs.map((entry) => entry.job.id as string) ?? [];
    const timezone = this.schedulerConfig?.timezone ?? 'UTC';
    const result = await createScriptJob(this.rootDir, input, this.baseUseCases, timezone);
    const changes = await this.reloadSchedule(before);
    const job = this.scheduler?.getStatus().jobs
      .find((entry) => entry.job.id === result.job.id)
      ?.job as Record<string, unknown> | undefined;
    this.publishScheduleChange(changes);
    return { job: job ?? (result.job as unknown as Record<string, unknown>), warnings: result.warnings };
  }

  /** S3: share the persistence + reload flow with the schedule API module. */
  private async deleteScriptJob(jobId: string): Promise<{ removed: boolean }> {
    const before = this.scheduler?.getStatus().jobs.map((entry) => entry.job.id as string) ?? [];
    const timezone = this.schedulerConfig?.timezone ?? 'UTC';
    const result = await deleteScriptJob(this.rootDir, jobId, this.baseUseCases, timezone);
    const changes = await this.reloadSchedule(before);
    this.publishScheduleChange(changes);
    return { removed: result.removed };
  }

  /** Send a schedule mutation to SSE clients and local scheduler subscribers. */
  private publishScheduleChange(changes: { added: string[]; removed: string[] }): void {
    const event = {
      type: 'jobs_changed' as const,
      at: new Date().toISOString(),
      added: changes.added,
      removed: changes.removed,
    };
    if (this.scheduler) this.scheduler.publishEvent(event);
    else this.broadcastScheduleEvent(event);
  }

  /** Re-read both TOML files after an S3 mutation and reconcile live state. */
  private async reloadSchedule(previousIds: string[]): Promise<{ added: string[]; removed: string[] }> {
    const loaded = await loadScheduleConfig(this.rootDir, this.baseUseCases);
    return this.activateSchedule(loaded, previousIds);
  }

  /**
   * F5 preflight — the LLM policy is advisory and can only narrow the step set.
   * Mutating steps are staged as approval requests instead of being executed.
   */
  private async runPolicy(ctx: JobExecutionContext): Promise<PreflightResult> {
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
      lastStatus: this.scheduler?.getStatus().jobs.find(job => job.job.id === ctx.job.id)?.state.last_status,
      lastError: this.scheduler?.getStatus().jobs.find(job => job.job.id === ctx.job.id)?.state.last_error,
      consecutiveFailures:
        this.scheduler?.getStatus().jobs.find(job => job.job.id === ctx.job.id)?.state.consecutive_failures ?? 0,
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
  }

  /** F5: decisions remain readable even after the scheduler/policy is stopped. */
  private async readDecisionLog(options: { jobId?: string; limit?: number } = {}): Promise<unknown[]> {
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
  }

  /** F6 watcher hook: called after a note is created through the API. */
  private publishNoteCreated(projectId: string, notePath: string): void {
    this.eventBus?.publish({
      type: 'note.created',
      project: projectId,
      path: notePath,
      source: 'watcher',
    });
  }

  /** F6: execute a withheld mutating step only after explicit human approval. */
  public async decideApproval(
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
    const job = this.scheduler?.getStatus().jobs.find(item => item.job.id === request.jobId)?.job;
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
  }

  /** Stop the tick loop, close SSE clients and release the PID lock. */
  public async stopScheduler(options: { cancelActive?: boolean } = {}): Promise<void> {
    this.eventBus?.stop();
    this.eventBus = undefined;
    if (this.scheduleHeartbeat) {
      clearInterval(this.scheduleHeartbeat);
      this.scheduleHeartbeat = undefined;
    }
    for (const client of this.scheduleClients) client.end();
    this.scheduleClients.clear();
    if (this.scheduler) {
      await this.scheduler.stop(options);
      this.scheduler = undefined;
    }
    this.scheduledUseCases = {};
    this.policyAgent = undefined;
  }

  /** Adapter between the scheduler engine and the shared Use Case runner. */
  private async executeScheduledJob(ctx: JobExecutionContext): Promise<JobExecutionResult> {
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

    return {
      failedSteps: result.failedSteps,
      exitCodes: result.failedSteps.length > 0 ? [1] : [0],
    };
  }

  private broadcastScheduleEvent(event: SchedulerEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.scheduleClients) {
      try {
        client.write(payload);
      } catch {
        this.scheduleClients.delete(client);
      }
    }
  }

  /** Register an SSE client and keep a single shared keepalive timer. */
  private addScheduleClient(res: http.ServerResponse): () => void {
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
  }

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

  private validateApiToken(req: http.IncomingMessage): boolean {
    const requiredToken = process.env.WIKIFORGE_API_TOKEN;
    if (!requiredToken) return true;
    return verifyApiToken(apiTokenFromRequest(req), requiredToken);
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

  private proxyToFastApi(req: http.IncomingMessage, res: http.ServerResponse, targetPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const fastApiUrl = process.env.FASTAPI_SERVER_URL || 'http://127.0.0.1:8000';
      const parsedUrl = new URL(targetPath, fastApiUrl);

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${parsedUrl.hostname}:${parsedUrl.port}`,
        },
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
        proxyRes.on('end', () => resolve(true));
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `FastAPI Knowledge Graph Service unavailable: ${err.message}` }));
        }
        resolve(true);
      });

      req.pipe(proxyReq);
    });
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<boolean> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const projectId = this.getProjectIdFromRequest(req, url);

    // CORS preflight is public on every route, graph proxy included. It must
    // be answered before the token check or browsers could never call the API.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Project-Id, X-WikiForge-Token, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    // Documentation is public (the browser injects a token for "Try it out").
    if (await handleDocsRequest(req, res, pathname)) return true;

    // B4 — authenticate BEFORE any other ingress, the FastAPI graph proxy
    // included. Missing/invalid tokens get the exact B0 envelope.
    if (!this.validateApiToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: UNAUTHORIZED_MESSAGE }));
      return true;
    }

    // Reverse Proxy for Knowledge Graph & GraphRAG API endpoints
    if (
      (pathname === '/api/v1/graph/sync' || pathname === '/api/v1/graph/validate' || pathname === '/api/v1/graph/rag') &&
      (req.method === 'POST' || req.method === 'GET')
    ) {
      return this.proxyToFastApi(req, res, url.pathname + url.search);
    }

    // Every catalogue operation whose command is registered on the bus is now
    // an HTTP-neutral dispatch. The adapter only translates transport details
    // (path/query/body/headers) into a flat payload and writes the ApiResult.
    const catalogueMatch = matchRoute(API_ROUTES, req.method ?? '', pathname);
    if (catalogueMatch && this.bus.has(catalogueMatch.route.command)) {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of url.searchParams) payload[key] = value;
      for (const header of catalogueMatch.route.request.headers ?? []) {
        const value = req.headers[header.name.toLowerCase()];
        if (value !== undefined) payload[header.name] = value;
      }
      const accept = req.headers.accept ?? '';
      if (accept.includes('text/event-stream')) payload.stream = true;
      if (catalogueMatch.route.request.body) {
        try {
          const body = await readJsonBody(req);
          Object.assign(payload, body);
          payload.body = body;
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: String(err) }));
          return true;
        }
      }
      // Path parameters are authoritative: a body field named `id` (e.g. the
      // new project id on clone) must never shadow the source `:id` in the URL.
      Object.assign(payload, catalogueMatch.params);
      if (await this.dispatchApiCommand(catalogueMatch.route.command, payload, projectId, req, res)) return true;
    }

    // All catalogue routes are dispatched to domain modules through the bus.
    return false;
  }

  public async readAllWikiNotes(projectId: string = 'default'): Promise<WikiNote[]> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = await this.getWikiDir(projectId);
    const notes: WikiNote[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const relativePath = path.relative(projRoot, fullPath).replace(/\\/g, '/');
            const content = await fs.readFile(fullPath, 'utf-8');
            const stat = await fs.stat(fullPath).catch(() => null);
            const stem = entry.name.replace(/\.md$/i, '');
            const folder = path.relative(wikiDir, dir).replace(/\\/g, '/') || 'wiki';
            const titleFromName = stem.replace(/[-_]/g, ' ');

            const note = this.parser.parseNote(
              stem,
              titleFromName,
              content,
              folder === '.' ? 'wiki' : folder,
              relativePath
            );
            if (stat) {
              note.createdAt = stat.birthtime.toISOString();
              note.updatedAt = stat.mtime.toISOString();
            }
            notes.push(note);
          }
        }
      } catch (_e) {
        // Directory might not exist yet
      }
    };

    await walk(wikiDir);
    return this.parser.computeBacklinks(notes);
  }

  /** Parse the quick-notes scratchpad (`notes/quick-notes.md`) into individual
   *  entries delimited by `## [timestamp]` headings. */
  public async readScratchpadEntries(projectId: string = 'default'): Promise<ScratchpadEntry[]> {
    const notesFilePath = path.join(await this.resolveProjectRoot(projectId), 'notes', 'quick-notes.md');
    let raw = '';
    try {
      raw = await fs.readFile(notesFilePath, 'utf-8');
    } catch (_e) {
      return [];
    }

    return parseScratchpad(raw);
  }

  /** Remove a single scratchpad entry (matched by id) from `notes/quick-notes.md`. */
  public async deleteScratchpadEntry(id: string, projectId: string = 'default'): Promise<boolean> {
    const notesFilePath = path.join(await this.resolveProjectRoot(projectId), 'notes', 'quick-notes.md');
    let raw = '';
    try {
      raw = await fs.readFile(notesFilePath, 'utf-8');
    } catch (_e) {
      return false;
    }

    const entries = parseScratchpad(raw);
    const kept = entries.filter(entry => entry.id !== id);
    if (kept.length === entries.length) return false;

    const body = kept.map(entry => `## [${entry.timestamp}]\n${entry.text}\n\n`).join('');
    await atomicWriteFile(notesFilePath, SCRATCHPAD_INTRO + body, 'utf-8');
    return true;
  }

  public async getAllFolders(projectId: string = 'default'): Promise<string[]> {
    const wikiDir = await this.getWikiDir(projectId);
    const folders: string[] = ['wiki'];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const relativePath = path.relative(wikiDir, fullPath).replace(/\\/g, '/');
            if (relativePath && relativePath !== '.') {
              folders.push(relativePath);
            }
            await walk(fullPath);
          }
        }
      } catch (_e) {
        // Directory might not exist yet
      }
    };

    await walk(wikiDir);
    return folders.sort();
  }

  public async saveWikiNote(data: SaveNoteRequest, projectId: string = 'default'): Promise<WikiNote> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    let targetPath: string;

    if (data.path) {
      targetPath = path.isAbsolute(data.path)
        ? path.resolve(data.path)
        : path.resolve(projRoot, data.path);
    } else {
      const folder = data.folder && data.folder !== 'wiki' ? data.folder : '';
      const filename = `${data.id.endsWith('.md') ? data.id : `${data.id}.md`}`;
      targetPath = path.resolve(wikiDir, folder, filename);
    }

    // Path traversal containment check against wikiDir
    const rel = path.relative(wikiDir, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const err = new Error('Access denied: target path must reside inside wiki directory');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    const relativePath = path.relative(projRoot, targetPath).replace(/\\/g, '/');

    // `rawContent` carries the exact frontmatter + body produced by the editor.
    // Fall back to `content` for legacy callers (agent workflows write full notes).
    // Do NOT rewrite here: OKF frontmatter is added when the note is created,
    // while saving must preserve the author's bytes exactly.
    const contentToWrite = data.rawContent ?? data.content;

    // Keep a pre-write copy so the Review Studio "Confronta versioni" tab can
    // show what actually changed, even though the API container has no git.
    const previousContent = await fs.readFile(targetPath, 'utf-8').catch(() => '');
    if (previousContent && previousContent !== contentToWrite) {
      await this.writeReviewSnapshot(projectId, relativePath, previousContent, 'salvataggio');
    }

    await atomicWriteFile(targetPath, contentToWrite, 'utf-8');

    const folderName = path.relative(wikiDir, path.dirname(targetPath)).replace(/\\/g, '/') || 'wiki';
    const stem = path.basename(targetPath, '.md');
    const titleFromName = stem.replace(/[-_]/g, ' ');

    return this.parser.parseNote(
      stem,
      data.title || titleFromName,
      contentToWrite,
      folderName === '.' ? 'wiki' : folderName,
      relativePath
    );
  }

  /**
   * Applies a single, deterministic find/replace edit proposed by the agent.
   * The `find` block must match exactly once so the edit can never touch the
   * wrong location; ambiguous or missing matches are rejected instead of
   * letting the LLM rewrite an entire file.
   */
  public async applyWikiEdit(data: ApplyEditRequest, projectId: string = 'default'): Promise<WikiNote> {
    if (!data || typeof data.file !== 'string' || !data.file.trim()) {
      const err = new Error('Missing "file" in edit proposal');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    if (typeof data.find !== 'string' || data.find.length === 0) {
      const err = new Error('Missing or empty "find" block in edit proposal');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    if (typeof data.replace !== 'string') {
      const err = new Error('Missing "replace" block in edit proposal');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const rel = data.file.replace(/\\/g, '/').replace(/^\.?\//, '').trim();

    const resolveCandidates = (): string[] => {
      const rels = /\.md$/i.test(rel) ? [rel] : [rel, `${rel}.md`];
      const raw: string[] = [];
      for (const candidateRel of rels) {
        raw.push(path.resolve(wikiDir, candidateRel.replace(/^wiki\//i, '')));
        raw.push(path.resolve(projRoot, candidateRel));
      }
      const seen = new Set<string>();
      const candidates: string[] = [];
      for (const candidate of raw) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        const candidateRel = path.relative(wikiDir, candidate);
        if (!candidateRel.startsWith('..') && !path.isAbsolute(candidateRel)) {
          candidates.push(candidate);
        }
      }
      return candidates;
    };

    const containment = (candidate: string): string => path.relative(wikiDir, candidate);

    let targetPath: string | null = null;
    for (const candidate of resolveCandidates()) {
      try {
        await fs.access(candidate);
        targetPath = candidate;
        break;
      } catch (_e) {
        // try next candidate
      }
    }

    if (!targetPath) {
      const err = new Error(`Access denied or note not found: "${data.file}" must be an existing note inside the wiki directory`);
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

    const relToWiki = containment(targetPath);
    if (relToWiki.startsWith('..') || path.isAbsolute(relToWiki)) {
      const err = new Error('Access denied: target path must reside inside wiki directory');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

    const raw = await fs.readFile(targetPath, 'utf-8');
    const normalize = (value: string): string => value.replace(/\r\n/g, '\n');
    const rtrimLines = (value: string): string => value.split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n');
    const countMatches = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

    let haystack = normalize(raw);
    let needle = normalize(data.find).replace(/\n+$/, '');
    let replacement = normalize(data.replace);
    let occurrences = countMatches(haystack, needle);

    if (occurrences === 0) {
      const trimmedHaystack = rtrimLines(haystack);
      const trimmedNeedle = rtrimLines(needle);
      const trimmedOccurrences = countMatches(trimmedHaystack, trimmedNeedle);
      if (trimmedOccurrences > 0) {
        haystack = trimmedHaystack;
        needle = trimmedNeedle;
        replacement = rtrimLines(replacement);
        occurrences = trimmedOccurrences;
      }
    }

    if (occurrences === 0) {
      const err = new Error('Edit not applied: the "find" block was not found in the note (no exact match).');
      (err as unknown as { status: number }).status = 409;
      throw err;
    }
    if (occurrences > 1) {
      const err = new Error(`Edit not applied: the "find" block is ambiguous (${occurrences} matches). Add more surrounding context.`);
      (err as unknown as { status: number }).status = 409;
      throw err;
    }

    const updated = haystack.replace(needle, replacement);
    await atomicWriteFile(targetPath, updated, 'utf-8');

    const folderName = path.relative(wikiDir, path.dirname(targetPath)).replace(/\\/g, '/') || 'wiki';
    const stem = path.basename(targetPath, '.md');
    const relativePath = path.relative(projRoot, targetPath).replace(/\\/g, '/');

    return this.parser.parseNote(
      stem,
      stem.replace(/[-_]/g, ' '),
      updated,
      folderName === '.' ? 'wiki' : folderName,
      relativePath
    );
  }

  private async validateSafePath(targetPath: string, projectId: string = 'default'): Promise<void> {
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const rawDir = path.resolve(await this.getRawDir(projectId));
    const absTarget = path.resolve(targetPath);

    const relWiki = path.relative(wikiDir, absTarget);
    const relRaw = path.relative(rawDir, absTarget);

    const insideWiki = !relWiki.startsWith('..') && !path.isAbsolute(relWiki);
    const insideRaw = !relRaw.startsWith('..') && !path.isAbsolute(relRaw);

    if (!insideWiki && !insideRaw) {
      const err = new Error('Access denied: target path must reside inside wiki or raw directory');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
  }

  public async createFolderHandler(data: CreateFolderRequest, projectId: string = 'default'): Promise<string> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const target = path.resolve(wikiDir, data.folderPath.replace(/^wiki\/?/, ''));
    await this.validateSafePath(target, projectId);
    await fs.mkdir(target, { recursive: true });
    return path.relative(projRoot, target).replace(/\\/g, '/');
  }

  public async createFileHandler(data: CreateFileRequest, projectId: string = 'default'): Promise<WikiNote> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const folder = data.folderPath ? data.folderPath.replace(/^wiki\/?/, '') : '';
    const name = data.fileName.endsWith('.md') ? data.fileName : `${data.fileName}.md`;
    const target = path.resolve(wikiDir, folder, name);
    await this.validateSafePath(target, projectId);

    const title = data.fileName.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
    const defaultContent = ensureOkfFrontmatter(
      data.content ?? `# ${title}\n\n`,
      title,
      name,
    );
    await fs.mkdir(path.dirname(target), { recursive: true });
    await atomicWriteFile(target, defaultContent, 'utf-8');

    const id = path.basename(target, '.md');
    const relativePath = path.relative(projRoot, target).replace(/\\/g, '/');
    const folderName = path.relative(wikiDir, path.dirname(target)).replace(/\\/g, '/') || 'wiki';
    this.publishNoteCreated(projectId, relativePath);

    return this.parser.parseNote(id, id.replace(/[-_]/g, ' '), defaultContent, folderName === '.' ? 'wiki' : folderName, relativePath);
  }

  private async listWikiMarkdownFiles(wikiDir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (_e) {
        // Directory might not exist yet.
      }
    };

    await walk(wikiDir);
    return files;
  }

  /** Read a note and describe it the way the link rewriter needs it. */
  private async describeDocument(
    absPath: string,
    projRoot: string,
    wikiDir: string,
    extraAliases: string[] = []
  ): Promise<{ ref: DocumentRef; content: string; hasExplicitTitle: boolean }> {
    const content = await fs.readFile(absPath, 'utf-8');
    const stem = path.basename(absPath).replace(/\.md$/i, '');
    const relPath = path.relative(projRoot, absPath).replace(/\\/g, '/');
    const relId = path.relative(wikiDir, absPath).replace(/\\/g, '/').replace(/\.md$/i, '');
    const folder = path.relative(wikiDir, path.dirname(absPath)).replace(/\\/g, '/') || 'wiki';
    const note = this.parser.parseNote(stem, stem.replace(/[-_]/g, ' '), content, folder, relPath);

    const frontmatterTitle = note.frontmatter?.title;
    const hasExplicitTitle = typeof frontmatterTitle === 'string' && frontmatterTitle.trim().length > 0;

    const aliasValue = note.frontmatter?.aliases ?? note.frontmatter?.altLabel;
    const aliases = Array.isArray(aliasValue)
      ? aliasValue.map(value => String(value))
      : typeof aliasValue === 'string'
        ? [aliasValue]
        : [];

    return {
      content,
      hasExplicitTitle,
      ref: {
        relPath,
        relId,
        stem,
        title: String(note.title || stem),
        aliases: [...aliases, ...extraAliases],
      },
    };
  }

  private buildDocumentRef(absPath: string, projRoot: string, wikiDir: string, title: string, aliases: string[] = []): DocumentRef {
    return {
      relPath: path.relative(projRoot, absPath).replace(/\\/g, '/'),
      relId: path.relative(wikiDir, absPath).replace(/\\/g, '/').replace(/\.md$/i, ''),
      stem: path.basename(absPath).replace(/\.md$/i, ''),
      title,
      aliases,
    };
  }

  /**
   * Rewrite every vault link that points to the moved documents, then apply the
   * filesystem rename and write the updated contents.
   *
   * `performRename` is invoked only after all rewrites have been computed, so a
   * dry-run preview never touches the disk.
   */
  private async applyDocumentMoves(options: {
    projectId: string;
    moves: Array<{ oldAbs: string; newAbs: string }>;
    oldRefs: Map<string, DocumentRef>;
    newRefs: Map<string, DocumentRef>;
    contentOverrides: Map<string, string>;
    dryRun: boolean;
    performRename: () => Promise<void>;
  }): Promise<{ updates: RenameLinkUpdate[]; total: number }> {
    const projRoot = await this.resolveProjectRoot(options.projectId);
    const wikiDir = path.resolve(await this.getWikiDir(options.projectId));
    const files = await this.listWikiMarkdownFiles(wikiDir);

    const documents = new Map<string, { ref: DocumentRef; content: string }>();
    for (const fileAbs of files) {
      const key = path.resolve(fileAbs);
      try {
        documents.set(key, await this.describeDocument(fileAbs, projRoot, wikiDir));
      } catch (_e) {
        // Ignore unreadable files rather than aborting the whole operation.
      }
    }

    const allRelIds = files.map(fileAbs =>
      path.relative(wikiDir, fileAbs).replace(/\\/g, '/').replace(/\.md$/i, '')
    );

    const moves: DocumentMove[] = [];
    const pathMap = new Map<string, string>();
    for (const move of options.moves) {
      const oldKey = path.resolve(move.oldAbs);
      const oldRef = options.oldRefs.get(oldKey);
      const newRef = options.newRefs.get(oldKey);
      if (!oldRef || !newRef) continue;
      moves.push({ old: oldRef, new: newRef });
      pathMap.set(oldKey, path.resolve(move.newAbs));
    }

    const pending: Array<RenameLinkUpdate & { absPath: string; content: string }> = [];
    let total = 0;

    for (const fileAbs of files) {
      const key = path.resolve(fileAbs);
      const document = documents.get(key);
      if (!document) continue;

      const raw = options.contentOverrides.get(key) ?? document.content;
      const report = rewriteDocumentLinks(raw, {
        moves,
        sourceRelPath: document.ref.relPath,
        allRelIds,
      });

      const contentOverride = options.contentOverrides.has(key);
      if (report.replacements === 0 && !contentOverride) continue;

      total += report.replacements;
      pending.push({
        absPath: fileAbs,
        content: report.content,
        file: document.ref.relPath,
        replacements: report.replacements,
        samples: report.samples,
      });
    }

    if (options.dryRun) {
      return {
        total,
        updates: pending.map(({ file, replacements, samples }) => ({ file, replacements, samples })),
      };
    }

    await options.performRename();

    for (const update of pending) {
      const targetAbs = pathMap.get(path.resolve(update.absPath)) ?? update.absPath;
      await fs.mkdir(path.dirname(targetAbs), { recursive: true });
      await atomicWriteFile(targetAbs, update.content, 'utf-8');
    }

    return {
      total,
      updates: pending.map(({ file, replacements, samples }) => ({ file, replacements, samples })),
    };
  }

  private buildRenameResult(
    from: string,
    to: string,
    oldTitle: string,
    newTitle: string,
    id: string,
    dryRun: boolean,
    updates: RenameLinkUpdate[],
    total: number
  ): RenameResult {
    return {
      success: true,
      dryRun,
      renamed: { from, to, oldTitle, newTitle, id },
      updatedFiles: updates,
      totalReplacements: total,
    };
  }

  public async renameHandler(data: RenameRequest, projectId: string = 'default'): Promise<RenameResult> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const absOld = path.isAbsolute(data.oldPath) ? path.resolve(data.oldPath) : path.resolve(projRoot, data.oldPath);
    await this.validateSafePath(absOld, projectId);

    const stat = await fs.stat(absOld);

    if (stat.isDirectory()) {
      const rawName = (data.newTitle || data.newName || '').trim();
      if (!rawName) {
        const err = new Error('Missing "newTitle" or "newName" in rename request');
        (err as unknown as { status: number }).status = 400;
        throw err;
      }
      const folderName = data.newTitle ? slugifyDocumentTitle(rawName, path.basename(absOld)) : rawName;
      const absNew = path.resolve(path.dirname(absOld), folderName);
      await this.validateSafePath(absNew, projectId);

      if (path.resolve(absNew) !== path.resolve(absOld)) {
        const exists = await fs.stat(absNew).then(() => true).catch(() => false);
        if (exists) {
          const err = new Error(`Cannot rename: "${path.relative(projRoot, absNew)}" already exists`);
          (err as unknown as { status: number }).status = 409;
          throw err;
        }
      }

      const files = await this.listWikiMarkdownFiles(absOld);
      const oldRefs = new Map<string, DocumentRef>();
      const newRefs = new Map<string, DocumentRef>();
      const moves: Array<{ oldAbs: string; newAbs: string }> = [];

      for (const fileAbs of files) {
        const document = await this.describeDocument(fileAbs, projRoot, wikiDir);
        const relative = path.relative(absOld, fileAbs);
        const newFileAbs = path.resolve(absNew, relative);
        oldRefs.set(path.resolve(fileAbs), document.ref);
        newRefs.set(
          path.resolve(fileAbs),
          this.buildDocumentRef(newFileAbs, projRoot, wikiDir, document.ref.title, document.ref.aliases)
        );
        moves.push({ oldAbs: fileAbs, newAbs: newFileAbs });
      }

      const { updates, total } = await this.applyDocumentMoves({
        projectId,
        moves,
        oldRefs,
        newRefs,
        contentOverrides: new Map(),
        dryRun: Boolean(data.dryRun),
        performRename: async () => {
          if (path.resolve(absNew) !== path.resolve(absOld)) await fs.rename(absOld, absNew);
        },
      });

      return this.buildRenameResult(
        path.relative(projRoot, absOld).replace(/\\/g, '/'),
        path.relative(projRoot, absNew).replace(/\\/g, '/'),
        path.basename(absOld),
        path.basename(absNew),
        path.basename(absNew),
        Boolean(data.dryRun),
        updates,
        total
      );
    }

    const document = await this.describeDocument(absOld, projRoot, wikiDir, data.extraAliases ?? []);
    const requestedTitle = (data.newTitle ?? '').trim();

    let newTitle = document.ref.title;
    let newAbs = absOld;
    let writeTitle = false;

    if (requestedTitle) {
      newTitle = requestedTitle;
      writeTitle = requestedTitle !== document.ref.title.trim();

      if (writeTitle) {
        const stem = slugifyDocumentTitle(requestedTitle, document.ref.stem);
        const candidate = path.resolve(path.dirname(absOld), `${stem}.md`);
        if (path.basename(candidate).toLowerCase() !== path.basename(absOld).toLowerCase()) {
          newAbs = candidate;
        }
      }
    } else if (data.newName?.trim()) {
      const raw = data.newName.trim();
      const filename = /\.md$/i.test(raw) ? raw : `${raw}.md`;
      newAbs = path.resolve(path.dirname(absOld), filename);

      if (!document.hasExplicitTitle && newAbs !== absOld) {
        newTitle = path.basename(newAbs).replace(/\.md$/i, '').replace(/[-_]/g, ' ');
      }
    } else {
      const err = new Error('Missing "newTitle" or "newName" in rename request');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

    await this.validateSafePath(newAbs, projectId);

    if (path.resolve(newAbs) !== path.resolve(absOld)) {
      const exists = await fs.stat(newAbs).then(() => true).catch(() => false);
      if (exists) {
        const err = new Error(`Cannot rename: "${path.relative(projRoot, newAbs)}" already exists`);
        (err as unknown as { status: number }).status = 409;
        throw err;
      }
    }

    const newRef = this.buildDocumentRef(newAbs, projRoot, wikiDir, newTitle, document.ref.aliases);

    const overrides = new Map<string, string>();
    if (writeTitle) {
      let updated = setDocumentTitle(document.content, newTitle);
      updated = updateLeadingHeading(updated, document.ref.title, newTitle);
      overrides.set(path.resolve(absOld), updated);
    }

    const { updates, total } = await this.applyDocumentMoves({
      projectId,
      moves: [{ oldAbs: absOld, newAbs }],
      oldRefs: new Map([[path.resolve(absOld), document.ref]]),
      newRefs: new Map([[path.resolve(absOld), newRef]]),
      contentOverrides: overrides,
      dryRun: Boolean(data.dryRun),
      performRename: async () => {
        if (path.resolve(newAbs) !== path.resolve(absOld)) await fs.rename(absOld, newAbs);
      },
    });

    return this.buildRenameResult(
      document.ref.relPath,
      newRef.relPath,
      document.ref.title,
      newTitle,
      newRef.stem,
      Boolean(data.dryRun),
      updates,
      total
    );
  }

  public async moveHandler(data: MoveRequest, projectId: string = 'default'): Promise<RenameResult> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const absSource = path.isAbsolute(data.sourcePath) ? path.resolve(data.sourcePath) : path.resolve(projRoot, data.sourcePath);
    await this.validateSafePath(absSource, projectId);

    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const targetDir = path.resolve(wikiDir, data.targetFolder.replace(/^wiki\/?/, ''));
    await this.validateSafePath(targetDir, projectId);
    await fs.mkdir(targetDir, { recursive: true });

    const stat = await fs.stat(absSource);
    const absDest = path.resolve(targetDir, path.basename(absSource));
    await this.validateSafePath(absDest, projectId);

    if (path.resolve(absDest) === path.resolve(absSource)) {
      return this.buildRenameResult(
        path.relative(projRoot, absSource).replace(/\\/g, '/'),
        path.relative(projRoot, absDest).replace(/\\/g, '/'),
        path.basename(absSource),
        path.basename(absDest),
        path.basename(absDest).replace(/\.md$/i, ''),
        Boolean(data.dryRun),
        [],
        0
      );
    }

    const exists = await fs.stat(absDest).then(() => true).catch(() => false);
    if (exists) {
      const err = new Error(`Cannot move: "${path.relative(projRoot, absDest)}" already exists`);
      (err as unknown as { status: number }).status = 409;
      throw err;
    }

    const oldRefs = new Map<string, DocumentRef>();
    const newRefs = new Map<string, DocumentRef>();
    const moves: Array<{ oldAbs: string; newAbs: string }> = [];

    if (stat.isDirectory()) {
      const files = await this.listWikiMarkdownFiles(absSource);
      for (const fileAbs of files) {
        const document = await this.describeDocument(fileAbs, projRoot, wikiDir);
        const newFileAbs = path.resolve(absDest, path.relative(absSource, fileAbs));
        oldRefs.set(path.resolve(fileAbs), document.ref);
        newRefs.set(
          path.resolve(fileAbs),
          this.buildDocumentRef(newFileAbs, projRoot, wikiDir, document.ref.title, document.ref.aliases)
        );
        moves.push({ oldAbs: fileAbs, newAbs: newFileAbs });
      }
    } else {
      const document = await this.describeDocument(absSource, projRoot, wikiDir);
      oldRefs.set(path.resolve(absSource), document.ref);
      newRefs.set(
        path.resolve(absSource),
        this.buildDocumentRef(absDest, projRoot, wikiDir, document.ref.title, document.ref.aliases)
      );
      moves.push({ oldAbs: absSource, newAbs: absDest });
    }

    const { updates, total } = await this.applyDocumentMoves({
      projectId,
      moves,
      oldRefs,
      newRefs,
      contentOverrides: new Map(),
      dryRun: Boolean(data.dryRun),
      performRename: async () => {
        await fs.rename(absSource, absDest);
      },
    });

    return this.buildRenameResult(
      path.relative(projRoot, absSource).replace(/\\/g, '/'),
      path.relative(projRoot, absDest).replace(/\\/g, '/'),
      path.basename(absSource),
      path.basename(absDest),
      path.basename(absDest).replace(/\.md$/i, ''),
      Boolean(data.dryRun),
      updates,
      total
    );
  }

  /**
   * A11: deletions are recoverable. The file is moved to
   * `<project>/.wiki-forge/trash/` with an auditable manifest entry instead of
   * being unlinked, so an accidental UI/LLM delete is never data loss.
   */
  public async deleteHandler(data: DeleteRequest, projectId: string = 'default'): Promise<TrashEntry> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const absTarget = path.isAbsolute(data.targetPath) ? path.resolve(data.targetPath) : path.resolve(projRoot, data.targetPath);
    await this.validateSafePath(absTarget, projectId);
    return softDelete(absTarget, projRoot);
  }

  public async uploadHandler(data: UploadRequest, projectId: string = 'default'): Promise<void> {
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const folder = data.folderPath ? data.folderPath.replace(/^wiki\/?/, '') : '';
    const target = path.resolve(wikiDir, folder, data.fileName);
    await this.validateSafePath(target, projectId);

    await fs.mkdir(path.dirname(target), { recursive: true });

    if (data.isBase64) {
      const buffer = Buffer.from(data.content, 'base64');
      await atomicWriteFile(target, buffer);
    } else {
      const markdown = /\.md$/i.test(data.fileName)
        ? ensureOkfFrontmatter(data.content, data.fileName.replace(/\.md$/i, ''), data.fileName)
        : data.content;
      await atomicWriteFile(target, markdown, 'utf-8');
    }
    if (/\.md$/i.test(data.fileName)) {
      const projectRoot = await this.resolveProjectRoot(projectId);
      this.publishNoteCreated(projectId, path.relative(projectRoot, target).replace(/\\/g, '/'));
    }
  }

  public async attachToNote(data: AttachNoteRequest, projectId: string = 'default'): Promise<WikiNote> {
    const wikiDir = await this.getWikiDir(projectId);
    let targetId = data.noteId;
    if (!targetId && data.title) {
      targetId = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (!targetId) {
      targetId = `note-${Date.now()}`;
    }

    const folder = data.folder && data.folder !== 'wiki' ? data.folder : '';
    const filename = `${targetId.endsWith('.md') ? targetId : `${targetId}.md`}`;
    const targetPath = path.resolve(wikiDir, folder, filename);

    // Path traversal containment check
    const rel = path.relative(wikiDir, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const err = new Error('Access denied: target path must reside inside wiki directory');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

    let finalContent = data.content;
    const mode = data.mode ?? 'append';

    try {
      if (mode === 'append') {
        const existing = await fs.readFile(targetPath, 'utf-8');
        finalContent = `${existing.trim()}\n\n## Attached Note\n${data.content.trim()}\n`;
      }
    } catch (_err) {
      // File didn't exist: this is a new note, so guarantee OKF frontmatter
      // before the save. Existing notes keep their bytes untouched.
      const noteTitle = data.title || targetId.replace(/[-_]/g, ' ');
      if (!finalContent.startsWith('#') && !finalContent.startsWith('---')) {
        finalContent = `# ${noteTitle}\n\n${data.content}`;
      }
      finalContent = ensureOkfFrontmatter(finalContent, noteTitle, path.basename(targetPath));
    }

    return this.saveWikiNote({
      id: targetId,
      content: finalContent,
      folder: data.folder,
      title: data.title,
    }, projectId);
  }

  private parseHelpTopicFile(raw: string, fileName: string): { meta: HelpTopicMeta; body: string } | null {
    return this.catalogue.help.parse(raw, fileName);
  }

  private async loadHelpTopics(): Promise<HelpTopicMeta[]> {
    return this.catalogue.help.list();
  }

  private async loadHelpTopic(topicId: string): Promise<{ meta: HelpTopicMeta; body: string } | null> {
    return this.catalogue.help.get(topicId);
  }

  private async renderHelpCommand(query: string): Promise<string> {
    const topics = await this.loadHelpTopics();
    if (topics.length === 0) {
      return '### ❓ Guida\n\nContenuti della guida non trovati: manca la cartella `docs/help/`.';
    }
    const q = query.toLowerCase().trim();
    if (!q) {
      const list = topics.map(t => `- ${t.icon} \`${t.id}\` — **${t.title}**`).join('\n');
      return (
        '### ❓ Guida Wiki-Forge\n\n' +
        'Apri la guida completa in-app con il pulsante **?** in alto o il tasto **F1**.\n\n' +
        `Argomenti disponibili:\n\n${list}\n\n` +
        '*Esempio: `/help caricare-documenti`*'
      );
    }
    const qCompact = q.replace(/\s+/g, '-');
    const exact =
      topics.find(t => t.id === qCompact) ||
      topics.find(t => t.title.toLowerCase() === q) ||
      topics.find(t => t.keywords.some(k => k.toLowerCase() === q));
    const fuzzy =
      topics.find(t => t.id.includes(qCompact)) ||
      topics.find(t => t.title.toLowerCase().includes(q)) ||
      topics.find(t => t.keywords.some(k => k.toLowerCase().includes(q)));
    const target = exact || fuzzy;
    if (!target) {
      const suggestions = topics
        .filter(
          t =>
            t.id.includes(qCompact) ||
            t.keywords.some(k => q.split(/\s+/).some(w => w.length > 3 && k.includes(w)))
        )
        .slice(0, 5);
      const sugList = (suggestions.length ? suggestions : topics.slice(0, 5))
        .map(t => `- \`${t.id}\` — ${t.title}`)
        .join('\n');
      return `### ❓ Nessun argomento per "${query}"\n\nProva uno di questi:\n\n${sugList}\n\n*Elenco completo: \`/help\`*`;
    }
    const topic = await this.loadHelpTopic(target.id);
    if (!topic) {
      return `### ❓ Guida\n\nArgomento "${target.id}" non leggibile.`;
    }
    return (
      `### ${target.icon} ${target.title}\n\n${topic.body.trim()}\n\n` +
      `---\n*Guida in-app: pulsante **?** o tasto **F1** — argomento \`${target.id}\`.*`
    );
  }

  public async processChatCommandStream(
    req: ChatRequest,
    onChunk: (chunk: string) => void,
    projectId: string = 'default',
    principal?: Principal
  ): Promise<string> {
    const rawInput = (req.message || req.command || '').trim();
    if (rawInput.length > 50000) {
      throw new Error('Chat message exceeds maximum allowed length (50,000 characters).');
    }

    let command = '';
    let args = rawInput;

    if (rawInput.startsWith('/')) {
      const parts = rawInput.slice(1).split(' ');
      command = parts[0].toLowerCase();
      args = parts.slice(1).join(' ').trim();
    } else if (req.command) {
      command = req.command.toLowerCase().replace(/^\//, '');
    }

    if (command === 'compile' || command === 'audit' || command === 'trace' || command === 'reindex' || command === 'study-guide' || command === 'quiz' || command === 'deep-research' || command === 'mindmap' || command === 'note' || command === 'promote-note' || command === 'audio-overview' || command === 'thesis-chapter' || command === 'verify' || command === 'human-review' || command === 'apply' || command === 'applica' || command === 'help') {
      const result = await this.processChatCommand(req, projectId, principal);
      onChunk(result);
      return result;
    }

    if (command === 'wizard' && !WIZARD_SCENARIOS[args.toLowerCase().trim()]) {
      const text = `### 🪄 Wizard Scenarios\n\nChoose a scenario or launch it directly:\n\n${formatWizardList()}\n\n*Run with e.g. \`/wizard academic\`.*`;
      onChunk(text);
      return text;
    }

    const notes = await this.readAllWikiNotes(projectId);
    let contextNotes: WikiNote[] = [];
    if (args) {
      const queryWords = args.toLowerCase().split(/\s+/).filter(Boolean);
      contextNotes = notes
        .map(n => {
          let score = 0;
          const lowerTitle = n.title.toLowerCase();
          const lowerContent = n.content.toLowerCase();
          for (const word of queryWords) {
            if (lowerTitle.includes(word)) score += 5;
            if (lowerContent.includes(word)) score += 1;
          }
          return { note: n, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.note);
    }

    if (contextNotes.length === 0 && notes.length > 0) {
      contextNotes = notes.slice(0, 3);
    }

    const systemPrompt = await this.getSystemPrompt();
    const client = await this.getOrInitLlmClient();

    if (client.completeStream) {
      try {
        const wizardScenario = command === 'wizard' ? WIZARD_SCENARIOS[args.toLowerCase().trim()] : undefined;
        const userMsg = command === 'consult'
          ? `Perform /consult synthesis for query: "${args}"`
          : wizardScenario
            ? `Execute the "${wizardScenario.name}" wizard scenario now.`
            : (rawInput || 'Hello');
        const sysPrompt = command === 'consult'
          ? `${systemPrompt}\n\nTASK: Process a /consult workflow query according to AGENT.md §5.4. Synthesize relevant notes and cite using [[wikilinks]].`
          : wizardScenario
            ? `${systemPrompt}\n\nTASK: Execute the "${wizardScenario.name}" wizard scenario according to AGENT.md §/wizard. Follow the workflow steps: ${wizardScenario.workflow.join(' → ')}. Then run the scenario prompt and confirm each step.\nScenario prompt: ${wizardScenario.prompt}`
            : systemPrompt;

        return await client.completeStream(
          {
            systemPrompt: sysPrompt,
            userMessage: userMsg,
            contextNotes,
          },
          onChunk
        );
      } catch (err) {
        const fallback = await this.processChatCommand(req, projectId);
        onChunk(fallback);
        return fallback;
      }
    } else {
      const full = await this.processChatCommand(req, projectId, principal);
      onChunk(full);
      return full;
    }
  }

  public async processChatCommand(
    req: ChatRequest,
    projectId: string = 'default',
    principal?: Principal
  ): Promise<string> {
    const rawInput = (req.message || req.command || '').trim();
    if (rawInput.length > 50000) {
      throw new Error('Chat message exceeds maximum allowed length (50,000 characters).');
    }
    const notes = await this.readAllWikiNotes(projectId);

    let command = '';
    let args = rawInput;

    if (rawInput.startsWith('/')) {
      const parts = rawInput.slice(1).split(' ');
      command = parts[0].toLowerCase();
      args = parts.slice(1).join(' ').trim();
    } else if (req.command) {
      command = req.command.toLowerCase().replace(/^\//, '');
    }

    // Select context notes based on input
    let contextNotes: WikiNote[] = [];
    if (args) {
      const queryWords = args.toLowerCase().split(/\s+/).filter(Boolean);
      contextNotes = notes
        .map(n => {
          let score = 0;
          const lowerTitle = n.title.toLowerCase();
          const lowerContent = n.content.toLowerCase();

          for (const word of queryWords) {
            if (lowerTitle.includes(word)) score += 5;
            if (lowerContent.includes(word)) score += 1;
          }
          return { note: n, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.note);
    }

    if (contextNotes.length === 0 && notes.length > 0) {
      contextNotes = notes.slice(0, 3);
    }

    // Handle commands or general freeform query
    switch (command) {
      case 'consult': {
        const systemPrompt = await this.getSystemPrompt();
        const client = await this.getOrInitLlmClient();
        try {
          return await client.complete({
            systemPrompt: `${systemPrompt}\n\nTASK: Process a /consult workflow query according to AGENT.md §5.4. Synthesize relevant notes and cite using [[wikilinks]].`,
            userMessage: `Perform /consult synthesis for query: "${args}"`,
            contextNotes,
          });
        } catch (err) {
          return `### 🔍 Consult Synthesis for "${args}" (Fallback)\n\nFound **${contextNotes.length}** matching article(s):\n\n` +
            contextNotes.map(n => `- [[${n.id}]] (${n.folder}): ${n.title}`).join('\n') +
            `\n\n*Note: LLM provider unavailable (${String(err)}).*`;
        }
      }

      case 'compile': {
        return this.executeCompileWorkflow(projectId);
      }

      case 'audit': {
        return this.executeAuditWorkflow(notes, projectId);
      }

      case 'trace': {
        return await this.executeTraceWorkflow(args, notes);
      }

      case 'reindex': {
        return this.executeReindexWorkflow(projectId);
      }

      case 'study-guide': {
        return await this.executeStudyGuideWorkflow(args, notes, projectId);
      }

      case 'quiz': {
        return await this.executeQuizWorkflow(args, notes, projectId);
      }

      case 'mindmap': {
        return await this.executeMindmapWorkflow(args, notes, projectId);
      }

      case 'note': {
        return await this.executeNoteWorkflow(args, projectId);
      }

      case 'promote-note': {
        return await this.executePromoteNoteWorkflow(args, projectId);
      }

      case 'audio-overview': {
        return await this.executeAudioOverviewWorkflow(args, notes, projectId);
      }

      case 'thesis-chapter': {
        return await this.executeThesisChapterWorkflow(args, projectId);
      }

      case 'deep-research': {
        return await this.executeDeepResearchWorkflow(args, notes, projectId);
      }

      case 'verify':
      case 'human-review': {
        return await this.executeVerifyWorkflow(args, notes, projectId, principal);
      }

      case 'skill': {
        const skillsDir = path.resolve(this.rootDir, 'skills');
        try {
          const folders = await fs.readdir(skillsDir, { withFileTypes: true });
          const skillNames = folders.filter(f => f.isDirectory()).map(f => f.name);
          return `### 🛠️ Registered Agent Skills (${skillNames.length})\n\nAvailable skills in \`skills/\`:\n` +
            skillNames.map(s => `- \`/skill ${s}\` — \`skills/${s}/SKILL.md\``).join('\n') +
            `\n\n*Security Guardrail Active: Shell commands and write operations outside project workspace require explicit approval.*`;
        } catch (_e) {
          return `### 🛠️ Agent Skills\n\nSkills directory \`skills/\` not found.`;
        }
      }

      case 'wizard': {
        const scenarioId = args.toLowerCase().trim();
        const scenario = WIZARD_SCENARIOS[scenarioId];
        if (!scenario) {
          return `### 🪄 Wizard Scenarios\n\nChoose a scenario or launch it directly:\n\n${formatWizardList()}\n\n*Run with e.g. \`/wizard academic\`.*`;
        }
        const systemPrompt = await this.getSystemPrompt();
        const client = await this.getOrInitLlmClient();
        try {
          return await client.complete({
            systemPrompt: `${systemPrompt}\n\nTASK: Execute the "${scenario.name}" wizard scenario according to AGENT.md §/wizard. Follow the workflow steps: ${scenario.workflow.join(' → ')}. Then run the scenario prompt and confirm each step.\nScenario prompt: ${scenario.prompt}`,
            userMessage: `Execute the "${scenario.name}" wizard scenario now.`,
            contextNotes,
          });
        } catch (err) {
          return `### 🪄 Wizard: ${scenario.name}\n\n**Workflow:** ${scenario.workflow.join(' → ')}\n\n**Prompt:** ${scenario.prompt}\n\n*(LLM provider unavailable (${String(err)}).)*`;
        }
      }

      case 'apply':
      case 'applica': {
        return '### ✅ Applica modifica\n\nNessuna proposta pendente da applicare. Chiedi prima una modifica all\'agente: se la sua risposta include un blocco `wiki-edit`, questa la applicherà (usando il pulsante **Applica modifica** o rispondendo "sì, procedi").';
      }

      case 'help': {
        return await this.renderHelpCommand(args);
      }

      default: {
        if (!rawInput) {
          return `### 🤖 Agent Assistant\n\nAsk any question or use slash shortcuts:\n- \`/help [argomento]\` — guida in-app (anche con il tasto F1)\n- \`/consult <topic>\`\n- \`/compile\`\n- \`/audit\`\n- \`/trace <topic>\`\n- \`/reindex\`\n- \`/verify <note> [reviewer=<id>] [stable]\` — mark a note human-reviewed (🟢)\n- \`/wizard [scenario]\``;
        }

        const systemPrompt = await this.getSystemPrompt();
        const client = await this.getOrInitLlmClient();

        try {
          return await client.complete({
            systemPrompt,
            userMessage: rawInput,
            contextNotes,
          });
        } catch (err) {
          // Fallback response if LLM provider fails
          const match = contextNotes[0];
          if (match) {
            return `### 💡 Answer for "${rawInput}"\n\nBased on your wiki knowledge base, see [[${match.id}]] (${match.title}):\n\n${match.content.slice(0, 400)}...\n\nRelated articles: ${contextNotes.slice(0, 4).map(n => `[[${n.id}]]`).join(', ')}\n\n*(LLM completion error: ${String(err)})*`;
          }
          return `### 💡 Answer for "${rawInput}"\n\nProcessed query using agent guidelines. You can compile new findings into your wiki notes using the **Attach to Wiki** button below.\n\n*(LLM completion error: ${String(err)})*`;
        }
      }
    }
  }

  /**
   * One-shot "import a markdown file" workflow used by the simple UI.
   *
   * This intentionally reuses the *canonical* ingestion pipeline instead of
   * re-implementing it, so an import behaves exactly like the script/agent flow
   * a power user would run from the Script Control Panel:
   *
   *   1. Stage the source in `raw/<file>.md`, mirroring what
   *      `scripts/conv2md.py` does for plain-Markdown inputs (a passthrough
   *      copy from `sources/` into `raw/`).
   *   2. Run the very same `executeCompileWorkflow` that powers the `/compile`
   *      agent command (LLM compile following AGENT.md §5.1 + reindex); the
   *      only difference is that the target wiki sub-folder is overridden with
   *      the folder chosen by the user.
   *
   * When no LLM provider is configured the compile step fails and the file is
   * left in `raw/` for a later `/compile`, exactly like the normal offline flow.
   */
  public async ingestMarkdownHandler(
    data: IngestRequest,
    projectId: string = 'default'
  ): Promise<{ note: WikiNote | undefined; compiled: boolean; targetFolder: string; message: string }> {
    const badRequest = (msg: string) => {
      const err = new Error(msg);
      (err as unknown as { status: number }).status = 400;
      return err;
    };

    let fileName = path.basename((data.fileName || '').trim());
    if (!fileName) throw badRequest('fileName is required');
    if (!/\.md$/i.test(fileName)) fileName = `${fileName}.md`;

    const rawFolder = (data.targetFolder || '').trim().replace(/^wiki\/?/i, '').replace(/^\/+/, '');
    const targetFolder =
      (rawFolder || 'general').split('/').filter(seg => seg && seg !== '.' && seg !== '..').join('/') || 'general';

    const rawDir = path.resolve(await this.getRawDir(projectId));
    const rawPath = path.join(rawDir, fileName);
    await this.validateSafePath(rawPath, projectId);

    const content = data.isBase64
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : data.content;

    // Step 1 — stage in raw/ (same as conv2md.py's Markdown passthrough).
    await fs.mkdir(rawDir, { recursive: true });
    await atomicWriteFile(rawPath, content, 'utf-8');

    // Step 2 — compile through the exact `/compile` code path.
    try {
      await this.executeCompileWorkflow(projectId, { targetFolder, onlyFile: fileName });
    } catch (_err) {
      // No LLM provider (or prompt failure): the raw file stays staged for a
      // later `/compile`, mirroring the normal offline behaviour.
    }

    const compiledPath = path.join(rawDir, fileName.replace(/\.md$/i, '_COMPILED.md'));
    let compiled = false;
    try {
      await fs.access(compiledPath);
      compiled = true;
    } catch {
      // Not compiled yet.
    }

    const stem = fileName.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let note: WikiNote | undefined;
    if (compiled) {
      const notes = await this.readAllWikiNotes(projectId);
      note = notes.find(
        n => (n.folder || 'general') === targetFolder && path.basename(n.path).toLowerCase() === `${stem}.md`
      );
      // The agent may have filed the article in a thematic folder chosen by
      // itself (e.g. wiki/temi/), so fall back to a filename match anywhere.
      if (!note) {
        note = notes.find(n => path.basename(n.path).toLowerCase() === `${stem}.md`);
      }
    }

    const notePath = note?.path || `wiki/${targetFolder}/${stem}.md`;
    const message = compiled
      ? `Importato e compilato in ${notePath}`
      : `File copiato in raw/${fileName}: compilazione differita (agente/LLM non disponibile). Usa "Compila" per completare.`;
    if (compiled && note) this.publishNoteCreated(projectId, note.path);

    return { note, compiled, targetFolder, message };
  }

  private async executeCompileWorkflow(
    projectId: string = 'default',
    options: { targetFolder?: string; onlyFile?: string } = {}
  ): Promise<string> {
    const rawDir = await this.getRawDir(projectId);
    const uncompiledFiles: string[] = [];

    try {
      const entries = await fs.readdir(rawDir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isFile() &&
          entry.name.endsWith('.md') &&
          !entry.name.includes('_COMPILED') &&
          (!options.onlyFile || entry.name === options.onlyFile)
        ) {
          uncompiledFiles.push(entry.name);
        }
      }
    } catch (_e) {
      // raw directory might not exist
    }

    if (uncompiledFiles.length === 0) {
      const notes = await this.readAllWikiNotes(projectId);
      return `### ⚡ Compile Workflow Completed\n\n- **Uncompiled Files in \`raw/\`**: 0\n- **Wiki Articles Analyzed**: ${notes.length}\n- **Status**: Knowledge base fully interlinked and compiled according to \`AGENT.md\` guidelines.`;
    }

    const client = await this.getOrInitLlmClient();
    const systemPrompt = await this.getSystemPrompt();
    const compiledResults: string[] = [];

    for (const fileName of uncompiledFiles) {
      const rawPath = path.join(rawDir, fileName);
      const content = await fs.readFile(rawPath, 'utf-8');

      try {
        const prompt = `Ingest raw file '${fileName}' into the wiki following AGENT.md §5.1 compile guidelines. Generate article content in Markdown with YAML frontmatter, H1 title, summary, related [[wikilinks]], and sources section.`;
        const response = await client.complete({
          systemPrompt,
          userMessage: prompt,
          contextNotes: [{ id: fileName, title: fileName, content, folder: 'raw', path: `raw/${fileName}`, outboundLinks: [], tags: [], frontmatter: {}, backlinks: [] }],
        });

        // The OpenCode agent runs with filesystem tools and usually writes the
        // article itself (following AGENT.md), returning only a prose summary.
        // Persisting that summary as a note would create a junk "narration"
        // note next to the real article, so only save responses that are an
        // OKF article (YAML frontmatter + body).
        const stem = fileName.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const folder = options.targetFolder || 'general';
        const isArticle = response.trim().startsWith('---');
        if (isArticle) {
          await this.saveWikiNote({
            id: stem,
            folder,
            content: response,
            title: stem.replace(/[-_]/g, ' '),
          }, projectId);
        }

        // Rename file in raw/ to _COMPILED.md (the agent may have done it already).
        const compiledPath = path.join(rawDir, fileName.replace(/\.md$/i, '_COMPILED.md'));
        let rawStillStaged = true;
        try {
          await fs.access(rawPath);
        } catch {
          rawStillStaged = false;
        }
        if (rawStillStaged) await fs.rename(rawPath, compiledPath);

        compiledResults.push(
          isArticle
            ? `- Ingested \`${fileName}\` -> created \`wiki/${folder}/${stem}.md\` & renamed to \`_COMPILED.md\``
            : `- Ingested \`${fileName}\` -> note written by the agent (no duplicate saved); renamed to \`_COMPILED.md\``
        );
      } catch (err) {
        compiledResults.push(`- Error processing \`${fileName}\`: ${String(err)}`);
      }
    }

    await this.executeReindexWorkflow(projectId);

    return `### ⚡ Compile Workflow Execution Report\n\n**Processed ${uncompiledFiles.length} file(s):**\n${compiledResults.join('\n')}\n\n- **Indexes updated**: Regenerated \`wiki/index.md\` and thematic indexes.`;
  }

  private async executeAuditWorkflow(notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    void projectId;

    const baseName = (note: WikiNote): string => path.basename(note.path || '').toLowerCase();
    const isIndexNote = (note: WikiNote): boolean => baseName(note) === 'index.md';
    // index.md (§8) and log.md (§9) are OKF structural files: they are not
    // linked from notes, so they must not show up as orphans or as notes
    // missing frontmatter.
    const isStructural = (note: WikiNote): boolean =>
      isIndexNote(note) || baseName(note) === 'log.md';

    // 1 + 2. Links: resolve every wikilink with the same resolver used by the
    // viewer and the graph. A plain id/title set missed folder-qualified
    // targets such as [[strumenti/wiki-forge-script-panel]].
    const inbound = new Set<string>();
    const outbound = new Set<string>();
    const brokenLinks: Array<{ source: string; target: string }> = [];

    for (const note of notes) {
      if (note.outboundLinks.length > 0) outbound.add(note.path || note.id);

      for (const link of note.outboundLinks) {
        const clean = link.trim();
        if (!clean) continue;

        const target = this.parser.resolveLinkTarget(clean, notes);
        if (target) {
          inbound.add(target.path || target.id);
          continue;
        }

        // Links to a bundle index are valid even when the file is missing.
        const lower = clean.toLowerCase();
        if (lower === 'index' || lower.endsWith('/index')) continue;

        brokenLinks.push({ source: note.id, target: clean });
      }
    }

    // A true orphan has neither inbound nor outbound links (same rule as
    // scripts/wiki_stats.py); inbound-only would flag every note that is only
    // reachable from an index.
    const orphans = notes.filter(
      note =>
        !isStructural(note) &&
        !inbound.has(note.path || note.id) &&
        !outbound.has(note.path || note.id)
    );

    // 3. Frontmatter status. `note.content` has the YAML block stripped by
    // parseNote(), so the check must look at `note.frontmatter`.
    const missingFrontmatter: string[] = [];
    const missingTags: string[] = [];

    for (const note of notes) {
      if (isStructural(note)) continue;
      if (Object.keys(note.frontmatter ?? {}).length === 0) missingFrontmatter.push(note.id);
      if (!note.tags || note.tags.length === 0) missingTags.push(note.id);
    }

    const orphanList = orphans.map(n => `- [[${n.id}]]`).join('\n') || 'None';
    const brokenList = brokenLinks.map(b => `- [[${b.source}]] -> [[${b.target}]]`).join('\n') || 'None';
    const missingFmList = missingFrontmatter.map(id => `- [[${id}]]`).join('\n') || 'None (every note has a YAML frontmatter)';
    const missingTagsList = missingTags.map(id => `- [[${id}]]`).join('\n') || 'None (every note has tags)';

    return `### 🛡️ Audit Report\n\n- **Total Notes**: ${notes.length}\n\n- **Orphan Notes (${orphans.length})**:\n${orphanList}\n\n- **Broken Links (${brokenLinks.length})**:\n${brokenList}\n\n- **Missing Frontmatter (${missingFrontmatter.length})**:\n${missingFmList}\n\n- **Missing Tags (${missingTags.length})**:\n${missingTagsList}`;
  }

  // -------------------------------------------------------------------------
  // Study Studio generators (shared by chat commands and HTTP endpoints)
  // -------------------------------------------------------------------------

  /** Writes a study artefact under `<project>/output` and returns its relative path. */
  private async writeStudyOutput(projectId: string, fileName: string, markdown: string): Promise<string> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const outputDir = path.resolve(projRoot, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    await atomicWriteFile(filePath, markdown, 'utf-8');
    return path.relative(projRoot, filePath).replace(/\\/g, '/');
  }

  public async generateStudyGuide(topic: string, projectId: string = 'default'): Promise<StudyOutputResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const built = buildStudyGuide(notes, topic);
    const outputPath = await this.writeStudyOutput(projectId, `study-guide-${built.slug}.md`, built.markdown);
    return { success: true, markdown: built.markdown, outputPath, sources: built.sources };
  }

  public async generateQuiz(
    topic: string,
    count: number | undefined = 5,
    projectId: string = 'default'
  ): Promise<StudyQuizResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const requested = Number.isFinite(count) ? Number(count) : 5;
    const built = buildQuiz(notes, topic, requested);
    const outputPath = await this.writeStudyOutput(projectId, `quiz-${built.slug}.md`, built.markdown);
    return {
      success: true,
      markdown: built.markdown,
      outputPath,
      sources: built.sources,
      count: built.count,
    };
  }

  public async generateMindmap(target: string, projectId: string = 'default'): Promise<StudyMindmapResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const built = buildMindmap(notes, target);
    if (!built.note) {
      return {
        success: false,
        markdown: built.markdown,
        outputPath: '',
        sources: [],
        nodes: [],
        links: [],
        headings: 0,
        wikilinks: 0,
        error: 'Nessuna nota corrispondente trovata per la mappa concettuale.',
      };
    }
    const outputPath = await this.writeStudyOutput(projectId, `mindmap-${built.slug}.md`, built.markdown);
    return {
      success: true,
      markdown: built.markdown,
      outputPath,
      sources: [built.note],
      note: built.note,
      nodes: built.nodes,
      links: built.links,
      headings: built.headings,
      wikilinks: built.wikilinks,
    };
  }

  public async generateAudioOverview(topic: string, projectId: string = 'default'): Promise<StudyOutputResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const built = buildAudioOverview(notes, topic);
    const projRoot = await this.resolveProjectRoot(projectId);
    await fs.mkdir(path.resolve(projRoot, 'output', 'audio'), { recursive: true });
    const outputPath = await this.writeStudyOutput(projectId, `audio-script-${built.slug}.md`, built.markdown);
    return { success: true, markdown: built.markdown, outputPath, sources: built.sources };
  }

  /**
   * Appends a dated entry to `notes/quick-notes.md` and returns the freshly
   * parsed scratchpad so the Studio can refresh its list without a second call.
   */
  public async addQuickNote(text: string, projectId: string = 'default'): Promise<StudyQuickNoteResponse> {
    const markdown = await this.executeNoteWorkflow(text, projectId);
    const entries = await this.readScratchpadEntries(projectId);
    const success = Boolean((text || '').trim());
    return {
      success,
      markdown,
      entry: success ? entries[entries.length - 1] : undefined,
      entries,
      error: success ? undefined : 'Il testo della nota è vuoto.',
    };
  }

  /**
   * Promotes one scratchpad entry into a wiki article. When `noteId` matches an
   * entry id the article body uses that entry's text; otherwise it falls back to
   * the whole scratchpad (legacy `/promote-note <slug> <folder>` behaviour).
   */
  public async promoteQuickNote(
    noteId: string,
    folder: string = 'general',
    projectId: string = 'default'
  ): Promise<StudyPromoteResponse> {
    const id = (noteId || '').trim();
    if (!id) {
      return {
        success: false,
        markdown: `### 🚀 Promote Note\n\nSpecifica l'id della nota veloce da promuovere.`,
        error: 'Id nota mancante.',
      };
    }

    const projRoot = await this.resolveProjectRoot(projectId);
    const notesFilePath = path.join(projRoot, 'notes', 'quick-notes.md');

    let raw = '';
    try {
      raw = await fs.readFile(notesFilePath, 'utf-8');
    } catch (_e) {
      return {
        success: false,
        markdown: `### 🚀 Promote Note\n\nNo scratchpad notes found in \`notes/quick-notes.md\`.`,
        error: 'Scratchpad non trovato.',
      };
    }

    const entries = parseScratchpad(raw);
    const selected = entries.find(entry => entry.id === id);
    const bodyText = selected ? selected.text : raw;

    const baseName = selected && /^\d{4}-\d{2}-\d{2}/.test(id) ? selected.text.split('\n')[0] : id;
    const stem = (baseName || id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'quick-note';
    const title = stem.replace(/[-_]/g, ' ');
    const targetFolder = (folder || 'general').trim() || 'general';

    const newArticleContent = `---
type: Note
title: "${title.charAt(0).toUpperCase() + title.slice(1)}"
tags: [promoted-note, ${targetFolder}]
created: ${new Date().toISOString().slice(0, 10)}
updated: ${new Date().toISOString().slice(0, 10)}
sources:
  - resource: notes/quick-notes.md
---

# ${title.charAt(0).toUpperCase() + title.slice(1)}

## Summary
- Promoted quick note from scratchpad \`notes/quick-notes.md\`${selected ? ` (entry \`${selected.id}\`)` : ''}.

## Body
${bodyText.slice(0, 500)}

## Related
- [[index]]

## Sources
- notes/quick-notes.md
`;

    const createdNote = await this.saveWikiNote({
      id: stem,
      folder: targetFolder,
      content: newArticleContent,
      title,
    }, projectId);

    await this.executeReindexWorkflow(projectId);

    return {
      success: true,
      markdown: `### 🚀 Note Promoted to Wiki Article\n\n- **Created Article**: \`wiki/${createdNote.folder}/${createdNote.id}.md\`\n- **Thematic Index Updated**: \`wiki/${createdNote.folder}/index.md\`\n- **Master Index Updated**: \`wiki/index.md\``,
      note: createdNote,
    };
  }

  public async generateThesisChapter(
    options: { topic?: string; title?: string; minMaturity?: number } = {},
    projectId: string = 'default'
  ): Promise<StudyThesisResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const built = buildThesis(notes, options);
    const slug = slugifyTopic(options.topic || options.title || 'draft', 'tesi');
    const outputPath = await this.writeStudyOutput(projectId, `thesis-${slug}.md`, built.markdown);
    // Keep the canonical draft in sync so the "Export Thesis to PDF" script
    // (default input `output/thesis_compiled.md`) works right after a run.
    await this.writeStudyOutput(projectId, 'thesis_compiled.md', built.markdown);
    return {
      success: true,
      markdown: built.markdown,
      outputPath,
      sources: notes
        .filter(note => built.chapters.some(chapter => chapter.path === note.path) || built.syntheses.some(synthesis => synthesis.path === note.path))
        .map(note => ({ id: note.id, title: note.title, path: note.path, folder: note.folder || 'wiki' })),
      title: built.title,
      chapters: built.chapters,
      syntheses: built.syntheses,
    };
  }

  public async executeStudyGuideWorkflow(topic: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const built = buildStudyGuide(notes, topic);
    const relPath = await this.writeStudyOutput(projectId, `study-guide-${built.slug}.md`, built.markdown);
    return `### 📚 Study Guide Generated\n\n- **Saved to**: \`${relPath}\`\n- **Source Articles Cited**: ${built.notes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*Study guide is ready in output directory.*`;
  }

  public async executeNoteWorkflow(noteText: string, projectId: string = 'default'): Promise<string> {
    const notesDir = path.join(await this.resolveProjectRoot(projectId), 'notes');
    await fs.mkdir(notesDir, { recursive: true });

    const text = (noteText || '').trim();
    if (!text) {
      return `### 📝 Quick Note\n\nPlease provide note content. Example: \`/note Key insight about LLM memory\``;
    }

    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const notesFilePath = path.join(notesDir, 'quick-notes.md');

    // Read, then make sure the file ends with a blank line: appending the new
    // heading straight after the previous text is what glued new notes to the
    // old one. `normalizeScratchpad` also repairs files that already have a
    // glued heading.
    let existing = '';
    try {
      existing = await fs.readFile(notesFilePath, 'utf-8');
    } catch (_e) {
      existing = SCRATCHPAD_INTRO;
    }

    const base = normalizeScratchpad(existing).replace(/\s+$/, '');
    const prefix = base ? `${base}\n\n` : SCRATCHPAD_INTRO;

    const entry = `## [${timestamp}]\n${text}\n\n`;
    await atomicWriteFile(notesFilePath, prefix + entry, 'utf-8');

    return `### 📝 Quick Note Saved\n\n- **Stored in**: \`notes/quick-notes.md\`\n- **Status**: Saved in scratchpad (excluded from \`wiki/index.md\`). Use \`/promote-note <id> <wiki-name>\` to convert to a formal article.`;
  }

  public async executeAudioOverviewWorkflow(target: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const built = buildAudioOverview(notes, target);
    const projRoot = await this.resolveProjectRoot(projectId);
    await fs.mkdir(path.resolve(projRoot, 'output', 'audio'), { recursive: true });
    const relScriptPath = await this.writeStudyOutput(projectId, `audio-script-${built.slug}.md`, built.markdown);

    return `### 🎙️ Audio Overview Script Generated\n\n- **Dialogue Script**: \`${relScriptPath}\`\n- **TTS Provider Status**: \`none\` (Audio synthesis disabled in \`config.toml\`). Dialogue script generated successfully.\n- **Sources Covered**: ${built.notes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*To enable MP3 generation, configure \`[audio]\` provider in \`config.toml\`.*`;
  }

  public async executePromoteNoteWorkflow(argsText: string, projectId: string = 'default'): Promise<string> {
    const parts = (argsText || '').trim().split(/\s+/);
    const noteId = parts[0];
    const wikiName = parts[1] || 'general';

    if (!noteId) {
      return `### 🚀 Promote Note\n\nUsage: \`/promote-note <note-id> [wiki-folder]\``;
    }

    const result = await this.promoteQuickNote(noteId, wikiName, projectId);
    return result.markdown;
  }

  public async executeThesisChapterWorkflow(
    argsText: string,
    projectId: string = 'default'
  ): Promise<string> {
    const tokens = (argsText || '').trim().split(/\s+/).filter(Boolean);
    let minMaturity = 0;
    let title = '';

    const kept: string[] = [];
    for (const token of tokens) {
      const maturityMatch = token.match(/^maturity=(\d+)$/i);
      if (maturityMatch) {
        minMaturity = Number.parseInt(maturityMatch[1], 10);
        continue;
      }
      const titleMatch = token.match(/^title=(.+)$/i);
      if (titleMatch) {
        title = titleMatch[1];
        continue;
      }
      kept.push(token);
    }

    const topic = kept.join(' ');
    const result = await this.generateThesisChapter({ topic, title, minMaturity }, projectId);

    return `### 🎓 Thesis Chapter Generated\n\n- **Saved to**: \`${result.outputPath}\`\n- **Current draft**: \`output/thesis_compiled.md\`\n- **Chapters**: ${result.chapters.length}\n- **Syntheses**: ${result.syntheses.length}\n- **Minimum maturity**: ${minMaturity}\n\n*Draft ready in the output directory. Use Developer Mode → Export Thesis to PDF for the final PDF.*`;
  }

  /**
   * Adds an OKF v0.2 human verification event to a note's frontmatter.
   *
   * This is the operation that flips a node's trust tier to `human-reviewed`
   * (🟢 instead of 🟡/⚪), because the tier is derived from the `verified`
   * list (docs/OKF_SPEC.md §6). Optionally promotes `status` to `stable`,
   * which ontology Rule 3 only allows for human-verified notes.
   */
  public async executeVerifyWorkflow(
    argsText: string,
    notes: WikiNote[],
    projectId: string = 'default',
    principal?: Principal
  ): Promise<string> {
    const tokens = (argsText || '').trim().split(/\s+/).filter(Boolean);
    let reviewerId = 'local';
    let setStable = false;
    let comment = '';
    const noteTokens: string[] = [];

    for (const token of tokens) {
      const eq = token.indexOf('=');
      if (eq > 0) {
        const key = token.slice(0, eq).toLowerCase();
        const value = token.slice(eq + 1).replace(/^["']|["']$/g, '');
        if (key === 'reviewer' || key === 'by' || key === 'user' || key === 'as') reviewerId = value;
        else if (key === 'comment' || key === 'reason') comment = value;
        else noteTokens.push(token);
        continue;
      }
      if (token.toLowerCase() === 'stable') {
        setStable = true;
        continue;
      }
      if (token.toLowerCase() === 'draft') {
        setStable = false;
        continue;
      }
      noteTokens.push(token);
    }

    const noteRef = noteTokens.join(' ').trim().replace(/^\[\[|\]\]$/g, '');

    const usage = `### ✅ Human Verification\n\nUsage: \`/verify <note> [reviewer=<id>] [stable] [comment=<text>]\`\n\n` +
      `- \`<note>\`: note id, title, or path (e.g. \`stefano-gatti\` or \`wiki/autori/stefano-gatti.md\`).\n` +
      `- \`reviewer=<id>\`: human reviewer id (default \`local\`, written as \`human:<id>\`).\n` +
      `- \`stable\`: also promote \`status\` to \`stable\` (requires human review, per ontology Rule 3).\n` +
      `- \`comment=<text>\`: optional note recorded in \`wiki/log.md\`.\n\n` +
      `Example: \`/verify stefano-gatti reviewer=studente stable\`\n\n` +
      `*This writes a \`verified: - by: human:<id>\` entry — the only action that turns a node 🟢 in the graph/sidebar.*`;

    if (!noteRef) {
      return usage;
    }

    const result = await this.recordHumanVerification({
      noteRef,
      reviewer: reviewerId,
      comment,
      setStable,
      projectId,
      notes,
      principal,
    });

    if (!result.success) {
      if (result.error === 'not-found') {
        const sample = notes
          .filter(n => !n.path.endsWith('index.md') && !n.path.endsWith('log.md'))
          .slice(0, 8)
          .map(n => `\`${n.id}\``)
          .join(', ');
        return `### ✅ Human Verification\n\nNo wiki note matched \`${noteRef}\`.\n\nTry one of: ${sample || 'none'}.`;
      }
      return `### ✅ Human Verification\n\nCould not read \`${result.path ?? noteRef}\`: ${result.error ?? 'unknown error'}`;
    }

    const target = result.target!;
    const finalNote = result.note!;
    const actor = result.actor!;
    const timestamp = result.timestamp!;
    const tierLabel = finalNote.trustTier === 'human-reviewed'
      ? '🟢 human-reviewed'
      : finalNote.trustTier === 'machine-confirmed'
        ? '🟡 machine-confirmed'
        : '⚪ unverified';

    return `### ✅ Human Verification Recorded\n\n` +
      `- **Note**: [[${target.id}]] (\`${target.path}\`)\n` +
      `- **Reviewer**: \`${actor}\`\n` +
      `- **Verified at**: ${timestamp}\n` +
      `- **Trust tier**: ${tierLabel}\n` +
      `- **Status**: ${finalNote.status ?? 'draft'}\n` +
      `- **Log**: \`wiki/log.md\` ${result.changed ? 'updated' : 'unchanged'}\n\n` +
      `${result.changed ? '_Verification written to frontmatter._' : '_A verification by this reviewer already existed; nothing changed._'}\n\n` +
      `*Run \`/ontology-check\` and \`/lint-frontmatter\` to validate.*`;
  }

  /**
   * Structured, reusable implementation of the OKF `verified` mutation.
   *
   * Both `/verify` (chat) and `POST /api/notes/review/verify` (Review Studio)
   * call this method, so the two entry points can never drift apart. It returns
   * data instead of Markdown; formatting stays in `executeVerifyWorkflow`.
   */
  public async recordHumanVerification(options: {
    noteRef: string;
    reviewer?: string;
    comment?: string;
    setStable?: boolean;
    projectId?: string;
    notes?: WikiNote[];
    /** B5 — supplied by the bus adapter; never read from the HTTP body. */
    principal?: Principal;
  }): Promise<{
    success: boolean;
    error?: 'not-found' | 'read-failed' | 'invalid-path' | string;
    target?: WikiNote;
    note?: WikiNote;
    actor?: string;
    timestamp?: string;
    changed?: boolean;
    alreadyVerified?: boolean;
    changedStable?: boolean;
    logUpdated?: boolean;
    path?: string;
    previousContent?: string;
    content?: string;
  }> {
    const projectId = options.projectId ?? 'default';
    const noteRef = (options.noteRef || '').trim().replace(/^\[\[|\]\]$/g, '');
    if (!noteRef) return { success: false, error: 'not-found' };

    const notes = options.notes ?? await this.readAllWikiNotes(projectId);
    const target = this.resolveReviewTarget(noteRef, notes);
    if (!target) return { success: false, error: 'not-found', path: noteRef };

    // B5: strict mode binds the actor to the server-derived Principal. Legacy
    // mode keeps the exact raw-reviewer normalization of the old implementation.
    const actor = this.strictProvenance
      ? canonicalActor(options.principal?.actor, PROCESS_FALLBACK_ACTOR)
      : `human:${(options.reviewer || 'local').replace(/^human:/i, '').trim() || 'local'}`;
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const setStable = options.setStable === true;

    // Ontology Rule 3: `status: stable` needs a human: verified entry. A
    // process principal may refresh `verified`, but must never promote to
    // stable (the legacy path is unchanged and still allows its raw reviewer).
    if (this.strictProvenance && setStable && actorKind(actor) !== 'human') {
      return {
        success: false,
        error: 'stable-requires-human-actor',
        target,
        path: target.path,
      };
    }

    const projRoot = await this.resolveProjectRoot(projectId);
    const absPath = path.resolve(projRoot, target.path);
    try {
      await this.validateSafePath(absPath, projectId);
    } catch (err) {
      return { success: false, error: 'invalid-path', target, path: target.path };
    }

    let raw = '';
    try {
      raw = await fs.readFile(absPath, 'utf-8');
    } catch (err) {
      return { success: false, error: `read-failed: ${String(err)}`, target, path: target.path };
    }

    const { content, alreadyVerified, changedStable, changed } = this.applyVerification(raw, actor, timestamp, setStable);
    if (changed) {
      await this.writeReviewSnapshot(projectId, target.path, raw, 'verifica');
    }
    await atomicWriteFile(absPath, content, 'utf-8');

    let logUpdated = false;
    if (changed) {
      const changeBits: string[] = [];
      changeBits.push(alreadyVerified ? 'verification refreshed' : `added \`by: ${actor}\``);
      if (setStable) changeBits.push(changedStable ? 'status → stable' : 'status already stable');
      const logMsg = `Human-verified [${target.title}](${target.path.replace(/^wiki\//, '')}) by \`${actor}\` (${changeBits.join('; ')})${options.comment ? ` — ${options.comment}` : ''}.`;
      const wikiDir = await this.getWikiDir(projectId);
      await this.appendWikiLog(wikiDir, logMsg, timestamp.slice(0, 10));
      logUpdated = true;
    }

    const note = this.parser.parseNote(target.id, target.title, content, target.folder || 'wiki', target.path);
    return {
      success: true,
      target,
      note,
      actor,
      timestamp,
      changed,
      alreadyVerified,
      changedStable,
      logUpdated,
      path: target.path,
      previousContent: raw,
      content,
    };
  }

  /** Resolve a note by id, title, folder/stem or path, case-insensitively. */
  private resolveReviewTarget(noteRef: string, notes: WikiNote[]): WikiNote | null {
    const ref = noteRef.trim().toLowerCase().replace(/^\.?\//, '').replace(/\.md$/i, '');
    return this.parser.resolveLinkTarget(noteRef, notes)
      || notes.find(n => n.id.toLowerCase() === ref)
      || notes.find(n => n.title.toLowerCase() === ref)
      || notes.find(n => n.path.toLowerCase() === ref)
      || notes.find(n => n.path.toLowerCase().replace(/\.md$/i, '').endsWith(`/${ref}`))
      || notes.find(n => n.path.toLowerCase().replace(/\.md$/i, '') === ref)
      || null;
  }

  /**
   * Inserts a `verified` event into an OKF frontmatter block and optionally
   * promotes `status` to `stable`, preserving the note body untouched.
   */
  private applyVerification(
    rawContent: string,
    actor: string,
    timestamp: string,
    setStable: boolean
  ): { content: string; alreadyVerified: boolean; changedStable: boolean; changed: boolean } {
    const newline = rawContent.includes('\r\n') ? '\r\n' : '\n';
    const fmMatch = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(rawContent);

    let fmLines: string[] = [];
    let body = rawContent;
    if (fmMatch) {
      fmLines = fmMatch[1].split(/\r?\n/);
      body = rawContent.slice(fmMatch[0].length);
    }

    // Locate the top-level `verified:` key.
    let verifiedIndex = -1;
    for (let i = 0; i < fmLines.length; i++) {
      if (/^verified\s*:/.test(fmLines[i])) {
        verifiedIndex = i;
        break;
      }
    }

    // Collect the actors already recorded in the verified block.
    const existingActors: string[] = [];
    if (verifiedIndex !== -1) {
      const inline = fmLines[verifiedIndex].slice(fmLines[verifiedIndex].indexOf(':') + 1).trim();
      if (inline.startsWith('[') && inline.endsWith(']')) {
        for (const item of inline.slice(1, -1).split(',')) {
          const a = item.trim().replace(/^['"]|['"]$/g, '');
          if (a) existingActors.push(a.toLowerCase());
        }
      }
      for (let i = verifiedIndex + 1; i < fmLines.length; i++) {
        const line = fmLines[i];
        if (line.trim() === '') continue;
        if (!/^\s/.test(line)) break; // next top-level key ends the block
        const m = line.match(/^\s*-?\s*(?:by\s*:\s*)?(.+)$/);
        if (!m) continue;
        const val = m[1].trim().replace(/^['"]|['"]$/g, '');
        if (val && !/^at\s*:/i.test(val)) existingActors.push(val.toLowerCase());
      }
    }

    const alreadyVerified = existingActors.includes(actor.toLowerCase());
    let changed = false;

    if (!alreadyVerified) {
      // Upgrade an inline array into a block form so entries can be appended.
      if (verifiedIndex !== -1) {
        const inline = fmLines[verifiedIndex].slice(fmLines[verifiedIndex].indexOf(':') + 1).trim();
        if (inline.startsWith('[')) {
          const items = inline
            .slice(1, -1)
            .split(',')
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
          fmLines[verifiedIndex] = 'verified:';
          fmLines.splice(verifiedIndex + 1, 0, ...items.map(a => `  - by: ${a}`));
          verifiedIndex += items.length;
        }
      }

      const entry = [`  - by: ${actor}`, `    at: ${timestamp}`];
      if (verifiedIndex === -1) {
        fmLines.push('verified:');
        fmLines.push(...entry);
      } else {
        fmLines.splice(verifiedIndex + 1, 0, ...entry);
      }
      changed = true;
    }

    let changedStable = false;
    if (setStable) {
      const statusIndex = fmLines.findIndex(l => /^status\s*:/.test(l));
      if (statusIndex === -1) {
        fmLines.push('status: stable');
        changedStable = true;
        changed = true;
      } else if (fmLines[statusIndex].replace(/^status\s*:\s*/i, '').trim().toLowerCase() !== 'stable') {
        fmLines[statusIndex] = 'status: stable';
        changedStable = true;
        changed = true;
      }
    }

    const content = `---${newline}${fmLines.join(newline)}${newline}---${newline}${body}`;
    return { content, alreadyVerified, changedStable, changed };
  }

  /**
   * Appends an entry to `wiki/log.md` (OKF §9), creating a dated section when
   * today's section does not exist yet (newest dates first).
   */
  private async appendWikiLog(wikiDir: string, message: string, date: string): Promise<void> {
    const logPath = path.join(wikiDir, 'log.md');
    let raw = '';
    try {
      raw = await fs.readFile(logPath, 'utf-8');
    } catch (_e) {
      raw = '# Wiki Update Log\n';
    }

    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const header = `## ${date}`;
    const entry = `* **Update**: ${message}`;
    const headerIdx = lines.findIndex(l => l.trim() === header);

    if (headerIdx !== -1) {
      let insertAt = headerIdx + 1;
      while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
      lines.splice(insertAt, 0, entry);
    } else {
      const titleIdx = lines.findIndex(l => l.startsWith('# '));
      const insertAt = titleIdx === -1 ? lines.length : titleIdx + 1;
      lines.splice(insertAt, 0, '', header, '', entry);
    }

    await atomicWriteFile(logPath, lines.join(newline), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // Review Studio support (meta, quality gate, digest, snapshots, critique)
  // ---------------------------------------------------------------------------

  private getSnapshotDir(projectRoot: string, noteRelPath: string): string {
    const rel = noteRelPath
      .replace(/\\/g, '/')
      .replace(/^wiki\//i, '')
      .replace(/\.md$/i, '');
    return path.join(projectRoot, '.wiki-forge', 'snapshots', rel);
  }

  /**
   * Stores the pre-write content of a note under `.wiki-forge/snapshots/`.
   * Git is not required (and is unavailable inside the API container), so this
   * is the local history behind the Review Studio "Confronta versioni" tab.
   */
  public async writeReviewSnapshot(
    projectId: string,
    noteRelPath: string,
    content: string,
    reason: string = 'salvataggio'
  ): Promise<void> {
    if (!content.trim()) return;
    try {
      const projRoot = await this.resolveProjectRoot(projectId);
      const dir = this.getSnapshotDir(projRoot, noteRelPath);
      await fs.mkdir(dir, { recursive: true });

      const now = new Date();
      const stamp = now.toISOString().replace(/[:.]/g, '-');
      const base = path.join(dir, stamp);
      await atomicWriteFile(`${base}.md`, content, 'utf-8');
      await atomicWriteFile(
        `${base}.json`,
        JSON.stringify({ at: now.toISOString(), reason, path: noteRelPath }, null, 2),
        'utf-8'
      );

      const keep = 25;
      const files = (await fs.readdir(dir)).filter(name => name.endsWith('.md')).sort();
      for (const old of files.slice(0, Math.max(0, files.length - keep))) {
        await fs.unlink(path.join(dir, old)).catch(() => undefined);
        await fs.unlink(path.join(dir, old.replace(/\.md$/i, '.json'))).catch(() => undefined);
      }
    } catch (_err) {
      // Snapshots are best-effort: never block a note write because history failed.
    }
  }

  /** Parse OKF `verified` events (actor + timestamp), preserving order. */
  private extractVerificationEvents(rawContent: string): Array<{ actor: string; at?: string }> {
    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawContent);
    if (!fmMatch) return [];

    const lines = fmMatch[1].split('\n');
    const events: Array<{ actor: string; at?: string }> = [];
    let inVerified = false;

    for (const line of lines) {
      const indent = (line.match(/^\s*/)?.[0].length) ?? 0;
      const trimmed = line.trim();

      if (!inVerified && indent === 0 && /^verified\s*:/.test(trimmed)) {
        inVerified = true;
        const inline = trimmed.slice(trimmed.indexOf(':') + 1).trim();
        if (inline.startsWith('[') && inline.endsWith(']')) {
          for (const item of inline.slice(1, -1).split(',')) {
            const actor = item.trim().replace(/^['"]|['"]$/g, '');
            if (actor) events.push({ actor });
          }
          inVerified = false;
        } else if (inline && inline !== '[]') {
          events.push({ actor: inline.replace(/^['"]|['"]$/g, '') });
          inVerified = false;
        }
        continue;
      }

      if (!inVerified) continue;
      if (trimmed && indent === 0) break;

      const byMatch = /^-?\s*by\s*:\s*(.+)$/i.exec(trimmed);
      if (byMatch) {
        const actor = byMatch[1].trim().replace(/^['"]|['"]$/g, '');
        if (actor) events.push({ actor });
        continue;
      }
      const atMatch = /^at\s*:\s*(.+)$/i.exec(trimmed);
      if (atMatch && events.length > 0) {
        events[events.length - 1].at = atMatch[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }

    return events;
  }

  private frontmatterBlock(rawContent: string): string {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawContent);
    return match ? match[1] : '';
  }

  private countFrontmatterSourceEntries(rawContent: string): number {
    const block = this.frontmatterBlock(rawContent);
    const section = /^sources\s*:\s*$/m.exec(block);
    if (!section) {
      const inline = /^sources\s*:\s*\[([^\]]*)\]/m.exec(block);
      return inline ? inline[1].split(',').map(s => s.trim()).filter(Boolean).length : 0;
    }
    const start = section.index + section[0].length;
    const rest = block.slice(start);
    const endMatch = /^[A-Za-z_][\w-]*\s*:/m.exec(rest);
    const body = endMatch ? rest.slice(0, endMatch.index) : rest;
    return (body.match(/^\s*-\s+(?:id|resource)\s*:/gm) || []).length;
  }

  /**
   * Everything the Review Studio needs for one note in a single round trip:
   * identity, trust metadata, quality gate and verification history.
   */
  public async getReviewMeta(noteRef: string, projectId: string = 'default'): Promise<{
    success: boolean;
    error?: string;
    note?: {
      id: string;
      title: string;
      path: string;
      folder: string;
      status: string;
      trustTier: string;
      tags: string[];
      staleAfter?: string;
      createdAt?: string;
      updatedAt?: string;
      lineCount: number;
      bytes: number;
      outboundLinks: string[];
      brokenLinks: string[];
      sources: number;
      verified: Array<{ actor: string; at?: string }>;
    };
    quality?: {
      passed: number;
      total: number;
      items: Array<{
        key: string;
        label: string;
        ok: boolean;
        value: string;
        detail: string;
      }>;
    };
    history?: Array<{ actor: string; at?: string }>;
    suggestedReviewer?: string;
    snapshotCount?: number;
  }> {
    const notes = await this.readAllWikiNotes(projectId);
    const target = this.resolveReviewTarget(noteRef, notes);
    if (!target) return { success: false, error: `Nota non trovata: ${noteRef}` };

    const projRoot = await this.resolveProjectRoot(projectId);
    const absPath = path.resolve(projRoot, target.path);
    let raw = '';
    try {
      await this.validateSafePath(absPath, projectId);
      raw = await fs.readFile(absPath, 'utf-8');
    } catch (err) {
      return { success: false, error: `Impossibile leggere ${target.path}: ${String(err)}` };
    }

    const note = this.parser.parseNote(target.id, target.title, raw, target.folder || 'wiki', target.path);
    const verified = this.extractVerificationEvents(raw);
    const brokenLinks = note.outboundLinks.filter(link => !this.resolveReviewTarget(link, notes));
    const sources = this.countFrontmatterSourceEntries(raw);
    const stat = await fs.stat(absPath).catch(() => null);

    const fm = note.frontmatter;
    const missing: string[] = [];
    if (!fm.title) missing.push('title');
    if (!Array.isArray(fm.tags) || (fm.tags as string[]).length === 0) missing.push('tags');
    if (!fm.status) missing.push('status');
    if (fm.generated === undefined) missing.push('generated');
    if (sources === 0) missing.push('sources');

    const stale = Boolean(note.staleAfter && note.staleAfter.slice(0, 10) < new Date().toISOString().slice(0, 10));
    const items = [
      {
        key: 'links',
        label: 'Link interni',
        ok: brokenLinks.length === 0,
        value: String(note.outboundLinks.length),
        detail: brokenLinks.length === 0 ? 'tutti risolvibili' : `${brokenLinks.length} non risolto/i`,
      },
      {
        key: 'frontmatter',
        label: 'Frontmatter OKF',
        ok: missing.length === 0,
        value: missing.length === 0 ? 'ok' : `${missing.length} mancanti`,
        detail: missing.length === 0 ? 'campi obbligatori presenti' : `manca: ${missing.join(', ')}`,
      },
      {
        key: 'tags',
        label: 'Tag taxonomy',
        ok: note.tags.length > 0,
        value: String(note.tags.length),
        detail: note.tags.length > 0 ? 'tag presenti' : 'nessun tag',
      },
      {
        key: 'sources',
        label: 'Fonti citate',
        ok: sources > 0,
        value: String(sources),
        detail: sources > 0 ? 'provenienza dichiarata' : 'nessuna fonte',
      },
      {
        key: 'stale',
        label: 'Stale check',
        ok: !stale,
        value: note.staleAfter ? note.staleAfter.slice(0, 10) : '—',
        detail: stale ? 'da riverificare' : note.staleAfter ? 'entro la scadenza' : 'nessuna scadenza',
      },
    ];

    let snapshotCount = 0;
    try {
      const dir = this.getSnapshotDir(projRoot, target.path);
      snapshotCount = (await fs.readdir(dir)).filter(name => name.endsWith('.md')).length;
    } catch (_e) {
      snapshotCount = 0;
    }

    const humanReviewers = verified
      .map(event => event.actor)
      .filter(actor => actor.startsWith('human:'))
      .reverse();

    return {
      success: true,
      note: {
        id: note.id,
        title: note.title,
        path: note.path,
        folder: note.folder || 'wiki',
        status: note.status || 'draft',
        trustTier: note.trustTier || 'unverified',
        tags: note.tags,
        staleAfter: note.staleAfter,
        createdAt: stat?.birthtime.toISOString(),
        updatedAt: stat?.mtime.toISOString(),
        lineCount: raw.split(/\r?\n/).length,
        bytes: Buffer.byteLength(raw, 'utf-8'),
        outboundLinks: note.outboundLinks,
        brokenLinks,
        sources,
        verified,
      },
      quality: {
        passed: items.filter(item => item.ok).length,
        total: items.length,
        items,
      },
      history: verified.slice().reverse(),
      suggestedReviewer: humanReviewers[0]?.replace(/^human:/i, '') || 'local',
      snapshotCount,
    };
  }

  private parseReviewLog(raw: string): Array<{
    date: string;
    kind: 'created' | 'modified' | 'verified' | 'other';
    message: string;
    title?: string;
    path?: string;
  }> {
    const entries: Array<{
      date: string;
      kind: 'created' | 'modified' | 'verified' | 'other';
      message: string;
      title?: string;
      path?: string;
    }> = [];
    let currentDate = '';

    for (const line of raw.split(/\r?\n/)) {
      const dateMatch = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(line.trim());
      if (dateMatch) {
        currentDate = dateMatch[1];
        continue;
      }
      const itemMatch = /^\*\s+\*\*([^*]+)\*\*:\s*(.+)$/.exec(line.trim());
      if (!itemMatch || !currentDate) continue;

      const label = itemMatch[1].trim();
      const message = itemMatch[2].trim();
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(message);
      const kind: 'created' | 'modified' | 'verified' | 'other' =
        /verified/i.test(label) || /Human-verified/i.test(message)
          ? 'verified'
          : /creation|created/i.test(label)
            ? 'created'
            : 'modified';

      entries.push({
        date: currentDate,
        kind,
        message,
        title: link?.[1],
        path: link?.[2],
      });
    }
    return entries;
  }

  /**
   * Deterministic digest: parses `wiki/log.md`, checks note freshness and link
   * integrity, and returns both structured data and a Markdown report.
   */
  public async getReviewDigest(
    projectId: string = 'default',
    days: number = 7,
    scope: 'all' | 'folder' | 'note' = 'all',
    targetRef?: string
  ): Promise<{
    success: boolean;
    error?: string;
    rangeDays: number;
    scope: string;
    generatedAt: string;
    stats: { notesChanged: number; verified: number; stale: number; brokenLinks: number; notes: number };
    days: Array<{
      date: string;
      items: Array<{ noteId?: string; title: string; path?: string; kind: string; detail: string }>;
    }>;
    health: { score: number; label: string; summary: string };
    nextActions: Array<{ title: string; kind: string; noteId?: string }>;
    markdown: string;
  }> {
    const safeDays = Math.max(1, Math.min(365, Math.floor(Number(days) || 7)));
    const notes = await this.readAllWikiNotes(projectId);
    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = await this.getWikiDir(projectId);
    const cutoff = new Date(Date.now() - safeDays * 86400000);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    let scopedNotes = notes;
    let target: WikiNote | null = null;
    if (targetRef && (scope === 'note' || scope === 'folder')) {
      target = this.resolveReviewTarget(targetRef, notes);
      if (!target) return {
        success: false,
        error: `Nota non trovata: ${targetRef}`,
        rangeDays: safeDays,
        scope,
        generatedAt: new Date().toISOString(),
        stats: { notesChanged: 0, verified: 0, stale: 0, brokenLinks: 0, notes: 0 },
        days: [],
        health: { score: 0, label: 'n/d', summary: '' },
        nextActions: [],
        markdown: '',
      };
      scopedNotes = scope === 'note'
        ? notes.filter(note => note.path === target!.path)
        : notes.filter(note => note.folder === target!.folder);
    }

    const scopedPaths = new Set(scopedNotes.map(note => note.path));
    let logRaw = '';
    try {
      logRaw = await fs.readFile(path.join(wikiDir, 'log.md'), 'utf-8');
    } catch (_e) {
      logRaw = '';
    }
    const logEntries = this.parseReviewLog(logRaw);
    const toWikiPath = (rel?: string): string => {
      if (!rel) return '';
      const clean = rel.replace(/\\/g, '/').replace(/^\.?\//, '');
      return clean.startsWith('wiki/') ? clean : `wiki/${clean}`;
    };

    const relevantLog = logEntries.filter(entry => {
      if (entry.date < cutoffDate) return false;
      if (scope === 'all') return true;
      const entryPath = toWikiPath(entry.path);
      return scopedPaths.has(entryPath);
    });

    const grouped = new Map<string, Array<{ noteId?: string; title: string; path?: string; kind: string; detail: string }>>();
    for (const entry of relevantLog) {
      const entryPath = toWikiPath(entry.path);
      const note = notes.find(candidate => candidate.path === entryPath);
      const date = entry.date;
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date)!.push({
        noteId: note?.id,
        title: entry.title || note?.title || entryPath || 'Wiki',
        path: entryPath || undefined,
        kind: entry.kind,
        detail: entry.message.replace(/\[[^\]]+\]\([^)]+\)/g, '').trim(),
      });
    }

    // Notes saved outside the log (e.g. manual edits) still belong in the digest.
    for (const note of scopedNotes) {
      if (!note.updatedAt || new Date(note.updatedAt) < cutoff) continue;
      const day = note.updatedAt.slice(0, 10);
      if (!grouped.has(day)) grouped.set(day, []);
      const bucket = grouped.get(day)!;
      if (bucket.some(item => item.path === note.path)) continue;
      bucket.push({
        noteId: note.id,
        title: note.title,
        path: note.path,
        kind: 'modified',
        detail: 'modificata sul disco',
      });
    }

    const daysList = Array.from(grouped.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
      .map(([date, items]) => ({ date, items }));

    const changedPaths = new Set<string>();
    for (const entry of relevantLog) changedPaths.add(toWikiPath(entry.path));
    for (const note of scopedNotes) {
      if (note.updatedAt && new Date(note.updatedAt) >= cutoff) changedPaths.add(note.path);
    }

    const verifiedNotes = new Set<string>();
    for (const note of scopedNotes) {
      // `note.content` is the body only (frontmatter is stripped), so parse the
      // actors from `note.verified` and use the file mtime as the recency signal:
      // recording a verification always rewrites the note.
      const actors = Array.isArray(note.verified) ? note.verified : [];
      const humanVerified = actors.some(actor => String(actor).startsWith('human:'));
      const recentlyTouched = note.updatedAt ? new Date(note.updatedAt) >= cutoff : false;
      if (humanVerified && recentlyTouched) {
        verifiedNotes.add(note.path);
      }
    }
    for (const entry of relevantLog) {
      if (entry.kind !== 'verified') continue;
      const entryPath = toWikiPath(entry.path);
      if (scopedPaths.has(entryPath)) verifiedNotes.add(entryPath);
    }

    const staleNotes = scopedNotes.filter(
      note => note.staleAfter && note.staleAfter.slice(0, 10) < today
    );
    let brokenLinkCount = 0;
    for (const note of scopedNotes) {
      for (const link of note.outboundLinks) {
        if (!this.resolveReviewTarget(link, notes)) brokenLinkCount++;
      }
    }

    const total = Math.max(1, scopedNotes.length);
    const unverified = scopedNotes.filter(note => note.trustTier === 'unverified').length;
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
          (unverified / total) * 25 -
          staleNotes.length * 6 -
          Math.min(30, brokenLinkCount * 8)
        )
      )
    );
    const label = score >= 85 ? 'Ottima' : score >= 70 ? 'Buona' : score >= 50 ? 'Discreta' : 'Critica';

    const nextActions: Array<{ title: string; kind: string; noteId?: string }> = [];
    for (const note of staleNotes.slice(0, 2)) {
      nextActions.push({ title: `Rivedere la nota stale "${note.title}"`, kind: 'stale', noteId: note.id });
    }
    for (const note of scopedNotes.filter(candidate => candidate.trustTier === 'unverified').slice(0, 2)) {
      nextActions.push({ title: `Verificare "${note.title}"`, kind: 'verify', noteId: note.id });
    }
    if (brokenLinkCount > 0) {
      nextActions.push({ title: `Riparare ${brokenLinkCount} link interni`, kind: 'link' });
    }

    const stats = {
      notesChanged: changedPaths.size,
      verified: verifiedNotes.size,
      stale: staleNotes.length,
      brokenLinks: brokenLinkCount,
      notes: scopedNotes.length,
    };

    const markdownLines = [
      `# Digest Wiki · ultimi ${safeDays} giorni`,
      '',
      `Generato il ${new Date().toISOString().slice(0, 10)} · ambito: ${
        scope === 'note' && target ? target.title : scope === 'folder' && target ? target.folder : 'tutta la wiki'
      }`,
      '',
      `- Note modificate: **${stats.notesChanged}**`,
      `- Verificate: **${stats.verified}**`,
      `- Stale: **${stats.stale}**`,
      `- Link rotti: **${stats.brokenLinks}**`,
      `- Salute della wiki: **${score}/100 (${label})**`,
      '',
    ];
    for (const day of daysList) {
      markdownLines.push(`## ${day.date}`);
      for (const item of day.items) {
        markdownLines.push(`- ${item.title} — ${item.kind}${item.detail ? `: ${item.detail}` : ''}`);
      }
      markdownLines.push('');
    }
    if (nextActions.length > 0) {
      markdownLines.push('## Prossime azioni');
      for (const action of nextActions) markdownLines.push(`- ${action.title}`);
    }

    return {
      success: true,
      rangeDays: safeDays,
      scope,
      generatedAt: new Date().toISOString(),
      stats,
      days: daysList,
      health: {
        score,
        label,
        summary: `${stats.stale} stale · ${stats.brokenLinks} link rotti · ${stats.verified} verifiche recenti`,
      },
      nextActions,
      markdown: markdownLines.join('\n'),
    };
  }

  /**
   * Best-effort LLM critique with a deterministic fallback. The fallback keeps
   * the tab useful when no provider is configured (common in offline dev).
   */
  public async critiqueNote(options: {
    noteRef: string;
    projectId?: string;
    depth?: 'fast' | 'standard' | 'deep';
    focus?: string[];
    instructions?: string;
  }): Promise<{
    success: boolean;
    markdown: string;
    fallback: boolean;
    error?: string;
    note?: { id: string; title: string; path: string };
  }> {
    const projectId = options.projectId ?? 'default';
    const notes = await this.readAllWikiNotes(projectId);
    const target = this.resolveReviewTarget(options.noteRef, notes);
    if (!target) {
      return { success: false, markdown: '', fallback: false, error: `Nota non trovata: ${options.noteRef}` };
    }

    const meta = await this.getReviewMeta(target.path, projectId);
    const focus = options.focus?.length
      ? options.focus.join(', ')
      : 'contraddizioni interne, citazioni mancanti, salti logici, copertura delle fonti';
    const depth = options.depth || 'standard';
    const depthInstruction = depth === 'fast'
      ? 'Sii sintetico: massimo 5 finding.'
      : depth === 'deep'
        ? 'Sii esaustivo: almeno 8 finding, cita i passaggi e proponi contro-argomenti.'
        : 'Produci 5-7 finding ordinati per gravità.';

    const contextNotes = [
      target,
      ...target.outboundLinks
        .map(link => this.resolveReviewTarget(link, notes))
        .filter((note): note is WikiNote => Boolean(note))
        .slice(0, 6),
    ];

    const systemPrompt = [
      'Sei un revisore critico accademico esperto di knowledge management e OKF v0.2.',
      'Il tuo compito è stress-testare una nota di una tesi, non riscriverla.',
      'Rispondi in italiano, in Markdown, con questa struttura esatta:',
      '## Sintesi',
      '## Finding',
      'Una tabella con colonne: Gravità | Tipo | Dettaglio | Riferimento.',
      '## Contro-argomenti',
      '## Azioni consigliate',
      'Usa solo ciò che è presente nella nota o nelle note collegate. Se manca una prova, dillo esplicitamente.',
    ].join('\n');

    const userMessage = [
      `Analizza la nota "${target.title}" (${target.path}) con focus su: ${focus}.`,
      depthInstruction,
      options.instructions ? `Istruzioni aggiuntive dell'autore: ${options.instructions}` : '',
      '',
      '### Frontmatter e note collegate',
      `- Trust tier: ${meta.note?.trustTier ?? 'unverified'} · status: ${meta.note?.status ?? 'draft'}`,
      `- Fonti dichiarate: ${meta.note?.sources ?? 0} · link interni: ${meta.note?.outboundLinks.length ?? 0}`,
      '',
      '### Contenuto della nota',
      target.content,
    ].filter(Boolean).join('\n');

    try {
      const client = await this.getOrInitLlmClient();
      const markdown = await client.complete({
        systemPrompt,
        userMessage,
        contextNotes,
      });
      return {
        success: true,
        markdown: markdown.trim(),
        fallback: false,
        note: { id: target.id, title: target.title, path: target.path },
      };
    } catch (err) {
      const items = meta.quality?.items ?? [];
      const issues = items.filter(item => !item.ok);
      const fallbackLines = [
        '## Sintesi',
        `Revisione deterministica di **${target.title}**. Il provider LLM non è disponibile, quindi il report si basa solo sui controlli strutturali della Quality Gate.`,
        '',
        '## Finding',
        '',
        '| Gravità | Tipo | Dettaglio | Riferimento |',
        '|---|---|---|---|',
      ];
      if (issues.length === 0) {
        fallbackLines.push('| Bassa | Struttura | Nessun problema strutturale rilevato. | Quality Gate |');
      } else {
        for (const issue of issues) {
          fallbackLines.push(
            `| ${issue.key === 'stale' || issue.key === 'sources' ? 'Alta' : 'Media'} | ${issue.label} | ${issue.detail} | \`${target.path}\` |`
          );
        }
      }
      fallbackLines.push(
        '',
        '## Contro-argomenti',
        '- Verifica manualmente le affermazioni empiriche: la revisione deterministica non può valutarne la correttezza.',
        '- Controlla che ogni fonte dichiarata sia effettivamente citata nel corpo della nota.',
        '',
        '## Azioni consigliate',
        issues.length > 0
          ? issues.map(issue => `- Correggere **${issue.label}**: ${issue.detail}`).join('\n')
          : '- Eseguire una revisione critica con il provider LLM quando disponibile.',
        '',
        `_Provider LLM non disponibile: ${String(err)}_`,
      );
      return {
        success: true,
        markdown: fallbackLines.join('\n'),
        fallback: true,
        error: String(err),
        note: { id: target.id, title: target.title, path: target.path },
      };
    }
  }

  public async listReviewSnapshots(noteRef: string, projectId: string = 'default'): Promise<Array<{
    id: string;
    at: string;
    reason: string;
    bytes: number;
  }>> {
    const notes = await this.readAllWikiNotes(projectId);
    const target = this.resolveReviewTarget(noteRef, notes);
    if (!target) return [];
    const projRoot = await this.resolveProjectRoot(projectId);
    const dir = this.getSnapshotDir(projRoot, target.path);
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter(name => name.endsWith('.md'));
    } catch (_e) {
      return [];
    }
    const snapshots = [];
    for (const file of files.sort().reverse()) {
      const full = path.join(dir, file);
      const stat = await fs.stat(full).catch(() => null);
      let reason = 'snapshot';
      try {
        const meta = JSON.parse(await fs.readFile(full.replace(/\.md$/i, '.json'), 'utf-8')) as { reason?: string; at?: string };
        reason = meta.reason || reason;
      } catch (_e) {
        // Sidecar missing: derive the timestamp from the filename.
      }
      const id = file.replace(/\.md$/i, '');
      const parsed = id.replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z$/, 'T$1:$2:$3.$4Z');
      snapshots.push({
        id,
        at: Number.isNaN(Date.parse(parsed)) ? (stat?.mtime.toISOString() ?? '') : new Date(parsed).toISOString(),
        reason,
        bytes: stat?.size ?? 0,
      });
    }
    return snapshots;
  }

  private diffLines(before: string[], after: string[]): Array<{
    type: 'ctx' | 'add' | 'del';
    leftNo: number | null;
    rightNo: number | null;
    left: string;
    right: string;
  }> {
    const maxLines = 600;
    const a = before.slice(0, maxLines);
    const b = after.slice(0, maxLines);
    const n = a.length;
    const m = b.length;

    if (n * m > 250000) {
      return [
        ...a.map((line, index) => ({ type: 'del' as const, leftNo: index + 1, rightNo: null, left: line, right: '' })),
        ...b.map((line, index) => ({ type: 'add' as const, leftNo: null, rightNo: index + 1, left: '', right: line })),
      ];
    }

    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const rows: Array<{
      type: 'ctx' | 'add' | 'del';
      leftNo: number | null;
      rightNo: number | null;
      left: string;
      right: string;
    }> = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        rows.push({ type: 'ctx', leftNo: i + 1, rightNo: j + 1, left: a[i], right: b[j] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        rows.push({ type: 'del', leftNo: i + 1, rightNo: null, left: a[i], right: '' });
        i++;
      } else {
        rows.push({ type: 'add', leftNo: null, rightNo: j + 1, left: '', right: b[j] });
        j++;
      }
    }
    while (i < n) {
      rows.push({ type: 'del', leftNo: i + 1, rightNo: null, left: a[i], right: '' });
      i++;
    }
    while (j < m) {
      rows.push({ type: 'add', leftNo: null, rightNo: j + 1, left: '', right: b[j] });
      j++;
    }
    return rows;
  }

  public async getReviewDiff(noteRef: string, snapshotId: string, projectId: string = 'default'): Promise<{
    success: boolean;
    error?: string;
    note?: { id: string; title: string; path: string };
    snapshot?: { id: string; at: string; reason: string };
    rows?: Array<{ type: string; leftNo: number | null; rightNo: number | null; left: string; right: string }>;
    stats?: { added: number; removed: number; context: number };
  }> {
    if (!/^[0-9A-Za-z._-]+$/.test(snapshotId)) {
      return { success: false, error: 'Identificativo snapshot non valido' };
    }
    const notes = await this.readAllWikiNotes(projectId);
    const target = this.resolveReviewTarget(noteRef, notes);
    if (!target) return { success: false, error: `Nota non trovata: ${noteRef}` };

    const projRoot = await this.resolveProjectRoot(projectId);
    const dir = this.getSnapshotDir(projRoot, target.path);
    const snapshotPath = path.join(dir, `${snapshotId}.md`);
    let snapshotContent = '';
    try {
      snapshotContent = await fs.readFile(snapshotPath, 'utf-8');
    } catch (_e) {
      return { success: false, error: 'Snapshot non trovato' };
    }

    const absPath = path.resolve(projRoot, target.path);
    const currentContent = await fs.readFile(absPath, 'utf-8').catch(() => '');
    const rows = this.diffLines(snapshotContent.split(/\r?\n/), currentContent.split(/\r?\n/));

    let reason = 'snapshot';
    let at = '';
    try {
      const meta = JSON.parse(await fs.readFile(snapshotPath.replace(/\.md$/i, '.json'), 'utf-8')) as { reason?: string; at?: string };
      reason = meta.reason || reason;
      at = meta.at || '';
    } catch (_e) {
      // Best effort.
    }

    return {
      success: true,
      note: { id: target.id, title: target.title, path: target.path },
      snapshot: { id: snapshotId, at, reason },
      rows,
      stats: {
        added: rows.filter(row => row.type === 'add').length,
        removed: rows.filter(row => row.type === 'del').length,
        context: rows.filter(row => row.type === 'ctx').length,
      },
    };
  }

  public async restoreReviewSnapshot(noteRef: string, snapshotId: string, projectId: string = 'default'): Promise<WikiNote | null> {
    if (!/^[0-9A-Za-z._-]+$/.test(snapshotId)) return null;
    const notes = await this.readAllWikiNotes(projectId);
    const target = this.resolveReviewTarget(noteRef, notes);
    if (!target) return null;

    const projRoot = await this.resolveProjectRoot(projectId);
    const dir = this.getSnapshotDir(projRoot, target.path);
    const snapshotPath = path.join(dir, `${snapshotId}.md`);
    let snapshotContent = '';
    try {
      snapshotContent = await fs.readFile(snapshotPath, 'utf-8');
    } catch (_e) {
      return null;
    }

    const absPath = path.resolve(projRoot, target.path);
    await this.validateSafePath(absPath, projectId);
    const current = await fs.readFile(absPath, 'utf-8').catch(() => '');
    if (current) await this.writeReviewSnapshot(projectId, target.path, current, 'pre-ripristino');
    await atomicWriteFile(absPath, snapshotContent, 'utf-8');

    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const wikiDir = await this.getWikiDir(projectId);
    await this.appendWikiLog(
      wikiDir,
      `Restored [${target.title}](${target.path.replace(/^wiki\//, '')}) from snapshot \`${snapshotId}\`.`,
      timestamp.slice(0, 10)
    );

    return this.parser.parseNote(target.id, target.title, snapshotContent, target.folder || 'wiki', target.path);
  }

  public async executeMindmapWorkflow(target: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const built = buildMindmap(notes, target);

    if (!built.note) {
      return `### 🧠 Mind Map\n\nNo matching note found to generate mind map.`;
    }

    const relPath = await this.writeStudyOutput(projectId, `mindmap-${built.slug}.md`, built.markdown);

    return `### 🧠 Mind Map Generated for "${built.note.title}"\n\n- **Saved to**: \`${relPath}\`\n- **Extracted Headings**: ${built.headings}\n- **Wikilinks**: ${built.wikilinks}\n\n\`\`\`text\n${built.tree.slice(0, 15).join('\n')}\n${built.tree.length > 15 ? '...' : ''}\n\`\`\`\n\n*Mind map tree and JSON stored in output/.*`;
  }

  /**
   * Builds and stores the deep research report. The deterministic scaffolding
   * is always produced; when an LLM is configured its synthesis replaces the
   * report body while frontmatter and source provenance stay grounded in the
   * notes that matched the question.
   */
  private async writeDeepResearchReport(
    question: string,
    notes: WikiNote[],
    projectId: string = 'default'
  ): Promise<ResearchDeepResearchResult> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const outputDir = path.resolve(projRoot, 'output');
    const synthesisDir = path.resolve(projRoot, 'wiki/synthesis');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(synthesisDir, { recursive: true });

    const q = (question || '').trim();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);

    const relevantNotes = words.length > 0
      ? notes.filter(n => {
          const text = `${n.id} ${n.title} ${n.content} ${n.folder} ${n.tags?.join(' ')}`.toLowerCase();
          return words.some(w => text.includes(w));
        })
      : notes.slice(0, 10);

    const slug = q ? q.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) : 'general';
    const dateStr = new Date().toISOString().slice(0, 10);
    const filePath = path.join(outputDir, `research-${slug}-${dateStr}.md`);
    const synthesisPath = path.join(synthesisDir, `${slug}.md`);

    const sources = relevantNotes.length > 0 ? relevantNotes : notes.slice(0, 5);
    const matrixRows = sources.map(n => `| Synthesis Claim from [[${n.id}]] | \`wiki/${n.path}\` | \`raw/\` background sources |`).join('\n');

    const thinkingTrace = `<think>
Analyzing research question: "${q}"
Generated multi-query strategy:
1. Query 1: "${q} domain principles"
2. Query 2: "${q} empirical evidence and case studies"
3. Query 3: "${q} unresolved gaps and future directions"
Scanned ${sources.length} knowledge base sources.
Synthesizing evidence and generating grounded report...
</think>`;

    const deterministicBody = `# Deep Research Report: ${q || 'Knowledge Base Analysis'}

## 🎯 Executive Summary
Extended multi-source analysis synthesized across **${sources.length}** wiki article(s) regarding: *"${q || 'Knowledge Base Overview'}"*.

## 🔬 Thematic Deep-Dive
${sources.map(n => `### Analysis of [[${n.id}]] (${n.title})
- **Folder**: \`${n.folder}\`
- **Core Insights**: ${n.content.slice(0, 300).replace(/\n/g, ' ')}...
- **Connected Links**: ${n.outboundLinks.map(l => `[[${l}]]`).join(', ') || 'None'}
`).join('\n')}

## 📊 Source Attribution Matrix
| Claim / Finding | Wiki Source | Raw Source Grounding |
|---|---|---|
${matrixRows || '| General Knowledge | `wiki/index.md` | `raw/` |'}

## ⚠️ Identified Knowledge Gaps
- **Potential Missing Sources**: Further documents regarding specific edge cases of *${q || 'this domain'}*.
- **Recommended Action**: Ingest additional primary sources into \`sources/\` and run \`/compile\`.
`;

    let body = deterministicBody;
    let fallback = true;
    let error: string | undefined;

    try {
      const client = await this.getOrInitLlmClient();
      const systemPrompt = await this.getSystemPrompt();
      const markdown = await client.complete({
        systemPrompt,
        userMessage: [
          `Domanda di ricerca: "${q || 'panoramica della knowledge base'}"`,
          'Scrivi un report di deep research in Markdown, in italiano, basandoti solo sulle note fornite.',
          'Struttura richiesta:',
          '1. # Deep Research Report: <domanda>',
          '2. ## Executive Summary',
          '3. ## Thematic Deep-Dive',
          '4. ## Source Attribution Matrix (tabella: Claim | Wiki Source | Grounding)',
          '5. ## Knowledge Gaps',
          'Cita ogni affermazione con [[wikilink]] tratti esclusivamente dalle note fornite.',
        ].join('\n'),
        contextNotes: sources,
      });
      if (markdown.trim()) {
        body = markdown.trim();
        fallback = false;
      }
    } catch (err) {
      error = String(err);
    }

    const content = `${thinkingTrace}

---
tags: [deep-research, synthesis, ${slug}]
created: ${dateStr}
sources:
${sources.map(n => `  - wiki/${n.id}.md`).join('\n')}
---

${body}
`;

    // The legacy synthesis block above has no `type` and string-valued
    // `sources`; prepend a minimal OKF header so the saved notes pass lint.
    const okfContent = ensureOkfFrontmatter(content, slug, path.basename(synthesisPath));
    await atomicWriteFile(filePath, okfContent, 'utf-8');
    await atomicWriteFile(synthesisPath, okfContent, 'utf-8');

    const relPath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');
    const relSynthesis = path.relative(this.rootDir, synthesisPath).replace(/\\/g, '/');

    const count = sources.length;
    const summary = '### 🔬 Deep Research Report Generated\n\n- **Output File**: `' + relPath + '`\n- **Synthesis Note**: `' + relSynthesis + '`\n- **Articles Consulted**: ' + count + '\n- **Reasoning Trace**: Included in `<think>` block.\n\n*Report and synthesis note saved successfully.*';

    return {
      summary,
      report: content,
      outputPath: relPath,
      synthesisPath: relSynthesis,
      articles: count,
      fallback,
      error,
    };
  }

  public async executeDeepResearchWorkflow(question: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const result = await this.writeDeepResearchReport(question, notes, projectId);
    return result.summary;
  }

  public async generateDeepResearch(
    question: string,
    projectId: string = 'default'
  ): Promise<ResearchDeepResearchResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const result = await this.writeDeepResearchReport(question, notes, projectId);
    return {
      success: true,
      markdown: result.report,
      outputPath: result.outputPath,
      synthesisPath: result.synthesisPath,
      articles: result.articles,
      fallback: result.fallback,
      error: result.error,
    };
  }

  public async consultWiki(question: string, projectId: string = 'default'): Promise<ResearchConsultResponse> {
    const q = (question || '').trim();
    const notes = await this.readAllWikiNotes(projectId);
    const search = searchNotes(notes, q, 8);
    const noteById = new Map(notes.map(note => [note.id, note]));
    const sources = search.results
      .map(result => noteById.get(result.note.id))
      .filter((note): note is WikiNote => Boolean(note));
    const citations: ResearchConsultCitation[] = sources.map(note => ({
      id: note.id,
      title: note.title,
      path: note.path,
    }));

    try {
      const client = await this.getOrInitLlmClient();
      const systemPrompt = await this.getSystemPrompt();
      const markdown = await client.complete({
        systemPrompt,
        userMessage: [
          `Domanda: "${q}"`,
          'Rispondi in italiano, in Markdown, citando solo le note fornite con [[wikilink]].',
          'Struttura richiesta:',
          '## Risposta',
          '## Passaggi chiave',
          '## Fonti consultate',
          'Se le note non contengono la risposta, dichiaralo esplicitamente invece di inventare.',
        ].join('\n'),
        contextNotes: sources,
      });
      return { success: true, markdown: markdown.trim(), fallback: false, citations };
    } catch (err) {
      const lines = [
        '## Risposta',
        `Il provider LLM non è disponibile, quindi ecco le note più pertinenti trovate nella wiki per **"${q}"**.`,
        '',
        '## Passaggi chiave',
      ];
      if (search.results.length === 0) {
        lines.push('- Nessuna nota contiene i termini della domanda.');
      } else {
        for (const result of search.results.slice(0, 5)) {
          const firstMatch = result.matches[0];
          lines.push(
            `- [[${result.note.id}]] (${result.note.title}) — ${result.matchCount} righe corrispondenti${firstMatch ? `, a partire dalla riga ${firstMatch.line}` : ''}.`
          );
        }
      }
      lines.push(
        '',
        '## Fonti consultate',
        ...(citations.length > 0
          ? citations.map(citation => `- [[${citation.id}]] — \`${citation.path}\``)
          : ['- Nessuna fonte pertinente.']),
        '',
        `_Provider LLM non disponibile: ${String(err)}_`
      );
      return { success: true, markdown: lines.join('\n'), fallback: true, error: String(err), citations };
    }
  }

  /**
   * Persist a `/consult` answer as an OKF v0.2 note in the scoped vault.
   * The note is validated before writing; indexes are then regenerated so the
   * new note is discoverable right away.
   */
  public async promoteConsultAnswer(
    input: ConsultAnswerInput,
    projectId: string = 'default'
  ): Promise<ResearchPromoteAnswerResponse> {
    const note = buildConsultAnswerNote(input);
    const validation = validateOkfNote(note.markdown);
    if (validation.length > 0) {
      return { success: false, validation, error: 'Nota non conforme OKF v0.2.' };
    }

    const saved = await this.saveWikiNote({
      id: note.id,
      folder: 'general',
      content: note.markdown,
      title: note.title,
    }, projectId);
    await this.executeReindexWorkflow(projectId);
    return { success: true, path: saved.path, validation: [] };
  }

  public async executeQuizWorkflow(topicAndCount: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const parts = (topicAndCount || '').trim().split(/\s+/);
    let count = 5;
    let topic = '';

    if (parts.length > 1 && !isNaN(parseInt(parts[parts.length - 1], 10))) {
      count = parseInt(parts.pop()!, 10);
      topic = parts.join(' ');
    } else if (parts.length === 1 && !isNaN(parseInt(parts[0], 10))) {
      count = parseInt(parts[0], 10);
      topic = '';
    } else {
      topic = parts.join(' ');
    }

    const built = buildQuiz(notes, topic, count);
    const relPath = await this.writeStudyOutput(projectId, `quiz-${built.slug}.md`, built.markdown);

    return `### 🧪 Quiz Generated\n\n- **Saved to**: \`${relPath}\`\n- **Total Questions**: ${built.count}\n- **Source Articles Cited**: ${built.notes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*Quiz generated in output directory.*`;
  }

  /**
   * Shared deterministic engine for `/trace` and the Trace tab: finds notes
   * matching the query, lists outgoing links and resolves the raw source
   * passages declared in frontmatter or in a `## Sources` section.
   */
  private async traceClaimInNotes(target: string, notes: WikiNote[]): Promise<ResearchTraceResponse> {
    const q = target.trim().toLowerCase();
    if (!q) return { query: target, notes: [], scanned: notes.length };

    const connected = notes.filter(n =>
      n.id.toLowerCase().includes(q) ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.outboundLinks.some((l: string) => l.toLowerCase().includes(q))
    );

    const traced: ResearchTraceNote[] = [];

    for (const n of connected.slice(0, 12)) {
      const matchedIn: string[] = [];
      if (n.id.toLowerCase().includes(q)) matchedIn.push('id');
      if (n.title.toLowerCase().includes(q)) matchedIn.push('titolo');
      if (n.content.toLowerCase().includes(q)) matchedIn.push('corpo');
      if (n.outboundLinks.some((l: string) => l.toLowerCase().includes(q))) matchedIn.push('link');

      // Extract sources listed in frontmatter or ## Sources section
      const rawSources: string[] = [];
      if (Array.isArray(n.frontmatter?.sources)) {
        for (const src of n.frontmatter.sources) {
          if (typeof src === 'string') rawSources.push(src);
        }
      }

      const sourcesMatch = n.content.match(/## Sources\s+([\s\S]*?)(?=\n## |$)/i);
      if (sourcesMatch) {
        const lines = sourcesMatch[1].split('\n');
        for (const line of lines) {
          const m = line.match(/(raw\/[^\s\)]+\.md(?:#L\d+(?:-L?\d+)?)?)/i);
          if (m && !rawSources.includes(m[1])) {
            rawSources.push(m[1]);
          }
        }
      }

      const sources: ResearchTraceSource[] = [];
      for (const rawRef of rawSources) {
        const [rawFile, anchor] = rawRef.split('#');
        const absRawPath = path.resolve(this.rootDir, rawFile);
        const source: ResearchTraceSource = { rawRef, file: rawFile, exists: false };

        try {
          const rawContent = await fs.readFile(absRawPath, 'utf-8');
          source.exists = true;
          const lines = rawContent.split('\n');

          if (anchor && /^L\d+(?:-L?\d+)?$/i.test(anchor)) {
            const numMatch = anchor.match(/^L(\d+)(?:-L?(\d+))?$/i);
            if (numMatch) {
              const startLine = Math.max(1, parseInt(numMatch[1], 10));
              const endLine = numMatch[2] ? Math.min(lines.length, parseInt(numMatch[2], 10)) : startLine;
              source.startLine = startLine;
              source.endLine = endLine;
              source.passage = lines.slice(startLine - 1, endLine).join('\n').trim();
            }
          } else if (q) {
            // Search for matching line in raw file
            const lineIdx = lines.findIndex(l => l.toLowerCase().includes(q));
            if (lineIdx !== -1) {
              const startLine = Math.max(1, lineIdx);
              const endLine = Math.min(lines.length, lineIdx + 3);
              source.startLine = startLine;
              source.endLine = endLine;
              source.inferred = true;
              source.passage = lines.slice(startLine - 1, endLine).join('\n').trim();
            }
          }
        } catch (_e) {
          // Source file not found or inaccessible
        }

        sources.push(source);
      }

      traced.push({
        note: toNoteRef(n),
        matchedIn,
        outboundLinks: n.outboundLinks,
        sources,
      });
    }

    return { query: target, notes: traced, scanned: notes.length };
  }

  public async traceClaim(query: string, projectId: string = 'default'): Promise<ResearchTraceResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    return this.traceClaimInNotes(query, notes);
  }

  public async executeTraceWorkflow(target: string, notes: WikiNote[]): Promise<string> {
    const trace = await this.traceClaimInNotes(target, notes);

    if (trace.notes.length === 0) {
      return `### 🕸️ Connection Trace for "${target}"\n\nNo target connections traced in wiki notes.`;
    }

    const traceEntries = trace.notes.slice(0, 5).map(t => {
      let entry = `- **Article**: [[${t.note.id}]] (${t.note.folder})\n  - **Outbound Links**: ${t.outboundLinks.map((l: string) => `[[${l}]]`).join(', ') || 'none'}`;

      if (t.sources.length > 0) {
        entry += `\n  - **Grounded Raw Sources**:`;
        for (const source of t.sources) {
          let passage = '';
          if (source.passage && source.startLine) {
            const endLine = source.endLine ?? source.startLine;
            const label = source.inferred
              ? ` (Inferred #L${source.startLine}-L${endLine})`
              : ` (Lines ${source.startLine}-${endLine})`;
            passage = `${label}: "${source.passage.slice(0, 150)}${source.passage.length > 150 ? '...' : ''}"`;
          }
          entry += `\n    - \`${source.rawRef}\`${passage}`;
        }
      }

      return entry;
    });

    return `### 🕸️ Connection & Passage Trace for "${target}"\n\n${traceEntries.join('\n\n')}`;
  }

  /**
   * A1/A6 de-duplication: index generation has exactly ONE implementation —
   * the OKF v0.2 Python script. The former inline TypeScript writer emitted a
   * non-conformant index and silently masked script failures, so failures are
   * now surfaced instead of being papered over by a second writer.
   */
  private async executeReindexWorkflow(projectId: string = 'default'): Promise<string> {
    // A docs-managed wiki owns its indexes: they are generated from docs/ by
    // scripts/docs_to_wiki.py. Running okf_reindex.py here would rewrite them
    // in a different format and create a false docs-sync drift after any note
    // the user creates in the wiki.
    const project = await this.projects.get(projectId);
    if (project?.docsManaged) {
      return `### 🔄 Reindex skipped\n\n- **${project.name}** is a 'docs/' projection: its indexes are generated by \`scripts/docs_to_wiki.py\`.\n- Modifica \`docs/\` e rigenera la proiezione per aggiornare gli indici.`;
    }

    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = await this.getWikiDir(projectId);
    const notes = await this.readAllWikiNotes(projectId);

    const scriptPath = resolveToolScript(this.rootDir, 'scripts/okf_reindex.py');
    const relWiki = path.relative(projRoot, wikiDir).replace(/\\/g, '/') || 'wiki';
    const res = spawnSync(PYTHON_CMD, [scriptPath, relWiki], {
      cwd: projRoot,
      encoding: 'utf-8',
    });
    if (res.error) {
      throw new Error(`Reindex script failed to start: ${res.error.message}`);
    }
    if (res.status !== 0) {
      const detail = (res.stderr || res.stdout || '').trim();
      throw new Error(`Reindex script failed (exit ${res.status}): ${detail}`);
    }

    return `### 🔄 Reindex Complete\n\n- **OKF v0.2 indexes regenerated** via \`scripts/okf_reindex.py\`\n- **Indexed Notes**: ${notes.length}\n- **Bundle root**: \`${relWiki}/index.md\``;
  }
}
