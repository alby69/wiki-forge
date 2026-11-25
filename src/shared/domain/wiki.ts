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
  id: string;
  title: string;
  content: string;
  frontmatterRaw?: string;
  rawContent?: string;
  folder?: string;
  path: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  outboundLinks: string[];
  backlinks: Backlink[];
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  verified?: string[];
  staleAfter?: string;
  trustTier?: 'human-reviewed' | 'machine-confirmed' | 'unverified';
}
