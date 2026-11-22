/**
 * Research Studio domain module.
 *
 * Search, backlinks and related notes reuse the deterministic helpers directly;
 * LLM-backed commands delegate to the injected services. Validation messages,
 * limit clamping, 400/404 branches and error fallbacks are copied from the
 * legacy inline HTTP handlers.
 */

import { error, json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import { findBacklinks, searchNotes, suggestRelated } from '../researchHelpers';
import type { DomainServices, ProjectId } from './services';

type Payload = Record<string, unknown>;

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

export class ResearchModule implements DomainModule {
  readonly name = 'research';

  constructor(private readonly services: DomainServices) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('research.search', (payload, context) => this.search(payload, context.projectId));
    bus.register<Payload>('research.backlinks', (payload, context) => this.backlinks(payload, context.projectId));
    bus.register<Payload>('research.related', (payload, context) => this.related(payload, context.projectId));
    bus.register<Payload>('research.trace', (payload, context) => this.trace(payload, context.projectId));
    bus.register<Payload>('research.consult', (payload, context) => this.consult(payload, context.projectId));
    bus.register<Payload>('research.promoteAnswer', (payload, context) => this.promoteAnswer(payload, context.projectId));
    bus.register<Payload>('research.deepResearch', (payload, context) => this.deepResearch(payload, context.projectId));
  }

  private async search(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const query = asString(payload.q) || '';
    if (!query.trim()) return error('Parametro "q" mancante', 400);
    try {
      const parsedLimit = asNumber(payload.limit);
      const limit = parsedLimit === undefined ? 30 : Math.max(1, Math.min(100, parsedLimit));
      const notes = await this.services.readAllWikiNotes(projectId);
      const result = searchNotes(notes, query, limit);
      return json({ success: true, ...result });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async backlinks(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const noteRef = asString(payload.note) || '';
    if (!noteRef) return error('Parametro "note" mancante', 400);
    try {
      const notes = await this.services.readAllWikiNotes(projectId);
      const target = this.services.resolveReviewTarget(noteRef, notes);
      if (!target) return error(`Nota non trovata: ${noteRef}`, 404);
      const result = findBacklinks(notes, target, (ref, list) => this.services.resolveReviewTarget(ref, list));
      return json({ success: true, ...result });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async related(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const noteRef = asString(payload.note) || '';
    if (!noteRef) return error('Parametro "note" mancante', 400);
    try {
      const parsedLimit = asNumber(payload.limit);
      const limit = parsedLimit === undefined ? 12 : Math.max(1, Math.min(50, parsedLimit));
      const notes = await this.services.readAllWikiNotes(projectId);
      const target = this.services.resolveReviewTarget(noteRef, notes);
      if (!target) return error(`Nota non trovata: ${noteRef}`, 404);
      const result = suggestRelated(notes, target, (ref, list) => this.services.resolveReviewTarget(ref, list), limit);
      return json({ success: true, ...result });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async trace(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const query = asString(payload.q) || '';
    if (!query.trim()) return error('Parametro "q" mancante', 400);
    try {
      const trace = await this.services.traceClaim(query, projectId);
      return json({ success: true, ...trace });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async consult(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const question = asString(payload.question) || '';
    if (!question.trim()) return error('Campo "question" mancante', 400);
    try {
      const answer = await this.services.consultWiki(question, projectId);
      return json(answer);
    } catch (err) {
      return json({ success: false, fallback: true, markdown: '', citations: [], error: String(err) }, 500);
    }
  }

  private async promoteAnswer(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    // The API contract uses `markdown`; direct builder callers use `answer`.
    const question = asString(payload.question)?.trim();
    const answer = (asString(payload.answer) ?? asString(payload.markdown))?.trim();
    if (!question || !answer) {
      return json({ success: false, validation: [], error: 'Campi "question" e "markdown" obbligatori' }, 400);
    }
    try {
      const result = await this.services.promoteConsultAnswer({
        question,
        answer,
        citations: Array.isArray(payload.citations) ? payload.citations : [],
        fallback: asBool(payload.fallback) ?? false,
      }, projectId);
      return json(result, result.success === true ? 200 : 400);
    } catch (err) {
      return json({ success: false, validation: [], error: String(err) }, 500);
    }
  }

  private async deepResearch(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    const question = asString(payload.question) || '';
    if (!question.trim()) return error('Campo "question" mancante', 400);
    try {
      const report = await this.services.generateDeepResearch(question, projectId);
      return json(report, report.success === true ? 200 : 400);
    } catch (err) {
      return json({ success: false, articles: 0, fallback: true, markdown: '', error: String(err) }, 500);
    }
  }
}

export function createResearchModule(services: DomainServices): ResearchModule {
  return new ResearchModule(services);
}
