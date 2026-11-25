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

export const vaultMethods = {
  async readAllWikiNotes(this: Host, projectId: string = 'default'): Promise<WikiNote[]> {
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
  },

  /** Parse the quick-notes scratchpad (`notes/quick-notes.md`) into individual
   *  entries delimited by `## [timestamp]` headings. */

  async readScratchpadEntries(this: Host, projectId: string = 'default'): Promise<ScratchpadEntry[]> {
    const notesFilePath = path.join(await this.resolveProjectRoot(projectId), 'notes', 'quick-notes.md');
    let raw = '';
    try {
      raw = await fs.readFile(notesFilePath, 'utf-8');
    } catch (_e) {
      return [];
    }

    return parseScratchpad(raw);
  },

  /** Remove a single scratchpad entry (matched by id) from `notes/quick-notes.md`. */

  async deleteScratchpadEntry(this: Host, id: string, projectId: string = 'default'): Promise<boolean> {
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
  },

  async getAllFolders(this: Host, projectId: string = 'default'): Promise<string[]> {
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
  },

  async saveWikiNote(this: Host, data: SaveNoteRequest, projectId: string = 'default'): Promise<WikiNote> {
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
    if (previousContent && previousContent !== contentToWrite) {
      this.publishNoteModified(projectId, relativePath);
    }

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
  },

  /**
   * Applies a single, deterministic find/replace edit proposed by the agent.
   * The `find` block must match exactly once so the edit can never touch the
   * wrong location; ambiguous or missing matches are rejected instead of
   * letting the LLM rewrite an entire file.
   */

  async applyWikiEdit(this: Host, data: ApplyEditRequest, projectId: string = 'default'): Promise<WikiNote> {
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
    this.publishNoteModified(projectId, path.relative(projRoot, targetPath).replace(/\\/g, '/'));

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
  },

  async validateSafePath(this: Host, targetPath: string, projectId: string = 'default'): Promise<void> {
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
  },

  async createFolderHandler(this: Host, data: CreateFolderRequest, projectId: string = 'default'): Promise<string> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const wikiDir = path.resolve(await this.getWikiDir(projectId));
    const target = path.resolve(wikiDir, data.folderPath.replace(/^wiki\/?/, ''));
    await this.validateSafePath(target, projectId);
    await fs.mkdir(target, { recursive: true });
    return path.relative(projRoot, target).replace(/\\/g, '/');
  },

  async createFileHandler(this: Host, data: CreateFileRequest, projectId: string = 'default'): Promise<WikiNote> {
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
  },

  async listWikiMarkdownFiles(this: Host, wikiDir: string): Promise<string[]> {
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
  },

  /** Read a note and describe it the way the link rewriter needs it. */

  async describeDocument(this: Host,
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
  },

  buildDocumentRef(this: Host, absPath: string, projRoot: string, wikiDir: string, title: string, aliases: string[] = []): DocumentRef {
    return {
      relPath: path.relative(projRoot, absPath).replace(/\\/g, '/'),
      relId: path.relative(wikiDir, absPath).replace(/\\/g, '/').replace(/\.md$/i, ''),
      stem: path.basename(absPath).replace(/\.md$/i, ''),
      title,
      aliases,
    };
  },

  /**
   * Rewrite every vault link that points to the moved documents, then apply the
   * filesystem rename and write the updated contents.
   *
   * `performRename` is invoked only after all rewrites have been computed, so a
   * dry-run preview never touches the disk.
   */

  async applyDocumentMoves(this: Host, options: {
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

    const allRelIds = files.map((fileAbs: any) =>
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
  },

  buildRenameResult(this: Host,
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
  },

  async renameHandler(this: Host, data: RenameRequest, projectId: string = 'default'): Promise<RenameResult> {
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
  },

  async moveHandler(this: Host, data: MoveRequest, projectId: string = 'default'): Promise<RenameResult> {
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
  },

  /**
   * A11: deletions are recoverable. The file is moved to
   * `<project>/.wiki-forge/trash/` with an auditable manifest entry instead of
   * being unlinked, so an accidental UI/LLM delete is never data loss.
   */

  async deleteHandler(this: Host, data: DeleteRequest, projectId: string = 'default'): Promise<TrashEntry> {
    const projRoot = await this.resolveProjectRoot(projectId);
    const absTarget = path.isAbsolute(data.targetPath) ? path.resolve(data.targetPath) : path.resolve(projRoot, data.targetPath);
    await this.validateSafePath(absTarget, projectId);
    const entry = await softDelete(absTarget, projRoot);
    if (absTarget.toLowerCase().endsWith('.md')) {
      this.publishNoteDeleted(projectId, path.relative(projRoot, absTarget).replace(/\\/g, '/'));
    }
    return entry;
  },

  async uploadHandler(this: Host, data: UploadRequest, projectId: string = 'default'): Promise<void> {
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
  },

  async attachToNote(this: Host, data: AttachNoteRequest, projectId: string = 'default'): Promise<WikiNote> {
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
  },

  async ingestMarkdownHandler(this: Host,
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
        (n: any) => (n.folder || 'general') === targetFolder && path.basename(n.path).toLowerCase() === `${stem}.md`
      );
      // The agent may have filed the article in a thematic folder chosen by
      // itself (e.g. wiki/temi/), so fall back to a filename match anywhere.
      if (!note) {
        note = notes.find((n: any) => path.basename(n.path).toLowerCase() === `${stem}.md`);
      }
    }

    const notePath = note?.path || `wiki/${targetFolder}/${stem}.md`;
    const message = compiled
      ? `Importato e compilato in ${notePath}`
      : `File copiato in raw/${fileName}: compilazione differita (agente/LLM non disponibile). Usa "Compila" per completare.`;
    if (compiled && note) this.publishNoteCreated(projectId, note.path);

    return { note, compiled, targetFolder, message };
  },

  async executeCompileWorkflow(this: Host,
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
  },

  async executeAuditWorkflow(this: Host, notes: WikiNote[], projectId: string = 'default'): Promise<string> {
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
  },

  // -------------------------------------------------------------------------
  // Study Studio generators (shared by chat commands and HTTP endpoints)
  // -------------------------------------------------------------------------

  /** Writes a study artefact under `<project>/output` and returns its relative path. */

  async executeReindexWorkflow(this: Host, projectId: string = 'default'): Promise<string> {
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
  },
};

export type VaultMethods = typeof vaultMethods;
