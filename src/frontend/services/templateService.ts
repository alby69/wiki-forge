/**
 * Template service for the graphical template workflow.
 *
 * Built-in templates mirror the Markdown files under `templates/` in the
 * repository, with OKF v0.2 frontmatter so a note created from them is valid
 * straight away. User templates are persisted in localStorage (browser-local,
 * so the feature works without the API); the storage helpers are defensive so
 * the module can also be imported in Node tests.
 */

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

const TEMPLATES_KEY = 'wiki-forge:templates';
const DEFAULT_TEMPLATE_KEY = 'wiki-forge:default-template';
export const DEFAULT_TEMPLATE_ID = 'builtin:article';

const okfFrontmatter = (type: string, tags: string): string =>
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

/** Built-ins seeded from the repository `templates/` folder. */
export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
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

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'template';
}

function readUserTemplates(): TemplateDefinition[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TemplateDefinition => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<TemplateDefinition>;
      return (
        typeof candidate.id === 'string' &&
        candidate.id.startsWith('user:') &&
        typeof candidate.name === 'string' &&
        typeof candidate.content === 'string'
      );
    });
  } catch {
    return [];
  }
}

function writeUserTemplates(templates: TemplateDefinition[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    /* storage unavailable or full: keep the in-memory result usable */
  }
}

export function listTemplates(): TemplateDefinition[] {
  return [...BUILT_IN_TEMPLATES, ...readUserTemplates()];
}

export function getTemplate(id: string): TemplateDefinition | undefined {
  return listTemplates().find(template => template.id === id);
}

export function getDefaultTemplateId(): string {
  const store = storage();
  try {
    const stored = store?.getItem(DEFAULT_TEMPLATE_KEY);
    if (stored && listTemplates().some(template => template.id === stored)) return stored;
  } catch {
    /* fall through to the built-in default */
  }
  return DEFAULT_TEMPLATE_ID;
}

export function setDefaultTemplateId(id: string): boolean {
  if (!getTemplate(id)) return false;
  try {
    storage()?.setItem(DEFAULT_TEMPLATE_KEY, id);
  } catch {
    /* best effort */
  }
  return true;
}

/** Create or update a user template. Built-in ids are never overwritten. */
export function saveTemplate(draft: TemplateDraft): TemplateDefinition {
  const name = draft.name.trim() || 'Nuovo template';
  const description = (draft.description ?? '').trim();
  const templates = readUserTemplates();
  const existingId = draft.id && draft.id.startsWith('user:') ? draft.id : undefined;
  const index = existingId ? templates.findIndex(template => template.id === existingId) : -1;
  const template: TemplateDefinition = {
    id: index >= 0 ? existingId! : `user:${slugify(name)}`,
    name,
    description,
    content: draft.content,
    builtIn: false,
  };
  if (index >= 0) templates[index] = template;
  else templates.push(template);
  writeUserTemplates(templates);
  return template;
}

/** Delete a user template. Returns false for built-ins and unknown ids. */
export function deleteTemplate(id: string): boolean {
  if (!id.startsWith('user:')) return false;
  const templates = readUserTemplates();
  const remaining = templates.filter(template => template.id !== id);
  if (remaining.length === templates.length) return false;
  writeUserTemplates(remaining);
  if (getDefaultTemplateId() === id) {
    try {
      storage()?.removeItem(DEFAULT_TEMPLATE_KEY);
    } catch {
      /* best effort */
    }
  }
  return true;
}

/** Keep a substituted title valid inside a quoted YAML scalar. */
function escapeQuotedFrontmatterValues(content: string): string {
  return content.replace(
    /^(\s*(?:title|description):\s*")(.*?)("\s*)$/gm,
    (_match, prefix: string, value: string, suffix: string) =>
      prefix + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + suffix
  );
}

/** Replace recognised placeholders; unknown ones are left for the author. */
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

export const templateService = {
  listTemplates,
  getTemplate,
  getDefaultTemplateId,
  setDefaultTemplateId,
  saveTemplate,
  deleteTemplate,
  renderTemplate,
};
