import { marked } from 'marked';
import { escapeHtml, sanitizeHtml } from './html';

marked.setOptions({ breaks: true, gfm: true });

/**
 * Renders a wiki note's raw Markdown into safe, formatted HTML for the
 * read/explore viewer.
 *
 * - YAML frontmatter is stripped (it is metadata, not body content).
 * - HTML output is sanitized against XSS vectors.
 * - `[[wiki links]]` / `[[wiki link|label]]` become clickable anchors
 *   (`a.wikilink[data-wikilink="target"]`) that the app wires to navigation.
 * - Standard Markdown (headings, lists, bold, code, tables, …) is rendered.
 */
export function renderMarkdown(raw: string): string {
  const stripped = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  let html = marked.parse(stripped) as string;

  // Sanitize HTML output to neutralize XSS payloads
  html = sanitizeHtml(html);

  // Turn [[wikilinks]] into navigable anchors (supporting optional line/section anchor, e.g. [[article#L12-L24]])
  html = html.replace(
    /\[\[([^\]\|#]+)(?:#([^\]\|]+))?(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, anchor?: string, label?: string) => {
      const t = target.trim();
      const text = (label ?? target).trim();
      const anchorAttr = anchor ? ` data-anchor="${escapeHtml(anchor.trim())}"` : '';
      return `<a href="#" class="wikilink" data-wikilink="${escapeHtml(t)}"${anchorAttr}>${escapeHtml(text)}</a>`;
    }
  );

  // Turn raw/ source references like raw/file.md#L10-L20 into clickable source anchors
  html = html.replace(
    /\b(raw\/[^\s\)]+?\.md)(#L\d+(?:-L?\d+)?)?\b/gi,
    (_match, filePath: string, lineAnchor?: string) => {
      const fullRef = `${filePath}${lineAnchor || ''}`;
      const anchorAttr = lineAnchor ? ` data-line-anchor="${escapeHtml(lineAnchor.replace(/^#/, ''))}"` : '';
      return `<a href="#" class="source-link" data-source-file="${escapeHtml(filePath)}"${anchorAttr}>${escapeHtml(fullRef)}</a>`;
    }
  );

  return html;
}
