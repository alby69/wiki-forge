import type { ManagedUserRole } from '../api/types';

export type CapabilityRole = ManagedUserRole;

export const ROLE_ORDER: CapabilityRole[] = ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin'];

export const ROLE_RANK: Record<CapabilityRole, number> = {
  Reader: 0,
  Contributor: 1,
  KnowledgeEngineer: 2,
  Admin: 3,
};

export const OPERATION_MIN_ROLE: Record<string, CapabilityRole> = {
  'auth.me': 'Reader',
  'auth.login': 'Reader',
  'ui.access': 'Reader',
  'ui.preferences.get': 'Reader',
  'ui.preferences.put': 'Reader',
  'files.download': 'Reader',
  'graph.clusters': 'Reader',
  'graph.cypher': 'Reader',
  'graph.events': 'Reader',
  'graph.insights': 'Reader',
  'graph.status': 'Reader',
  'help.get': 'Reader',
  'help.list': 'Reader',
  'ingest.queue.list': 'Reader',
  'ke.useCases.list': 'Reader',
  'projects.config.get': 'Reader',
  'projects.export': 'Reader',
  'projects.exportMarkdownZip': 'Reader',
  'projects.list': 'Reader',
  'projects.stats': 'Reader',
  'research.backlinks': 'Reader',
  'research.related': 'Reader',
  'research.search': 'Reader',
  'review.diff': 'Reader',
  'review.digest': 'Reader',
  'review.meta': 'Reader',
  'review.snapshots': 'Reader',
  'reviews.list': 'Reader',
  'schedule.approvals': 'Reader',
  'schedule.decisions': 'Reader',
  'schedule.events': 'Reader',
  'schedule.runs': 'Reader',
  'schedule.status': 'Reader',
  'scripts.list': 'Reader',
  'scripts.registry': 'Reader',
  'skills.list': 'Reader',
  'wiki.folders.list': 'Reader',
  'wiki.notes.list': 'Reader',
  'wiki.scratchpad.list': 'Reader',
  'wiki.trash.list': 'Reader',
  'changesets.get': 'Contributor',
  'changesets.list': 'Contributor',
  'changesets.stage': 'Contributor',
  'chat.send': 'Contributor',
  'ingest.queue.add': 'Contributor',
  'ingest.queue.process': 'Contributor',
  'reviews.action': 'Contributor',
  'reviews.add': 'Contributor',
  'study.audioOverview': 'Contributor',
  'study.guide': 'Contributor',
  'study.mindmap': 'Contributor',
  'study.note': 'Contributor',
  'study.promoteNote': 'Contributor',
  'study.quiz': 'Contributor',
  'study.thesisChapter': 'Contributor',
  'wiki.delete': 'Contributor',
  'wiki.file.create': 'Contributor',
  'wiki.folder.create': 'Contributor',
  'wiki.ingest': 'Contributor',
  'wiki.move': 'Contributor',
  'wiki.note.applyEdit': 'Contributor',
  'wiki.note.attach': 'Contributor',
  'wiki.note.save': 'Contributor',
  'wiki.rename': 'Contributor',
  'wiki.scratchpad.delete': 'Contributor',
  'wiki.trash.restore': 'Contributor',
  'wiki.upload': 'Contributor',
  'changesets.apply': 'KnowledgeEngineer',
  'changesets.reject': 'KnowledgeEngineer',
  'graph.reconcile': 'KnowledgeEngineer',
  'graph.sync.neo4j': 'KnowledgeEngineer',
  'ke.useCases.execute': 'KnowledgeEngineer',
  'research.consult': 'KnowledgeEngineer',
  'research.deepResearch': 'KnowledgeEngineer',
  'research.promoteAnswer': 'KnowledgeEngineer',
  'research.trace': 'KnowledgeEngineer',
  'review.critique': 'KnowledgeEngineer',
  'review.restore': 'KnowledgeEngineer',
  'review.verify': 'KnowledgeEngineer',
  'schedule.cancel': 'KnowledgeEngineer',
  'schedule.patch': 'KnowledgeEngineer',
  'schedule.run': 'KnowledgeEngineer',
  'schedule.trigger': 'KnowledgeEngineer',
  'scripts.execute': 'KnowledgeEngineer',
  'scripts.schedule': 'KnowledgeEngineer',
  'scripts.unschedule': 'KnowledgeEngineer',
  'projects.archive': 'Admin',
  'projects.clone': 'Admin',
  'projects.config.put': 'Admin',
  'projects.create': 'Admin',
  'projects.delete': 'Admin',
  'projects.import': 'Admin',
  'projects.rename': 'Admin',
  'projects.restore': 'Admin',
  'schedule.approvalDecision': 'Admin',
  'users.create': 'Admin',
  'users.delete': 'Admin',
  'users.list': 'Admin',
  'users.update': 'Admin',
};

