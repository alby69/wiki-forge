import { RenameResult, WikiNote } from '@frontend/core/types/wiki';
import {
  ReviewCritiqueResponse,
  ReviewDepth,
  ReviewDiffResponse,
  ReviewDigest,
  ReviewMetaResponse,
  ReviewSnapshot,
  ReviewVerifyResponse,
} from '@frontend/core/types/review';
import {
  ResearchBacklinksResponse,
  ResearchConsultResponse,
  ResearchDeepResearchResponse,
  ResearchPromoteAnswerResponse,
  ResearchRelatedResponse,
  ResearchSearchResponse,
  ResearchTraceResponse,
} from '@frontend/core/types/research';
import {
  StudyMindmapResponse,
  StudyOutputResponse,
  StudyPromoteResponse,
  StudyQuickNoteResponse,
  StudyQuizResponse,
  StudyThesisResponse,
} from '@frontend/core/types/study';
import { IStorage, IngestResult } from '@frontend/core/interfaces/IStorage';
import { appStore } from '@frontend/store/appStore';
import { FileStorage } from './FileStorage';
import { WikiEdit } from '@frontend/core/utils/wikiEdit';
import { FrontendApiBus } from '@frontend/core/apiBus';
import { ApiClientError, createApiClient } from '@frontend/api/client';
import type { EndpointId, EndpointRequest, EndpointResponse } from '@shared/api/contracts';

export interface AttachOptions {
  noteId?: string;
  title?: string;
  folder?: string;
  content: string;
  mode?: 'append' | 'create' | 'overwrite';
}

export interface ApplyEditResult {
  success: boolean;
  note?: WikiNote;
  error?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
}

/** Shared key for the wiki currently selected in the header project picker.
 * Kept as an export for external launchers; appStore is the only writer. */
export const ACTIVE_PROJECT_KEY = 'wiki-forge:active-project';

/** Read the active project id outside of an ApiStorage instance.
 *
 * Script launchers (Script Control Panel, KE workbench, ...) must use this so
 * every API call is scoped to the wiki the user actually selected. appStore is
 * the single source of truth and mirrors its value to localStorage; we read the
 * persisted value first so external launchers and tests that set it directly
 * are honoured, then fall back to the in-memory store. */
export function getActiveProjectId(fallback: string = 'default'): string {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (stored) return stored;
    } catch (_e) {
      // Storage can be unavailable in embedded contexts.
    }
  }
  return appStore.getState().activeProjectId || fallback;
}

export interface ScratchpadEntry {
  id: string;
  timestamp: string;
  text: string;
}

export interface HelpTopicMeta {
  id: string;
  title: string;
  icon: string;
  order: number;
  group: string;
  mode: 'focus' | 'dev' | 'both';
  keywords: string[];
  context: string[];
}

export interface HelpTopic extends HelpTopicMeta {
  markdown: string;
}

/** Resolve the API origin in the browser.
 *
 *  Components must call this instead of using bare `/api/...` paths: in the
 *  Docker setup the UI (Vite, :5173) and the API (:3001) are separate origins,
 *  and a relative URL would be resolved against the Vite dev server instead. */
