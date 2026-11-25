/**
 * Study Studio domain module.
 *
 * Wraps the injected study generators behind bus commands. Each command keeps
 * the legacy 200/400/404 success statuses and the exact fallback body used by
 * the former inline HTTP handlers when a generator throws.
 */

import { json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import type { ProjectId } from './services';
import type { StudyPort } from '../../app/ports';

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

export class StudyModule implements DomainModule {
  readonly name = 'study';

  constructor(private readonly services: StudyPort) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('study.guide', (payload, context) => this.guide(payload, context.projectId));
    bus.register<Payload>('study.quiz', (payload, context) => this.quiz(payload, context.projectId));
    bus.register<Payload>('study.mindmap', (payload, context) => this.mindmap(payload, context.projectId));
    bus.register<Payload>('study.audioOverview', (payload, context) => this.audioOverview(payload, context.projectId));
    bus.register<Payload>('study.note', (payload, context) => this.note(payload, context.projectId));
    bus.register<Payload>('study.promoteNote', (payload, context) => this.promoteNote(payload, context.projectId));
    bus.register<Payload>('study.thesisChapter', (payload, context) => this.thesisChapter(payload, context.projectId));
  }

  private async guide(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.generateStudyGuide(asString(payload.topic) || '', projectId);
      return json(result);
    } catch (err) {
      return json({ success: false, markdown: '', outputPath: '', sources: [], error: String(err) }, 500);
    }
  }

  private async quiz(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.generateQuiz(asString(payload.topic) || '', asNumber(payload.count), projectId);
      return json(result);
    } catch (err) {
      return json({ success: false, markdown: '', outputPath: '', sources: [], count: 0, error: String(err) }, 500);
    }
  }

  private async mindmap(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.generateMindmap(asString(payload.target) || '', projectId);
      return json(result, result.success === true ? 200 : 404);
    } catch (err) {
      return json({
        success: false, markdown: '', outputPath: '', sources: [],
        nodes: [], links: [], headings: 0, wikilinks: 0, error: String(err),
      }, 500);
    }
  }

  private async audioOverview(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.generateAudioOverview(asString(payload.topic) || '', projectId);
      return json(result);
    } catch (err) {
      return json({ success: false, markdown: '', outputPath: '', sources: [], error: String(err) }, 500);
    }
  }

  private async note(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.addQuickNote(asString(payload.text) || '', projectId);
      return json(result, result.success === true ? 200 : 400);
    } catch (err) {
      return json({ success: false, markdown: '', entries: [], error: String(err) }, 500);
    }
  }

  private async promoteNote(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.promoteQuickNote(
        asString(payload.noteId) || '',
        asString(payload.folder) || 'general',
        projectId,
      );
      return json(result, result.success === true ? 200 : 400);
    } catch (err) {
      return json({ success: false, markdown: '', error: String(err) }, 500);
    }
  }

  private async thesisChapter(payload: Payload, projectId: ProjectId): Promise<ApiResult> {
    try {
      const result = await this.services.generateThesisChapter({
        topic: asString(payload.topic) || '',
        title: asString(payload.title) || '',
        minMaturity: asNumber(payload.minMaturity),
      }, projectId);
      return json(result);
    } catch (err) {
      return json({
        success: false, markdown: '', outputPath: '', sources: [],
        title: '', chapters: [], syntheses: [], error: String(err),
      }, 500);
    }
  }
}

export function createStudyModule(services: StudyPort): StudyModule {
  return new StudyModule(services);
}
