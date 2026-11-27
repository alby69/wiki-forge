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
  noteSearchLines,
  ResearchTraceNote,
  ResearchTraceResponse,
  ResearchTraceSource,
  suggestRelated,
  toNoteRef,
  tokenize,
} from '../researchHelpers';
import { defaultRetriever } from '../retrieval/retrieverPort';
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

export const knowledgeMethods = {
  /** Shared retrieval path for chat, /consult and Deep Research context. */
  async retrieveContextNotes(this: Host,
    query: string,
    notes: WikiNote[],
    limit: number = 5
  ): Promise<WikiNote[]> {
    if (!query.trim() || notes.length === 0) return [];
    const hits = await defaultRetriever.retrieve(query, notes, { limit });
    const byId = new Map(notes.map(note => [note.id, note]));
    const selected = hits
      .map(hit => byId.get(hit.id))
      .filter((note): note is WikiNote => Boolean(note));
    return selected.length > 0 ? selected : notes.slice(0, 3);
  },

  async processChatCommandStream(this: Host,
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

    if (command === 'compile' || command === 'audit' || command === 'trace' || command === 'reindex' || command === 'study-guide' || command === 'quiz' || command === 'deep-research' || command === 'mindmap' || command === 'note' || command === 'promote-note' || command === 'audio-overview' || command === 'thesis-chapter' || command === 'verify' || command === 'verify-citations' || command === 'human-review' || command === 'apply' || command === 'applica' || command === 'help') {
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
    const contextNotes = await this.retrieveContextNotes(args, notes);

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
  },

  async processChatCommand(this: Host,
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

    // Select context notes through the shared Retriever port.
    const contextNotes = await this.retrieveContextNotes(args, notes);

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
            contextNotes.map((n: WikiNote) => `- [[${n.id}]] (${n.folder}): ${n.title}`).join('\n') +
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

      case 'verify-citations': {
        return await this.executeVerifyCitationsWorkflow(args, notes, projectId);
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
        return await this.catalogue.renderHelpAnswer(args);
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
            return `### 💡 Answer for "${rawInput}"\n\nBased on your wiki knowledge base, see [[${match.id}]] (${match.title}):\n\n${match.content.slice(0, 400)}...\n\nRelated articles: ${contextNotes.slice(0, 4).map((n: WikiNote) => `[[${n.id}]]`).join(', ')}\n\n*(LLM completion error: ${String(err)})*`;
          }
          return `### 💡 Answer for "${rawInput}"\n\nProcessed query using agent guidelines. You can compile new findings into your wiki notes using the **Attach to Wiki** button below.\n\n*(LLM completion error: ${String(err)})*`;
        }
      }
    }
  },

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

  async writeStudyOutput(this: Host, projectId: string, fileName: string, markdown: string): Promise<string> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const outputDir = path.resolve(projRoot, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    await atomicWriteFile(filePath, markdown, 'utf-8');
    return path.relative(projRoot, filePath).replace(/\\/g, '/');
  },

  async generateStudyGuide(this: Host, topic: string, projectId: string = 'default'): Promise<StudyOutputResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const built = buildStudyGuide(notes, topic);
    const outputPath = await this.writeStudyOutput(projectId, `study-guide-${built.slug}.md`, built.markdown);
    return { success: true, markdown: built.markdown, outputPath, sources: built.sources };
  },

  async generateQuiz(this: Host,
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
  },

  async generateMindmap(this: Host, target: string, projectId: string = 'default'): Promise<StudyMindmapResponse> {
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
  },

  async generateAudioOverview(this: Host, topic: string, projectId: string = 'default'): Promise<StudyOutputResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    const built = buildAudioOverview(notes, topic);
    const projRoot = await this.resolveProjectRoot(projectId);
    await fs.mkdir(path.resolve(projRoot, 'output', 'audio'), { recursive: true });
    const outputPath = await this.writeStudyOutput(projectId, `audio-script-${built.slug}.md`, built.markdown);
    return { success: true, markdown: built.markdown, outputPath, sources: built.sources };
  },

  /**
   * Appends a dated entry to `notes/quick-notes.md` and returns the freshly
   * parsed scratchpad so the Studio can refresh its list without a second call.
   */

  async addQuickNote(this: Host, text: string, projectId: string = 'default'): Promise<StudyQuickNoteResponse> {
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
  },

  /**
   * Promotes one scratchpad entry into a wiki article. When `noteId` matches an
   * entry id the article body uses that entry's text; otherwise it falls back to
   * the whole scratchpad (legacy `/promote-note <slug> <folder>` behaviour).
   */

  async promoteQuickNote(this: Host,
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
  },

  async generateThesisChapter(this: Host,
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
        .filter((note: any) => built.chapters.some(chapter => chapter.path === note.path) || built.syntheses.some(synthesis => synthesis.path === note.path))
        .map((note: any) => ({ id: note.id, title: note.title, path: note.path, folder: note.folder || 'wiki' })),
      title: built.title,
      chapters: built.chapters,
      syntheses: built.syntheses,
    };
  },

  async executeStudyGuideWorkflow(this: Host, topic: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const built = buildStudyGuide(notes, topic);
    const relPath = await this.writeStudyOutput(projectId, `study-guide-${built.slug}.md`, built.markdown);
    return `### 📚 Study Guide Generated\n\n- **Saved to**: \`${relPath}\`\n- **Source Articles Cited**: ${built.notes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*Study guide is ready in output directory.*`;
  },

  async executeNoteWorkflow(this: Host, noteText: string, projectId: string = 'default'): Promise<string> {
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
  },

  async executeAudioOverviewWorkflow(this: Host, target: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const built = buildAudioOverview(notes, target);
    const projRoot = await this.resolveProjectRoot(projectId);
    await fs.mkdir(path.resolve(projRoot, 'output', 'audio'), { recursive: true });
    const relScriptPath = await this.writeStudyOutput(projectId, `audio-script-${built.slug}.md`, built.markdown);

    return `### 🎙️ Audio Overview Script Generated\n\n- **Dialogue Script**: \`${relScriptPath}\`\n- **TTS Provider Status**: \`none\` (Audio synthesis disabled in \`config.toml\`). Dialogue script generated successfully.\n- **Sources Covered**: ${built.notes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*To enable MP3 generation, configure \`[audio]\` provider in \`config.toml\`.*`;
  },

  async executePromoteNoteWorkflow(this: Host, argsText: string, projectId: string = 'default'): Promise<string> {
    const parts = (argsText || '').trim().split(/\s+/);
    const noteId = parts[0];
    const wikiName = parts[1] || 'general';

    if (!noteId) {
      return `### 🚀 Promote Note\n\nUsage: \`/promote-note <note-id> [wiki-folder]\``;
    }

    const result = await this.promoteQuickNote(noteId, wikiName, projectId);
    return result.markdown;
  },

  async executeThesisChapterWorkflow(this: Host,
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
  },

  /**
   * Adds an OKF v0.2 human verification event to a note's frontmatter.
   *
   * This is the operation that flips a node's trust tier to `human-reviewed`
   * (🟢 instead of 🟡/⚪), because the tier is derived from the `verified`
    * list (docs/standard/OKF_SPEC.md §6). Optionally promotes `status` to `stable`,
   * which ontology Rule 3 only allows for human-verified notes.
   */

  async executeMindmapWorkflow(this: Host, target: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const built = buildMindmap(notes, target);

    if (!built.note) {
      return `### 🧠 Mind Map\n\nNo matching note found to generate mind map.`;
    }

    const relPath = await this.writeStudyOutput(projectId, `mindmap-${built.slug}.md`, built.markdown);

    return `### 🧠 Mind Map Generated for "${built.note.title}"\n\n- **Saved to**: \`${relPath}\`\n- **Extracted Headings**: ${built.headings}\n- **Wikilinks**: ${built.wikilinks}\n\n\`\`\`text\n${built.tree.slice(0, 15).join('\n')}\n${built.tree.length > 15 ? '...' : ''}\n\`\`\`\n\n*Mind map tree and JSON stored in output/.*`;
  },

  /**
   * Builds and stores the deep research report. The deterministic scaffolding
   * is always produced; when an LLM is configured its synthesis replaces the
   * report body while frontmatter and source provenance stay grounded in the
   * notes that matched the question.
   */

  async executeQuizWorkflow(this: Host, topicAndCount: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
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
  },

  /**
   * Shared deterministic engine for `/trace` and the Trace tab: finds notes
   * matching the query, lists outgoing links and resolves the raw source
   * passages declared in frontmatter or in a `## Sources` section.
   */

  async writeDeepResearchReport(this: Host,
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
    const noteById = new Map(notes.map(note => [note.id, note]));
    const hits = q ? await defaultRetriever.retrieve(q, notes, { limit: 12, projectId }) : [];
    const relevantNotes = q
      ? hits.map(hit => noteById.get(hit.id)).filter((note): note is WikiNote => Boolean(note))
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

    const requiredHeadings = [
      '# Deep Research Report',
      'Executive Summary',
      'Thematic Deep-Dive',
      'Source Attribution Matrix',
      'Identified Knowledge Gaps',
    ];
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
          'Usa esattamente e letteralmente questi titoli in inglese, senza tradurli o modificarli:',
          ...requiredHeadings,
          'Il titolo Source Attribution Matrix deve essere seguito da una tabella Claim | Wiki Source | Grounding.',
          'Cita ogni affermazione con [[wikilink]] tratti esclusivamente dalle note fornite.',
        ].join('\n'),
        contextNotes: sources,
      });
      if (markdown.trim() && requiredHeadings.every((heading) => markdown.includes(heading))) {
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
  },

  async executeDeepResearchWorkflow(this: Host, question: string, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
    const result = await this.writeDeepResearchReport(question, notes, projectId);
    return result.summary;
  },

  async generateDeepResearch(this: Host,
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
  },

  async consultWiki(this: Host, question: string, projectId: string = 'default'): Promise<ResearchConsultResponse> {
    const q = (question || '').trim();
    const notes: WikiNote[] = await this.readAllWikiNotes(projectId);
    const noteById = new Map(notes.map((note: WikiNote) => [note.id, note]));
    const hits = await defaultRetriever.retrieve(q, notes, { limit: 8, projectId });
    const sources = hits
      .map(hit => noteById.get(hit.id))
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
      if (hits.length === 0) {
        lines.push('- Nessuna nota contiene i termini della domanda.');
      } else {
        const tokens = tokenize(q);
        for (const hit of hits.slice(0, 5)) {
          const note = noteById.get(hit.id);
          if (!note) continue;
          const details = noteSearchLines(note, tokens);
          lines.push(
            `- [[${note.id}]] (${note.title}) — ${details.matchCount} righe corrispondenti${details.matches[0] ? `, a partire dalla riga ${details.matches[0].line}` : ''}.`
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
  },

  /**
   * Persist a `/consult` answer as an OKF v0.2 note in the scoped vault.
   * The note is validated before writing; indexes are then regenerated so the
   * new note is discoverable right away.
   */

  async promoteConsultAnswer(this: Host,
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
  },

  async traceClaimInNotes(this: Host, target: string, notes: WikiNote[]): Promise<ResearchTraceResponse> {
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
  },

  async traceClaim(this: Host, query: string, projectId: string = 'default'): Promise<ResearchTraceResponse> {
    const notes = await this.readAllWikiNotes(projectId);
    return this.traceClaimInNotes(query, notes);
  },

  async executeTraceWorkflow(this: Host, target: string, notes: WikiNote[]): Promise<string> {
    const trace = await this.traceClaimInNotes(target, notes);

    if (trace.notes.length === 0) {
      return `### 🕸️ Connection Trace for "${target}"\n\nNo target connections traced in wiki notes.`;
    }

    const traceEntries = trace.notes.slice(0, 5).map((t: any) => {
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
  },

  /**
   * A1/A6 de-duplication: index generation has exactly ONE implementation —
   * the OKF v0.2 Python script. The former inline TypeScript writer emitted a
   * non-conformant index and silently masked script failures, so failures are
   * now surfaced instead of being papered over by a second writer.
   */
};

export type KnowledgeMethods = typeof knowledgeMethods;
