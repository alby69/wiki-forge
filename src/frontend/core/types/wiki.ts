/**
 * Wiki Note representation within the domain model
 */
export interface Backlink {
  sourceId: string;
  sourceTitle: string;
  contextSnippet?: string;
}

/** One file whose links were rewritten by a document rename/move. */
export interface RenameLinkUpdate {
  file: string;
  replacements: number;
  samples: string[];
}

export interface RenameResult {
  success: boolean;
  dryRun: boolean;
  renamed: {
    from: string;
    to: string;
    oldTitle: string;
    newTitle: string;
    id: string;
  };
  updatedFiles: RenameLinkUpdate[];
  totalReplacements: number;
  error?: string;
}

export interface WikiNote {
  id: string;               // Unique path or identifier (e.g. "wiki/c64_dev.md" or "c64_dev")
  title: string;            // Display title of the note
  content: string;          // Raw Markdown content
  folder?: string;          // Folder path within vault
  path: string;             // Full vault path, e.g. "wiki/ai/foo.md" (used by the explorer)
  tags: string[];           // Extracted tags (from YAML frontmatter or #tags)
  frontmatter: Record<string, unknown>; // Parsed YAML frontmatter attributes
  outboundLinks: string[];  // Target node IDs linked from this note via [[WikiLink]]
  backlinks: Backlink[];    // Notes that link to this note
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  verified?: string[];
  staleAfter?: string;
  trustTier?: 'human-reviewed' | 'machine-confirmed' | 'unverified';
}
