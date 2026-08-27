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
