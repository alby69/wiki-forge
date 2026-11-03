import * as path from 'node:path';

/**
 * Helpers for keeping `[[wikilinks]]` coherent when a document is renamed or
 * moved inside a Wiki-Forge vault.
 *
 * A note is identified on disk by its path (and therefore by its filename
 * stem). The UI, however, shows the human-readable `title` from the YAML
 * frontmatter. Renaming only the file breaks every link that pointed to the old
 * stem, so the backend rewrites all references in one pass.
 */

/** A document as seen by the link rewriter. */
export interface DocumentRef {
  /** Path relative to the project root, including `wiki/` and `.md`. */
  relPath: string;
  /** Path relative to the wiki root, without extension (canonical link id). */
  relId: string;
  /** Filename without extension. */
  stem: string;
  /** Display title (frontmatter title when present). */
  title: string;
  /** Frontmatter aliases, also valid link targets. */
  aliases?: string[];
}

export interface DocumentMove {
  old: DocumentRef;
  new: DocumentRef;
}

export interface LinkRewriteOptions {
  moves: DocumentMove[];
  /** Project-root-relative path of the file being rewritten. */
  sourceRelPath: string;
  /** Wiki-relative ids of every note in the vault (ambiguity detection). */
  allRelIds: string[];
}

export interface LinkRewriteReport {
  content: string;
  replacements: number;
  samples: string[];
}

/** Normalize a link target so `./foo`, `foo.md`, `wiki/foo` all compare equal. */
function normalizeLinkTarget(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^wiki\//i, '')
    .replace(/\.md$/i, '')
    .replace(/\/+/g, '/')
    .toLowerCase();
}

/** Loose comparison key used to match titles/headings regardless of accents,
 *  punctuation and capitalization. */
function looseText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Turn a human title into a filesystem-safe slug.
 *
 * Chapter titles such as `Capitolo 5: Il Quadro...` keep the numeric ordering
 * prefix (`05-...`), either from the previous filename or from the title itself.
 */
export function slugifyDocumentTitle(title: string, previousStem = ''): string {
  const chapterMatch = /^\s*capitolo\s+(\d+)\b/i.exec(title);
  const previousPrefix = /^(\d{1,4})[-_. ]/.exec(previousStem);
  const prefixNumber = previousPrefix?.[1] ?? chapterMatch?.[1];

  let base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (prefixNumber) {
    // Avoid `05-capitolo-5-...`: the number is already the filename prefix.
    const stripChapter = new RegExp(`^capitolo-?0*${Number(prefixNumber)}-?`);
    base = base.replace(stripChapter, '');
  }

  if (!base) base = 'documento';
  if (base.length > 100) {
    const cut = base.slice(0, 100);
    const lastDash = cut.lastIndexOf('-');
    base = (lastDash > 30 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
  }

  const prefix = prefixNumber ? `${String(prefixNumber).padStart(2, '0')}-` : '';
  return `${prefix}${base}`;
}

/**
 * Set (or add) the `title` key in the YAML frontmatter.
 *
 * The frontmatter parser used by the UI is intentionally small, so we write a
 * single-quoted YAML scalar (with `''` escaping) which is valid for PyYAML and
 * readable by the UI.
 */
export function setDocumentTitle(content: string, title: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  const quoted = `'${title.replace(/'/g, "''")}'`;
  const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);

  if (!frontmatter) {
    const body = normalized.replace(/^\uFEFF/, '').replace(/^\n+/, '');
    // OKF lint requires a non-empty `type`: default to the same Concept type
    // used by generated notes when the document had no frontmatter at all.
    return `---\ntype: Concept\ntitle: ${quoted}\n---\n\n${body}`;
  }

  const lines = frontmatter[1].split('\n');
  const titleIndex = lines.findIndex(line => /^title\s*:/.test(line));
  const hasType = lines.some(line => /^type\s*:/.test(line));

  if (titleIndex >= 0) {
    // Replace the whole scalar, including continuation lines produced by YAML
    // wrapping of long titles.
    let end = titleIndex + 1;
    while (end < lines.length && (/^\s+\S/.test(lines[end]) || lines[end].trim() === '')) {
      end += 1;
    }
    lines.splice(titleIndex, end - titleIndex, `title: ${quoted}`);
  } else {
    lines.unshift(`title: ${quoted}`);
  }

  // Keep the document valid for the OKF linter even when only the title is
  // being changed and the original frontmatter omitted `type`.
  if (!hasType) lines.unshift('type: Concept');

  const hasTrailingNewline = frontmatter[0].endsWith('\n');
  const body = normalized.slice(frontmatter[0].length);
  return `---\n${lines.join('\n')}\n---${hasTrailingNewline ? '\n' : ''}${body}`;
}

