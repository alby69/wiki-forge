import { WikiNote, Backlink } from '../core/types/wiki';

export class MarkdownParser {
  /**
   * Extracts WikiLinks formatted as [[target]] or [[target|label]]
   */
  public extractWikiLinks(content: string): string[] {
    const wikiLinkRegex = /\[\[([^\]\|#]+)(?:\|[^\]]+)?\]\]/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const target = match[1].trim();
      if (target && !links.includes(target)) {
        links.push(target);
      }
    }

    return links;
  }

  /**
   * Extracts tags from content (#tag format and YAML frontmatter tags)
   */
  public extractTags(content: string, frontmatterTags?: string[]): string[] {
    const tagSet = new Set<string>(frontmatterTags || []);
    const inlineTagRegex = /(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g;
    let match: RegExpExecArray | null;

    while ((match = inlineTagRegex.exec(content)) !== null) {
      const tag = match[1].trim();
      if (tag) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet);
  }

  /**
   * Simple YAML Frontmatter parser for Markdown strings
   */
  public parseFrontmatter(rawContent: string): { frontmatter: Record<string, unknown>; content: string } {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
    const match = frontmatterRegex.exec(rawContent);

    if (!match) {
      return { frontmatter: {}, content: rawContent };
    }

    const yamlBlock = match[1];
    const content = rawContent.slice(match[0].length);
    const frontmatter: Record<string, unknown> = {};

    yamlBlock.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key] = value
            .slice(1, -1)
            .split(',')
            .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
        } else {
          frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    });

    return { frontmatter, content };
  }

  /**
   * Processes a raw note file to produce a structured WikiNote
   */
  public parseNote(
    id: string,
    title: string,
    rawContent: string,
    folder: string = '',
    notePath: string = ''
  ): WikiNote {
    const { frontmatter, content } = this.parseFrontmatter(rawContent);
    const fTags = Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : [];
    const tags = this.extractTags(content, fTags);
    const outboundLinks = this.extractWikiLinks(content);

    return {
      id,
      title: (frontmatter.title as string) || title,
      content,
      folder,
      path: notePath,
      tags,
      frontmatter,
      outboundLinks,
      backlinks: [],
    };
  }

  /**
   * Resolves a [[wikilink]] target to a concrete note.
   *
   * Supports several notations actually used in vaults:
   *   - [[stem]]                      (same folder)
   *   - [[folder/stem]]               (cross-folder, explicit)
   *   - [[Some Title]]                (by title)
   * Matching is case-insensitive and tolerant of a leading folder prefix.
   */
  public resolveLinkTarget(target: string, notes: WikiNote[]): WikiNote | null {
    const t = target.trim();
    const tLower = t.toLowerCase();
    const tStem = t.includes('/') ? t.substring(t.lastIndexOf('/') + 1) : t;
    const tStemLower = tStem.toLowerCase();

    // 1. exact id (with or without folder prefix)
    let found = notes.find(n => n.id.toLowerCase() === tLower);
    if (found) return found;
    // 2. folder/stem form on the note id
    found = notes.find(n => `${n.folder}/${n.id}`.toLowerCase() === tLower);
    if (found) return found;
    // 3. bare stem (folder prefix stripped from the target)
    found = notes.find(n => n.id.toLowerCase() === tStemLower);
    if (found) return found;
    // 4. by title
    found = notes.find(n => n.title.toLowerCase() === tLower);
    if (found) return found;
    return null;
  }

  /**
   * Computes backlinks across a collection of parsed WikiNotes
   */
  public computeBacklinks(notes: WikiNote[]): WikiNote[] {
    const noteMap = new Map<string, WikiNote>();
    notes.forEach(note => noteMap.set(note.id, { ...note, backlinks: [] }));

    notes.forEach(sourceNote => {
      sourceNote.outboundLinks.forEach(targetId => {
        const targetNote = this.resolveLinkTarget(targetId, Array.from(noteMap.values()));

        if (targetNote) {
          const backlink: Backlink = {
            sourceId: sourceNote.id,
            sourceTitle: sourceNote.title,
            contextSnippet: `Linked from ${sourceNote.title}`,
          };
          if (!targetNote.backlinks.some(b => b.sourceId === sourceNote.id)) {
            targetNote.backlinks.push(backlink);
          }
        }
      });
    });

    return Array.from(noteMap.values());
  }
}
