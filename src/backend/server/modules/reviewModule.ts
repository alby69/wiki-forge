/**
 * Legacy review queue module.
 *
 * Owns `.llm-wiki/reviews.json` for the active project. The HTTP adapter only
 * forwards the JSON body and the project id; this module never imports `http`
 * or `AgentServer`, so it can also be invoked by the scheduler or a test.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { error, json, type ApiResult } from '../api/http';
import { atomicWriteFile } from '../safeFs';
import type { DomainModule, MessageBus } from '../bus/messageBus';

export interface ReviewItem {
  id: string;
  title?: string;
  sourceFile?: string;
  recommendedAction?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AddReviewPayload {
  title?: string;
  sourceFile?: string;
  recommendedAction?: string;
  reason?: string;
}

export interface ReviewActionPayload {
  id?: string;
  action?: string;
}

export type ResolveProjectRoot = (projectId: string) => Promise<string>;

export class ReviewModule implements DomainModule {
  readonly name = 'reviews';

  /** Injected by the gateway: project resolution stays in ProjectService. */
  constructor(private readonly resolveRoot: ResolveProjectRoot) {}

  register(bus: MessageBus): void {
    bus.register('reviews.list', (_payload, context) => this.list(context.projectId));
    bus.register<AddReviewPayload>('reviews.add', (payload, context) => this.add(payload, context.projectId));
    bus.register<ReviewActionPayload>('reviews.action', (payload, context) => this.action(payload, context.projectId));
  }

  private async reviewFile(projectId: string): Promise<string> {
    const projectRoot = await this.resolveRoot(projectId);
    return path.resolve(projectRoot, '.llm-wiki', 'reviews.json');
  }

  private async readReviews(file: string): Promise<ReviewItem[]> {
    try {
      const raw = await fs.readFile(file, 'utf-8');
      return JSON.parse(raw) as ReviewItem[];
    } catch {
      // Missing or malformed file: the previous handler treated it as empty.
      return [];
    }
  }

  private async writeReviews(file: string, reviews: ReviewItem[]): Promise<void> {
    await atomicWriteFile(file, JSON.stringify(reviews, null, 2), 'utf-8');
  }

  async list(projectId: string): Promise<ApiResult> {
    try {
      const reviews = await this.readReviews(await this.reviewFile(projectId));
      return json({ success: true, reviews });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  async add(payload: AddReviewPayload, projectId: string): Promise<ApiResult> {
    try {
      const file = await this.reviewFile(projectId);
      const reviews = await this.readReviews(file);
      const newItem: ReviewItem = {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: payload.title,
        sourceFile: payload.sourceFile,
        recommendedAction: payload.recommendedAction || 'Create Page',
        reason: payload.reason || 'Flagged for human review',
        status: 'pending',
        createdAt: new Date().toISOString().slice(0, 10),
      };
      reviews.push(newItem);
      await this.writeReviews(file, reviews);
      return json({ success: true, review: newItem });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  async action(payload: ReviewActionPayload, projectId: string): Promise<ApiResult> {
    try {
      const file = await this.reviewFile(projectId);
      const reviews = await this.readReviews(file);
      const remaining = reviews.filter((review) => review.id !== payload.id);
      await this.writeReviews(file, remaining);
      return json({ success: true });
    } catch (err) {
      return error(String(err), 500);
    }
  }
}

export function createReviewModule(resolveRoot: ResolveProjectRoot): ReviewModule {
  return new ReviewModule(resolveRoot);
}
