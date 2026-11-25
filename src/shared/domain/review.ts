/**
 * Shared shapes for the Review Studio.
 *
 * The backend returns these structures from `/api/notes/review/*`; keeping the
 * types in one module keeps the modal and `ApiStorage` in sync.
 */

export type ReviewTab = 'verify' | 'critique' | 'digest' | 'diff' | 'proposte';

export type ReviewDepth = 'fast' | 'standard' | 'deep';

export interface ReviewVerificationEvent {
  actor: string;
  at?: string;
}

export interface ReviewQualityItem {
  key: string;
  label: string;
  ok: boolean;
  value: string;
  detail: string;
}

export interface ReviewQualityGate {
  passed: number;
  total: number;
  items: ReviewQualityItem[];
}

export interface ReviewNoteMeta {
  id: string;
  title: string;
  path: string;
  folder: string;
  status: string;
  trustTier: string;
  tags: string[];
  staleAfter?: string;
  createdAt?: string;
  updatedAt?: string;
  lineCount: number;
  bytes: number;
  outboundLinks: string[];
  brokenLinks: string[];
  sources: number;
  verified: ReviewVerificationEvent[];
}

export interface ReviewMetaResponse {
  success: boolean;
  error?: string;
  note?: ReviewNoteMeta;
  quality?: ReviewQualityGate;
  history?: ReviewVerificationEvent[];
  suggestedReviewer?: string;
  snapshotCount?: number;
}

export interface ReviewVerifyResponse {
  success: boolean;
  error?: string;
  note?: {
    id: string;
    title: string;
    path: string;
    status?: string;
    trustTier?: string;
  };
  actor?: string;
  timestamp?: string;
  changed?: boolean;
  alreadyVerified?: boolean;
  changedStable?: boolean;
  logUpdated?: boolean;
  meta?: ReviewMetaResponse | null;
}

export interface ReviewDigestItem {
  noteId?: string;
  title: string;
  path?: string;
  kind: string;
  detail: string;
}

export interface ReviewDigestDay {
  date: string;
  items: ReviewDigestItem[];
}

export interface ReviewDigest {
  success: boolean;
  error?: string;
  rangeDays: number;
  scope: string;
  generatedAt: string;
  stats: {
    notesChanged: number;
    verified: number;
    stale: number;
    brokenLinks: number;
    notes: number;
  };
  days: ReviewDigestDay[];
  health: { score: number; label: string; summary: string };
  nextActions: Array<{ title: string; kind: string; noteId?: string }>;
  markdown: string;
}

export interface ReviewCritiqueResponse {
  success: boolean;
  markdown: string;
  fallback: boolean;
  error?: string;
  note?: { id: string; title: string; path: string };
}

export interface ReviewSnapshot {
  id: string;
  at: string;
  reason: string;
  bytes: number;
  content?: string;
}

export interface ReviewDiffRow {
  type: 'ctx' | 'add' | 'del' | string;
  leftNo: number | null;
  rightNo: number | null;
  left: string;
  right: string;
}

export interface ReviewDiffResponse {
  success: boolean;
  error?: string;
  note?: { id: string; title: string; path: string };
  snapshot?: { id: string; at: string; reason: string };
  rows?: ReviewDiffRow[];
  stats?: { added: number; removed: number; context: number };
}

/** A3 — a Finding staged as a human-reviewable changeset. */
export interface ReviewProposalFinding {
  findingId: string;
  kind: string;
  confidence: number;
  evidence: string[];
  targetPath: string;
  proposedAction: string;
}

export interface ReviewProposalEdit {
  file: string;
  action: string;
  snapshotId?: string;
}

export interface ReviewProposal {
  id: string;
  description: string;
  status: string;
  rationale?: string;
  sources?: string[];
  finding?: ReviewProposalFinding;
  edits: ReviewProposalEdit[];
}

export interface ReviewOpenOptions {
  noteId: string;
  tab?: ReviewTab;
}
