/**
 * OKF line-anchor citations — shared, dependency-free logic.
 *
 * A stable note can anchor a claim to the exact span of its source:
 *
 *   [^src:source-docs-architettura-md#L12-L18]
 *
 * The anchor references `sources[].id` in the OKF frontmatter; the line range
 * points into `sources[].resource`. This module parses anchors, tracks claim
 * coverage and evaluates the report used by `/verify-citations`, the Review
 * Studio and the stable-verification gate.
 */

export interface CitationAnchor {
  raw: string;
  sourceId: string;
  startLine: number;
  endLine: number;
}

export interface CitationSourceRef {
  id: string;
  resource?: string;
  sha256?: string;
}

export type CitationIssueKind = 'orphan' | 'missing-source' | 'range' | 'hash';

export interface CitationIssue {
  kind: CitationIssueKind;
  sourceId: string;
  anchor?: string;
  detail: string;
}

export interface CitationResolvedSource {
  exists: boolean;
  lineCount?: number;
  sha256?: string;
}

export interface CitationReport {
  anchors: number;
  sources: number;
  claimsTotal: number;
  claimsAnchored: number;
  /** 0..1 — 1 when the note has no claim lines. */
  coverage: number;
  issues: CitationIssue[];
  /** No blocking issue (orphan / missing source / out-of-range lines). */
  ok: boolean;
}

const ANCHOR_PATTERN = /\[\^src:([^\]#]+)#L(\d+)(?:-L(\d+))?\]/g;
const ANCHOR_TEST = /\[\^src:([^\]#]+)#L(\d+)(?:-L(\d+))?\]/;

/** Shortest line treated as a citable claim (characters without whitespace). */
const MIN_CLAIM_CHARS = 12;

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function splitFrontmatter(rawContent: string): { block: string; body: string } {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(rawContent);
  return match
    ? { block: match[1], body: rawContent.slice(match[0].length) }
    : { block: '', body: rawContent };
}

export function parseCitationAnchors(body: string): CitationAnchor[] {
  const anchors: CitationAnchor[] = [];
  const regex = new RegExp(ANCHOR_PATTERN.source, ANCHOR_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const startLine = Number(match[2]);
    const endRaw = match[3];
    anchors.push({
      raw: match[0],
      sourceId: match[1].trim(),
      startLine,
      endLine: endRaw ? Number(endRaw) : startLine,
    });
  }
  return anchors;
}

/** Parse the `sources:` frontmatter section into refs (id/resource/sha256). */
export function parseCitationSources(block: string): CitationSourceRef[] {
  const section = /^sources\s*:\s*$/m.exec(block);
  if (!section) return [];
  const rest = block.slice(section.index + section[0].length);
  const endMatch = /^[A-Za-z_][\w-]*\s*:/m.exec(rest);
  const sourcesBody = endMatch ? rest.slice(0, endMatch.index) : rest;

  const refs: CitationSourceRef[] = [];
  let current: CitationSourceRef | null = null;
  for (const line of sourcesBody.split(/\r?\n/)) {
    const idMatch = /^\s*-\s+id\s*:\s*(.+)$/.exec(line);
    if (idMatch) {
      current = { id: stripQuotes(idMatch[1]) };
      refs.push(current);
      continue;
    }
    if (!current) continue;
    const resourceMatch = /^\s+resource\s*:\s*(.+)$/.exec(line);
    if (resourceMatch) {
      current.resource = stripQuotes(resourceMatch[1]);
      continue;
    }
    const shaMatch = /^\s+sha256\s*:\s*(\S+)\s*$/.exec(line);
    if (shaMatch) current.sha256 = stripQuotes(shaMatch[1]);
  }
  return refs.filter(ref => ref.id !== '');
}

/**
 * Claim coverage: a claim is a non-heading body line with enough prose; it is
 * anchored when it carries at least one `[^src:…]` anchor.
 */
export function claimStats(body: string): { claimsTotal: number; claimsAnchored: number } {
  let claimsTotal = 0;
  let claimsAnchored = 0;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^([-*_>])[\s-*_>]$/.test(line)) continue;
    const text = line
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/\[\^src:[^\]]*\]/g, '');
    const plain = text.replace(/\[\[[^\]]*\]\]/g, '').replace(/[*_`#>|]/g, '');
    if (plain.replace(/\s/g, '').length < MIN_CLAIM_CHARS) continue;
    claimsTotal += 1;
    if (ANCHOR_TEST.test(line)) claimsAnchored += 1;
  }
  return { claimsTotal, claimsAnchored };
}

/**
 * Evaluate every anchor against the resolved source files.
 *
 * `resolver` receives the source id from the anchor and must reflect the
 * frontmatter ref (or null when the ref itself is unknown).
 */
export function evaluateCitations(
  body: string,
  sources: CitationSourceRef[],
  resolver: (sourceId: string, ref: CitationSourceRef) => CitationResolvedSource | null,
): CitationReport {
  const anchors = parseCitationAnchors(body);
  const byId = new Map(sources.map(ref => [ref.id, ref]));
  const issues: CitationIssue[] = [];

  for (const anchor of anchors) {
    const ref = byId.get(anchor.sourceId);
    if (!ref) {
      issues.push({
        kind: 'orphan',
        sourceId: anchor.sourceId,
        anchor: anchor.raw,
        detail: `id "${anchor.sourceId}" assente nel frontmatter sources:`,
      });
      continue;
    }
    const resolved = resolver(anchor.sourceId, ref);
    if (!resolved || !resolved.exists) {
      issues.push({
        kind: 'missing-source',
        sourceId: anchor.sourceId,
        anchor: anchor.raw,
        detail: `fonte "${ref.resource ?? anchor.sourceId}" inesistente`,
      });
      continue;
    }
    if (
      resolved.lineCount !== undefined &&
      (anchor.startLine < 1 || anchor.endLine < anchor.startLine || anchor.endLine > resolved.lineCount)
    ) {
      issues.push({
        kind: 'range',
        sourceId: anchor.sourceId,
        anchor: anchor.raw,
        detail: `righe L${anchor.startLine}-L${anchor.endLine} fuori dal range (1-${resolved.lineCount})`,
      });
    }
    if (ref.sha256 && resolved.sha256 && ref.sha256 !== resolved.sha256) {
      issues.push({
        kind: 'hash',
        sourceId: anchor.sourceId,
        anchor: anchor.raw,
        detail: `sha256 della fonte modificata dopo l'ultima verifica`,
      });
    }
  }

  const { claimsTotal, claimsAnchored } = claimStats(body);
  const coverage = claimsTotal > 0 ? claimsAnchored / claimsTotal : 1;
  const ok = !issues.some(issue => issue.kind !== 'hash');

  return {
    anchors: anchors.length,
    sources: sources.length,
    claimsTotal,
    claimsAnchored,
    coverage,
    issues,
    ok,
  };
}

/** The claim line carrying a given anchor (used by the advisory verdicts). */
export function claimForAnchor(body: string, anchorRaw: string): string {
  const index = body.indexOf(anchorRaw);
  if (index === -1) return anchorRaw;
  const lineStart = body.lastIndexOf('\n', index) + 1;
  const lineEnd = body.indexOf('\n', index);
  return body.slice(lineStart, lineEnd === -1 ? body.length : lineEnd).trim();
}
