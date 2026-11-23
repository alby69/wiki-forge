import type { StreamEvent } from './apiBus';
import { eventBus } from './events';
import type { GraphData, GraphLink, GraphNode } from './types/graph';

export interface GraphChangedPayload {
  type: 'graph:changed';
  event?: string;
  origin: string;
  projectId?: string;
  id?: string;
  path?: string;
  revision?: number;
  action?: string;
  at?: string;
  graph?: unknown;
}

export function parseGraphFrame(data: string): GraphChangedPayload | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const frame = parsed as Record<string, unknown>;
  if (frame.type !== 'graph:changed' || typeof frame.origin !== 'string' || !frame.origin) {
    return undefined;
  }
  return {
    type: 'graph:changed',
    event: typeof frame.event === 'string' ? frame.event : undefined,
    origin: frame.origin,
    projectId: typeof frame.projectId === 'string' ? frame.projectId : undefined,
    id: typeof frame.id === 'string' ? frame.id : undefined,
    path: typeof frame.path === 'string' ? frame.path : undefined,
    revision: typeof frame.revision === 'number' ? frame.revision : undefined,
    action: typeof frame.action === 'string' ? frame.action : undefined,
    at: typeof frame.at === 'string' ? frame.at : undefined,
    graph: frame.graph,
  };
}

export function adaptServerGraphData(value: unknown): GraphData | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(source.nodes) || !Array.isArray(source.links)) return undefined;

  const nodes: GraphNode[] = [];
  for (const entry of source.nodes) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const node = entry as Record<string, unknown>;
    if (typeof node.id !== 'string' || !node.id) continue;
    const valueWeight = typeof node.val === 'number' && Number.isFinite(node.val) ? node.val : 1;
    const tags = Array.isArray(node.tags) ? node.tags.filter((tag): tag is string => typeof tag === 'string') : undefined;
    nodes.push({
      id: node.id,
      label: typeof node.label === 'string' ? node.label : typeof node.title === 'string' ? node.title : node.id,
      group: typeof node.group === 'string' ? node.group : undefined,
      val: Math.max(1, valueWeight),
      color: typeof node.color === 'string' ? node.color : undefined,
      tags,
    });
  }

  const links: GraphLink[] = [];
  const ids = new Set(nodes.map((node) => node.id));
  for (const entry of source.links) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const link = entry as Record<string, unknown>;
    if (typeof link.source !== 'string' || typeof link.target !== 'string') continue;
    if (!ids.has(link.source) || !ids.has(link.target)) continue;
    links.push({
      source: link.source,
      target: link.target,
      type: typeof link.type === 'string' ? link.type : undefined,
    });
  }

  return { nodes, links };
}

export interface GraphEventSubscriptionOptions {
  stream: (onEvent: (event: StreamEvent) => void, signal?: AbortSignal) => Promise<void>;
  onGraphChanged?: (payload: GraphChangedPayload) => void;
  onError?: (error: unknown) => void;
}

export function startGraphEventSubscription(options: GraphEventSubscriptionOptions): () => void {
  const controller = new AbortController();
  void (async () => {
    try {
      await options.stream((event) => {
        if (controller.signal.aborted) return;
        const payload = parseGraphFrame(event.data);
        if (!payload) return;
        eventBus.emit('graph:changed', payload);
        options.onGraphChanged?.(payload);
      }, controller.signal);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      options.onError?.(err);
    }
  })();
  return () => controller.abort();
}
