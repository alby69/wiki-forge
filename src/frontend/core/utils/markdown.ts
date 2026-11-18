import { marked } from 'marked';
import { escapeHtml, sanitizeHtml } from './html';

marked.setOptions({ breaks: true, gfm: true });

/**
 * Turns references written inside a text node into navigable anchors.
 *
 * Only text (never tags/attributes) must be passed here: the previous
 * implementation ran these replacements over the whole HTML string, so it also
 * rewrote the `href="raw/....md#L3-L44"` of Markdown links, nesting an anchor
 * inside another anchor and leaving the visible garbage in the Sources
 * sections (see the "Sources" rendering bug).
 */
function transformInlineRefs(text: string): string {
  // [[wikilinks]] with optional #anchor and |label
  let out = text.replace(
    /\[\[([^\]\|#]+)(?:#([^\]\|]+))?(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, anchor?: string, label?: string) => {
      const t = target.trim();
      const labelText = (label ?? target).trim();
      const anchorAttr = anchor ? ` data-anchor="${escapeHtml(anchor.trim())}"` : '';
      return `<a href="#" class="wikilink" data-wikilink="${escapeHtml(t)}"${anchorAttr}>${escapeHtml(labelText)}</a>`;
    }
  );

  // Bare raw/ source references like raw/file.md#L10-L20
  out = out.replace(
    /\b(raw\/[^\s\)]+?\.md)(#L\d+(?:-L?\d+)?)?\b/gi,
    (_match, filePath: string, lineAnchor?: string) => {
      const fullRef = `${filePath}${lineAnchor || ''}`;
      const anchorAttr = lineAnchor ? ` data-line-anchor="${escapeHtml(lineAnchor.replace(/^#/, ''))}"` : '';
      return `<a href="#" class="source-link" data-source-file="${escapeHtml(filePath)}"${anchorAttr}>${escapeHtml(fullRef)}</a>`;
    }
  );

  // Bare wiki file references (e.g. "analisi/foo.md" or "foo.md")
  out = out.replace(
    /(?<!["`>/.\w-])\b((?:[a-zA-Z0-9][\w-]*\/)*[a-zA-Z0-9][\w-]*\.md)(?:#([^\s"<)\]]+))?/g,
    (_match, filePath: string, anchor?: string) => {
      const text = anchor ? `${filePath}#${anchor}` : filePath;
      return `<a href="#" class="note-link" data-note-ref="${escapeHtml(filePath)}">${escapeHtml(text)}</a>`;
    }
  );

  return out;
}

/**
 * Renders a wiki note's raw Markdown into safe, formatted HTML for the
 * read/explore viewer.
 *
 * - YAML frontmatter is stripped (it is metadata, not body content).
 * - HTML output is sanitized against XSS vectors.
 * - `[[wiki links]]` / `[[wiki link|label]]` become clickable anchors
 *   (`a.wikilink[data-wikilink="target"]`) that the app wires to navigation.
 * - Standard Markdown links to `raw/*.md#Lx-Ly` become source anchors
 *   (`a.source-link[data-source-file][data-line-anchor]`).
 * - Standard Markdown (headings, lists, bold, code, tables, …) is rendered.
 */
export function renderMarkdown(raw: string): string {
  const stripped = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  let html = stripped;

  // Convert <think>...</think> blocks into collapsible reasoning traces
  html = html.replace(
    /<think>([\s\S]*?)<\/think>/gi,
    (_m, trace: string) => `\n\n<details class="wf-think-trace" style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 12px;margin:12px 0;font-size:12px;color:#cbd5e1;"><summary style="cursor:pointer;font-weight:600;color:#38bdf8;">💭 Agent Reasoning Trace</summary><div class="wf-think-content" style="margin-top:8px;white-space:pre-wrap;font-family:monospace;color:#94a3b8;">${escapeHtml(trace.trim())}</div></details>\n\n`
  );

  html = marked.parse(html) as string;

  // Rewrite existing Markdown links that point to raw sources into viewer
  // anchors. Doing this at tag level (instead of matching path text) keeps the
  // href intact and only adds the data attributes the viewer listens to.
  html = html.replace(/<a\b([^>]*)>/gi, (tag: string, attrs: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
    if (!hrefMatch) return tag;
    const pathMatch = hrefMatch[1].match(/^(?:\.\/)?(raw\/[^#"]+?\.md)(?:#(L\d+(?:-L?\d+)?))?$/i);
    if (!pathMatch) return tag;

    const file = decodeURIComponent(pathMatch[1]);
    const anchorPart = pathMatch[2];
    const anchorAttr = anchorPart ? ` data-line-anchor="${escapeHtml(anchorPart)}"` : '';
    const titleMatch = attrs.match(/\btitle\s*=\s*"([^"]*)"/i);
    const titleAttr = titleMatch ? ` title="${titleMatch[1]}"` : '';
    return `<a href="#" class="source-link" data-source-file="${escapeHtml(file)}"${anchorAttr}${titleAttr}>`;
  });

  // Inline references are expanded on text nodes only, skipping <code>/<pre>,
  // so syntax examples and real attributes are never rewritten.
  const codeSplit = html.split(/(<(?:code|pre)\b[\s\S]*?<\/(?:code|pre)>)/i);
  for (let i = 0; i < codeSplit.length; i += 2) {
    codeSplit[i] = codeSplit[i].replace(/>([^<]+)</g, (_m, text: string) => `>${transformInlineRefs(text)}<`);
  }
  html = codeSplit.join('');

  return sanitizeHtml(html);
}
