/**
 * C7 — fan-out of graph change frames to browser SSE subscribers.
 *
 * The hub is transport-only: it never reads a graph and never writes a vault
 * note. Commands publish typed frames; the UI consumes them through the typed
 * apiBus and keeps using GraphService for its local graph.
 */

import type * as http from 'node:http';
import type { GraphOrigin } from './graphReconciliation';

export interface GraphChangedFrame {
  type: 'graph:changed';
  event: 'graph:changed';
  projectId?: string;
  origin: GraphOrigin;
  path?: string;
  id?: string;
  revision?: number;
  action?: string;
  at: string;
  graph?: unknown;
}

export class GraphEventHub {
  private readonly clients = new Map<http.ServerResponse, string>();
  private heartbeat?: NodeJS.Timeout;

  public get size(): number {
    return this.clients.size;
  }

  public addClient(res: http.ServerResponse, projectId: string): () => void {
    this.clients.set(res, projectId);
    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => {
        for (const client of this.clients.keys()) {
          try {
            client.write(': keepalive\n\n');
          } catch {
            this.clients.delete(client);
          }
        }
        if (this.clients.size === 0) this.stopHeartbeat();
      }, 15_000);
      this.heartbeat.unref?.();
    }
    return () => {
      this.clients.delete(res);
      if (this.clients.size === 0) this.stopHeartbeat();
    };
  }

  public publish(frame: GraphChangedFrame): number {
    const payload = `data: ${JSON.stringify(frame)}\n\n`;
    let delivered = 0;
    for (const [client, projectId] of this.clients) {
      if (frame.projectId !== undefined && frame.projectId !== projectId) continue;
      try {
        client.write(payload);
        delivered += 1;
      } catch {
        this.clients.delete(client);
      }
    }
    return delivered;
  }

  public close(): void {
    for (const client of this.clients.keys()) {
      try {
        client.end();
      } catch {
        continue;
      }
    }
    this.clients.clear();
    this.stopHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }
}

export function graphChangedFrame(
  origin: GraphOrigin,
  fields: Partial<GraphChangedFrame> = {},
): GraphChangedFrame {
  return {
    type: 'graph:changed',
    event: 'graph:changed',
    origin,
    at: new Date().toISOString(),
    ...fields,
  };
}
