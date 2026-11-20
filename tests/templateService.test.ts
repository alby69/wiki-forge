import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  deleteTemplate,
  getDefaultTemplateId,
  getTemplate,
  listTemplates,
  renderTemplate,
  saveTemplate,
  setDefaultTemplateId,
} from '@frontend/services/templateService';

function useStorage(): Map<string, string> {
  const values = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  return values;
}

describe('Template service', () => {
  beforeEach(() => { useStorage(); });

  it('ships OKF v0.2 built-in templates mirroring templates/*.md', () => {
    assert.ok(BUILT_IN_TEMPLATES.length >= 5);
    assert.ok(BUILT_IN_TEMPLATES.some(template => template.id === DEFAULT_TEMPLATE_ID));
    for (const template of BUILT_IN_TEMPLATES) {
      assert.match(template.content, /^type: /m, `${template.id} has an OKF type`);
      assert.match(template.content, /^status: draft$/m, `${template.id} is a draft`);
      assert.match(template.content, /^  by: human:alby69$/m, `${template.id} has a valid actor`);
      assert.match(template.content, /^  at: "\{\{DATE\}\}"$/m, `${template.id} stamps the date`);
      assert.match(template.content, /^sources: \[\]$/m, `${template.id} has a sources list`);
    }
  });

  it('renders known placeholders and keeps unknown ones for the author', () => {
    const rendered = renderTemplate(
      '# {{TITLE}}\nData: {{DATE}}\nCapitolo {{CHAPTER_NUMBER}}: {{CHAPTER_TITLE}}\n{{CUSTOM}}',
      { title: 'La mia nota', date: '2026-11-20', chapterNumber: '3' }
    );
    assert.equal(
      rendered,
      '# La mia nota\nData: 2026-11-20\nCapitolo 3: La mia nota\n{{CUSTOM}}'
    );
  });

  it('escapes quotes in the rendered YAML frontmatter', () => {
    const rendered = renderTemplate('---\ntitle: "{{TITLE}}"\n---\n# {{TITLE}}', {
      title: 'Studio "OKF"',
    });
    assert.equal(rendered, '---\ntitle: "Studio \\"OKF\\""\n---\n# Studio "OKF"');
  });

  it('creates, updates and deletes user templates', () => {
    const created = saveTemplate({ name: 'Report', description: 'Un report', content: '# {{TITLE}}' });
    assert.equal(created.id, 'user:report');
    assert.equal(created.builtIn, false);
    assert.equal(getTemplate('user:report')?.name, 'Report');

    const updated = saveTemplate({ id: created.id, name: 'Report v2', content: '# {{TITLE}}\nAggiornato' });
    assert.equal(updated.id, 'user:report');
    assert.equal(listTemplates().filter(template => template.id === 'user:report').length, 1);
    assert.equal(getTemplate('user:report')?.name, 'Report v2');

    assert.equal(deleteTemplate(created.id), true);
    assert.equal(getTemplate('user:report'), undefined);
    assert.equal(deleteTemplate(DEFAULT_TEMPLATE_ID), false, 'built-ins cannot be deleted');
  });

  it('persists and validates the default template choice', () => {
    assert.equal(getDefaultTemplateId(), DEFAULT_TEMPLATE_ID);
    const custom = saveTemplate({ name: 'Thesis', content: '# {{TITLE}}' });
    assert.equal(setDefaultTemplateId(custom.id), true);
    assert.equal(getDefaultTemplateId(), custom.id);
    assert.equal(setDefaultTemplateId('missing'), false);
    assert.equal(getDefaultTemplateId(), custom.id);

    assert.equal(deleteTemplate(custom.id), true);
    assert.equal(getDefaultTemplateId(), DEFAULT_TEMPLATE_ID, 'deleting the default resets it');
  });

  it('ignores malformed persisted data', () => {
    const values = useStorage();
    values.set('wiki-forge:templates', '{not json');
    assert.equal(listTemplates().length, BUILT_IN_TEMPLATES.length);
  });
});
