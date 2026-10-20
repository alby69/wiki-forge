/** Tracks what the user is currently doing so the Help panel (F1 / "?" button)
 *  can preselect the most relevant topic. Components register their context
 *  when they open or start an action and clear it when they close or finish.
 *
 *  A simple stack is used so that nested overlays (e.g. Tools opened from the
 *  Workbench) keep working: the most recent context always wins. */

export type HelpContextId =
  | 'upload'
  | 'import-md'
  | 'compile'
  | 'ke-workbench'
  | 'config'
  | 'tools'
  | 'wizard'
  | 'versioni';

let stack: HelpContextId[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(listener => listener());
}

export function setHelpContext(ctx: HelpContextId): void {
  if (stack[stack.length - 1] === ctx) return;
  stack.push(ctx);
  notify();
}

export function clearHelpContext(ctx?: HelpContextId): void {
  if (!ctx) {
    stack = [];
  } else {
    stack = stack.filter(entry => entry !== ctx);
  }
  notify();
}

export function getHelpContext(): HelpContextId | null {
  return stack.length ? stack[stack.length - 1] : null;
}

export function onHelpContextChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
