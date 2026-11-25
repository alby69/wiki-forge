/**
 * Minimal OKF v0.2 frontmatter helpers shared by the UI and the API server.
 *
 * A note created by a person must be valid from the first save, otherwise the
 * OKF validation workflow fails on a file the user never meant to "publish".
 * We only guarantee the fields the linter requires (`type`) plus a readable
 * `title`; richer frontmatter written by templates or agent workflows is left
 * untouched byte-for-byte.
 *
 * Reserved OKF files (`index.md`, `log.md`) are excluded: their format is
 * fixed by the specification and they must not gain frontmatter.
 */

const FRONTMATTER_RE = /^\uFEFF?[ \t]*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const RESERVED_NAMES = new Set(['index.md', 'log.md']);
const TYPE_LINE_RE = /^([ \t]*)type[ \t]*:[ \t]*$/m;
const HAS_TYPE_RE = /(^|\n)[ \t]*type[ \t]*:/;
const HAS_TITLE_RE = /(^|\n)[ \t]*title[ \t]*:/;

/** True for the OKF reserved filenames, whose content must not be changed. */
export function isReservedOkfFile(fileName: string): boolean {
  const base = fileName.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  return RESERVED_NAMES.has(base);
}

function yamlQuote(value: string): string {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim() || 'Nota';
  return `"${clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** True when the leading YAML block already carries a non-empty `type`. */
export function hasOkfType(content: string): boolean {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return false;
  return /(^|\n)[ \t]*type[ \t]*:[ \t]*\S+/.test(match[1]);
}

/**
 * Return `content` with a minimal valid OKF frontmatter when needed.
 *
 * - no frontmatter  -> prepend `type: Note` + `title`
 * - frontmatter lacking `type` -> add it (or fill an empty `type:`)
 * - already valid  -> return the original string unchanged
 * - reserved file  -> return the original string unchanged
 */
export function ensureOkfFrontmatter(content: string, title: string, fileName?: string): string {
  if (fileName && isReservedOkfFile(fileName)) return content;

  const source = content.replace(/^\uFEFF/, '');
  if (hasOkfType(source)) return content;

  const match = FRONTMATTER_RE.exec(source);
  if (!match) {
    const body = source.replace(/^\s+/, '');
    return `---\ntype: Note\ntitle: ${yamlQuote(title)}\n---\n\n${body}`;
  }

  let header = match[1];
  if (HAS_TYPE_RE.test(header)) {
    header = header.replace(TYPE_LINE_RE, '$1type: Note');
  } else {
    header += `\ntype: Note`;
  }
  if (!HAS_TITLE_RE.test(header)) {
    header += `\ntitle: ${yamlQuote(title)}`;
  }
  return `---\n${header}\n---\n` + source.slice(match[0].length);
}
