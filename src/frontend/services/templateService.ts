import { api } from '@frontend/core/apiFacade';
import {
  CANONICAL_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  renderTemplate as renderCanonicalTemplate,
  slugify,
  type TemplateDefinition,
  type TemplateDraft,
  type TemplateRenderVars,
} from '@shared/domain/templates';

export {
  DEFAULT_TEMPLATE_ID,
  renderCanonicalTemplate as renderTemplate,
  slugify,
  type TemplateDefinition,
  type TemplateDraft,
  type TemplateRenderVars,
};

export const BUILT_IN_TEMPLATES = CANONICAL_TEMPLATES;

const TEMPLATES_KEY = 'wiki-forge:templates';
const DEFAULT_TEMPLATE_KEY = 'wiki-forge:default-template';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
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
    return;
  }
}

export function listTemplates(): TemplateDefinition[] {
  return [...BUILT_IN_TEMPLATES, ...readUserTemplates()];
}

export async function loadCanonicalTemplates(): Promise<TemplateDefinition[]> {
  try {
    const json = await api.dispatch('templates.list', {});
    return json.success && Array.isArray(json.templates) ? json.templates : BUILT_IN_TEMPLATES;
  } catch {
    return BUILT_IN_TEMPLATES;
  }
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
    return DEFAULT_TEMPLATE_ID;
  }
  return DEFAULT_TEMPLATE_ID;
}

export function setDefaultTemplateId(id: string): boolean {
  if (!getTemplate(id)) return false;
  try {
    storage()?.setItem(DEFAULT_TEMPLATE_KEY, id);
  } catch {
    return true;
  }
  return true;
}

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
      return true;
    }
  }
  return true;
}

export const templateService = {
  listTemplates,
  loadCanonicalTemplates,
  getTemplate,
  getDefaultTemplateId,
  setDefaultTemplateId,
  saveTemplate,
  deleteTemplate,
  renderTemplate: renderCanonicalTemplate,
};
