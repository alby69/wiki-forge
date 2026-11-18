/**
 * Shared shapes for the Study Studio.
 *
 * The seven tabs map to the "📚 Studio e Sintesi" commands:
 * `/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`,
 * `/promote-note`, `/thesis-chapter`.
 * Every structure mirrors the JSON returned by `/api/notes/study/*`.
 */

export type StudyTab = 'guide' | 'quiz' | 'mindmap' | 'audio' | 'note' | 'promote' | 'thesis';

export interface StudyNoteRef {
  id: string;
  title: string;
  path: string;
  folder: string;
}

export interface StudyMindmapNode {
  id: string;
  label: string;
  group: string;
}

export interface StudyMindmapLink {
  source: string;
  target: string;
}

export interface StudyOutputResponse {
  success: boolean;
  markdown: string;
  outputPath: string;
  sources: StudyNoteRef[];
  error?: string;
}

export interface StudyQuizResponse extends StudyOutputResponse {
  count: number;
}

export interface StudyMindmapResponse extends StudyOutputResponse {
  note?: StudyNoteRef;
  nodes: StudyMindmapNode[];
  links: StudyMindmapLink[];
  headings: number;
  wikilinks: number;
}

export interface StudyScratchpadEntry {
  id: string;
  timestamp: string;
  text: string;
}

export interface StudyQuickNoteResponse {
  success: boolean;
  markdown: string;
  entry?: StudyScratchpadEntry;
  entries: StudyScratchpadEntry[];
  error?: string;
}

export interface StudyPromoteResponse {
  success: boolean;
  markdown: string;
  note?: {
    id: string;
    title: string;
    path: string;
    folder?: string;
  };
  error?: string;
}

export interface StudyThesisChapter {
  title: string;
  number: number;
  path: string;
  maturity: number;
}

export interface StudyThesisSynthesis {
  title: string;
  path: string;
  maturity: number;
  type: string;
}

export interface StudyThesisResponse extends StudyOutputResponse {
  title: string;
  chapters: StudyThesisChapter[];
  syntheses: StudyThesisSynthesis[];
}

export interface StudyOpenOptions {
  /** Wiki note used as context (mind map target and note prefill). */
  noteId?: string;
  tab?: StudyTab;
  /** Prefills the topic/query field of the opened tab. */
  topic?: string;
}