/**
 * Update the first Markdown heading when it is just the old title (e.g.
 * `# Capitolo 1: Introduzione`). Headings that carry extra editorial meaning
 * are left untouched.
 */
export function updateLeadingHeading(content: string, oldTitle: string, newTitle: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  const frontmatter = /^---\n[\s\S]*?\n---\n?/.exec(normalized);
  const prefix = frontmatter ? frontmatter[0] : '';
  const lines = normalized.slice(prefix.length).split('\n');
  const oldKey = looseText(oldTitle);

  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (!heading) continue;
    if (oldKey && looseText(heading[2]) === oldKey) {
      lines[i] = `${heading[1]} ${newTitle}`;
    }
    break;
  }

  return prefix + lines.join('\n');
}

interface ParsedWikilink {
  predicate: string | null;
  target: string;
  anchor: string | null;
  label: string | null;
}

function splitWikilink(inner: string): ParsedWikilink | null {
  let rest = inner.trim();
  let predicate: string | null = null;

  const predicateIndex = rest.indexOf('::');
  if (predicateIndex > 0) {
    predicate = rest.slice(0, predicateIndex);
    rest = rest.slice(predicateIndex + 2);
  }

  let label: string | null = null;
  const pipeIndex = rest.lastIndexOf('|');
  if (pipeIndex >= 0) {
    label = rest.slice(pipeIndex + 1);
    rest = rest.slice(0, pipeIndex);
  }

  let anchor: string | null = null;
  const hashIndex = rest.indexOf('#');
  if (hashIndex >= 0) {
    anchor = rest.slice(hashIndex + 1);
    rest = rest.slice(0, hashIndex);
  }

  const target = rest.trim();
  if (!target) return null;
  return { predicate, target, anchor, label };
}

interface Lookup {
  move: DocumentMove;
  idKeys: Set<string>;
  titleKeys: Set<string>;
  keys: Set<string>;
}

interface Match {
  lookup: Lookup;
  kind: 'id' | 'title' | 'path';
}

/**
 * Rewrite all references to the moved/renamed documents inside one file.
 *
 * Supports `[[target]]`, `[[target|label]]`, `[[target#anchor]]`,
 * typed links `[[predicate::target]]`, embeds `![[target]]` and relative
 * Markdown links `[text](folder/note.md)`.
 */
