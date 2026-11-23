import type { Language } from './i18n/strings';

/** Typed application events. Components subscribe instead of knowing each other. */
export interface AppEvents {
  'project:changed': { id: string; previousId?: string };
  'vault:changed': { projectId?: string };
  /** C7 — a graph change observed by the server (DB sync, reconcile, apply). */
  'graph:changed': {
    origin: string;
    projectId?: string;
    id?: string;
    path?: string;
    revision?: number;
    action?: string;
    graph?: unknown;
  };
  'note:selected': { id: string };
  'note:saved': { id: string };
  'language:changed': { language: Language };
  /** API bus observability: components subscribe instead of calling each other. */
  'api:request': { id: string; projectId?: string };
  'api:result': { id: string; projectId?: string };
  'api:error': { id: string; error: string };
  'api:stream': { id: string; event: string };
  'reviews:changed': { projectId?: string };
  'changesets:changed': { projectId?: string };
  'schedule:changed': { projectId?: string };
  'scripts:executed': { scriptId: string; projectId?: string };
}

type EventName = keyof AppEvents;
type Listener<K extends EventName> = (payload: AppEvents[K]) => void;

class EventBus {
  private listeners: { [K in EventName]?: Set<Listener<K>> } = {};

  public on<K extends EventName>(name: K, listener: Listener<K>): () => void {
    const set = (this.listeners[name] ??= new Set<Listener<K>>() as never) as Set<Listener<K>>;
    set.add(listener);
    return () => set.delete(listener);
  }

  public emit<K extends EventName>(name: K, payload: AppEvents[K]): void {
    const set = this.listeners[name] as Set<Listener<K>> | undefined;
    if (!set) return;
    for (const listener of [...set]) listener(payload);
  }
}

export const eventBus = new EventBus();
