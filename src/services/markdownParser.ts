import { WikiNote, Backlink } from '../core/types/wiki';

export class MarkdownParser {
  /**
   * Extracts WikiLinks formatted as [[target]] or [[target|label]]
   */
  public extractWikiLinks(content: string): string[] {
    const wikiLinkRegex = /\[\[([^\]\|#]+)(?:#[^\]\|]+)?(?:\|[^\]]+)?\]\]/g;
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
      // Only capture top-level mapping keys. Indented lines belong to nested
      // mappings/sequences (e.g. the `sources:` list) and would otherwise
      // clobber their parent's value — notably a source's `title:` overwriting
      // the note's real title. Blank lines and sequence markers are skipped too.
      if (/^\s/.test(line) || line.trimStart().startsWith('-')) return;

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
   * Extracts the verification actors from an OKF v0.2 `verified` block.
   *
   * The spec allows several shapes (docs/OKF_SPEC.md §4-§6):
   *   verified:
   *     - by: human:alby69
   *       at: 2026-09-02T12:30:00Z
   * or a flat scalar / inline array:
   *   verified: [human:alby69, process:compile]
   *
   * The trust tier keys off the actor string (`human:*` => human-reviewed),
   * so this returns the list of actors regardless of the concrete shape.
   * Because the frontmatter parser only keeps top-level keys, the nested
   * `- by:` entries would otherwise be invisible to the trust-tier logic.
   */
  public extractVerifiedActors(rawContent: string): string[] {
    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawContent);
    if (!fmMatch) return [];

    const lines = fmMatch[1].split('\n');
    const actors: string[] = [];
    let inVerified = false;
    let verifiedIndent = 0;

    for (const line of lines) {
      const indent = (line.match(/^\s*/)?.[0].length) ?? 0;
      const trimmed = line.trim();

      if (!inVerified && indent === 0 && /^verified\s*:/.test(trimmed)) {
        inVerified = true;
        verifiedIndent = indent;
        const inline = trimmed.slice(trimmed.indexOf(':') + 1).trim();
        if (inline.startsWith('[') && inline.endsWith(']')) {
          for (const item of inline.slice(1, -1).split(',')) {
            const actor = item.trim().replace(/^['"]|['"]$/g, '');
            if (actor) actors.push(actor);
          }
        } else if (inline) {
          actors.push(inline.replace(/^['"]|['"]$/g, ''));
        }
        continue;
      }

      if (!inVerified) continue;

      // A new top-level key ends the verified block.
      if (trimmed && indent <= verifiedIndent) {
        inVerified = false;
        continue;
      }
      if (!trimmed) continue;

      // Nested form: `- by: human:alby69` or `- human:alby69`, plus the
      // continuation line `by: human:alby69` without a leading dash.
      const item = trimmed.replace(/^-\s*/, '');
      const byMatch = item.match(/^by\s*:\s*(.+)$/);
      const actor = (byMatch ? byMatch[1] : item).trim().replace(/^['"]|['"]$/g, '');
      if (actor && !/^at\s*:/i.test(actor)) actors.push(actor);
    }

    return actors;
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

    // Prefer the OKF-aware extraction (handles nested `- by:` objects); fall
    // back to a flat inline array / scalar string when present.
    let verified = this.extractVerifiedActors(rawContent);
    if (verified.length === 0) {
      if (Array.isArray(frontmatter.verified)) {
        verified = (frontmatter.verified as unknown[]).map(v => String(v).trim()).filter(Boolean);
      } else if (typeof frontmatter.verified === 'string' && frontmatter.verified.trim()) {
        verified = [frontmatter.verified.trim()];
      }
    }

    const status = typeof frontmatter.status === 'string' ? frontmatter.status.toLowerCase() : 'draft';
    const staleAfter = typeof frontmatter.stale_after === 'string' ? frontmatter.stale_after : undefined;

    let trustTier: 'human-reviewed' | 'machine-confirmed' | 'unverified' = 'unverified';
    if (verified.some(v => v.startsWith('human:'))) {
      trustTier = 'human-reviewed';
    } else if (verified.length > 0) {
      trustTier = 'machine-confirmed';
    }

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
      status,
      verified,
      staleAfter,
      trustTier,
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
