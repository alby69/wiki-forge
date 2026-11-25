export * from '@shared/domain/review';

import type { ReviewDepth } from '@shared/domain/review';

export const REVIEW_DEPTH_LABELS: Record<ReviewDepth, string> = {
  fast: 'Veloce',
  standard: 'Standard',
  deep: 'Approfondita',
};
