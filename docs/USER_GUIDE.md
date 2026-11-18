# User Guide — Simple Focus Mode & Guided Procedures

## Focus Mode Overview
Focus Mode provides a clean, 3-step interface for operators:

1. **1. Carica Documenti**: Drag and drop PDF, EPUB, DOCX, or TXT sources into `sources/`.
2. **2. Compila Wiki**: Converts raw sources into interlinked OKF v0.2 Markdown notes.
3. **3. Chiedi alla Wiki**: Ask questions, request syntheses, or generate study materials.

## Guided Wizards
Focus Mode includes a guided **Onboarding Wizard** (also available in chat as `/wizard [scenario]`) that walks you through setting up a new project step by step, and scenario presets can be selected in the wizard itself.

Backend progress for guided procedures is recorded in `.wikiforge/wizard_state.json`, but the web UI has no resume button yet: after a page reload the wizard starts again from its first step.

## Markdown Editor & Toolbar
When editing notes, the editor view includes a built-in formatting toolbar:
- **Undo / Redo**: **↩️ Undo** and **↪️ Redo** buttons with dynamic state enabling/disabling, plus standard keyboard shortcuts (`Ctrl+Z` / `Ctrl+Y`).
- **Text Styling**: **B** (Bold `**text**`), *I* (Italic `*text*`), ~~S~~ (Strikethrough `~~text~~`), and `</>` (Inline Code `` `code` ``).
- **Structure**: Headers dropdown (H1, H2, H3), Bulleted Lists (`- `), Numbered Lists (`1. `), and Blockquotes (`> `).
- **Formatting & Alignment**: Text Color picker (`<span style="color: ...">`) and Text Alignment dropdown (`<div align="...">`).
- **Wikilink Autocomplete**: Type `[[` inside the editor to invoke automatic autocomplete for existing wiki notes.

## Review Studio
The editor header includes a **🔍 Revisione** button that opens the **Review Studio**, a single modal with four horizontal tabs:

| Tab | Purpose |
|---|---|
| **Verifica** | Note quality gate (links, OKF frontmatter, tags, sources, `stale_after`), verification history, and the human-review form (reviewer, `stable`, comment). |
| **Critica** | Adversarial critique with `fast` / `standard` / `deep` depth and selectable focus areas; structured findings, counter-arguments and recommended actions. Uses the configured LLM when available and a deterministic fallback otherwise. |
| **Digest** | Activity over the last N days (from `wiki/log.md`) grouped by day, plus freshness and link-health stats, next actions and a Markdown report. |
| **Confronta versioni** | Unified line-by-line diff against a local pre-write snapshot (both line-number columns), with one-click restore. |

Ways to open it:
- right-click a note in the left file tree and pick a tab from the review menu;
- click **🔍 Revisione** in the editor header;
- press `Ctrl+Alt+R` (Verifica), `Ctrl+Alt+C` (Critica), `Ctrl+Alt+D` (Digest) or `Ctrl+Alt+F` (Confronta versioni).

Review history is stored locally in `.wiki-forge/snapshots/<note-path>/` as a `.md` snapshot plus a `.json` sidecar (timestamp and reason). The last **25** snapshots per note are kept and the folder is gitignored. The chat `/verify` (alias `/human-review`) shares the exact same code path; `/digest`, `/adversarial-review` and `/diff` stay available as agent commands, while their Review Studio tabs are deterministic.

See [`TUTORIAL.md`](TUTORIAL.md) §5.1 for trust tiers and [`mockups/`](mockups/README.md) for the design preview.
