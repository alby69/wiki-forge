/**
 * Wiki Note representation within the domain model
 */
export interface Backlink {
  sourceId: string;
  sourceTitle: string;
  contextSnippet?: string;
}

export interface WikiNote {
  id: string;               // Unique path or identifier (e.g. "wiki/c64_dev.md" or "c64_dev")
  title: string;            // Display title of the note
  content: string;          // Raw Markdown content
  folder?: string;          // Folder path within vault
  tags: string[];           // Extracted tags (from YAML frontmatter or #tags)
  frontmatter: Record<string, unknown>; // Parsed YAML frontmatter attributes
  outboundLinks: string[];  // Target node IDs linked from this note via [[WikiLink]]
  backlinks: Backlink[];    // Notes that link to this note
  createdAt?: string;
  updatedAt?: string;
}
