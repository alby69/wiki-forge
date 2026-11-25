import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { MarkdownParser } from '@shared/domain/markdownParser';
import { ensureOkfFrontmatter } from '@shared/domain/okfFrontmatter';
import type { WikiNote } from '@shared/domain/wiki';
import type { ScriptDef } from '@shared/domain/scripts';
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
import { json, readJsonBody, readJsonBodyWithRaw, sendApiResult } from './api/http';
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
export const SCRATCHPAD_INTRO =
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
export function normalizeScratchpad(raw: string): string {
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
export function parseScratchpad(raw: string): ScratchpadEntry[] {
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

export function formatWizardList(): string {
  return Object.values(WIZARD_SCENARIOS)
    .map(s => `- \`/wizard ${s.id}\` — **${s.name}**: ${s.description}`)
    .join('\n');
}

export function formatKeUseCaseList(): string {
  return Object.values(KE_USE_CASES)
    .map(u => `- **${u.title}** (\`${u.id}\`): ${u.summary}`)
    .join('\n');
}
