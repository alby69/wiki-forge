import { WikiNote } from '../../core/types/wiki';
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

export function matchWikilinkQuery(lineText: string, posInLine: number): { from: number; query: string } | null {
  const beforeCursor = lineText.slice(0, posInLine);
  const match = beforeCursor.match(/\[\[([^\]]*)$/);
  if (!match) return null;
  const query = match[1];
  const from = posInLine - query.length;
  return { from, query };
}

export function filterWikilinkCompletions(notes: WikiNote[], query: string) {
  const q = query.toLowerCase();
  return notes
    .filter(n => n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
    .map(n => ({
      label: n.title,
      detail: n.id !== n.title ? n.id : undefined,
      apply: `${n.id}]]`,
    }));
}

export function wikilinkAutocompleteSource(getNotes: () => WikiNote[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos);
    const posInLine = context.pos - line.from;
    const matched = matchWikilinkQuery(line.text, posInLine);

    if (!matched) return null;

    const notes = getNotes();
    const completions = filterWikilinkCompletions(notes, matched.query);

    return {
      from: line.from + matched.from,
      options: completions,
      validFor: /^[^\]]*$/,
    };
  };
}
