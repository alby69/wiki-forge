import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  Changeset,
  ChangesetFinding,
  ChangesetStore,
  StageChangesetInput,
} from './changesetStore';

/**
 * A3 — bridge from the A1 read-only `Finding` model to the A7 changeset store.
 *
 * A Finding is advisory: this module never mutates a note. It only converts the
 * `wikiforge.finding/v1` envelope into a durable, human-reviewable proposal.
 * Nothing is applied unless a human calls the existing `changesets.apply`
 * route; approve/reject/rollback stay in the hands of the reviewer.
 */

export const FINDINGS_SCHEMA = 'wikiforge.finding/v1';

export const FINDING_KINDS = [
  'knowledge_gap',
  'orphan_node',
  'inconsistency',
  'odp_suggestion',
] as const;

export interface Finding {
  findingId: string;
  kind: string;
  confidence: number;
  evidence: string[];
  targetPath: string;
  proposedAction: string;
}

export interface FindingsEnvelope {
  schema: string;
  count: number;
  findings: Finding[];
}

export interface StageFindingsResult {
  created: Changeset[];
  /** Finding ids already represented by a changeset (idempotent staging). */
  skipped: string[];
}

/** Validate the single A1 envelope shape before any stage call. */
export function parseFindingsEnvelope(value: unknown): FindingsEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Findings envelope must be an object');
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.schema !== FINDINGS_SCHEMA) {
    throw new Error(`Unsupported findings schema: ${String(candidate.schema)}`);
  }
  if (!Array.isArray(candidate.findings)) {
    throw new Error('Findings envelope needs a findings array');
  }
  if (typeof candidate.count !== 'number' || candidate.count !== candidate.findings.length) {
    throw new Error('Findings envelope count does not match its findings');
  }
  for (const item of candidate.findings) {
    const finding = item as Record<string, unknown>;
    if (typeof finding.findingId !== 'string' || !finding.findingId.trim()) {
      throw new Error('Every finding needs a non-empty findingId');
    }
    if (typeof finding.kind !== 'string' || !(FINDING_KINDS as readonly string[]).includes(finding.kind)) {
      throw new Error(`Unsupported finding kind: ${String(finding.kind)}`);
    }
    if (typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1) {
      throw new Error(`Finding ${finding.findingId} has an invalid confidence`);
    }
    if (!Array.isArray(finding.evidence) || finding.evidence.length === 0
      || finding.evidence.some((entry) => typeof entry !== 'string' || !entry.trim())) {
      throw new Error(`Finding ${finding.findingId} needs non-empty evidence`);
    }
    if (typeof finding.targetPath !== 'string' || !finding.targetPath.trim()) {
      throw new Error(`Finding ${finding.findingId} needs a targetPath`);
    }
    if (typeof finding.proposedAction !== 'string' || !finding.proposedAction.trim()) {
      throw new Error(`Finding ${finding.findingId} needs a proposedAction`);
    }
  }
  return candidate as unknown as FindingsEnvelope;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'finding';
}

function resolveInside(projectRoot: string, relative: string): { absolute: string; relative: string } {
  const clean = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').includes('..')) throw new Error(`Unsafe finding target '${relative}'`);
  const absolute = path.resolve(projectRoot, clean);
  const inside = path.relative(projectRoot, absolute);
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new Error(`Finding target escapes the project: '${relative}'`);
  }
  return { absolute, relative: inside.replace(/\\/g, '/') };
}

function proposalBody(finding: Finding): string {
  return [
    `- **Finding**: \`${finding.findingId}\``,
    `- **Confidenza**: ${finding.confidence}`,
    `- **Target**: \`${finding.targetPath}\``,
    `- **Azione proposta**: \`${finding.proposedAction}\``,
    '',
    '### Evidenze',
    ...finding.evidence.map((entry) => `- ${entry}`),
    '',
    '> Proposta generata automaticamente. Richiede revisione umana: nessuna applicazione automatica.',
    '',
  ].join('\n');
}

function proposalNote(finding: Finding): string {
  return [
    '---',
    `title: "Proposta A3 — ${finding.kind}"`,
    'type: proposal',
    'tags: [l4, proposta, finding]',
    '---',
    '',
    `# Proposta A3 — ${finding.kind}`,
    '',
    ...proposalBody(finding).split('\n'),
  ].join('\n');
}

/**
 * Convert one Finding into a stage input. If the target is an existing markdown
 * note we append a reviewed proposal section and pin it to the staged bytes;
 * otherwise we stage a new OKF proposal note under `wiki/proposte/`.
 */
export async function findingToStageInput(
  finding: Finding,
  projectRoot: string,
): Promise<StageChangesetInput> {
  const target = resolveInside(projectRoot, finding.targetPath);
  const original = await fs.readFile(target.absolute, 'utf-8').catch(() => '');
  const isMarkdown = target.relative.toLowerCase().endsWith('.md');
  const body = proposalBody(finding);
  const edit = isMarkdown && original
    ? {
      file: target.relative,
      action: 'modify' as const,
      proposed_content: `${original.replace(/\s*$/, '')}\n\n## Proposta A3 — ${finding.kind}\n\n${body}`,
      requireOriginal: true,
    }
    : {
      file: `wiki/proposte/${slug(finding.findingId)}.md`,
      action: 'create' as const,
      proposed_content: proposalNote(finding),
    };

  const context: ChangesetFinding = {
    findingId: finding.findingId,
    kind: finding.kind,
    confidence: finding.confidence,
    evidence: [...finding.evidence],
    targetPath: finding.targetPath,
    proposedAction: finding.proposedAction,
  };

  return {
    description: `[A3] ${finding.kind} — ${finding.targetPath}`,
    author: 'agent:finding',
    rationale: [
      `Finding ${finding.findingId} (${finding.kind}, confidenza ${finding.confidence}).`,
      `Azione proposta: ${finding.proposedAction}.`,
      `Evidenze: ${finding.evidence.join(' | ')}`,
      'Nessuna mutazione automatica: il changeset richiede approvazione umana.',
    ].join(' '),
    sources: [...finding.evidence],
    edits: [edit],
    finding: context,
  };
}

/** Stage every finding once; findings already staged are reported as skipped. */
export async function stageFindingChangesets(
  store: ChangesetStore,
  envelope: FindingsEnvelope,
  projectRoot: string,
  actor?: string,
): Promise<StageFindingsResult> {
  const findings = parseFindingsEnvelope(envelope).findings;
  const existing = await store.list();
  const seen = new Set(
    existing.map((changeset) => changeset.finding?.findingId).filter((id): id is string => Boolean(id)),
  );

  const created: Changeset[] = [];
  const skipped: string[] = [];
  for (const finding of findings) {
    if (seen.has(finding.findingId)) {
      skipped.push(finding.findingId);
      continue;
    }
    const input = await findingToStageInput(finding, projectRoot);
    created.push(await store.stage(actor ? { ...input, actor } : input));
    seen.add(finding.findingId);
  }
  return { created, skipped };
}