export function rewriteDocumentLinks(content: string, options: LinkRewriteOptions): LinkRewriteReport {
  if (options.moves.length === 0) {
    return { content, replacements: 0, samples: [] };
  }

  const stemCounts = new Map<string, number>();
  for (const relId of options.allRelIds) {
    const stem = (relId.split('/').pop() ?? relId).toLowerCase();
    stemCounts.set(stem, (stemCounts.get(stem) ?? 0) + 1);
  }

  const lookups: Lookup[] = options.moves.map(move => {
    const idKeys = new Set<string>();
    const titleKeys = new Set<string>();
    const keys = new Set<string>();

    const add = (set: Set<string>, value: string | undefined): void => {
      if (!value) return;
      const normalized = normalizeLinkTarget(value);
      if (!normalized) return;
      set.add(normalized);
      keys.add(normalized);
    };

    add(idKeys, move.old.relPath);
    add(idKeys, move.old.relId);
    add(idKeys, move.old.stem);
    add(titleKeys, move.old.title);
    for (const alias of move.old.aliases ?? []) {
      // Path-like aliases (e.g. the previous filename passed by the repair
      // command) are identifiers, not display titles.
      const looksLikeId = /[/\\]/.test(alias) || /\.md$/i.test(alias) || (!/\s/.test(alias) && /^[a-z0-9][a-z0-9._-]*$/i.test(alias));
      add(looksLikeId ? idKeys : titleKeys, alias);
    }

    return { move, idKeys, titleKeys, keys };
  });

  const resolve = (target: string): Match | null => {
    const normalized = normalizeLinkTarget(target);
    if (!normalized) return null;

    for (const lookup of lookups) {
      if (!lookup.keys.has(normalized)) continue;
      const isTitle = !lookup.idKeys.has(normalized) && lookup.titleKeys.has(normalized);
      // A bare stem shared by several notes is inherently ambiguous (the UI
      // resolver would pick the first one), so never rewrite it blindly.
      if (!normalized.includes('/') && !isTitle && (stemCounts.get(normalized) ?? 0) > 1) {
        continue;
      }
      return { lookup, kind: isTitle ? 'title' : 'id' };
    }

    // `folder/stem` link matched against a bare old stem: only when the stem is
    // unique in the vault, otherwise we could rewrite the wrong document.
    for (const lookup of lookups) {
      for (const key of lookup.keys) {
        if (key.includes('/')) continue;
        if (!normalized.endsWith(`/${key}`)) continue;
        if ((stemCounts.get(key) ?? 0) > 1) continue;
        return { lookup, kind: 'path' };
      }
    }

    return null;
  };

  const formatTarget = (match: Match, rawTarget: string): string => {
    const trimmed = rawTarget.trim();
    const hadWikiPrefix = /^wiki\//i.test(trimmed);

    if (match.kind === 'title' && !/[|#[\]]/.test(match.lookup.move.new.title)) {
      return match.lookup.move.new.title;
    }

    const keepPath = match.kind === 'path' || trimmed.includes('/');
    const value = keepPath ? match.lookup.move.new.relId : match.lookup.move.new.stem;
    return hadWikiPrefix ? `wiki/${value}` : value;
  };

  /**
   * A label that simply repeated the old title (`[[old|Capitolo 5: Old]]`) would
   * otherwise keep showing stale text. Labels with editorial wording are left
   * untouched.
   */
  const formatLabel = (match: Match, label: string): string => {
    const lookup = match.lookup;
    const key = looseText(label);
    if (!key) return label;

    const candidates = [lookup.move.old.title, ...(lookup.move.old.aliases ?? [])];
    const isOldName = candidates.some(candidate => candidate && looseText(candidate) === key);
    if (!isOldName) return label;

    const newTitle = lookup.move.new.title;
    return /[|#[\]]/.test(newTitle) ? label : newTitle;
  };

  let replacements = 0;
  const samples: string[] = [];

  const rewriteWikilinks = (segment: string): string =>
    segment.replace(/\[\[([^\]\n]+)\]\]/g, (match, inner: string) => {
      const parsed = splitWikilink(inner);
      if (!parsed) return match;

      const resolved = resolve(parsed.target);
      if (!resolved) return match;

      const newTarget = formatTarget(resolved, parsed.target);
      const newLabel = parsed.label !== null ? formatLabel(resolved, parsed.label) : null;
      const rebuilt = `${parsed.predicate ? `${parsed.predicate}::` : ''}${newTarget}${
        parsed.anchor ? `#${parsed.anchor}` : ''
      }${newLabel !== null ? `|${newLabel}` : ''}`;

      if (`[[${rebuilt}]]` === match) return match;

      replacements += 1;
      if (samples.length < 10) samples.push(`${match} → [[${rebuilt}]]`);
      return `[[${rebuilt}]]`;
    });

  const rewriteMarkdownLinks = (segment: string): string =>
    segment.replace(/(!?\[[^\]\n]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (match, prefix: string, rawPath: string, suffix: string) => {
      const rewritten = rewriteRelativePath(rawPath, options.moves, options.sourceRelPath);
      if (!rewritten || rewritten === rawPath) return match;

      replacements += 1;
      if (samples.length < 10) samples.push(`${rawPath} → ${rewritten}`);
      return `${prefix}${rewritten}${suffix}`;
    });

  const lines = content.split('\n');
  let inFence = false;
  const rewritten = lines.map(line => {
    if (/^\s*(```+|~~~+)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    // Keep inline code spans untouched.
    return line
      .split(/(`+[^`]*`+)/)
      .map((chunk, index) => (index % 2 === 1 ? chunk : rewriteWikilinks(rewriteMarkdownLinks(chunk))))
      .join('');
  });

  return { content: rewritten.join('\n'), replacements, samples };
}

function rewriteRelativePath(rawPath: string, moves: DocumentMove[], sourceRelPath: string): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(rawPath)) return null;

  let pathPart = rawPath;
  let anchor = '';
  const hashIndex = pathPart.indexOf('#');
  if (hashIndex >= 0) {
    anchor = pathPart.slice(hashIndex);
    pathPart = pathPart.slice(0, hashIndex);
  }

  let decoded = pathPart;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch (_e) {
    // Keep the raw value when it is not valid percent-encoding.
  }

  if (!/\.md$/i.test(decoded)) return null;

  const sourceDir = path.posix.dirname(sourceRelPath.replace(/\\/g, '/'));
  const clean = decoded.replace(/\\/g, '/').replace(/^\.\//, '');
  const candidates = new Set<string>([
    path.posix.normalize(clean),
    path.posix.normalize(path.posix.join(sourceDir, clean)),
  ]);

  for (const move of moves) {
    const oldPath = move.old.relPath.replace(/\\/g, '/').toLowerCase();
    const matches = Array.from(candidates).some(candidate => candidate.toLowerCase() === oldPath);
    if (!matches) continue;

    const relative = path.posix.relative(sourceDir, move.new.relPath.replace(/\\/g, '/'));
    const prefix = decoded.startsWith('./') ? './' : '';
    return `${prefix}${relative}${anchor}`;
  }

  return null;
}
