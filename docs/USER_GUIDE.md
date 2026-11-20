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
The editor header includes a **🧐 Revisione** button that opens the **Review Studio**, a single modal with four horizontal tabs:

| Tab | Purpose |
|---|---|
| **Verifica** | Note quality gate (links, OKF frontmatter, tags, sources, `stale_after`), verification history, and the human-review form (reviewer, `stable`, comment). |
| **Critica** | Adversarial critique with `fast` / `standard` / `deep` depth and selectable focus areas; structured findings, counter-arguments and recommended actions. Uses the configured LLM when available and a deterministic fallback otherwise. |
| **Digest** | Activity over the last N days (from `wiki/log.md`) grouped by day, plus freshness and link-health stats, next actions and a Markdown report. |
| **Confronta versioni** | Unified line-by-line diff against a local pre-write snapshot (both line-number columns), with one-click restore. |

Ways to open it:
- right-click a note in the left file tree and pick a tab from the review menu;
- click **🧐 Revisione** in the editor header;
- press `Ctrl+Alt+R` (Verifica), `Ctrl+Alt+C` (Critica), `Ctrl+Alt+D` (Digest) or `Ctrl+Alt+F` (Confronta versioni).

Review history is stored locally in `.wiki-forge/snapshots/<note-path>/` as a `.md` snapshot plus a `.json` sidecar (timestamp and reason). The last **25** snapshots per note are kept and the folder is gitignored. The chat `/verify` (alias `/human-review`) shares the exact same code path; `/digest`, `/adversarial-review` and `/diff` stay available as agent commands, while their Review Studio tabs are deterministic.

See [`TUTORIAL.md`](TUTORIAL.md) §5.1 for trust tiers and [`mockups/`](mockups/README.md) for the design preview.

## Research Studio
The **🔎 Research** button in the top bar and the **🔎 Ricerca** button in the editor header open the **Research Studio**, a single modal with six horizontal tabs matching the six query commands:

| Tab | Command | Purpose |
|---|---|---|
| **Consult** | `/consult` | Natural-language question: the most relevant notes become the model context and the answer cites sources with `[[wikilinks]]`. |
| **Ricerca** | `/search` | Case-insensitive full-text search over title, id, tags and body, ranked by relevance, with line numbers and one line of context. |
| **Backlink** | `/backlinks` | Notes that reference the selected one through `[[wikilinks]]`, with the first citing line. |
| **Correlate** | `/related` | Affine notes sharing tags/vocabulary that are **not linked yet** in either direction. |
| **Traccia** | `/trace` | Notes matching a claim, their outbound links, and the raw sources declared in frontmatter or `## Sources`, with the quoted passage. |
| **Deep Research** | `/deep-research` | Extended report saved to `output/research-*.md` plus a synthesis note in `wiki/synthesis/`, with source-attribution matrix and knowledge gaps. |

Ways to open it:
- click **🔎 Research** in the top bar or **🔎 Ricerca** in the editor header;
- right-click a note and pick **Backlink della nota** or **Correlazioni suggerite**;
- press `Ctrl+Alt+Q` (Consult), `Ctrl+Alt+S` (Ricerca), `Ctrl+Alt+B` (Backlink), `Ctrl+Alt+L` (Correlate), `Ctrl+Alt+T` (Traccia) or `Ctrl+Alt+H` (Deep Research);
- type one of the six commands in the chat: the matching tab opens with the query pre-filled.

Search, backlinks, related and trace are deterministic and work offline. Consult and deep research use the configured LLM and fall back to a deterministic, clearly labelled response when no provider is available; the deep-research report and synthesis note are written only when the backend responds.

See [`TUTORIAL.md`](TUTORIAL.md) §2 for the tab table and [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) §2.12 for the API.

## Study Studio
The **📚 Studio** button in the top bar (global action) opens the **Study Studio**, a single modal with seven horizontal tabs matching the 📚 study commands:

| Tab | Command | Purpose |
|---|---|---|
| **Guida** | `/study-guide` | Study guide with executive summary, per-note sections, glossary and self-assessment questions; `sources` uses real note paths. |
| **Quiz** | `/quiz` | Multiple-choice quiz with an exact count of 1–25 questions, correct answers and explanations. |
| **Mindmap** | `/mindmap` | Heading tree (`##`/`###`), outbound wikilinks and the JSON payload for the graph. |
| **Audio** | `/audio-overview` | Host A / Host B podcast script; MP3 synthesis stays off until an `[audio]` provider is configured. |
| **Note** | `/note` | Quick note in `notes/quick-notes.md` with a timestamp id, excluded from `wiki/index.md`. |
| **Promuovi** | `/promote-note` | Promotes the selected scratchpad entry into `wiki/<folder>/<slug>.md` and updates both indexes. |
| **Tesi** | `/thesis-chapter` | Aggregates `tipo: capitolo_tesi` notes and mature syntheses; also refreshes `output/thesis_compiled.md`. |

Ways to open it:
- click **📚 Studio** in the top bar;
- right-click a note and pick **Guida di studio**, **Quiz di autovalutazione**, **Mappa concettuale** or **Copione audio**;
- press `Ctrl+Alt+G` (Guida), `Ctrl+Alt+K` (Quiz), `Ctrl+Alt+M` (Mindmap) or `Ctrl+Alt+A` (Audio).

All seven tabs are deterministic: they use the same builders as the chat commands (`src/backend/server/studyHelpers.ts`, `POST /api/notes/study/*`) and need no LLM. Generated artefacts go to `output/`, quick notes to `notes/quick-notes.md`, and promoted articles to `wiki/`.

See [`TUTORIAL.md`](TUTORIAL.md) §2/§4 for the tab table and [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) §2.13 for the API.

## Top bar, languages and keyboard shortcuts (Fase 78)

- The top bar holds the project selector, a **language selector (🇮🇹 IT / 🇬🇧 EN)**,
  the view-mode pills, the global **Research**, **Studio**, **Docs Wiki** and
  **Chat** buttons, plus a `⋯` overflow menu for the remaining actions.
- The `⋯` menu starts with a **Personalizza barra / Customize toolbar** section:
  one flag per global action. Tick a flag to show that action as a button in the
  main bar, untick it to hide the button. The action always stays in the menu,
  the choice is remembered across restarts, and the default layout is unchanged.
  The **Docs Wiki** flag appears only in Developer Mode.
- Research and Studio are **global only**: the duplicated buttons were removed
  from the note header, which now shows only Node Info, Review, History and
  Save/Edit.
- `Ctrl+K` opens the command palette (notes + actions), `F1` opens contextual
  help, `Ctrl+Shift+D` toggles Focus/Developer mode, `Ctrl+Alt+W` opens the
  docs wiki. Studio shortcuts: `Ctrl+Alt+G/K/M/A` (guide/quiz/mindmap/audio),
  Review shortcuts: `Ctrl+Alt+R/C/D/F`.
- Confirmation and input dialogs are styled and keyboard accessible; no native
  browser dialogs are used.

## Managing projects (Fase 78)

Open **📁 Projects** in the top bar to use the **Project Manager**. From there you
can create, clone, rename, archive/restore, export/import and delete wikis.
**Delete moves the project to the trash by default** (recoverable); a separate
danger action performs a permanent delete after an explicit confirmation. The
`default` project cannot be removed. See [`help/progetti-config.md`](help/progetti-config.md).
