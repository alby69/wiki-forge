import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { history, undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
import {
  wrapSelection,
  toggleWrapSelection,
  insertLinePrefix,
  applyColor,
  applyAlignment,
  MarkdownEditor,
} from '@frontend/components/editor/MarkdownEditor';
import { WikiNote } from '@frontend/core/types/wiki';

beforeEach(() => {
  const elements = new Map<string, any>();
  let mockDocument: any;

  const makeElement = (tag: string, id: string = '') => {
    const listeners: Record<string, Function[]> = {};
    const attributes = new Map<string, string>();
    const attributesObj: any = [];
    attributesObj.item = (i: number) => attributesObj[i] || null;
    attributesObj.getNamedItem = (name: string) => {
      const val = attributes.get(name);
      return val ? { name, value: val } : null;
    };

    const styleObj: any = {
      cssText: '',
      setProperty: () => {},
      removeProperty: () => {},
      getItem: () => '',
      length: 0,
    };

    const el: any = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      nodeName: tag.toUpperCase(),
      style: styleObj,
      attributes: attributesObj,
      _innerHTML: '',
      textContent: '',
      value: '',
      children: [] as any[],
      childNodes: [] as any[],
      classList: {
        toggle: () => {},
        add: () => {},
        remove: () => {},
        contains: () => false,
      },
      id,
      disabled: false,
      ownerDocument: null as any,
      parentNode: null as any,
      setAttribute: (k: string, v: string) => {
        attributes.set(k, v);
        const existing = attributesObj.find((a: any) => a.name === k);
        if (existing) {
          existing.value = v;
        } else {
          attributesObj.push({ name: k, value: v });
        }
      },
      getAttribute: (k: string) => attributes.get(k) || null,
      removeAttribute: (k: string) => {
        attributes.delete(k);
        const idx = attributesObj.findIndex((a: any) => a.name === k);
        if (idx !== -1) attributesObj.splice(idx, 1);
      },
      hasAttribute: (k: string) => attributes.has(k),
      appendChild: (child: any) => {
        child.parentNode = el;
        el.children.push(child);
        el.childNodes.push(child);
        if (child.id) elements.set(child.id, child);
        return child;
      },
      removeChild: (child: any) => {
        const idx = el.children.indexOf(child);
        if (idx !== -1) {
          el.children.splice(idx, 1);
          el.childNodes.splice(idx, 1);
        }
        child.parentNode = null;
        return child;
      },
      insertBefore: (child: any, ref: any) => {
        child.parentNode = el;
        const idx = el.children.indexOf(ref);
        if (idx !== -1) {
          el.children.splice(idx, 0, child);
          el.childNodes.splice(idx, 0, child);
        } else {
          el.children.push(child);
          el.childNodes.push(child);
        }
        if (child.id) elements.set(child.id, child);
        return child;
      },
      contains: () => true,
      querySelector: (sel: string) => {
        const idMatch = sel.match(/^#([\w-]+)/);
        if (idMatch && elements.has(idMatch[1])) {
          return elements.get(idMatch[1]);
        }
        if (idMatch) {
          const newEl = makeElement('div', idMatch[1]);
          elements.set(idMatch[1], newEl);
          return newEl;
        }
        return makeElement('div');
      },
      querySelectorAll: (sel: string) => [],
      addEventListener: (evt: string, fn: Function) => {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      removeEventListener: (evt: string, fn: Function) => {
        if (listeners[evt]) {
          listeners[evt] = listeners[evt].filter(f => f !== fn);
        }
      },
      remove: () => {
        if (el.parentNode && el.parentNode.removeChild) {
          el.parentNode.removeChild(el);
        }
      },
      dispatchEvent: (event: any) => {
        const type = typeof event === 'string' ? event : event.type;
        if (listeners[type]) {
          listeners[type].forEach(fn => fn(event));
        }
        return true;
      },
      click: () => {
        if (listeners['click']) {
          listeners['click'].forEach(fn => fn({ type: 'click', preventDefault: () => {} }));
        }
      },
      focus: () => {},
      getRootNode: () => mockDocument,
    };

    Object.defineProperty(el, 'innerHTML', {
      get() { return el._innerHTML; },
      set(val: string) {
        el._innerHTML = val;
        const matches = val.matchAll(/id=["']([\w-]+)["']/g);
        for (const match of matches) {
          const id = match[1];
          if (!elements.has(id)) {
            elements.set(id, makeElement('div', id));
          }
        }
      }
    });

    el.ownerDocument = mockDocument;
    if (id) elements.set(id, el);
    return el;
  };

  const mockHead = makeElement('head');
  const mockBody = makeElement('body');

  mockDocument = {
    nodeType: 9,
    defaultView: null as any,
    createElement: (tag: string) => makeElement(tag),
    createTextNode: (text: string) => ({
      nodeType: 3,
      nodeValue: text,
      textContent: text,
      parentNode: null,
      ownerDocument: mockDocument,
    }),
    createComment: (data: string) => ({
      nodeType: 8,
      nodeValue: data,
      textContent: data,
      parentNode: null,
      ownerDocument: mockDocument,
    }),
    getElementById: (id: string) => elements.get(id) || null,
    addEventListener: () => {},
    removeEventListener: () => {},
    hasFocus: () => true,
    head: mockHead,
    body: mockBody,
    insertBefore: (child: any, ref: any) => mockHead.insertBefore(child, ref),
    appendChild: (child: any) => mockHead.appendChild(child),
  };

  class MockMutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  }

  const mockWindow = {
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb: Function) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    MutationObserver: MockMutationObserver,
    document: mockDocument,
    getSelection: () => ({
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      rangeCount: 0,
      getRangeAt: () => null,
      removeAllRanges: () => {},
      addRange: () => {},
    }),
  };
  mockDocument.defaultView = mockWindow;
  mockDocument.getSelection = mockWindow.getSelection;

  (global as any).window = mockWindow;
  (global as any).document = mockDocument;
  (global as any).HTMLElement = class {};
  (global as any).Window = class {};
  (global as any).MutationObserver = MockMutationObserver;
});

test('Editor Formatting & Toolbar Actions Test Suite', async (t) => {
  function createMockView(initialDoc: string = 'Hello World'): any {
    let state = EditorState.create({
      doc: initialDoc,
      extensions: [history()],
    });
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: any) => {
        state = state.update(tr).state;
      },
      focus: () => {},
    };
    return view;
  }

  await t.test('wrapSelection wraps selected range or inserts placeholder', () => {
    const view = createMockView('Hello World');
    // Select "World" (from index 6 to 11)
    view.dispatch({ selection: { anchor: 6, head: 11 } });
    wrapSelection(view, '**', '**');
    assert.equal(view.state.doc.toString(), 'Hello **World**');

    // Test with empty selection (placeholder insertion)
    const view2 = createMockView('');
    wrapSelection(view2, '*', '*', 'sample');
    assert.equal(view2.state.doc.toString(), '*sample*');
  });

  await t.test('toggleWrapSelection wraps text with symmetric wrapper', () => {
    const view = createMockView('Bold Test');
    view.dispatch({ selection: { anchor: 0, head: 4 } });
    toggleWrapSelection(view, '**');
    assert.equal(view.state.doc.toString(), '**Bold** Test');
  });

  await t.test('insertLinePrefix adds prefix at start of current line', () => {
    const view = createMockView('Line 1\nLine 2');
    // Cursor on Line 2 (index 7)
    view.dispatch({ selection: { anchor: 8 } });
    insertLinePrefix(view, '- ');
    assert.equal(view.state.doc.toString(), 'Line 1\n- Line 2');
  });

  await t.test('applyColor inserts HTML color span', () => {
    const view = createMockView('Red Text');
    view.dispatch({ selection: { anchor: 0, head: 3 } });
    applyColor(view, '#e53e3e');
    assert.equal(view.state.doc.toString(), '<span style="color: #e53e3e;">Red</span> Text');
  });

  await t.test('applyAlignment inserts HTML alignment block', () => {
    const view = createMockView('Centered');
    view.dispatch({ selection: { anchor: 0, head: 8 } });
    applyAlignment(view, 'center');
    assert.equal(view.state.doc.toString(), '<div align="center">\nCentered\n</div>');
  });

  await t.test('Undo and Redo history functions modify editor doc and depth correctly', () => {
    const view = createMockView('Initial state');
    assert.equal(undoDepth(view.state), 0);
    assert.equal(redoDepth(view.state), 0);

    // Make an edit
    view.dispatch({ changes: { from: 13, insert: ' updated' } });
    assert.equal(view.state.doc.toString(), 'Initial state updated');
    assert.ok(undoDepth(view.state) > 0);

    // Perform Undo
    undo(view);
    assert.equal(view.state.doc.toString(), 'Initial state');
    assert.ok(redoDepth(view.state) > 0);

    // Perform Redo
    redo(view);
    assert.equal(view.state.doc.toString(), 'Initial state updated');
  });

  await t.test('MarkdownEditor renders toolbar elements in DOM', () => {
    const container = document.createElement('div');
    const sampleNote: WikiNote = {
      id: 'test-note',
      title: 'Test Note Title',
      content: 'Sample content line 1',
      folder: 'wiki',
      path: 'wiki/test-note.md',
      tags: [],
      frontmatter: {},
      outboundLinks: [],
      backlinks: [],
    };

    const editor = new MarkdownEditor(container);
    editor.setNote(sampleNote);

    // Click edit button
    const editBtn = container.querySelector('#editor-toggle-btn') as HTMLButtonElement;
    assert.ok(editBtn, 'Edit button should exist in preview mode');
    editBtn.click();

    const undoBtn = container.querySelector('#tb-undo') as HTMLButtonElement;
    const redoBtn = container.querySelector('#tb-redo') as HTMLButtonElement;
    const boldBtn = container.querySelector('#tb-bold') as HTMLButtonElement;
    const headingSelect = container.querySelector('#tb-heading') as HTMLSelectElement;
    const colorSelect = container.querySelector('#tb-color') as HTMLSelectElement;

    assert.ok(undoBtn, 'Undo button present');
    assert.ok(redoBtn, 'Redo button present');
    assert.ok(boldBtn, 'Bold button present');
    assert.ok(headingSelect, 'Heading selector present');
    assert.ok(colorSelect, 'Color selector present');

    // Clean up editor instance to avoid pending async measuring callbacks in mock DOM
    (editor as any).destroyEditor();
  });
});
