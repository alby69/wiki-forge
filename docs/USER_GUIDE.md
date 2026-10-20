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
