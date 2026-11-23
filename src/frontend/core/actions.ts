import { t, type TranslationKey } from './i18n/strings';

export type ActionGroup = 'global' | 'note' | 'studio';

export interface ActionContext {
  noteId?: string;
  tab?: string;
  query?: string;
}

export interface ActionDefinition {
  id: string;
  labelKey: TranslationKey;
  icon: string;
  titleKey?: TranslationKey;
  group: ActionGroup;
  /** Rendered in the "more actions" menu / command palette. */
  menu?: boolean;
  /** Requires a selected note to be meaningful. */
  needsNote?: boolean;
  shortcut?: string;
}

export type ActionHandler = (context: ActionContext) => void;

/* One catalogue. Header, note header, context menu and command palette all
 * render from here: renaming a label or icon is a single-line change. */
const BUILT_IN_ACTIONS: ActionDefinition[] = [
  { id: 'global:projects', labelKey: 'projects', icon: '📁', group: 'global', menu: true },
  { id: 'global:research', labelKey: 'research', icon: '🔎', titleKey: 'researchStudio', group: 'global', menu: true },
  { id: 'global:docsWiki', labelKey: 'docsWiki', icon: '📚', titleKey: 'docsWiki', group: 'global', menu: true, shortcut: 'Ctrl+Alt+W' },
  { id: 'global:study', labelKey: 'study', icon: '📚', titleKey: 'studyStudio', group: 'global', menu: true },
  { id: 'global:review', labelKey: 'review', icon: '🧐', titleKey: 'reviewStudio', group: 'global', menu: true },
  { id: 'global:tools', labelKey: 'tools', icon: '🛠️', group: 'global', menu: true },
  { id: 'global:config', labelKey: 'config', icon: '⚙️', group: 'global', menu: true },
  { id: 'global:wizard', labelKey: 'wizard', icon: '🪄', group: 'global', menu: true },
  { id: 'global:keWorkbench', labelKey: 'keWorkbench', icon: '🧠', group: 'global', menu: true },
  { id: 'global:changesets', labelKey: 'changesets', icon: '📋', group: 'global', menu: true },
  { id: 'global:template', labelKey: 'template', icon: '📐', titleKey: 'templateManager', group: 'global', menu: true },
  { id: 'global:help', labelKey: 'help', icon: '❓', group: 'global', menu: true, shortcut: 'F1' },
  { id: 'global:chat', labelKey: 'chat', icon: '💬', group: 'global', menu: true },
  { id: 'global:users', labelKey: 'users', icon: '👥', titleKey: 'userManager', group: 'global', menu: true },
  { id: 'global:exportWikiZip', labelKey: 'exportWikiZip', icon: '📦', group: 'global', menu: true },
  { id: 'global:toggleMode', labelKey: 'actions', icon: '🔄', group: 'global', menu: false, shortcut: 'Ctrl+Shift+D' },
  { id: 'focus:upload', labelKey: 'upload', icon: '📥', group: 'global', menu: false },
  { id: 'focus:compile', labelKey: 'compile', icon: '⚡', group: 'global', menu: false },
  { id: 'focus:ask', labelKey: 'ask', icon: '💬', group: 'global', menu: false },

  { id: 'note:info', labelKey: 'nodeInfo', icon: '📊', group: 'note' },
  { id: 'note:review', labelKey: 'review', icon: '🧐', group: 'note' },
  { id: 'note:history', labelKey: 'history', icon: '🕐', group: 'note' },

  { id: 'review:verify', labelKey: 'verifyHuman', icon: '✓', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+R' },
  { id: 'review:critique', labelKey: 'criticalReview', icon: '⚡', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+C' },
  { id: 'review:digest', labelKey: 'activityDigest', icon: '◷', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+D' },
  { id: 'review:diff', labelKey: 'compareVersions', icon: '⇄', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+F' },
  { id: 'research:backlinks', labelKey: 'noteBacklinks', icon: '↩', group: 'studio', menu: true, needsNote: true },
  { id: 'research:related', labelKey: 'suggestedRelated', icon: '🧩', group: 'studio', menu: true, needsNote: true },
  { id: 'study:guide', labelKey: 'studyGuide', icon: '📝', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+G' },
  { id: 'study:quiz', labelKey: 'selfQuiz', icon: '🧪', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+K' },
  { id: 'study:mindmap', labelKey: 'mindmap', icon: '🧠', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+M' },
  { id: 'study:audio', labelKey: 'audioScript', icon: '🎙️', group: 'studio', menu: true, needsNote: true, shortcut: 'Ctrl+Alt+A' },
];

let definitions: ActionDefinition[] = [...BUILT_IN_ACTIONS];
const handlers = new Map<string, ActionHandler>();

export function setActionDefinitions(next: ActionDefinition[]): void {
  definitions = [...next];
}

export function getActions(filter: {
  group?: ActionGroup;
  menu?: boolean;
  withShortcut?: boolean;
} = {}): ActionDefinition[] {
  return definitions.filter(action =>
    (filter.group === undefined || action.group === filter.group) &&
    (filter.menu === undefined || action.menu === filter.menu) &&
    (filter.withShortcut === undefined || Boolean(action.shortcut) === filter.withShortcut)
  );
}

export function getAction(id: string): ActionDefinition | undefined {
  return definitions.find(action => action.id === id);
}

export function bindActionHandler(id: string, handler: ActionHandler): void {
  handlers.set(id, handler);
}

/** Execute an action. Tab-specific ids pass their suffix as `context.tab`. */
export function runAction(id: string, context: ActionContext = {}): void {
  const handler = handlers.get(id);
  if (!handler) return;
  const separator = id.indexOf(':');
  const tab = id.includes(':') && ['review', 'research', 'study'].includes(id.slice(0, separator))
    ? id.slice(separator + 1)
    : undefined;
  handler({ ...context, tab: context.tab ?? tab });
}

export function actionLabel(action: ActionDefinition): string {
  return t(action.labelKey);
}

export function actionTitle(action: ActionDefinition): string {
  return action.titleKey ? t(action.titleKey) : actionLabel(action);
}
