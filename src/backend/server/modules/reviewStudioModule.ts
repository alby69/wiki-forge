/**
 * Review Studio domain module.
 *
 * Migrates the inline `/api/notes/review/*` handlers to bus commands. All
 * validation messages, status codes and response shapes (including the verify
 * projection of the note and the optional review meta) stay identical to the
 * legacy HTTP implementation.
 */

import { json, type ApiResult } from '../api/http';
import type { CommandContext, DomainModule, MessageBus } from '../bus/messageBus';
import type { CitationReport } from '@shared/domain/citations';
import type { JsonObject, ProjectId } from './services';
import type { ReviewPort } from '../../app/ports';

type Payload = Record<string, unknown>;

type ReviewScope = 'all' | 'folder' | 'note';
type CritiqueDepth = 'fast' | 'standard' | 'deep';

interface VerificationResult {
  success: boolean;
  error?: string;
  path?: string;
  note?: JsonObject;
  actor?: string;
  timestamp?: string;
  changed?: boolean;
  alreadyVerified?: boolean;
  changedStable?: boolean;
  logUpdated?: boolean;
  citation?: CitationReport;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export class ReviewStudioModule implements DomainModule {
  readonly name = 'review-studio';

  constructor(private readonly services: ReviewPort) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('review.meta', (payload, context) => this.meta(payload, context.projectId));
    bus.register<Payload>('review.verify', (payload, context) => this.verify(payload, context));
    bus.register<Payload>('review.citations', (payload, context) => this.citations(payload, context));
    bus.register<Payload>('review.digest', (payload, context) => this.digest(payload, context.projectId));
    bus.register<Payload>('review.critique', (payload, context) => this.critique(payload, context.projectId));
    bus.register<Payload>('review.snapshots', (payload, context) => this.snapshots(payload, context.projectId));
    bus.register<Payload>('review.diff', (payload, context) => this.diff(payload, context.projectId));
    bus.register<Payload>('review.restore', (payload, context) => this.restore(payload, context.projectId));
  }

  private async meta(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const noteRef = asString(payload.note) || '';
    if (!noteRef) {
      return json({ success: false, error: 'Parametro "note" mancante' }, 400);
    }
    try {
      const result = await this.services.getReviewMeta(noteRef, projectId);
      return json(result, result.success === true ? 200 : 404);
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }

  private async verify(payload: Payload, context: CommandContext): Promise<ApiResult> {
    const noteRef = asString(payload.note);
    if (!noteRef) {
      return json({ success: false, error: 'Campo "note" mancante' }, 400);
    }
    const projectId = context.projectId;
    try {
      const result = (await this.services.recordHumanVerification({
        noteRef,
        comment: asString(payload.comment),
        setStable: asBool(payload.setStable),
        projectId,
      }, context.principal)) as unknown as VerificationResult;
      const meta = result.success
        ? await this.services.getReviewMeta(result.path as string, projectId)
        : null;
      const status = result.success ? 200 : result.error === 'not-found' ? 404 : 400;
      return json({
        success: result.success,
        error: result.error,
        note: result.note
          ? {
              id: result.note.id,
              title: result.note.title,
              path: result.note.path,
              status: result.note.status,
              trustTier: result.note.trustTier,
            }
          : undefined,
        actor: result.actor,
        timestamp: result.timestamp,
        changed: result.changed,
        alreadyVerified: result.alreadyVerified,
        changedStable: result.changedStable,
        logUpdated: result.logUpdated,
        citation: result.citation,
        meta,
      }, status);
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }

  private async citations(payload: Payload, context: CommandContext): Promise<ApiResult> {
    const noteRef = asString(payload.note);
    if (!noteRef) {
      return json({ success: false, error: 'Campo "note" mancante' }, 400);
    }
    try {
      const result = await this.services.checkNoteCitations(
        noteRef,
        context.projectId,
        asBool(payload.semantic),
      );
      const status = result.success === true ? 200 : result.error === 'not-found' ? 404 : 400;
      return json(result, status);
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }

  private async digest(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const days = asNumber(payload.days) ?? 7;
    const scopeParam = asString(payload.scope) || 'all';
    const scope: ReviewScope = scopeParam === 'note' || scopeParam === 'folder' ? scopeParam : 'all';
    const noteRef = asString(payload.note) || undefined;
    try {
      const result = await this.services.getReviewDigest(projectId, days, scope, noteRef);
      return json(result, result.success === true ? 200 : 404);
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }

  private async critique(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const noteRef = asString(payload.note);
    if (!noteRef) {
      return json({ success: false, markdown: '', fallback: false, error: 'Campo "note" mancante' }, 400);
    }
    const focus = Array.isArray(payload.focus)
      ? payload.focus.filter((item): item is string => typeof item === 'string')
      : undefined;
    try {
      const result = await this.services.critiqueNote({
        noteRef,
        projectId,
        depth: asString(payload.depth) as CritiqueDepth | undefined,
        focus,
        instructions: asString(payload.instructions),
      });
      return json(result, result.success === true ? 200 : 404);
    } catch (err) {
      return json({ success: false, markdown: '', fallback: false, error: String(err) }, 500);
    }
  }

  private async snapshots(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const noteRef = asString(payload.note) || '';
    if (!noteRef) {
      return json({ success: false, error: 'Parametro "note" mancante' }, 400);
    }
    try {
      const snapshots = await this.services.listReviewSnapshots(noteRef, projectId);
      return json({ success: true, snapshots });
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }

  private async diff(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const noteRef = asString(payload.note) || '';
    const snapshotId = asString(payload.snapshot) || '';
    if (!noteRef || !snapshotId) {
      return json({ success: false, error: 'Parametri "note" e "snapshot" obbligatori' }, 400);
    }
    try {
      const result = await this.services.getReviewDiff(noteRef, snapshotId, projectId);
      return json(result, result.success === true ? 200 : 404);
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }

  private async restore(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const noteRef = asString(payload.note);
    const snapshotId = asString(payload.snapshot);
    if (!noteRef || !snapshotId) {
      return json({ success: false, error: 'Campi "note" e "snapshot" obbligatori' }, 400);
    }
    try {
      const restored = await this.services.restoreReviewSnapshot(noteRef, snapshotId, projectId);
      if (!restored) {
        return json({ success: false, error: 'Snapshot o nota non trovati' }, 404);
      }
      return json({ success: true, note: restored });
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }
}

export function createReviewStudioModule(services: ReviewPort): ReviewStudioModule {
  return new ReviewStudioModule(services);
}
