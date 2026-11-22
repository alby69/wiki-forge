/**
 * HTTP-neutral service surface consumed by domain modules.
 *
 * `AgentServer` builds this object once and injects it into modules; modules
 * never see `IncomingMessage`/`ServerResponse` and can be reused by the
 * scheduler, a CLI or a test. Keeping the surface explicit also documents the
 * last coupling points left in the legacy facade while they are being migrated.
 */

import type { WikiNote } from '../../../frontend/core/types/wiki';
import type { TrashEntry } from '../safeFs';
import type { ProjectService } from '../projectService';
import type { ChangesetStore } from '../changesetStore';
import type { Scheduler } from '../scheduler/scheduler';
import type { ApprovalStore } from '../scheduler/approvalStore';
import type { EventTriggerBus } from '../scheduler/eventTriggers';
import type { ScriptScheduleCreateInput } from '../scheduler/scriptJobStore';
import type { MessageBus } from '../bus/messageBus';
import type { PythonTool } from './pythonTool';
import type { ScriptDef, ChatRequest } from '../agentServer';

export type ProjectId = string;
export type JsonObject = Record<string, unknown>;

export interface VaultServices {
  readAllWikiNotes(projectId?: ProjectId): Promise<WikiNote[]>;
  readScratchpadEntries(projectId?: ProjectId): Promise<Array<{ id: string; timestamp: string; text: string }>>;
  deleteScratchpadEntry(id: string, projectId?: ProjectId): Promise<boolean>;
  getAllFolders(projectId?: ProjectId): Promise<string[]>;
  saveWikiNote(data: JsonObject, projectId?: ProjectId): Promise<WikiNote>;
  applyWikiEdit(data: JsonObject, projectId?: ProjectId): Promise<WikiNote>;
  attachToNote(data: JsonObject, projectId?: ProjectId): Promise<WikiNote>;
  createFolderHandler(data: JsonObject, projectId?: ProjectId): Promise<string>;
  createFileHandler(data: JsonObject, projectId?: ProjectId): Promise<WikiNote>;
  renameHandler(data: JsonObject, projectId?: ProjectId): Promise<any>;
  moveHandler(data: JsonObject, projectId?: ProjectId): Promise<any>;
  deleteHandler(data: JsonObject, projectId?: ProjectId): Promise<TrashEntry>;
  uploadHandler(data: JsonObject, projectId?: ProjectId): Promise<void>;
  ingestMarkdownHandler(data: JsonObject, projectId?: ProjectId): Promise<any>;
  listTrash(projectId?: ProjectId): Promise<TrashEntry[]>;
  restoreTrash(id: string, projectId?: ProjectId): Promise<string>;
  downloadFile(filePath: string, projectId?: ProjectId): Promise<{ filename: string; data: Buffer }>;
  publishNoteCreated(projectId: ProjectId, notePath: string): void;
}

export interface ReviewStudioServices {
  getReviewMeta(noteRef: string, projectId?: ProjectId): Promise<JsonObject>;
  recordHumanVerification(options: JsonObject): Promise<JsonObject>;
  getReviewDigest(projectId: ProjectId, days: number, scope: string, noteRef?: string): Promise<JsonObject>;
  critiqueNote(options: JsonObject): Promise<JsonObject>;
  listReviewSnapshots(noteRef: string, projectId?: ProjectId): Promise<JsonObject[]>;
  getReviewDiff(noteRef: string, snapshotId: string, projectId?: ProjectId): Promise<JsonObject>;
  restoreReviewSnapshot(noteRef: string, snapshotId: string, projectId?: ProjectId): Promise<WikiNote | null>;
}

export interface ResearchServices {
  resolveReviewTarget(noteRef: string, notes: WikiNote[]): WikiNote | null;
  traceClaim(query: string, projectId?: ProjectId): Promise<JsonObject>;
  consultWiki(question: string, projectId?: ProjectId): Promise<JsonObject>;
  promoteConsultAnswer(input: JsonObject, projectId?: ProjectId): Promise<JsonObject>;
  generateDeepResearch(question: string, projectId?: ProjectId): Promise<JsonObject>;
}

export interface StudyServices {
  generateStudyGuide(topic: string, projectId?: ProjectId): Promise<JsonObject>;
  generateQuiz(topic: string, count?: number, projectId?: ProjectId): Promise<JsonObject>;
  generateMindmap(target: string, projectId?: ProjectId): Promise<JsonObject>;
  generateAudioOverview(topic: string, projectId?: ProjectId): Promise<JsonObject>;
  addQuickNote(text: string, projectId?: ProjectId): Promise<JsonObject>;
  promoteQuickNote(noteId: string, folder: string, projectId?: ProjectId): Promise<JsonObject>;
  generateThesisChapter(input: JsonObject, projectId?: ProjectId): Promise<JsonObject>;
}

export interface ChatServices {
  processChatCommand(req: ChatRequest, projectId?: ProjectId): Promise<string>;
  processChatCommandStream(req: ChatRequest, onChunk: (chunk: string) => void, projectId?: ProjectId): Promise<string>;
}

export interface ExecutionServices {
  registry: Record<string, ScriptDef>;
  useCases: JsonObject;
  resolveRoot: (projectId: ProjectId) => Promise<string>;
  rootDir: string;
  pythonTool: PythonTool;
  buildCliArgs: (scriptDef: ScriptDef, args: JsonObject) => string[];
  withoutApprovalFlags: (args?: JsonObject) => JsonObject | undefined;
}

export interface SchedulerServices {
  getScheduler(): Scheduler | undefined;
  getSchedulerConfig(): JsonObject | null;
  getScheduleErrors(): string[];
  getEventBus(): EventTriggerBus | undefined;
  getApprovalStore(): ApprovalStore | undefined;
  readDecisionLog(options?: { jobId?: string; limit?: number }): Promise<JsonObject[]>;
  decideApproval(
    approvalId: string,
    decision: 'approved' | 'rejected',
    reviewer?: string,
    reason?: string,
  ): Promise<{ approval?: JsonObject; error?: string }>;
  addScheduleClient(res: import('node:http').ServerResponse): () => void;
  snapshotStatus(): JsonObject | null;
  /** S3: persist + hot-reload a script job; throws ScriptScheduleError on failure. */
  createScriptJob(input: ScriptScheduleCreateInput): Promise<{ job: JsonObject; warnings: string[] }>;
  deleteScriptJob(jobId: string): Promise<{ removed: boolean }>;
}

/** Everything the extracted modules need; still additive to AgentServer's API. */
export interface DomainServices
  extends VaultServices, ReviewStudioServices, ResearchServices, StudyServices,
    ChatServices, ExecutionServices, SchedulerServices {
  projects: ProjectService;
  changesets: (projectId: ProjectId) => ChangesetStore | Promise<ChangesetStore>;
  bus: MessageBus;
}