export function resolveApiBaseUrl(fallback: string = ''): string {
  if (typeof window !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  return fallback;
}

export class ApiStorage implements IStorage {
  private fallback = new FileStorage();
  /** Kept as an explicit client option for callers that supply a custom origin. */
  private baseUrl: string;
  /** Per-instance bus: same transport, but honours the constructor's base URL. */
  private readonly api: FrontendApiBus;

  constructor(baseUrl: string = '') {
    this.baseUrl = resolveApiBaseUrl(baseUrl);
    this.api = new FrontendApiBus(createApiClient({
      baseUrl: this.baseUrl,
      getProjectId: () => getActiveProjectId(),
      // B7 — same session as the shared bus, no direct fetch in facades.
      getBearerToken: () => appStore.getState().auth.token || undefined,
    }), { scopeQuery: true });
  }

  public getActiveProjectId(): string {
    return getActiveProjectId();
  }

  public setActiveProjectId(id: string): void {
    appStore.setActiveProjectId(id);
  }

  /** The single transport entry point: URL, headers and lifecycle events are the bus'. */
  private async request<K extends EndpointId>(
    id: K,
    req: EndpointRequest<K> = {} as EndpointRequest<K>,
    projectId?: string
  ): Promise<EndpointResponse<K>> {
    return this.api.dispatch(id, req, projectId);
  }

  /** Keep the legacy JSON error envelope when the client throws on a non-2xx response. */
  private failedEnvelope<T extends { success?: boolean; error?: string }>(err: unknown, fallback: T): T {
    if (err instanceof ApiClientError && err.body && typeof err.body === 'object') {
      const envelope = err.body as { success?: boolean; error?: string };
      return { ...envelope, error: envelope.error || `HTTP ${err.status}` } as unknown as T;
    }
    return { ...fallback, error: String(err) } as unknown as T;
  }

  public async getProjects(): Promise<ProjectInfo[]> {
    try {
      const json = await this.request('projects.list', { query: {} });
      if (json.success && json.projects) {
        return json.projects;
      }
    } catch (_err) {
      // Fallback
    }
    return [{ id: 'default', name: 'Default Wiki', path: '.' }];
  }

  public async createProject(id: string, name: string): Promise<ProjectInfo | null> {
    try {
      const json = await this.request('projects.create', { body: { id, name } });
      if (json.success && json.project) {
        return json.project;
      }
    } catch (_err) {
      // Fallback
    }
    return null;
  }

  public async getProjectConfig(projectId?: string): Promise<Record<string, unknown> | null> {
    const id = projectId || this.getActiveProjectId();
    try {
      const json = await this.request('projects.config.get', { params: { id } });
      if (json.success && json.config) {
        return json.config;
      }
    } catch (_err) {
      // Fallback
    }
    return null;
  }

  public async updateProjectConfig(config: Record<string, unknown>, projectId?: string): Promise<boolean> {
    const id = projectId || this.getActiveProjectId();
    try {
      const json = await this.request('projects.config.put', { params: { id }, body: config });
      return json.success;
    } catch (_err) {
      // Fallback
    }
    return false;
  }

  public async deleteProject(projectId: string, deleteFolder: boolean = false): Promise<boolean> {
    try {
      const json = await this.request('projects.delete', {
        params: { id: projectId },
        query: { deleteFolder },
      });
      return json.success;
    } catch (_err) {
      // Fallback
    }
    return false;
  }

  public async getAllNotes(projectId?: string): Promise<WikiNote[]> {
    try {
      const json = await this.request('wiki.notes.list', {}, projectId);
      if (json.success && Array.isArray(json.notes) && json.notes.length > 0) {
        return json.notes;
      }
    } catch (_err) {
      // Backend unavailable; fallback to static FileStorage only for the active project
    }
    return projectId ? [] : this.fallback.getAllNotes();
  }

  public async getScratchpad(): Promise<ScratchpadEntry[]> {
    try {
      const json = await this.request('wiki.scratchpad.list');
      if (json.success && Array.isArray(json.entries)) {
        return json.entries;
      }
    } catch (_err) {
      // Backend unavailable
    }
    return [];
  }

  public async deleteScratchpad(id: string): Promise<boolean> {
    try {
      const json = await this.request('wiki.scratchpad.delete', { body: { id } });
      return json.success === true;
    } catch (_err) {
      // Backend unavailable
    }
    return false;
  }

  public async getNote(id: string): Promise<WikiNote | null> {
    const notes = await this.getAllNotes();
    const q = id.toLowerCase();
    return (
      notes.find(n => n.id === id || n.id.toLowerCase() === q || n.title.toLowerCase() === q) ?? null
    );
  }

  public async saveNote(note: Partial<WikiNote> & { id: string }): Promise<WikiNote> {
    try {
      const json = await this.request('wiki.note.save', {
        body: {
          id: note.id,
          content: note.content ?? '',
          rawContent: note.rawContent,
          path: note.path,
          folder: note.folder,
          title: note.title,
        },
      });
      if (json.success && json.note) {
        return json.note;
      }
    } catch (_err) {
      // Backend unavailable; fallback
    }

    return this.fallback.saveNote(note);
  }

  public async attachNote(options: AttachOptions): Promise<WikiNote> {
    try {
      const json = await this.request('wiki.note.attach', { body: options });
      if (json.success && json.note) {
        return json.note;
      }
    } catch (_err) {
      // Backend unavailable
    }

    const targetId = options.noteId || options.title?.toLowerCase().replace(/\s+/g, '-') || `attached-${Date.now()}`;
    return this.fallback.saveNote({ id: targetId, content: options.content });
  }

  public async applyEdit(edit: WikiEdit): Promise<ApplyEditResult> {
    try {
      const json = await this.request('wiki.note.applyEdit', {
        body: { file: edit.file, find: edit.find, replace: edit.replace },
      });
      if (json.success && json.note) {
        return { success: true, note: json.note };
      }
      return { success: false, error: (json as { error?: string }).error || 'HTTP 200' };
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err) });
    }
  }

  /** A7: stage an LLM edit proposal; the wiki is untouched until human apply. */
  public async proposeChangeset(
    edits: WikiEdit[],
    description: string
  ): Promise<{ success: boolean; changesetId?: string; error?: string }> {
    try {
      // The catalogue DTO calls the edited file `path`; the backend still expects
      // the legacy `file` key, so keep the body and narrow-cast to the contract type.
      const body = {
        description,
        author: 'agent:chat',
        rationale: 'Proposta generata dall’agente, in attesa di revisione umana.',
        sources: ['chat'],
        edits: edits.map(edit => ({
          file: edit.file,
          action: 'modify',
          find: edit.find,
          replace: edit.replace,
        })),
      } as unknown as EndpointRequest<'changesets.stage'>['body'];
      const json = await this.request('changesets.stage', { body });
      if (json.success && json.changeset) {
        return { success: true, changesetId: json.changeset.id };
      }
      return { success: false, error: (json as { error?: string }).error || 'HTTP 200' };
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err) });
    }
  }

  public async deleteNote(id: string): Promise<boolean> {
    try {
      const json = await this.request('wiki.delete', { body: { path: id, type: 'file' } });
      return json.success;
    } catch (_err) {
      // Backend unavailable
    }
    return false;
  }

  public async createFolder(folderPath: string): Promise<boolean> {
    try {
      const json = await this.request('wiki.folder.create', { body: { path: folderPath } });
      return json.success;
    } catch (_err) {
      // Fallback
    }
    return this.fallback.createFolder(folderPath);
  }

  public async createFile(folderPath: string, fileName: string, content?: string): Promise<WikiNote> {
    try {
      // An absent body field was previously omitted by JSON.stringify; keep that
      // behaviour so a missing content still fails over to FileStorage.
      const json = await this.request('wiki.file.create', {
        body: { folder: folderPath, name: fileName, content: content as string },
      });
      if (json.success && json.note) return json.note;
    } catch (_err) {
      // Fallback
    }
    return this.fallback.createFile(folderPath, fileName, content);
  }

  public async renameItem(oldPath: string, newName: string): Promise<boolean> {
    try {
      const json = await this.request('wiki.rename', {
        body: { from: oldPath, to: newName, newName, dryRun: false },
      });
      return json.success;
    } catch (_err) {
      // Fallback
    }
    return this.fallback.renameItem(oldPath, newName);
  }

  /** Rename a document by title: slugified filename + title update + wikilink repair. */
  public async renameDocument(oldPath: string, newTitle: string): Promise<RenameResult | null> {
    return this.requestRename(oldPath, newTitle, false);
  }

  /** Preview how many links a rename would rewrite, without changing the disk. */
  public async previewRename(oldPath: string, newTitle: string): Promise<RenameResult | null> {
    return this.requestRename(oldPath, newTitle, true);
  }

  private async requestRename(oldPath: string, newTitle: string, dryRun: boolean): Promise<RenameResult | null> {
    try {
      return await this.request('wiki.rename', {
        body: { from: oldPath, to: newTitle, newTitle, dryRun },
      });
    } catch (err) {
      const body = err instanceof ApiClientError && err.body && typeof err.body === 'object'
        ? err.body as { error?: string }
        : undefined;
      return {
        success: false,
        dryRun,
        renamed: { from: oldPath, to: oldPath, oldTitle: '', newTitle, id: '' },
        updatedFiles: [],
        totalReplacements: 0,
        error: body?.error || (err instanceof ApiClientError ? `HTTP ${err.status}` : String(err)),
      };
    }
  }

  public async moveItem(sourcePath: string, targetFolder: string): Promise<boolean> {
    try {
      const json = await this.request('wiki.move', {
        body: { from: sourcePath, to: targetFolder, dryRun: false },
      });
      return json.success;
    } catch (_err) {
      // Fallback
    }
    return this.fallback.moveItem(sourcePath, targetFolder);
  }

  public async uploadFile(folderPath: string, fileName: string, content: string | ArrayBuffer): Promise<boolean> {
    try {
      let payloadContent = '';
      if (typeof content === 'string') {
        payloadContent = content;
      } else {
        const bytes = new Uint8Array(content);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        payloadContent = btoa(binary);
      }

      const joinedPath = folderPath ? `${folderPath.replace(/\/+$/, '')}/${fileName}` : fileName;
      const json = await this.request('wiki.upload', {
        body: {
          path: joinedPath,
          content: payloadContent,
          encoding: typeof content !== 'string' ? 'base64' : 'utf-8',
        },
      });
      return json.success;
    } catch (_err) {
      // Fallback
    }
    return this.fallback.uploadFile(folderPath, fileName, content);
  }

  /**
   * One-shot import: stages a Markdown file in `raw/`, then compiles it into the
   * chosen wiki folder. Returns the created note and whether the LLM compile
   * ran (false means the raw markdown was copied verbatim).
   */
  public async ingestMarkdownFile(
    fileName: string,
    content: string,
    targetFolder: string
  ): Promise<IngestResult> {
    try {
      const json = await this.request('wiki.ingest', {
        body: { folder: targetFolder, fileName, content },
      });
      if (json.success) {
        return {
          success: true,
          note: json.note,
          compiled: json.compiled,
          targetFolder: json.targetFolder,
          message: json.message,
        };
      }
      return { success: false, error: (json as { error?: string }).error || 'HTTP 200' };
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err) });
    }
  }

  public async searchNotes(query: string): Promise<WikiNote[]> {
    const notes = await this.getAllNotes();
    const q = query.toLowerCase();
    return notes.filter(
      n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }

  public async getAllFolders(): Promise<string[]> {
    try {
      const json = await this.request('wiki.folders.list');
      if (json.success && Array.isArray(json.folders)) {
        return json.folders;
      }
    } catch (_err) {
      // Backend unavailable
    }
    return ['wiki'];
  }

  public async sendChat(message: string, command?: string, contextNoteId?: string): Promise<string> {
    try {
      const json = await this.request('chat.send', {
        body: { message, command, contextNoteId },
      });
      if (json.success && json.response) {
        return json.response;
      }
    } catch (_err) {
      // Offline simulation fallback
    }

    return `### 🤖 Offline Agent Assistant\n\nReceived: "${message}". Connect to the backend server for live execution.`;
  }

  public async sendChatStream(
    message: string,
    onChunk: (chunk: string) => void,
    command?: string,
    contextNoteId?: string
  ): Promise<void> {
    try {
      await this.api.stream(
        'chat.send',
        { body: { message, command, contextNoteId, stream: true } },
        (event) => {
          if (event.data === '[DONE]') return;
          try {
            const parsed = JSON.parse(event.data) as { chunk?: string; error?: string };
            if (parsed.chunk) {
              onChunk(parsed.chunk);
            }
            // In-stream `{ error }` frames were parsed and ignored by the legacy reader.
          } catch (_e) {
            // ignore
          }
        }
      );
      return;
    } catch (_err) {
      // Offline fallback
    }

    const fallbackResponse = await this.sendChat(message, command, contextNoteId);
    onChunk(fallbackResponse);
  }

  public async getHelpTopics(): Promise<HelpTopicMeta[]> {
    try {
      const json = await this.request('help.list');
      if (json.success && Array.isArray(json.topics)) {
        return json.topics;
      }
    } catch (_err) {
      // Backend unavailable
    }
    return [];
  }

  public async getHelpTopic(id: string): Promise<HelpTopic | null> {
    try {
      const json = await this.request('help.get', { params: { topicId: id } });
      if (json.success && json.topic) {
        return json.topic as HelpTopic;
      }
    } catch (_err) {
      // Backend unavailable
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Review Studio
  // ---------------------------------------------------------------------------

  public async getReviewMeta(noteRef: string): Promise<ReviewMetaResponse> {
    try {
      return await this.request('review.meta', { query: { note: noteRef } });
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err) });
    }
  }

  public async verifyNote(options: {
    note: string;
    reviewer?: string;
    comment?: string;
    setStable?: boolean;
  }): Promise<ReviewVerifyResponse> {
    try {
      return await this.request('review.verify', { body: options });
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err) });
    }
  }

  public async getReviewDigest(
    options: { days?: number; scope?: 'all' | 'folder' | 'note'; note?: string } = {}
  ): Promise<ReviewDigest> {
    try {
      return await this.request('review.digest', {
        query: { days: options.days, scope: options.scope, note: options.note },
      });
    } catch (err) {
      return this.failedEnvelope(err, {
        success: false,
        error: String(err),
        rangeDays: options.days ?? 7,
        scope: options.scope ?? 'all',
        generatedAt: new Date().toISOString(),
        stats: { notesChanged: 0, verified: 0, stale: 0, brokenLinks: 0, notes: 0 },
        days: [],
        health: { score: 0, label: 'n/d', summary: '' },
        nextActions: [],
        markdown: '',
      });
    }
  }

  public async critiqueNote(options: {
    note: string;
    depth?: ReviewDepth;
    focus?: string[];
    instructions?: string;
  }): Promise<ReviewCritiqueResponse> {
    try {
      return await this.request('review.critique', { body: options });
    } catch (err) {
      return this.failedEnvelope(err, { success: false, markdown: '', fallback: false, error: String(err) });
    }
  }

  public async listReviewSnapshots(noteRef: string): Promise<ReviewSnapshot[]> {
    try {
      const json = await this.request('review.snapshots', { query: { note: noteRef } });
      if (json.success && Array.isArray(json.snapshots)) return json.snapshots;
    } catch (_err) {
      // Backend unavailable
    }
    return [];
  }

  public async getReviewDiff(noteRef: string, snapshotId: string): Promise<ReviewDiffResponse> {
    try {
      return await this.request('review.diff', {
        query: { note: noteRef, snapshot: snapshotId },
      });
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err) });
    }
  }

  public async restoreReviewSnapshot(noteRef: string, snapshotId: string): Promise<WikiNote | null> {
    try {
      const json = await this.request('review.restore', {
        body: { note: noteRef, snapshot: snapshotId },
      });
      if (json.success && json.note) return json.note;
    } catch (_err) {
      // Backend unavailable
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Research Studio
  // ---------------------------------------------------------------------------

  /** Research Studio can query a different project without switching the active
   * vault. The explicit scope is handed to the bus, which sets `X-Project-Id`. */
  public async researchSearch(query: string, limit: number = 30, projectId?: string): Promise<ResearchSearchResponse> {
    try {
      return await this.request('research.search', { query: { q: query, limit } }, projectId);
    } catch (err) {
      return this.failedEnvelope(err, {
        success: false, error: String(err), query, total: 0, totalMatches: 0, scanned: 0, tookMs: 0, results: [],
      });
    }
  }

  public async researchBacklinks(noteRef: string, projectId?: string): Promise<ResearchBacklinksResponse> {
    try {
      return await this.request('research.backlinks', { query: { note: noteRef } }, projectId);
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err), items: [], scanned: 0 });
    }
  }

  public async researchRelated(noteRef: string, limit: number = 12, projectId?: string): Promise<ResearchRelatedResponse> {
    try {
      return await this.request('research.related', { query: { note: noteRef, limit } }, projectId);
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err), suggestions: [], scanned: 0 });
    }
  }

  public async researchTrace(query: string, projectId?: string): Promise<ResearchTraceResponse> {
    try {
      return await this.request('research.trace', { query: { q: query } }, projectId);
    } catch (err) {
      return this.failedEnvelope(err, { success: false, error: String(err), query, notes: [], scanned: 0 });
    }
  }

  public async researchConsult(question: string, projectId?: string): Promise<ResearchConsultResponse> {
    try {
      return await this.request('research.consult', { body: { question } }, projectId);
    } catch (err) {
      return this.failedEnvelope(err, {
        success: false, markdown: '', fallback: true, citations: [], error: String(err),
      });
    }
  }

  /** Write a `/consult` answer into the scoped vault as a validated OKF note. */
  public async researchPromoteAnswer(
    question: string,
    markdown: string,
    citations: Array<{ id: string; title: string; path: string }>,
    fallback: boolean,
    projectId?: string
  ): Promise<ResearchPromoteAnswerResponse> {
    try {
      return await this.request('research.promoteAnswer', {
        body: { question, markdown, citations, fallback },
      }, projectId);
    } catch (err) {
      return this.failedEnvelope(err, { success: false, validation: [], error: String(err) });
    }
  }

  public async researchDeepResearch(question: string, projectId?: string): Promise<ResearchDeepResearchResponse> {
    try {
      return await this.request('research.deepResearch', { body: { question } }, projectId);
    } catch (err) {
      return this.failedEnvelope(err, {
        success: false, markdown: '', articles: 0, fallback: true, error: String(err),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Study Studio
  // ---------------------------------------------------------------------------

  private async studyPost<T extends { success?: boolean; error?: string }>(
    id: EndpointId,
    body: Record<string, unknown>,
    fallback: T
  ): Promise<T> {
    try {
      const json = await this.request(id, { body } as unknown as EndpointRequest<EndpointId>);
      return json as unknown as T;
    } catch (err) {
      return this.failedEnvelope(err, fallback);
    }
  }

  public async studyGuide(topic: string): Promise<StudyOutputResponse> {
    return this.studyPost<StudyOutputResponse>('study.guide', { topic }, {
      success: false,
      markdown: '',
      outputPath: '',
      sources: [],
    });
  }

  public async studyQuiz(topic: string, count: number = 5): Promise<StudyQuizResponse> {
    return this.studyPost<StudyQuizResponse>('study.quiz', { topic, count }, {
      success: false,
      markdown: '',
      outputPath: '',
      sources: [],
      count: 0,
    });
  }

  public async studyMindmap(target: string): Promise<StudyMindmapResponse> {
    return this.studyPost<StudyMindmapResponse>('study.mindmap', { target }, {
      success: false,
      markdown: '',
      outputPath: '',
      sources: [],
      nodes: [],
      links: [],
      headings: 0,
      wikilinks: 0,
    });
  }

  public async studyAudioOverview(topic: string): Promise<StudyOutputResponse> {
    return this.studyPost<StudyOutputResponse>('study.audioOverview', { topic }, {
      success: false,
      markdown: '',
      outputPath: '',
      sources: [],
    });
  }

  public async studyQuickNote(text: string): Promise<StudyQuickNoteResponse> {
    return this.studyPost<StudyQuickNoteResponse>('study.note', { text }, {
      success: false,
      markdown: '',
      entries: [],
    });
  }

  public async studyPromoteNote(noteId: string, folder: string): Promise<StudyPromoteResponse> {
    return this.studyPost<StudyPromoteResponse>('study.promoteNote', { noteId, folder }, {
      success: false,
      markdown: '',
    });
  }

  public async studyThesisChapter(
    topic: string,
    options: { title?: string; minMaturity?: number } = {}
  ): Promise<StudyThesisResponse> {
    return this.studyPost<StudyThesisResponse>('study.thesisChapter', {
      topic,
      title: options.title || '',
      minMaturity: options.minMaturity ?? 0,
    }, {
      success: false,
      markdown: '',
      outputPath: '',
      sources: [],
      title: '',
      chapters: [],
      syntheses: [],
    });
  }
}
