---
type: Concept
title: "Note Editor Migration — CodeMirror → Milkdown/Crepe"
description: "The note editor used a plain CodeMirror 6 source view. It was reliable but"
resource: docs/EDITOR_MIGRATION.md
tags: [scope/docs, layer/generated, area/architettura, lang/en]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-editor-migration-md
    resource: docs/EDITOR_MIGRATION.md
    title: "Note Editor Migration — CodeMirror → Milkdown/Crepe"
    author: human:alby69
---
# Note Editor Migration — CodeMirror → Milkdown/Crepe

> **Status**: implemented (Unreleased). This document is the reference for the
> decoupled editor architecture introduced with the WYSIWYG migration.

## 1. Why the change

The note editor used a plain CodeMirror 6 source view. It was reliable but
forced every user to write Markdown by hand: bold, headings, tables, images,
colours and wikilinks all had to be typed as syntax. Milkdown/Crepe provides a
WYSIWYG surface with a toolbar, slash commands, tables, KaTeX, image upload
and CodeMirror-backed code blocks, while still storing plain Markdown files on
disk — exactly the non-parametric memory model of Wiki-Forge.

Constraints that shaped the migration:

- **No React.** The UI is vanilla TypeScript + Vite. We use `@milkdown/crepe`
  and `@milkdown/kit` directly, not `@milkdown/react`.
- **No AI in the editor.** Wiki-Forge already ships Review, Research and Study
  Studios. `CrepeFeature.AI` and `CrepeFeature.TopBar` are disabled.
- **OKF frontmatter must survive byte-for-byte.** The editor only ever sees the
  note body; the raw frontmatter is carried separately and reattached on save.
- **CodeMirror stays as a fallback.** It keeps the unit tests (mock DOM) and
  capability-constrained environments working.

## 2. Adapter contract

`src/frontend/components/editor/EditorAdapter.ts` defines the seam:

```ts
interface NoteEditorAdapter {
  readonly engine: 'codemirror' | 'milkdown';
  mount(root: HTMLElement, markdown: string): Promise<void>;
  getMarkdown(): string;
  replace(markdown: string): void;
  setReadonly(value: boolean): void;
  onChange(cb: (body: string) => void): void;
  onWikilinkClick(cb: (target: string) => void): void;
  toggleInline(format: 'strong' | 'emphasis' | 'strike' | 'code'): void;
  applyBlock(format: 'heading1' | 'heading2' | 'heading3' |
                      'bullet-list' | 'ordered-list' | 'quote'): void;
  insertColor(color: string): void;
  insertAlignment(align: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  focus(): void;
  destroy(): Promise<void>;
}
```

The contract is deliberately **semantic** (`toggleInline('strong')`, not
`wrapSelection(view, '**')`). No CodeMirror or ProseMirror type leaks into the
shell, so an engine can be replaced without touching the application.

Engine selection is centralised in `resolveEngine(preference)`:

| Preference | Result |
| :--- | :--- |
| `'codemirror'` | CodeMirror (explicit) |
| `'milkdown'` | Milkdown (explicit) |
| `'auto'` (default) | Milkdown when `isMilkdownSupported()`, else CodeMirror |

`isMilkdownSupported()` checks for a real browser DOM (`document.createRange`,
`getBoundingClientRect`, `window.getSelection`). The Node test runner therefore
uses CodeMirror automatically.

## 3. Component map

```text
MarkdownEditor.ts                 shell: header, Node Info, Studio buttons,
                                  save lifecycle, toolbar, keyboard shortcuts
  ├─ EditorAdapter.ts             contract + engine resolver
  ├─ editorMarkdownOps.ts         pure CodeMirror formatting helpers
  ├─ CodeMirrorAdapter.ts         fallback engine
  └─ milkdown/
      ├─ MilkdownAdapter.ts       Crepe engine, commands, uploads, wikilink bridge
      ├─ wikilink.ts              custom node, remark plugin, input rule, click plugin
      └─ wikilinkParsing.ts       pure parsing/splitting helpers (unit-tested)
```

`MarkdownEditor` keeps its public API and still re-exports the pure formatting
helpers (`toggleWrapSelection`, `wrapSelection`, `insertLinePrefix`,
`applyColor`, `applyAlignment`) so existing tests and callers keep working.

