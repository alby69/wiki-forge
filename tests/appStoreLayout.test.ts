import assert from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import { appStore } from '../src/store/appStore';
import { MainLayout } from '../src/components/ui/MainLayout';
class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  [name: string]: any;
}

class FakeHTMLElement {
  style: Record<string, string> = {};
  children: FakeHTMLElement[] = [];
  id: string = '';
  innerHTML: string = '';

  querySelector(selector: string): FakeHTMLElement | null {
    if (selector === '#simple-mode-slot') {
      const el = new FakeHTMLElement();
      el.id = 'simple-mode-slot';
      return el;
    }
    const el = new FakeHTMLElement();
    return el;
  }

  querySelectorAll(_selector: string): FakeHTMLElement[] {
    return [];
  }

  addEventListener(): void {}
}

describe('AppStore & Layout UI Test Suite', () => {
  beforeEach(() => {
    const fakeDocument = {
      createElement: (_tag: string) => new FakeHTMLElement(),
      getElementById: (_id: string) => new FakeHTMLElement(),
      body: new FakeHTMLElement(),
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    (global as any).document = fakeDocument;
    (global as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      innerWidth: 1024,
      innerHeight: 768,
    };
    (global as any).HTMLElement = FakeHTMLElement;
    (global as any).localStorage = new MemoryStorage();
    localStorage.clear();
  });

  test('appStore saves and restores viewMode atomically via localStorage', () => {
    appStore.setViewMode('graph');
    assert.strictEqual(appStore.getState().viewMode, 'graph');
    assert.strictEqual(localStorage.getItem('wiki-forge:view-mode'), 'graph');

    appStore.setViewMode('split');
    assert.strictEqual(appStore.getState().viewMode, 'split');
    assert.strictEqual(localStorage.getItem('wiki-forge:view-mode'), 'split');
  });

  test('MainLayout creates simple-mode-slot and layout containers intact', () => {
    const root = document.getElementById('app')!;
    const layout = new MainLayout(root);

    assert.ok(layout.simpleModeSlot);
    assert.strictEqual(layout.simpleModeSlot.id, 'simple-mode-slot');
    assert.ok(layout.sidebarContainer);
    assert.ok(layout.editorContainer);
    assert.ok(layout.graphContainer);

    layout.setViewMode('editor');
    assert.strictEqual(layout.editorContainer.style.display, 'flex');
    assert.strictEqual(layout.graphContainer.style.display, 'none');

    layout.setViewMode('graph');
    assert.strictEqual(layout.editorContainer.style.display, 'none');
    assert.strictEqual(layout.graphContainer.style.display, 'block');

    layout.setViewMode('split');
    assert.strictEqual(layout.editorContainer.style.display, 'flex');
    assert.strictEqual(layout.graphContainer.style.display, 'block');
  });
});
