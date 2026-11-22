/**
 * C5 — bridge from the Python reconciler's JSON proposals to ChangesetStore.
 *
 * This module never edits a vault note. It only validates the reconciler
 * envelope, stages reviewable changesets with server-trusted B5 provenance and
 * (optionally) advances a small checkpoint file. Every vault write still goes
 * through the existing human `changesets.apply` route, with snapshot/rollback.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { canonicalActor, isCanonicalActor } from './auth/actor';
import type { Changeset, ChangesetStore, StageChangesetInput } from './changesetStore';
import { atomicWriteFile } from './safeFs';

export const NEO4J_RECONCILE_SCHEMA = 'wikiforge.neo4j-reconcile/v1';
export const NEO4J_RECONCILER_ACTOR = 'process:neo4j-reconciler';

export interface Neo4jProposal {
  id: string;
  findingId: string;
  path: string;
  title: string;
  action: 'create' | 'modify';
  revision: number;
  origin: string;
  baseHash: string;
  contentHash: string;
  localHash?: string;
  content: string;
  requiresConfirmation?: boolean;
}

export interface Neo4jConflict {
  id: string;
  path: string;
  revision: number;
  findingId: string;
  localHash: string;
  baseHash: string;
  dbHash: string;
  reason: string;
}

export interface Neo4jReconcileResult {
  schema: string;
  success: boolean;
  projectId: string;
  checkpoint: number;
  nextCheckpoint?: number;
  requiresConfirmation?: boolean;
  mode?: string;
  wikiDir?: string;
  proposals: Neo4jProposal[];
  conflicts: Neo4jConflict[];
  count?: number;
  error?: string;
  errorType?: string;
}

export interface StageNeo4jResult {
  created: Changeset[];
  skipped: string[];
  conflicts: Neo4jConflict[];
  checkpoint: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Neo4j reconcile envelope needs a non-empty ${field}`);
  }
  return value.trim();
}

function finiteNumber(value: unknown, field: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Neo4j reconcile envelope needs a numeric ${field}`);
  }
  return value;
}

function safeRelative(value: string): string {
  const clean = value.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').includes('..')) {
    throw new Error(`Unsafe Neo4j reconcile path '${value}'`);
  }
  return clean;
}

/** Validate the single JSON envelope emitted by `neo4j_reconciler.reconcile()`. */
export function parseReconcileResult(value: unknown): Neo4jReconcileResult {
  const payload = record(value);
  if (payload.schema !== NEO4J_RECONCILE_SCHEMA) {
    throw new Error(`Unsupported Neo4j reconcile schema: ${String(payload.schema)}`);
  }
  if (payload.success === false) {
    return {
      schema: NEO4J_RECONCILE_SCHEMA,
      success: false,
      projectId: typeof payload.projectId === 'string' ? payload.projectId : 'default',
      checkpoint: finiteNumber(payload.checkpoint, 'checkpoint', 0),
      proposals: [],
      conflicts: [],
      error: typeof payload.error === 'string' ? payload.error : 'Neo4j reconcile failed',
      errorType: typeof payload.errorType === 'string' ? payload.errorType : undefined,
    };
  }
  if (!Array.isArray(payload.proposals) || !Array.isArray(payload.conflicts)) {
    throw new Error('Neo4j reconcile envelope needs proposals and conflicts arrays');
  }

  const proposals: Neo4jProposal[] = payload.proposals.map((entry) => {
    const item = record(entry);
    const action = item.action === 'create' ? 'create' : item.action === 'modify' ? 'modify' : null;
    if (!action) throw new Error(`Unsupported proposal action: ${String(item.action)}`);
    return {
      id: text(item.id, 'proposal id'),
      findingId: text(item.findingId, 'proposal findingId'),
      path: safeRelative(text(item.path, 'proposal path')),
      title: typeof item.title === 'string' ? item.title : text(item.id, 'proposal title'),
      action,
      revision: finiteNumber(item.revision, 'proposal revision'),
      origin: typeof item.origin === 'string' ? item.origin : 'neo4j',
      baseHash: typeof item.baseHash === 'string' ? item.baseHash : '',
      contentHash: typeof item.contentHash === 'string' ? item.contentHash : '',
      localHash: typeof item.localHash === 'string' ? item.localHash : undefined,
      content: typeof item.content === 'string' ? item.content : '',
      requiresConfirmation: item.requiresConfirmation === true,
    };
  });

  const conflicts: Neo4jConflict[] = payload.conflicts.map((entry) => {
    const item = record(entry);
    return {
      id: text(item.id, 'conflict id'),
      path: safeRelative(text(item.path, 'conflict path')),
      revision: finiteNumber(item.revision, 'conflict revision'),
      findingId: typeof item.findingId === 'string' ? item.findingId : '',
      localHash: typeof item.localHash === 'string' ? item.localHash : '',
      baseHash: typeof item.baseHash === 'string' ? item.baseHash : '',
      dbHash: typeof item.dbHash === 'string' ? item.dbHash : '',
      reason: typeof item.reason === 'string' ? item.reason : 'conflict',
    };
  });

  return {
    schema: NEO4J_RECONCILE_SCHEMA,
    success: true,
    projectId: typeof payload.projectId === 'string' ? payload.projectId : 'default',
    checkpoint: finiteNumber(payload.checkpoint, 'checkpoint', 0),
    nextCheckpoint: finiteNumber(payload.nextCheckpoint, 'nextCheckpoint', 0),
    requiresConfirmation: payload.requiresConfirmation === true,
    mode: typeof payload.mode === 'string' ? payload.mode : undefined,
    wikiDir: typeof payload.wikiDir === 'string' ? payload.wikiDir : undefined,
    proposals,
    conflicts,
    count: proposals.length,
  };
}

