import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NewDocumentModal, buildFileName, normalizeFolderPath, type NewDocumentResult } from '@frontend/components/templates/NewDocumentModal';
import { TemplateManagerModal } from '@frontend/components/templates/TemplateManagerModal';
import { getDefaultTemplateId, getTemplate } from '@frontend/services/templateService';

type Listener = (event: any) => void;

class MockEl {
  innerHTML = '';
  hidden = false;
  value = '';
  textContent = '';
  disabled = false;
  dataset: Record<string, string> = {};
  listeners = new Map<string, Listener[]>();

  constructor(public readonly selector: string, private registry: Map<string, MockEl>) {
    registry.set(selector, this);
  }

  addEventListener(type: string, cb: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }

  focus(): void {}
  remove(): void {}
  setAttribute(): void {}

  emit(type: string, target: MockEl = this): void {
    for (const cb of this.listeners.get(type) ?? []) {
      cb({ target, currentTarget: this, key: undefined });
    }
  }
}

function createHost() {
  const registry = new Map<string, MockEl>();
  let html = '';
  const host = {
    hidden: true,
    get innerHTML(): string { return html; },
    set innerHTML(value: string) {
      html = value;
      registry.clear();
      for (const match of value.matchAll(/id="([^"]+)"/g)) new MockEl(`#${match[1]}`, registry);
      for (const match of value.matchAll(/data-role="([^"]+)"/g)) new MockEl(`[data-role="${match[1]}"]`, registry);
      if (value.includes('class="wf-modal')) new MockEl('.wf-modal', registry);
      for (const match of value.matchAll(/data-template-(default|edit|delete)="([^"]+)"/g)) {
        const element = new MockEl(`[data-template-${match[1]}="${match[2]}"]`, registry);
        const key = `template${match[1][0].toUpperCase()}${match[1].slice(1)}`;
        element.dataset[key] = match[2];
      }
    },
    querySelector(selector: string): MockEl | null {
      return registry.get(selector) ?? null;
    },
    querySelectorAll(selector: string): MockEl[] {
      const attribute = selector.slice(1, -1);
      return Array.from(registry.values()).filter(element => element.selector.startsWith(`[${attribute}="`));
    },
  } as unknown as HTMLElement;
  return { host, registry };
}

function useStorage(): Map<string, string> {
  const values = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  return values;
}

describe('Template UI helpers', () => {
  it('normalises wiki paths and keeps file names inside the wiki', () => {
    assert.equal(normalizeFolderPath('wiki/guida/approfondimenti/'), 'guida/approfondimenti');
    assert.equal(normalizeFolderPath('/wiki//guida'), 'guida');
    assert.equal(normalizeFolderPath(''), '');
    assert.equal(buildFileName('../nuova nota.md'), 'nuova nota.md');
    assert.equal(buildFileName('wiki/guida/nota'), 'nota.md');
  });
});

describe('New document dialog', () => {
  beforeEach(() => { useStorage(); });

  it('renders name, editable path, template choice and a preview', () => {
    const { host, registry } = createHost();
    const modal = new NewDocumentModal({ container: host, defaultPath: 'wiki/guida', onSubmit: () => {} });
    modal.open();
    assert.equal(modal.isOpen, true);
    assert.ok(registry.get('#new-doc-name'));
    assert.ok(host.innerHTML.includes('value="guida"'), 'current path is prefilled and editable');
    assert.ok(host.innerHTML.includes('id="new-doc-template"'));
    assert.ok(registry.get('#new-doc-preview')!.value.includes('# Titolo'), 'default template preview is rendered');
    modal.close();
  });

  it('creates a document from the chosen template with the entered path', async () => {
    const { host, registry } = createHost();
    const results: NewDocumentResult[] = [];
    const modal = new NewDocumentModal({
      container: host,
      onSubmit: value => { results.push(value); },
    });
    modal.open('wiki');

    registry.get('#new-doc-name')!.value = 'Architettura / OKF';
    registry.get('#new-doc-path')!.value = 'wiki/guida/approfondimenti/';
    registry.get('#new-doc-template')!.value = getDefaultTemplateId();
    registry.get('#new-doc-submit')!.emit('click');
    await Promise.resolve();

    assert.equal(results.length, 1, 'onSubmit was called');
    const result = results[0];
    assert.equal(result.folderPath, 'guida/approfondimenti');
    assert.equal(result.fileName, 'OKF.md');
    assert.ok(result.content.includes('# Architettura / OKF'));
    assert.ok(result.content.includes('status: draft'));
    assert.equal(modal.isOpen, false);
  });

  it('requires a name before creating the document', () => {
    const { host, registry } = createHost();
    let called = false;
    const modal = new NewDocumentModal({ container: host, onSubmit: () => { called = true; } });
    modal.open();
    registry.get('#new-doc-submit')!.emit('click');
    assert.equal(called, false);
    assert.equal(registry.get('#new-doc-error')!.textContent, 'Inserisci il nome del documento.');
  });
});

describe('Template manager dialog', () => {
  beforeEach(() => { useStorage(); });

  it('lists built-ins and saves a user template', () => {
    const { host, registry } = createHost();
    const modal = new TemplateManagerModal({ container: host });
    modal.open();

    assert.ok(host.innerHTML.includes('Articolo (OKF)'));
    assert.ok(registry.get('[data-template-default="builtin:article"]'));

    registry.get('#template-name')!.value = 'Checklist';
    registry.get('#template-content')!.value = '# {{TITLE}}\n\n- [ ] da fare';
    registry.get('#template-save')!.emit('click');

    assert.equal(getTemplate('user:checklist')?.name, 'Checklist');
    assert.ok(host.innerHTML.includes('Checklist'));
    modal.close();
  });

  it('changes the default template from the list', () => {
    const { host, registry } = createHost();
    const modal = new TemplateManagerModal({ container: host });
    modal.open();
    registry.get('[data-template-default="builtin:thesis-chapter"]')!.emit('click');
    assert.equal(getDefaultTemplateId(), 'builtin:thesis-chapter');
    modal.close();
  });
});