The Milkdown module is loaded with a dynamic `import()`. Crepe is ESM-only and
its `@milkdown/kit/component/diff` subpath cannot be resolved by the Node test
runner; lazy loading keeps the tests on the CodeMirror path. Vite emits a
separate `dist/assets/MilkdownAdapter-*.js` chunk.

## 4. Layout and scrolling

The shell's `#cm-editor-wrapper` clips overflow (`overflow: hidden`) because
CodeMirror provides its own `.cm-scroller`. Crepe themes do **not** define a
scroll container, so without explicit CSS the `.ProseMirror` node simply grows
past the panel and its content becomes unreachable. `src/frontend/styles/editor.css`
therefore turns the Crepe document node into the scroll container:

```css
#cm-editor-container .milkdown {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  overflow: hidden;
}
#cm-editor-container .milkdown > .editor.ProseMirror {
  flex: 1 1 auto; min-width: 0; min-height: 0; box-sizing: border-box;
  overflow: auto; padding: 16px 20px;
}
```

This gives vertical scrolling for long notes and horizontal scrolling for wide
tables/code blocks/images, while Crepe's floating toolbar stays anchored to
`.milkdown`. The padding also replaces Crepe's `60px 120px` default, which is
too wide for the resizable editor panel.

## 5. OKF frontmatter preservation

`WikiNote` carries two extra fields:

- `frontmatterRaw` — the exact YAML block (including `---` delimiters) as read
  from disk, produced by `parseFrontmatter()`.
- `rawContent` — the complete file as read from disk.

The editor is mounted with `note.content` (body only). On save,
`MarkdownEditor.saveCurrentContent()` calls
`onSave(noteId, body, frontmatterRaw + body)`.

`ApiStorage.saveNote()` sends `rawContent`, and the backend
`saveWikiNote()` writes `rawContent ?? content` via `safeFs.atomicWriteFile()`.
This guarantees that comments, quoting style, key order and line endings in
the OKF frontmatter are untouched — a byte-identical round-trip is covered by
`tests/agentServer.test.ts`.

Image uploads use `ApiStorage.uploadFile()`; Milkdown's image feature calls it
with folder `raw/assets` and a sanitised filename. When no storage is supplied
(e.g. in isolation) it falls back to a local blob URL.

## 6. Wikilinks

`[[target]]` is not a Markdown primitive. remark-stringify would escape it as
`\[\[target]]`, silently corrupting the note. We therefore:

1. register a remark **stringify handler** for the `wikilink` mdast node that
   returns `node.value` verbatim (handlers are installed at plugin attach time
   via `data('toMarkdownExtensions')`);
2. transform text nodes at parse time, splitting `[[...]]` occurrences into
   `wikilink` nodes with the pure `splitWikilinkText()` helper;
3. map those nodes to a ProseMirror inline atom (`wikilinkSchema`) rendered as
   `<span data-type="wikilink" data-value="...">label</span>`;
4. add an `InputRule` so typing `[[target]]` converts it in place;
5. dispatch a bubbling `wikiforge:wikilink` CustomEvent on click; the adapter
   forwards it to the shell's `onOpenLink` callback.

Supported forms (all round-trip byte-for-byte):

```markdown
[[target]]
[[target|Etichetta]]
[[folder/target#Heading|Etichetta]]
[[predicate::target|Etichetta]]
```

`parseWikilink()` and `wikilinkNavigationTarget()` in `wikilinkParsing.ts` are
pure functions, unit-tested in `tests/editorWikilink.test.ts`. Navigation drops
the optional predicate and label and keeps the `#anchor` if present.

## 7. Colour and alignment

Milkdown escapes raw text, so `<span style="color: red;">` typed as plain text
would be serialised as `\<span ...>`. `insertColor()` and `insertAlignment()`
instead insert Milkdown `html` nodes (which carry a `value` attribute and are
serialised raw). This preserves the exact HTML already used by the CodeMirror
engine and by `renderMarkdown()`.

## 8. Validation

```bash
npx tsc --noEmit
npm test
npm run build
PYTHONPATH=.:scripts pytest tests/python/
python scripts/docs_to_wiki.py --check
```

`npm test` runs 264 tests (263 pass, 1 skipped) including the 8 new wikilink
tests and the existing editor formatting tests. The Vite build emits a lazy
Milkdown chunk, confirming the dynamic import works.
