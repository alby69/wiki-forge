import type { WikiNote } from '@shared/domain/wiki';

/**
 * Deterministic building blocks behind the Research Studio.
 *
 * They only work on the notes already loaded by `AgentServer`, so they can be
 * unit-tested without a filesystem or a running server. `consult` and
 * `deep-research` add the LLM on top, but search/backlinks/related/trace never
 * call a model.
 */

export interface NoteRef {
  id: string;
  title: string;
  path: string;
  folder: string;
}

export interface ResearchSearchMatch {
  line: number;
  snippet: string;
}

export interface ResearchSearchResult {
  note: NoteRef;
  score: number;
  matchCount: number;
  matches: ResearchSearchMatch[];
}

export interface ResearchSearchResponse {
  query: string;
  total: number;
  totalMatches: number;
  scanned: number;
  tookMs: number;
  results: ResearchSearchResult[];
}

export interface ResearchBacklink {
  source: NoteRef;
  line: number;
  snippet: string;
}

export interface ResearchBacklinksResponse {
  target: NoteRef;
  items: ResearchBacklink[];
  scanned: number;
}

export interface ResearchRelatedSuggestion {
  note: NoteRef;
  score: number;
  sharedTags: string[];
  sharedTerms: string[];
  rationale: string;
}

export interface ResearchRelatedResponse {
  target: NoteRef;
  suggestions: ResearchRelatedSuggestion[];
  scanned: number;
}

export interface ResearchTraceSource {
  rawRef: string;
  file: string;
  startLine?: number;
  endLine?: number;
  passage?: string;
  /** True when the passage was located by searching the query in the raw file. */
  inferred?: boolean;
  exists: boolean;
}

export interface ResearchTraceNote {
  note: NoteRef;
  /** Where the query matched: id, title, body or outbound links. */
  matchedIn: string[];
  outboundLinks: string[];
  sources: ResearchTraceSource[];
}

export interface ResearchTraceResponse {
  query: string;
  notes: ResearchTraceNote[];
  scanned: number;
}

export type ResolveNote = (ref: string, notes: WikiNote[]) => WikiNote | null;

const STOPWORDS = new Set([
  // Italian
  'alla', 'alle', 'allo', 'anche', 'avere', 'come', 'dalla', 'dalle', 'dallo',
  'degli', 'della', 'delle', 'dello', 'dentro', 'dopo', 'dove', 'essere',
  'fatta', 'fatte', 'fatti', 'fatto', 'fare', 'loro', 'molto', 'nelle', 'nella',
  'nello', 'ogni', 'oltre', 'perché', 'perche', 'prima', 'questa', 'queste',
  'questi', 'questo', 'sono', 'sulla', 'sulle', 'sullo', 'tutta', 'tutte',
  'tutti', 'tutto', 'verso', 'viene', 'vengono', 'degli', 'dagli', 'dalle',
  // English
  'about', 'after', 'again', 'against', 'being', 'between', 'could', 'does',
  'doing', 'during', 'every', 'from', 'have', 'having', 'into', 'more', 'most',
  'other', 'over', 'same', 'should', 'some', 'such', 'than', 'that', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'under', 'until', 'very', 'were', 'what', 'when', 'where', 'which', 'while',
  'with', 'would', 'your',
]);

