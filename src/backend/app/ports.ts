import type { DomainServices } from '../server/modules/services';

export type ProjectPathPort = Pick<DomainServices, 'resolveRoot'>;
export type FilesPort = ProjectPathPort & Pick<DomainServices, 'downloadFile'>;
export type ProjectsPort = Pick<DomainServices, 'projects' | 'rootDir' | 'invalidateLlmClient'>;
export type ChangesetPort = Pick<DomainServices, 'changesets'>;
export type ExecutionPort = ProjectPathPort & Pick<DomainServices,
  'registry' | 'useCases' | 'rootDir' | 'pythonTool' | 'buildCliArgs' | 'withoutApprovalFlags'>;
export type VaultPort = Pick<DomainServices,
  'readAllWikiNotes' | 'readScratchpadEntries' | 'deleteScratchpadEntry' | 'getAllFolders'
  | 'saveWikiNote' | 'applyWikiEdit' | 'attachToNote' | 'createFolderHandler'
  | 'createFileHandler' | 'renameHandler' | 'moveHandler' | 'deleteHandler'
  | 'uploadHandler' | 'ingestMarkdownHandler' | 'listTrash' | 'restoreTrash'>;
export type ReviewPort = Pick<DomainServices,
  'getReviewMeta' | 'recordHumanVerification' | 'getReviewDigest' | 'critiqueNote'
  | 'listReviewSnapshots' | 'getReviewDiff' | 'restoreReviewSnapshot'>;
export type ResearchPort = Pick<DomainServices,
  'resolveReviewTarget' | 'traceClaim' | 'consultWiki' | 'promoteConsultAnswer' | 'generateDeepResearch'>
  & Pick<DomainServices, 'readAllWikiNotes'>;
export type StudyPort = Pick<DomainServices,
  'generateStudyGuide' | 'generateQuiz' | 'generateMindmap' | 'generateAudioOverview'
  | 'addQuickNote' | 'promoteQuickNote' | 'generateThesisChapter'>;
export type ChatPort = Pick<DomainServices, 'processChatCommand' | 'processChatCommandStream'>;
export type SlashPort = Pick<DomainServices, 'processChatCommand'>;
export type SchedulerPort = Pick<DomainServices,
  'getScheduler' | 'getSchedulerConfig' | 'getScheduleErrors' | 'getEventBus' | 'getApprovalStore'
  | 'readDecisionLog' | 'decideApproval' | 'addScheduleClient' | 'snapshotStatus'
  | 'createScriptJob' | 'deleteScriptJob'>;
export type ProvenancePort = Pick<DomainServices, 'isStrictProvenance' | 'provenanceActor'>;
export type GraphPort = Partial<ProjectPathPort & ChangesetPort>;

export interface KernelPorts {
  projects: ProjectsPort;
  files: FilesPort;
  execution: ExecutionPort;
  vault: VaultPort;
  reviewStudio: ReviewPort;
  research: ResearchPort;
  study: StudyPort;
  chat: ChatPort;
  slash: SlashPort;
  scheduler: SchedulerPort & ProvenancePort;
  changesets: ChangesetPort & ProvenancePort;
  graph: GraphPort;
}

export function portsFromServices(services: DomainServices): KernelPorts {
  return {
    projects: services,
    files: services,
    execution: services,
    vault: services,
    reviewStudio: services,
    research: services,
    study: services,
    chat: services,
    slash: services,
    scheduler: services,
    changesets: services,
    graph: services,
  };
}
