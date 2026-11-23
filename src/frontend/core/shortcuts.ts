import { getActions, runAction, type ActionContext } from './actions';
import { canRenderAction } from './auth';

export interface ShortcutDefinition {
  id: string;
  combo: string;
  handler: (event: KeyboardEvent) => void;
}

/** Several components may listen for the same combo (e.g. Escape), so each
 * combo holds a list of handlers; there is still only ONE document listener. */
const shortcuts = new Map<string, ShortcutDefinition[]>();
let installed = false;
let contextProvider: () => ActionContext = () => ({});

/** Normalise a keyboard event to the same notation used in action metadata. */
export function comboFromEvent(event: KeyboardEvent): string | null {
  const key = event.key;
  if (['Control', 'Alt', 'Shift', 'Meta', 'Process'].includes(key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
    el.isContentEditable === true
  );
}

/** Register a shortcut handler. Multiple handlers per combo are allowed. */
export function registerShortcut(id: string, combo: string, handler: (event: KeyboardEvent) => void): boolean {
  const list = shortcuts.get(combo) ?? [];
  if (list.some(definition => definition.id === id)) return false;
  list.push({ id, combo, handler });
  shortcuts.set(combo, list);
  if (list.length > 1 && typeof console !== 'undefined') {
    console.warn(`[shortcuts] combo shared by ${list.length} handlers: ${combo}`);
  }
  return true;
}

export function unregisterShortcut(id: string): void {
  for (const [combo, list] of shortcuts) {
    const remaining = list.filter(definition => definition.id !== id);
    if (remaining.length === 0) shortcuts.delete(combo);
    else shortcuts.set(combo, remaining);
  }
}

export function clearShortcuts(): void {
  shortcuts.clear();
}

export function setShortcutContext(provider: () => ActionContext): void {
  contextProvider = provider;
}

/** Register every action that declares a keyboard shortcut. */
export function registerActionShortcuts(): void {
  for (const action of getActions({ withShortcut: true }).filter(candidate => canRenderAction(candidate.id))) {
    registerShortcut(`action:${action.id}`, action.shortcut!, () => runAction(action.id, contextProvider()));
  }
}

/** Install the single global keydown listener. Returns a cleanup function. */
export function installShortcuts(): () => void {
  if (installed || typeof document === 'undefined') return () => {};
  installed = true;
  const onKeyDown = (event: KeyboardEvent): void => {
    const combo = comboFromEvent(event);
    if (!combo) return;
    if (isEditableTarget(event.target) && !['Escape', 'F1'].includes(combo)) return;
    const handlers = shortcuts.get(combo);
    if (!handlers) return;
    event.preventDefault();
    for (const handler of [...handlers]) handler.handler(event);
  };
  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    installed = false;
  };
}

export function refreshActionShortcuts(): void {
  for (const definition of listShortcuts()) {
    if (definition.id.startsWith('action:')) unregisterShortcut(definition.id);
  }
  registerActionShortcuts();
}

export function listShortcuts(): ShortcutDefinition[] {
  return [...shortcuts.values()].flat();
}
