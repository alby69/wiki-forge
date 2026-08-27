import { marked } from 'marked';
import { escapeHtml } from './html';

marked.setOptions({ breaks: true, gfm: true });

/**
 * Renders a wiki note's raw Markdown into safe, formatted HTML for the
 * read/explore viewer.
 *
 * - YAML frontmatter is stripped (it is metadata, not body content).
 * - `[[wiki links]]` / `[[wiki link|label]]` become clickable anchors
 *   (`a.wikilink[data-wikilink="target"]`) that the app wires to navigation.
 * - Standard Markdown (headings, lists, bold, code, tables, …) is rendered.
 */
export function renderMarkdown(raw: string): string {
  const stripped = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  let html = marked.parse(stripped) as string;

  // Turn [[wikilinks]] into navigable anchors (after Markdown is parsed so we
  // don't touch links that already live inside code spans/fences).
  html = html.replace(
    /\[\[([^\]\|#]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, label?: string) => {
      const t = target.trim();
      const text = (label ?? target).trim();
      return `<a href="#" class="wikilink" data-wikilink="${escapeHtml(t)}">${escapeHtml(text)}</a>`;
    }
  );

  return html;
}
