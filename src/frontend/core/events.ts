import type { Language } from './i18n/strings';

/** Typed application events. Components subscribe instead of knowing each other. */
export interface AppEvents {
  'project:changed': { id: string; previousId?: string };
  'vault:changed': { projectId?: string };
  'note:selected': { id: string };
  'note:saved': { id: string };
  'language:changed': { language: Language };
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
