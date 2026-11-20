import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConsultAnswerNote,
  slugifyAnswerTitle,
  validateOkfNote,
} from '@backend/server/researchAnswerNote';
import { ApiStorage } from '@frontend/storage/ApiStorage';
import { ResearchStudio } from '@frontend/components/research/ResearchStudio';

const CITATIONS = [
  { id: 'governance-clinica', title: 'Governance clinica', path: 'wiki/governance-clinica.md' },
];

test('buildConsultAnswerNote produces a valid OKF Reference note', () => {
  const note = buildConsultAnswerNote({
    question: 'Quali decisioni sono documentate sulla governance clinica?',
    answer: 'Le decisioni sono registrate nel comitato etico.',
    citations: CITATIONS,
  });

  assert.equal(note.id, 'quali-decisioni-sono-documentate-sulla-governance-clinica');
  assert.equal(note.title, 'Quali decisioni sono documentate sulla governance clinica');
  assert.match(note.markdown, /^---\n/);
  assert.match(note.markdown, /^type: Reference$/m);
  assert.match(note.markdown, /^status: draft$/m);
  assert.match(note.markdown, /^  by: process:research-consult$/m);
  assert.match(note.markdown, /^  at: "\d{4}-\d{2}-\d{2}T/m);
  assert.match(note.markdown, /^  - id: source-1$/m);
  assert.match(note.markdown, /resource: "wiki\/governance-clinica\.md"/);
  assert.match(note.markdown, /^# Quali decisioni sono documentate/m);
  assert.deepEqual(validateOkfNote(note.markdown), []);
});

test('validateOkfNote rejects malformed or non-conforming notes', () => {
  const base = buildConsultAnswerNote({
    question: 'Domanda di prova?',
    answer: 'Risposta',
    citations: CITATIONS,
  });

  assert.ok(validateOkfNote(base.markdown.replace('type: Reference', 'type: Unknown')).some(e => e.includes('Invalid')));
  assert.ok(validateOkfNote(base.markdown.replace('status: draft', 'status: approved')).some(e => e.includes('status')));
  assert.ok(validateOkfNote(base.markdown.replace('process:research-consult', 'utente')).some(e => e.includes('generated.by')));
  assert.ok(validateOkfNote(base.markdown.replace(/at: "[^"]+"/, 'at: "ieri"')).some(e => e.includes('generated.at')));
  assert.ok(validateOkfNote(base.markdown.replace('wiki/governance-clinica.md', '')).some(e => e.includes('sources')));
  assert.ok(validateOkfNote('testo senza frontmatter').some(e => e.includes('frontmatter')));
  assert.ok(validateOkfNote(base.markdown.replace(/^# .*$/m, '')).some(e => e.includes('H1')));
});

test('slugifyAnswerTitle handles empty and accented questions', () => {
  assert.equal(slugifyAnswerTitle('  Perché è così?  '), 'perche-e-cosi');
  assert.equal(slugifyAnswerTitle('???'), 'risposta-consult');
});

test('Research Studio consult save buttons write to wiki and scratchpad', async () => {
  const previousDocument = (globalThis as any).document;
  const listeners = new Map<string, Array<() => void>>();

  const makeEl = (selector: string): any => ({
    innerHTML: '',
    className: '',
    textContent: '',
    classList: { add: () => {}, remove: () => {}, contains: () => true },
    addEventListener: (type: string, cb: () => void) => {
      listeners.set(`${selector}:${type}`, [...(listeners.get(`${selector}:${type}`) ?? []), cb]);
    },
    querySelector: (next: string) => makeEl(next),
    querySelectorAll: () => [],
    appendChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
  });

  const overlay = makeEl('overlay');
  const body = makeEl('#wf-rq-body');
  overlay.querySelector = (selector: string) => (selector === '#wf-rq-body' ? body : makeEl(selector));

  let created = 0;
  let feedbackText = '';
  (globalThis as any).document = {
    createElement: () => {
      if (++created === 1) return overlay;
      const feedback = makeEl('feedback');
      Object.defineProperty(feedback, 'textContent', {
        get: () => feedbackText,
        set: (value: string) => { feedbackText = value; },
      });
      return feedback;
    },
    addEventListener: () => {},
    body: { style: {}, appendChild: () => {} },
  };

  const promoted: unknown[][] = [];
  const quickNotes: string[] = [];
  let vaultChanges = 0;
  let scratchpadChanges = 0;

  const storage = {
    researchConsult: async () => ({
      success: true,
      markdown: 'Le decisioni sono registrate nel comitato etico.',
      citations: CITATIONS,
      fallback: false,
    }),
    researchPromoteAnswer: async (...args: unknown[]) => {
      promoted.push(args);
      return { success: true, path: 'wiki/general/decisioni.md', validation: [] };
    },
    studyQuickNote: async (text: string) => {
      quickNotes.push(text);
      return { success: true, markdown: '', entries: [] };
    },
  } as unknown as ApiStorage;

  try {
    const studio = new ResearchStudio(storage, {
      onVaultChanged: () => { vaultChanges += 1; },
      onScratchpadChanged: () => { scratchpadChanges += 1; },
    });
    studio.open({ tab: 'consult', query: 'Quali decisioni sono documentate?' });
    await new Promise(resolve => setImmediate(resolve));

    const wikiButton = body.innerHTML.match(/<button[^>]*id="wf-rq-consult-wiki"[^>]*>/)?.[0] ?? '';
    const scratchpadButton = body.innerHTML.match(/<button[^>]*id="wf-rq-consult-scratchpad"[^>]*>/)?.[0] ?? '';
    assert.ok(wikiButton, 'wiki save button is rendered');
    assert.ok(scratchpadButton, 'scratchpad save button is rendered');
    assert.ok(!wikiButton.includes('disabled'), 'wiki save button is enabled after a successful consult');
    assert.ok(!scratchpadButton.includes('disabled'), 'scratchpad save button is enabled after a successful consult');

    listeners.get('#wf-rq-consult-wiki:click')?.[0]?.();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(promoted.length, 1);
    assert.equal(promoted[0][0], 'Quali decisioni sono documentate?');
    assert.equal(promoted[0][2], CITATIONS);
    assert.equal(vaultChanges, 1);

    listeners.get('#wf-rq-consult-scratchpad:click')?.[0]?.();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(quickNotes.length, 1);
    assert.match(quickNotes[0], /\*\*Domanda:\*\* Quali decisioni sono documentate\?/);
    assert.match(quickNotes[0], /governance-clinica/);
    assert.equal(scratchpadChanges, 1);
    assert.match(feedbackText, /Risposta aggiunta allo Scratchpad/);

    studio.close();
  } finally {
    (globalThis as any).document = previousDocument;
  }
});
