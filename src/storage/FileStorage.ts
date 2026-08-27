import { WikiNote } from '../core/types/wiki';
import { IStorage } from '../core/interfaces/IStorage';
import { MarkdownParser } from '../services/markdownParser';

/**
 * File-based vault adapter (read-only viewer).
 *
 * Loads every Markdown file under `wiki/` and `raw/` at build/dev time using
 * Vite's `import.meta.glob`. This keeps the UI fully decoupled from any
 * backend: the agent edits the Markdown on disk, and the UI simply renders it.
 *
 * Note: this adapter is intentionally read/explore only. Persistence (saving
 * edits back to disk) is the job of the coding agent, which owns the files.
 */
export class FileStorage implements IStorage {
  private parser = new MarkdownParser();

  public async getAllNotes(): Promise<WikiNote[]> {
    // eager + ?raw => a map of "path" -> "markdown string"
    const modules = import.meta.glob(['../wiki/**/*.md', '../raw/**/*.md'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    const notes: WikiNote[] = [];

    for (const [path, content] of Object.entries(modules)) {
      const relative = path.replace(/^\.\.\//, ''); // e.g. "wiki/ai/foo.md"
      const segments = relative.split('/');
      const fileName = segments[segments.length - 1] ?? relative;
      const stem = fileName.replace(/\.md$/i, '');
      const folder = segments.length > 1 ? segments.slice(0, -1).join('/') : relative;
      const titleFromName = stem.replace(/[-_]/g, ' ');

      notes.push(this.parser.parseNote(stem, titleFromName, content, folder));
    }

    return this.parser.computeBacklinks(notes);
  }

  public async getNote(id: string): Promise<WikiNote | null> {
    const notes = await this.getAllNotes();
    return (
      notes.find(n => n.id === id || n.title.toLowerCase() === id.toLowerCase()) ?? null
    );
  }

  public async saveNote(note: Partial<WikiNote> & { id: string }): Promise<WikiNote> {
    // Read/explore viewer: reflect the change in the returned object only.
    // The agent remains the source of truth for on-disk files.
    const current = await this.getNote(note.id);
    return { ...(current as WikiNote), ...note } as WikiNote;
  }

  public async deleteNote(_id: string): Promise<boolean> {
    return false;
  }

  public async searchNotes(query: string): Promise<WikiNote[]> {
    const notes = await this.getAllNotes();
    const q = query.toLowerCase();
    return notes.filter(
      n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }
}
