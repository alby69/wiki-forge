/**
 * Small HTML-escaping helper.
 *
 * User-controlled content (note titles, Markdown bodies) is interpolated into
 * innerHTML strings when rendering the UI. Escaping prevents broken markup and
 * accidental HTML/script injection from note content.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes HTML string output to prevent XSS attacks while preserving safe Markdown HTML structure.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return html
    // Strip dangerous tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // Strip self-closing dangerous tags
    .replace(/<(?:script|style|iframe|object|embed|link)\b[^>]*\/?>/gi, '')
    // Strip inline event handlers like onerror=..., onload=...
    .replace(/(\s+)on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Neutralize javascript: URIs in href or src
    .replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '$1="#"');
}
