import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CommandPalette } from '../src/frontend/components/ui/CommandPalette';
import { ChangesetReviewModal } from '../src/frontend/components/ke/ChangesetReviewModal';

describe('Command Palette & Changeset Review UI Test Suite', () => {
  beforeEach(() => {
    const elements = new Map<string, any>();

    const makeElement = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        style: {},
        innerHTML: '',
        value: '',
        children: [],
        id: '',
        appendChild: (child: any) => {
          el.children.push(child);
          if (child.id) elements.set(child.id, child);
        },
        querySelector: (sel: string) => makeElement('div'),
        querySelectorAll: (sel: string) => [],
        addEventListener: () => {},
      };
      return el;
    };

    const mockDocument = {
      createElement: (tag: string) => makeElement(tag),
      getElementById: (id: string) => elements.get(id) || null,
      addEventListener: () => {},
      body: {
        appendChild: (child: any) => {
          if (child.id) {
            elements.set(child.id, child);
          }
        },
      },
    };

    (global as any).window = {};
    (global as any).document = mockDocument;
    (global as any).HTMLElement = class {};
    (global as any).fetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        changesets: [],
      }),
    });
  });

  test('CommandPalette creates root element in DOM', () => {
    const palette = new CommandPalette(
      () => [],
      () => {},
      () => {}
    );
    const root = document.getElementById('command-palette-overlay');
    assert.ok(root !== null, 'Command palette overlay should be in DOM');
  });

  test('ChangesetReviewModal creates root element in DOM', () => {
    const modal = new ChangesetReviewModal();
    const root = document.getElementById('changeset-review-modal-root');
    assert.ok(root !== null, 'Changeset review modal should be in DOM');
  });
});
