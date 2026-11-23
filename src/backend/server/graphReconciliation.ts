/**
 * C6 — origin-aware dedupe and echo suppression for graph changes.
 *
 * The checkpoint/findingId dedupe from C5 is kept. This ledger adds a stable
 * event key and a per-note reconciled revision, so a revision applied through
 * a changeset cannot come back as a new vault event. No vault write happens
 * here: non-conflicting revisions are only staged for human review.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ChangesetStore } from './changesetStore';
import {
  parseReconcileResult,
  reconcileAndStage,
  type Neo4jProposal,
  type Neo4jReconcileResult,
  type StageNeo4jResult,
} from './neo4jReverseSync';
import { atomicWriteFile } from './safeFs';

export type GraphOrigin = 'browser' | 'watcher' | 'vault' | 'neo4j' | 'reconciler';

export interface GraphChangeEvent {
  eventId?: string;
  id: string;
  path: string;
  origin: GraphOrigin;
  revision: number;
  action: string;
  localHash?: string;
  dbHash?: string;
  baseHash?: string;
}

export interface ReconciliationLedger {
  version: 1;
  seen: string[];
  revisions: Record<string, number>;
  updatedAt: string;
}

export type GraphEventVerdict = 'new' | 'duplicate' | 'echo';

export interface SkippedGraphEvent {
  event: GraphChangeEvent;
  reason: Exclude<GraphEventVerdict, 'new'>;
}

export interface ReconcileGraphOptions {
  store: ChangesetStore;
  projectRoot: string;
  envelope: Neo4jReconcileResult;
  events?: GraphChangeEvent[];
}

export interface GraphReconciliationResult extends StageNeo4jResult {
  processedEvents: GraphChangeEvent[];
  skippedEvents: SkippedGraphEvent[];
  ledger: ReconciliationLedger;
}

const RECONCILER_ORIGINS = new Set<GraphOrigin>(['neo4j', 'reconciler']);
const MAX_SEEN = 200;

export function eventKey(event: GraphChangeEvent): string {
  return event.eventId?.trim()
    || `${event.id}|${event.revision}|${event.origin}|${event.action}`;
}

export function emptyLedger(): ReconciliationLedger {
  return { version: 1, seen: [], revisions: {}, updatedAt: '' };
}

function ledgerFile(projectRoot: string): string {
  return path.join(projectRoot, '.wiki-forge', 'graph-reconciliation.json');
}

export async function readLedger(projectRoot: string): Promise<ReconciliationLedger> {
  try {
    const parsed = JSON.parse(await fs.readFile(ledgerFile(projectRoot), 'utf-8')) as Partial<ReconciliationLedger>;
    if (parsed.version !== 1 || !Array.isArray(parsed.seen)) return emptyLedger();
    const revisions: Record<string, number> = {};
    if (parsed.revisions && typeof parsed.revisions === 'object') {
      for (const [id, revision] of Object.entries(parsed.revisions)) {
        if (typeof revision === 'number' && Number.isFinite(revision)) revisions[id] = revision;
      }
    }
    return {
      version: 1,
      seen: parsed.seen.filter((key): key is string => typeof key === 'string'),
      revisions,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return emptyLedger();
  }
}

export async function writeLedger(projectRoot: string, ledger: ReconciliationLedger): Promise<void> {
  await atomicWriteFile(
    ledgerFile(projectRoot),
    JSON.stringify({ ...ledger, updatedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

export function classifyGraphEvent(
  event: GraphChangeEvent,
  ledger: ReconciliationLedger,
): GraphEventVerdict {
  if (ledger.seen.includes(eventKey(event))) return 'duplicate';
  if (RECONCILER_ORIGINS.has(event.origin)) {
    const applied = ledger.revisions[event.id];
    if (applied !== undefined && event.revision <= applied) return 'echo';
  }
  return 'new';
}

export function recordGraphEvent(
  ledger: ReconciliationLedger,
  event: GraphChangeEvent,
  reconciledRevision?: number,
): ReconciliationLedger {
  const seen = [...new Set([...ledger.seen, eventKey(event)])].slice(-MAX_SEEN);
  const revisions = { ...ledger.revisions };
  if (reconciledRevision !== undefined) {
    revisions[event.id] = Math.max(revisions[event.id] ?? 0, reconciledRevision);
  }
  return { version: 1, seen, revisions, updatedAt: '' };
}

export function eventsFromProposals(envelope: Neo4jReconcileResult): GraphChangeEvent[] {
  const parsed = parseReconcileResult(envelope);
  if (!parsed.success) return [];
  return parsed.proposals.map((proposal) => ({
    id: proposal.id,
    path: proposal.path,
    origin: proposal.origin as GraphOrigin,
    revision: proposal.revision,
    action: proposal.action.toUpperCase(),
    localHash: proposal.localHash,
    dbHash: proposal.dbHash ?? proposal.contentHash,
    baseHash: proposal.baseHash,
  }));
}

function matchesProposal(event: GraphChangeEvent, proposal: Neo4jProposal): boolean {
  return event.id === proposal.id
    && event.revision === proposal.revision
    && event.path === proposal.path;
}

export async function reconcileGraphChanges(
  options: ReconcileGraphOptions,
): Promise<GraphReconciliationResult> {
  const { store, projectRoot } = options;
  const parsed = parseReconcileResult(options.envelope);
  const incomingEvents = options.events ?? eventsFromProposals(parsed);
  let ledger = await readLedger(projectRoot);
  const processedEvents: GraphChangeEvent[] = [];
  const skippedEvents: SkippedGraphEvent[] = [];

  for (const event of incomingEvents) {
    const verdict = classifyGraphEvent(event, ledger);
    if (verdict === 'new') processedEvents.push(event);
    else skippedEvents.push({ event, reason: verdict });
  }

  if (incomingEvents.length > 0 && processedEvents.length === 0) {
    await writeLedger(projectRoot, ledger);
    return {
      created: [],
      skipped: [],
      conflicts: parsed.conflicts,
      checkpoint: parsed.checkpoint,
      processedEvents,
      skippedEvents,
      ledger,
    };
  }

  const proposals = parsed.proposals.filter((proposal) => incomingEvents.length === 0
    || processedEvents.some((event) => matchesProposal(event, proposal)));
  const stageEnvelope: Neo4jReconcileResult = {
    ...parsed,
    proposals,
    count: proposals.length,
  };
  const staged = parsed.success
    ? await reconcileAndStage(store, projectRoot, stageEnvelope)
    : { created: [], skipped: [], conflicts: parsed.conflicts, checkpoint: parsed.checkpoint };

  if (staged.conflicts.length === 0) {
    for (const event of processedEvents) ledger = recordGraphEvent(ledger, event);
    for (const proposal of proposals) {
      ledger = recordGraphEvent(ledger, {
        id: proposal.id,
        path: proposal.path,
        origin: proposal.origin as GraphOrigin,
        revision: proposal.revision,
        action: proposal.action.toUpperCase(),
      }, proposal.revision);
    }
  }
  await writeLedger(projectRoot, ledger);
  return { ...staged, processedEvents, skippedEvents, ledger };
}
