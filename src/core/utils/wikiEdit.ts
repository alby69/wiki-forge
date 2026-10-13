/**
 * Parsing helpers for the deterministic "edit proposal" protocol.
 *
 * Agents propose concrete changes to a wiki note by emitting one fenced
 * `wiki-edit` block per change:
 *
 * ```wiki-edit
 * file: capitoli/01-introduzione.md
 * find: |
 *   text currently in the file
 * replace: |
 *   new text
 * ```
 *
 * The block is parsed back into a structured `WikiEdit` and applied by the
 * backend with an exact (single-occurrence) string replacement, so the write
 * does not depend on the LLM re-generating the whole file.
 */

export interface WikiEdit {
  /** Note path, relative to the wiki directory (or the project root). */
  file: string;
  /** Exact text to locate; must match once. */
  find: string;
  /** Replacement text. */
  replace: string;
}

function stripTrailingNewlines(value: string): string {
  return value.replace(/\n+$/, '');
}

function parseBlockFields(body: string): Record<string, string> {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const fields: Record<string, string> = {};
  let i = 0;

  while (i < lines.length) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/.exec(lines[i]);
    if (!match) {
      i++;
      continue;
    }

    const key = match[1].toLowerCase();
    const rest = match[2];

    if (rest === '|' || rest === '|-' || rest === '|+') {
      const collected: string[] = [];
      i++;
      while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === '') {
          collected.push('');
          i++;
          continue;
        }
        if (/^[ \t]/.test(line)) {
          collected.push(line);
          i++;
          continue;
        }
        break;
      }

      const nonEmpty = collected.filter(line => line.trim() !== '');
      const indent = nonEmpty.length > 0
        ? Math.min(...nonEmpty.map(line => (line.match(/^[ \t]*/) as RegExpMatchArray)[0].length))
        : 0;
      fields[key] = stripTrailingNewlines(collected.map(line => line.slice(indent)).join('\n'));
    } else {
      fields[key] = rest;
      i++;
    }
  }

  return fields;
}

/** Extract every well-formed `wiki-edit` proposal from a message. */
export function parseWikiEdits(text: string): WikiEdit[] {
  if (!text) return [];

  const edits: WikiEdit[] = [];
  const fence = /```wiki-edit[^\n]*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    const fields = parseBlockFields(match[1]);
    if (fields.file === undefined || fields.find === undefined || fields.replace === undefined) {
      continue;
    }
    const file = fields.file.trim();
    if (!file || fields.find.length === 0) {
      continue;
    }
    edits.push({ file, find: fields.find, replace: fields.replace });
  }

  return edits;
}

/** Remove `wiki-edit` blocks from a message, for plain-text rendering. */
export function stripWikiEdits(text: string): string {
  if (!text) return '';
  return text.replace(/```wiki-edit[^\n]*\r?\n[\s\S]*?```\s?\n?/g, '').trimEnd();
}

const AFFIRMATIVE_WORDS = new Set([
  'si', 'sì', 'yes', 'yep', 'yup', 'ok', 'okay', 'okey', 'va', 'bene', 'dai', 'certo',
  'procedi', 'procedo', 'procediamo', 'applica', 'applicare', 'applica', 'confermo',
  'conferma', 'confermo', 'perfetto', 'giusto', 'esatto', 'vai', 'pure', 'allora', 'so',
  'go', 'ahead', 'apply', 'applies', 'proceed', 'do', 'it', 'them', 'yes', 'please',
]);

/**
 * True when the user message is a short confirmation, so the pending edits from
 * the previous assistant message can be applied deterministically instead of
 * being sent to the LLM as a new question.
 */
export function isAffirmative(text: string): boolean {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0 || words.length > 4) return false;
  return words.every(word => AFFIRMATIVE_WORDS.has(word));
}