function stageInput(proposal: Neo4jProposal): StageChangesetInput {
  const actor = canonicalActor(NEO4J_RECONCILER_ACTOR, NEO4J_RECONCILER_ACTOR);
  if (!isCanonicalActor(actor)) throw new Error('Invalid reconciler provenance actor');
  const evidence = [
    `neo4j:${proposal.id}@r${proposal.revision}`,
    `origin=${proposal.origin}`,
    `baseHash=${proposal.baseHash || '-'}`,
    `dbHash=${proposal.contentHash || '-'}`,
    proposal.requiresConfirmation
      ? 'confirm_destructive=true: richiede approvazione umana'
      : 'conflitti assenti, approvazione umana comunque obbligatoria',
  ];
  return {
    description: `[C5] Neo4j → vault — ${proposal.path} (r${proposal.revision})`,
    author: actor,
    actor,
    rationale: [
      `Revisione DB ${proposal.revision} per ${proposal.path}.`,
      `Hash base ${proposal.baseHash || '-'} → hash DB ${proposal.contentHash || '-'}.`,
      'Nessuna scrittura automatica: il changeset richiede approvazione umana.',
    ].join(' '),
    sources: evidence.slice(0, 4),
    edits: [{
      file: proposal.path,
      action: proposal.action,
      proposed_content: proposal.content,
      requireOriginal: true,
    }],
    finding: {
      findingId: proposal.findingId,
      kind: 'inconsistency',
      confidence: 1,
      evidence,
      targetPath: proposal.path,
      proposedAction: 'apply-neo4j-revision',
    },
  };
}

/**
 * Stage every non-conflicting proposal once. A conflict produces no changeset
 * and no vault write; the caller receives it for reporting.
 */
export async function stageNeo4jChangesets(
  store: ChangesetStore,
  envelope: Neo4jReconcileResult,
): Promise<StageNeo4jResult> {
  const parsed = parseReconcileResult(envelope);
  if (!parsed.success) {
    throw new Error(parsed.error ?? 'Neo4j reconcile failed');
  }
  const existing = await store.list();
  const seen = new Set(
    existing.map((changeset) => changeset.finding?.findingId).filter((id): id is string => Boolean(id)),
  );

  const created: Changeset[] = [];
  const skipped: string[] = [];
  for (const proposal of parsed.proposals) {
    if (seen.has(proposal.findingId)) {
      skipped.push(proposal.findingId);
      continue;
    }
    created.push(await store.stage(stageInput(proposal)));
    seen.add(proposal.findingId);
  }
  return {
    created,
    skipped,
    conflicts: parsed.conflicts,
    checkpoint: parsed.checkpoint,
  };
}

function checkpointFile(projectRoot: string): string {
  return path.join(projectRoot, '.wiki-forge', 'neo4j-reconciler.json');
}

/** Read the last observed Neo4j revision; a missing/invalid file means 0. */
export async function readCheckpoint(projectRoot: string): Promise<number> {
  try {
    const parsed = JSON.parse(await fs.readFile(checkpointFile(projectRoot), 'utf-8')) as {
      checkpoint?: unknown;
    };
    return typeof parsed.checkpoint === 'number' && Number.isFinite(parsed.checkpoint)
      ? parsed.checkpoint
      : 0;
  } catch {
    return 0;
  }
}

/** Persist a checkpoint. This is reconciler metadata, never a vault note. */
export async function writeCheckpoint(projectRoot: string, checkpoint: number): Promise<void> {
  if (!Number.isFinite(checkpoint)) throw new Error('Checkpoint must be a finite number');
  await atomicWriteFile(
    checkpointFile(projectRoot),
    JSON.stringify({ checkpoint: Math.max(0, Math.floor(checkpoint)), updatedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

/**
 * Convenience orchestration: stage proposals, then advance the checkpoint only
 * when no conflict was reported. Conflicts stay visible for the next run.
 */
export async function reconcileAndStage(
  store: ChangesetStore,
  projectRoot: string,
  envelope: Neo4jReconcileResult,
): Promise<StageNeo4jResult> {
  const parsed = parseReconcileResult(envelope);
  const result = await stageNeo4jChangesets(store, parsed);
  if (parsed.conflicts.length === 0 && parsed.nextCheckpoint !== undefined) {
    await writeCheckpoint(projectRoot, Math.max(parsed.checkpoint, parsed.nextCheckpoint));
  }
  return result;
}
