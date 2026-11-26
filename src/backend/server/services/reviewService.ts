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

export const reviewMethods = {
  async executeVerifyWorkflow(this: Host,
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
  },

  /**
   * Structured, reusable implementation of the OKF `verified` mutation.
   *
   * Both `/verify` (chat) and `POST /api/notes/review/verify` (Review Studio)
   * call this method, so the two entry points can never drift apart. It returns
   * data instead of Markdown; formatting stays in `executeVerifyWorkflow`.
   */

  async recordHumanVerification(this: Host, options: {
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

    const localFallback = `human:${process.env.WIKIFORGE_LOCAL_ACTOR?.trim() || 'local'}`;
    const actor = this.strictProvenance
      ? canonicalActor(options.principal?.actor, PROCESS_FALLBACK_ACTOR)
      : options.principal?.actor && actorKind(options.principal.actor) === 'human'
        ? canonicalActor(options.principal.actor)
        : localFallback;
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
  },

  /** Resolve a note by id, title, folder/stem or path, case-insensitively. */

  resolveReviewTarget(this: Host, noteRef: string, notes: WikiNote[]): WikiNote | null {
    const ref = noteRef.trim().toLowerCase().replace(/^\.?\//, '').replace(/\.md$/i, '');
    return this.parser.resolveLinkTarget(noteRef, notes)
      || notes.find(n => n.id.toLowerCase() === ref)
      || notes.find(n => n.title.toLowerCase() === ref)
      || notes.find(n => n.path.toLowerCase() === ref)
      || notes.find(n => n.path.toLowerCase().replace(/\.md$/i, '').endsWith(`/${ref}`))
      || notes.find(n => n.path.toLowerCase().replace(/\.md$/i, '') === ref)
      || null;
  },

  /**
   * Inserts a `verified` event into an OKF frontmatter block and optionally
   * promotes `status` to `stable`, preserving the note body untouched.
   */

  applyVerification(this: Host,
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
  },

  /**
   * Appends an entry to `wiki/log.md` (OKF §9), creating a dated section when
   * today's section does not exist yet (newest dates first).
   */

  async appendWikiLog(this: Host, wikiDir: string, message: string, date: string): Promise<void> {
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
  },

  // ---------------------------------------------------------------------------
  // Review Studio support (meta, quality gate, digest, snapshots, critique)
  // ---------------------------------------------------------------------------

  getSnapshotDir(this: Host, projectRoot: string, noteRelPath: string): string {
    const rel = noteRelPath
      .replace(/\\/g, '/')
      .replace(/^wiki\//i, '')
      .replace(/\.md$/i, '');
    return path.join(projectRoot, '.wiki-forge', 'snapshots', rel);
  },

  /**
   * Stores the pre-write content of a note under `.wiki-forge/snapshots/`.
   * Git is not required (and is unavailable inside the API container), so this
   * is the local history behind the Review Studio "Confronta versioni" tab.
   */

  async writeReviewSnapshot(this: Host,
    projectId: string,
    noteRelPath: string,
    content: string,
    reason: string = 'salvataggio'
  ): Promise<void> {
    await this.writeSnapshotFile(await this.resolveProjectRoot(projectId), noteRelPath, content, reason);
  },

  /** Shared implementation; returns the snapshot id for A3 changeset audit. */

  async writeSnapshotFile(this: Host,
    projectRoot: string,
    noteRelPath: string,
    content: string,
    reason: string
  ): Promise<string | undefined> {
    if (!content.trim()) return undefined;
    try {
      const dir = this.getSnapshotDir(projectRoot, noteRelPath);
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
      return stamp;
    } catch (_err) {
      // Snapshots are best-effort: never block a note write because history failed.
      return undefined;
    }
  },

  /** Parse OKF `verified` events (actor + timestamp), preserving order. */

  extractVerificationEvents(this: Host, rawContent: string): Array<{ actor: string; at?: string }> {
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
  },

  frontmatterBlock(this: Host, rawContent: string): string {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawContent);
    return match ? match[1] : '';
  },

  countFrontmatterSourceEntries(this: Host, rawContent: string): number {
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
  },

  /**
   * Everything the Review Studio needs for one note in a single round trip:
   * identity, trust metadata, quality gate and verification history.
   */

  async getReviewMeta(this: Host, noteRef: string, projectId: string = 'default'): Promise<{
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
    const brokenLinks = note.outboundLinks.filter((link: any) => !this.resolveReviewTarget(link, notes));
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
      .map((event: any) => event.actor)
      .filter((actor: any) => actor.startsWith('human:'))
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
  },

  parseReviewLog(this: Host, raw: string): Array<{
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
  },

  /**
   * Deterministic digest: parses `wiki/log.md`, checks note freshness and link
   * integrity, and returns both structured data and a Markdown report.
   */

  async getReviewDigest(this: Host,
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
        ? notes.filter((note: any) => note.path === target!.path)
        : notes.filter((note: any) => note.folder === target!.folder);
    }

    const scopedPaths = new Set(scopedNotes.map((note: any) => note.path));
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

    const relevantLog = logEntries.filter((entry: any) => {
      if (entry.date < cutoffDate) return false;
      if (scope === 'all') return true;
      const entryPath = toWikiPath(entry.path);
      return scopedPaths.has(entryPath);
    });

    const grouped = new Map<string, Array<{ noteId?: string; title: string; path?: string; kind: string; detail: string }>>();
    for (const entry of relevantLog) {
      const entryPath = toWikiPath(entry.path);
      const note = notes.find((candidate: any) => candidate.path === entryPath);
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
      const humanVerified = actors.some((actor: any) => String(actor).startsWith('human:'));
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
      (note: any) => note.staleAfter && note.staleAfter.slice(0, 10) < today
    );
    let brokenLinkCount = 0;
    for (const note of scopedNotes) {
      for (const link of note.outboundLinks) {
        if (!this.resolveReviewTarget(link, notes)) brokenLinkCount++;
      }
    }

    const total = Math.max(1, scopedNotes.length);
    const unverified = scopedNotes.filter((note: any) => note.trustTier === 'unverified').length;
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
    for (const note of scopedNotes.filter((candidate: any) => candidate.trustTier === 'unverified').slice(0, 2)) {
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
  },

  /**
   * Best-effort LLM critique with a deterministic fallback. The fallback keeps
   * the tab useful when no provider is configured (common in offline dev).
   */

  async critiqueNote(this: Host, options: {
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
        .map((link: any) => this.resolveReviewTarget(link, notes))
        .filter((note: any): note is WikiNote => Boolean(note))
        .slice(0, 6),
    ];

    const systemPrompt = [
      'Sei un revisore critico accademico esperto di knowledge management e OKF v0.2.',
      'Il tuo compito è stress-testare una nota di una tesi, non riscriverla.',
      'Rispondi in italiano, in Markdown, con questa struttura esatta:',
      'Usa un blocco <think>...</think> per l’analisi passo-passo, poi chiudi il blocco prima della struttura finale.',
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
      const issues = items.filter((item: any) => !item.ok);
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
          ? issues.map((issue: any) => `- Correggere **${issue.label}**: ${issue.detail}`).join('\n')
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
  },

  async listReviewSnapshots(this: Host, noteRef: string, projectId: string = 'default'): Promise<Array<{
    id: string;
    at: string;
    reason: string;
    bytes: number;
    content?: string;
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
      const content = await fs.readFile(full, 'utf-8').catch(() => '');
      snapshots.push({
        id,
        at: Number.isNaN(Date.parse(parsed)) ? (stat?.mtime.toISOString() ?? '') : new Date(parsed).toISOString(),
        reason,
        bytes: stat?.size ?? 0,
        content,
      });
    }
    return snapshots;
  },

  diffLines(this: Host, before: string[], after: string[]): Array<{
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
  },

  async getReviewDiff(this: Host, noteRef: string, snapshotId: string, projectId: string = 'default'): Promise<{
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
        added: rows.filter((row: any) => row.type === 'add').length,
        removed: rows.filter((row: any) => row.type === 'del').length,
        context: rows.filter((row: any) => row.type === 'ctx').length,
      },
    };
  },

  async restoreReviewSnapshot(this: Host, noteRef: string, snapshotId: string, projectId: string = 'default'): Promise<WikiNote | null> {
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
  },
};

export type ReviewMethods = typeof reviewMethods;
