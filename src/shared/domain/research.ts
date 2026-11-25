/**
 * Shared shapes for the Research Studio.
 *
 * The six tabs map to the "🔍 Interrogazione e Ricerca" commands:
 * `/consult`, `/search`, `/backlinks`, `/related`, `/trace`, `/deep-research`.
 * Every structure mirrors the JSON returned by `/api/notes/research/*`.
 */

export type ResearchTab = 'consult' | 'search' | 'backlinks' | 'related' | 'trace' | 'deep';

export interface ResearchNoteRef {
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
  note: ResearchNoteRef;
  score: number;
  matchCount: number;
  matches: ResearchSearchMatch[];
}

export interface ResearchSearchResponse {
  success: boolean;
  error?: string;
  query: string;
  total: number;
  totalMatches: number;
  scanned: number;
  tookMs: number;
  results: ResearchSearchResult[];
}

export interface ResearchBacklink {
  source: ResearchNoteRef;
  line: number;
  snippet: string;
}

export interface ResearchBacklinksResponse {
  success: boolean;
  error?: string;
  target?: ResearchNoteRef;
  items: ResearchBacklink[];
  scanned: number;
}

export interface ResearchRelatedSuggestion {
  note: ResearchNoteRef;
  score: number;
  sharedTags: string[];
  sharedTerms: string[];
  rationale: string;
}

export interface ResearchRelatedResponse {
  success: boolean;
  error?: string;
  target?: ResearchNoteRef;
  suggestions: ResearchRelatedSuggestion[];
  scanned: number;
}

export interface ResearchTraceSource {
  rawRef: string;
  file: string;
  startLine?: number;
  endLine?: number;
  passage?: string;
  inferred?: boolean;
  exists: boolean;
}

export interface ResearchTraceNote {
  note: ResearchNoteRef;
  matchedIn: string[];
  outboundLinks: string[];
  sources: ResearchTraceSource[];
}

export interface ResearchTraceResponse {
  success: boolean;
  error?: string;
  query: string;
  notes: ResearchTraceNote[];
  scanned: number;
}

export interface ResearchConsultCitation {
  id: string;
  title: string;
  path: string;
}

export interface ResearchConsultResponse {
  success: boolean;
  markdown: string;
  fallback: boolean;
  citations: ResearchConsultCitation[];
  error?: string;
}

/** Result of promoting a `/consult` answer into an OKF wiki note. */
export interface ResearchPromoteAnswerResponse {
  success: boolean;
  path?: string;
  /** OKF validation problems; empty when the note was accepted. */
  validation: string[];
  error?: string;
}

export interface ResearchDeepResearchResponse {
  success: boolean;
  markdown: string;
  outputPath?: string;
  synthesisPath?: string;
  articles: number;
  fallback: boolean;
  error?: string;
}

export interface ResearchOpenOptions {
  noteId?: string;
  tab?: ResearchTab;
  query?: string;
  noteRef?: string;
  /** Query a project other than the active vault (e.g. the wikiforge docs wiki). */
  projectId?: string;
  /** Human-readable label shown in the modal header for an explicit scope. */
  scopeLabel?: string;
}