export const ACTION_MIN_ROLE: Record<string, CapabilityRole> = {
  'global:projects': 'Reader',
  'global:research': 'Reader',
  'global:docsWiki': 'Reader',
  'global:study': 'Contributor',
  'global:review': 'Reader',
  'global:tools': 'Reader',
  'global:config': 'Reader',
  'global:wizard': 'Admin',
  'global:keWorkbench': 'KnowledgeEngineer',
  'global:changesets': 'Contributor',
  'global:template': 'Contributor',
  'global:help': 'Reader',
  'global:chat': 'Contributor',
  'global:users': 'Admin',
  'global:customize': 'Reader',
  'global:exportWikiZip': 'Reader',
  'global:toggleMode': 'Contributor',
  'focus:upload': 'Contributor',
  'focus:compile': 'Contributor',
  'focus:ask': 'Contributor',
  'note:info': 'Reader',
  'note:review': 'Reader',
  'note:history': 'Reader',
  'review:verify': 'KnowledgeEngineer',
  'review:critique': 'KnowledgeEngineer',
  'review:digest': 'Reader',
  'review:diff': 'Reader',
  'research:backlinks': 'Reader',
  'research:related': 'Reader',
  'study:guide': 'Contributor',
  'study:quiz': 'Contributor',
  'study:mindmap': 'Contributor',
  'study:audio': 'Contributor',
};

export function minimumRoleForOperation(command: string): CapabilityRole {
  return OPERATION_MIN_ROLE[command] ?? 'Admin';
}

export function minimumRoleForAction(actionId: string): CapabilityRole | undefined {
  return ACTION_MIN_ROLE[actionId];
}

export function roleHasCapability(roles: readonly string[] | undefined, required: CapabilityRole): boolean {
  if (!roles) return false;
  return roles.some(role => (ROLE_RANK[role as CapabilityRole] ?? -1) >= ROLE_RANK[required]);
}

export function canUseOperation(roles: readonly string[] | undefined, command: string): boolean {
  return roleHasCapability(roles, minimumRoleForOperation(command));
}

export function canUseAction(roles: readonly string[] | undefined, actionId: string): boolean {
  const required = minimumRoleForAction(actionId);
  return required === undefined || roleHasCapability(roles, required);
}

/** View modes that can be selected by presentation preferences. */
export const UI_VIEW_MODES = ['editor', 'graph', 'split', 'scratchpad', 'closed'] as const;

/**
 * Single catalogue of presentational panels. `requiredOperation` is checked
 * with the same matrix as bus commands; `essential` panels cannot be hidden.
 */
export interface UiPanelDefinition {
  id: 'files' | 'editor' | 'graph' | 'context' | 'chat' | 'scratchpad';
  labelKey: string;
  icon: string;
  requiredOperation: string;
  essential?: boolean;
}

export const UI_PANELS: readonly UiPanelDefinition[] = [
  { id: 'files', labelKey: 'panelFiles', icon: '📁', requiredOperation: 'wiki.folders.list' },
  { id: 'editor', labelKey: 'panelEditor', icon: '📝', requiredOperation: 'wiki.notes.list', essential: true },
  { id: 'graph', labelKey: 'panelGraph', icon: '🕸️', requiredOperation: 'graph.status' },
  { id: 'context', labelKey: 'panelContext', icon: '📊', requiredOperation: 'wiki.notes.list' },
  { id: 'chat', labelKey: 'panelChat', icon: '💬', requiredOperation: 'chat.send' },
  { id: 'scratchpad', labelKey: 'panelScratchpad', icon: '📒', requiredOperation: 'wiki.scratchpad.list' },
];

export type UiPanelId = (typeof UI_PANELS)[number]['id'];
export const UI_PANEL_IDS: readonly UiPanelId[] = UI_PANELS.map(panel => panel.id);

/** Only global action ids from the shared matrix may be pinned in the header. */
export const PINNABLE_ACTION_IDS: readonly string[] = Object.keys(ACTION_MIN_ROLE)
  .filter((id) => id.startsWith('global:'));

export function isPinnableActionId(value: unknown): value is string {
  return typeof value === 'string' && PINNABLE_ACTION_IDS.includes(value);
}

export function isUiPanelId(value: unknown): value is UiPanelId {
  return typeof value === 'string' && (UI_PANEL_IDS as readonly string[]).includes(value);
}

export function isUiViewMode(value: unknown): boolean {
  return typeof value === 'string' && (UI_VIEW_MODES as readonly string[]).includes(value);
}