/** Compact reference used by every response. */
export function toNoteRef(note: WikiNote): NoteRef {
  return {
    id: note.id,
    title: note.title,
    path: note.path,
    folder: note.folder || 'wiki',
  };
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Frequent, meaningful terms of a note. Used to compare two notes without any
 * embedding model: shared tags plus shared vocabulary is enough to surface
 * plausible links that are still missing.
 */
export function keyTerms(text: string, limit: number = 28): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    if (token.length < 4 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function buildSnippet(lines: string[], index: number): string {
  const start = Math.max(0, index - 1);
  const end = Math.min(lines.length, index + 2);
  const text = lines
    .slice(start, end)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
  return text.length > 480 ? `${text.slice(0, 477)}…` : text;
}

/** Line-level matches shared by the lexical helper and the retriever port. */
export function noteSearchLines(
  note: WikiNote,
  tokens: string[],
): { matches: ResearchSearchMatch[]; matchCount: number; bodyScore: number } {
  const lines = note.content.split(/\r?\n/);
  const matches: ResearchSearchMatch[] = [];
  let matchCount = 0;
  let bodyScore = 0;

  for (let index = 0; index < lines.length; index++) {
    const lower = lines[index].toLowerCase();
    let hits = 0;
    for (const token of tokens) {
      if (lower.includes(token)) hits++;
    }
    if (hits === 0) continue;
    matchCount++;
    bodyScore += hits;
    if (matches.length < 4) {
      matches.push({ line: index + 1, snippet: buildSnippet(lines, index) });
    }
  }
  return { matches, matchCount, bodyScore };
}

/**
 * Case-insensitive full-text search with line numbers and 1-line context.
 * A title hit weighs more than a body hit; the whole query as a phrase gets a
 * bonus so "governance clinica" ranks above two scattered word matches.
 */
export function searchNotes(notes: WikiNote[], query: string, limit: number = 30): ResearchSearchResponse {
  const started = Date.now();
  const q = query.trim();
  const tokens = tokenize(q);
  const phrase = q.toLowerCase();
  const results: ResearchSearchResult[] = [];
  let totalMatches = 0;

  if (tokens.length === 0) {
    return { query: q, total: 0, totalMatches: 0, scanned: notes.length, tookMs: 0, results: [] };
  }

  for (const note of notes) {
    const title = note.title.toLowerCase();
    const id = note.id.toLowerCase();
    const tags = note.tags.join(' ').toLowerCase();

    let score = 0;
    if (title.includes(phrase)) score += 15;
    if (id.includes(phrase)) score += 8;
    if (tags.includes(phrase)) score += 5;
    for (const token of tokens) {
      if (title.includes(token)) score += 6;
      if (id.includes(token)) score += 2;
      if (tags.includes(token)) score += 3;
    }

    const { matches, matchCount, bodyScore } = noteSearchLines(note, tokens);
    score += bodyScore;
    totalMatches += matchCount;

    if (score <= 0) continue;
    results.push({ note: toNoteRef(note), score, matchCount, matches });
  }

  results.sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title));
  return {
    query: q,
    total: results.length,
    totalMatches,
    scanned: notes.length,
    tookMs: Date.now() - started,
    results: results.slice(0, Math.max(1, limit)),
  };
}

/**
 * Notes that reference the target through `[[wikilinks]]`. The resolver is
 * injected so id/title/path aliases behave exactly like the rest of the app.
 */
export function findBacklinks(
  notes: WikiNote[],
  target: WikiNote,
  resolve: ResolveNote
): ResearchBacklinksResponse {
  const items: ResearchBacklink[] = [];

  for (const note of notes) {
    if (note.id === target.id) continue;
    const lines = note.content.split(/\r?\n/);
    let foundLine = -1;

    for (let index = 0; index < lines.length && foundLine === -1; index++) {
      const regex = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lines[index])) !== null) {
        const linked = resolve(match[1].trim(), notes);
        if (linked?.id === target.id) {
          foundLine = index;
          break;
        }
      }
    }

    if (foundLine !== -1) {
      items.push({
        source: toNoteRef(note),
        line: foundLine + 1,
        snippet: buildSnippet(lines, foundLine),
      });
    }
  }

  items.sort((a, b) => a.source.title.localeCompare(b.source.title));
  return { target: toNoteRef(target), items, scanned: notes.length };
}

/**
 * Suggests notes that share tags/vocabulary with the target but are not linked
 * yet (in either direction), so the list proposes new connections only.
 */
export function suggestRelated(
  notes: WikiNote[],
  target: WikiNote,
  resolve: ResolveNote,
  limit: number = 12
): ResearchRelatedResponse {
  const targetTags = new Set(target.tags.map(tag => tag.toLowerCase()));
  const targetTerms = new Set(keyTerms(`${target.title}\n${target.content}`));
  const excluded = new Set<string>([target.id]);

  for (const link of target.outboundLinks) {
    const resolved = resolve(link, notes);
    if (resolved) excluded.add(resolved.id);
  }
  for (const backlink of target.backlinks || []) {
    if (backlink.sourceId) excluded.add(backlink.sourceId);
  }

  const suggestions: ResearchRelatedSuggestion[] = [];
  for (const note of notes) {
    if (excluded.has(note.id)) continue;

    const sharedTags = note.tags
      .map(tag => tag.toLowerCase())
      .filter(tag => targetTags.has(tag));
    const candidateTerms = keyTerms(`${note.title}\n${note.content}`);
    const sharedTerms = candidateTerms.filter(term => targetTerms.has(term));
    if (sharedTags.length === 0 && sharedTerms.length === 0) continue;

    const score = sharedTags.length * 6 + Math.min(sharedTerms.length, 12);
    suggestions.push({
      note: toNoteRef(note),
      score,
      sharedTags: Array.from(new Set(sharedTags)),
      sharedTerms: sharedTerms.slice(0, 8),
      rationale: [
        sharedTags.length > 0 ? `${sharedTags.length} tag in comune` : '',
        sharedTerms.length > 0 ? `${sharedTerms.length} concetti condivisi` : '',
      ].filter(Boolean).join(' · '),
    });
  }

  suggestions.sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title));
  return { target: toNoteRef(target), suggestions: suggestions.slice(0, Math.max(1, limit)), scanned: notes.length };
}
