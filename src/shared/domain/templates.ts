export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
  builtIn: boolean;
}

export interface TemplateDraft {
  id?: string;
  name: string;
  description?: string;
  content: string;
}

export interface TemplateRenderVars {
  title: string;
  date?: string;
  id?: string;
  author?: string;
  chapterNumber?: string;
  subtitle?: string;
}

export const DEFAULT_TEMPLATE_ID = 'builtin:article';

export const okfFrontmatter = (type: string, tags: string): string =>
  [
    '---',
    `type: ${type}`,
    'title: "{{TITLE}}"',
    'description: "{{TITLE}} — descrizione da completare."',
    'resource: ""',
    `tags: [${tags}]`,
    'status: draft',
    'generated:',
    '  by: human:alby69',
    '  at: "{{DATE}}"',
    'verified: []',
    'sources: []',
    '---',
    '',
  ].join('\n');

export const CANONICAL_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'builtin:article',
    name: 'Articolo (OKF)',
    description: 'Articolo wiki standard: riepilogo, sezioni, correlati e fonti.',
    builtIn: true,
    content: `${okfFrontmatter('Concept', 'scope/wiki, layer/manual, lang/it')}# {{TITLE}}

{{2-4 righe di introduzione che spiegano il concetto o l'entità}}

## Summary

- {{punto 1}}
- {{punto 2}}
- {{punto 3}}

## {{Sezione 1}}

{{contenuto}}

## Related

- [[articolo-correlato-1]]
- [[articolo-correlato-2]]

## Sources

- [{{nome-fonte}}](raw/{{file-fonte}}_COMPILED.md)
`,
  },
  {
    id: 'builtin:thesis-chapter',
    name: 'Capitolo tesi (OKF)',
    description: 'Capitolo di tesi con introduzione, argomenti e conclusioni.',
    builtIn: true,
    content: `${okfFrontmatter('Reference', 'scope/thesis, layer/manual, type/capitolo, lang/it')}# Capitolo {{CHAPTER_NUMBER}}: {{TITLE}}

## Introduzione al Capitolo

{{Introduzione esecutiva dell'argomento e degli obiettivi della ricerca}}

## Core Syntheses & Arguments

{{Discussione accademica sintetizzata dalle note wiki mature}}

## Conclusioni del Capitolo

{{Conclusioni principali e transizione al capitolo successivo}}

## Referenze e Fonti Utilizzate

- [[sintesi-1]]
- [[fonte-1]]
`,
  },
  {
    id: 'builtin:thesis-question',
    name: 'Domanda tesi (OKF)',
    description: 'Domanda di ricerca con contesto, sintesi generate e concetti collegati.',
    builtIn: true,
    content: `${okfFrontmatter('Reference', 'scope/thesis, layer/manual, type/domanda, lang/it')}# {{TITLE}}

**Data della domanda:** {{DATE}}
**Autore / Ricercatore:** {{AUTHOR}}

## Context / Premise

{{Perché questa domanda viene posta e quali fonti l'hanno generata}}

## Generated Syntheses

- [[sintesi-generata-1]]

## Related Concepts

- [[concetto-1]]
- [[concetto-2]]
`,
  },
  {
    id: 'builtin:thesis-synthesis',
    name: 'Sintesi tesi (OKF)',
    description: 'Sintesi di ricerca con finding chiave, discussione e fonti.',
    builtIn: true,
    content: `${okfFrontmatter('Reference', 'scope/thesis, layer/manual, type/sintesi, lang/it')}# {{TITLE}}

{{2-4 righe di introduzione al concetto o al finding}}

## Summary

- {{finding 1}}
- {{finding 2}}
- {{finding 3}}

## Synthesis & Discussion

{{Discussione dettagliata della sintesi}}

## Related

- [[concetto-correlato-1]]
- [[concetto-correlato-2]]

## Sources

- [{{id-fonte}}](raw/{{file-fonte}}_COMPILED.md#L1-L50)
`,
  },
  {
    id: 'builtin:reveal',
    name: 'Presentazione reveal (OKF)',
    description: 'Slide Markdown per reveal.js con claim, evidenze e conclusioni.',
    builtIn: true,
    content: `${okfFrontmatter('Reference', 'scope/slides, layer/manual, lang/it')}# {{TITLE}}
## {{SUBTITLE}}

---

## Executive Summary
- {{punto 1}}
- {{punto 2}}
- {{punto 3}}

---

## Key Claims & Evidence
| Claim | Source Anchor | Status |
|---|---|---|
| {{claim 1}} | {{ancora 1}} | OKF Verified |

---

## Conclusion & Future Work
- {{conclusione}}
`,
  },
];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'template';
}

function escapeQuotedFrontmatterValues(content: string): string {
  return content.replace(
    /^(\s*(?:title|description):\s*")(.*?)("\s*)$/gm,
    (_match, prefix: string, value: string, suffix: string) =>
      prefix + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + suffix
  );
}

export function renderTemplate(content: string, vars: TemplateRenderVars): string {
  const date = vars.date ?? new Date().toISOString().slice(0, 10);
  const map: Record<string, string> = {
    TITLE: vars.title,
    CHAPTER_TITLE: vars.title,
    QUESTION_TITLE: vars.title,
    DATE: date,
    ID: vars.id ?? slugify(vars.title),
    AUTHOR: vars.author ?? 'human:alby69',
    CHAPTER_NUMBER: vars.chapterNumber ?? '1',
    SUBTITLE: vars.subtitle ?? vars.title,
  };
  const rendered = content.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : match
  );
  return escapeQuotedFrontmatterValues(rendered);
}
