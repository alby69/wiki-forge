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

  let html = stripped;

  // Convert <think>...</think> blocks into collapsible reasoning traces
  html = html.replace(
    /<think>([\s\S]*?)<\/think>/gi,
    (_m, trace: string) => `\n\n<details class="wf-think-trace" style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 12px;margin:12px 0;font-size:12px;color:#cbd5e1;"><summary style="cursor:pointer;font-weight:600;color:#38bdf8;">💭 Agent Reasoning Trace</summary><div class="wf-think-content" style="margin-top:8px;white-space:pre-wrap;font-family:monospace;color:#94a3b8;">${escapeHtml(trace.trim())}</div></details>\n\n`
  );

  html = marked.parse(html) as string;

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

  // Turn bare wiki file references the agent may write (e.g. "analisi/foo.md"
  // or just "foo.md") into clickable note links. Tokens already embedded in
  // href values, code spans, or existing anchors are skipped.
  html = html.replace(
    /(?<!["`>/.\w-])\b((?:[a-zA-Z0-9][\w-]*\/)*[a-zA-Z0-9][\w-]*\.md)(?:#([^\s"<)\]]+))?/g,
    (_match, filePath: string, anchor?: string) => {
      const text = anchor ? `${filePath}#${anchor}` : filePath;
      return `<a href="#" class="note-link" data-note-ref="${escapeHtml(filePath)}">${escapeHtml(text)}</a>`;
    }
  );

  return html;
}
