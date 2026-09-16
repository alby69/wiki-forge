# LLM Wiki Template

> A minimal, agent-agnostic template for building a **personal knowledge base
> that an LLM compiles and maintains for you** — based on Andrej Karpathy's
> [LLM Wiki](docs/KARPATHY_LLM_WIKI.md) pattern.

Instead of re-answering questions from raw documents every time (classic RAG),
the LLM acts as an active **Knowledge Engineer** — an intellectual partner that
**incrementally builds, evaluates, and maintains a persistent, interlinked wiki** of
Markdown files. Beyond basic indexing, the agent performs multi-source deep research,
critical source analysis, interactive tutoring (study guides, quizzes, mind maps, audio overviews),
and domain scenario adaptation.

This repository is a **reusable template**: change a single config file
(`config.toml`) to point it at any subject — a thesis, a book club, a research
project, a business wiki, personal notes, and so on.

---

## 🚀 Avvio Rapido (Per tutti gli utenti)

Non serve installare Python o Node.js! Segui questi tre semplici passaggi:

1. **Installa Docker Desktop** (se non lo hai già): [Scarica qui](https://www.docker.com/products/docker-desktop)
2. **Scarica questo repository** come file ZIP ed estrailo.
3. **Fai doppio click** sul file di avvio corrispondente al tuo sistema operativo nella cartella principale:
   - 🪟 Windows: `Start_WikiForge.bat`
   - 🍎 macOS: `Start_WikiForge.command` *(al primo avvio, potrebbe essere necessario fare clic destro → "Apri")*
   - 🐧 Linux: `Start_WikiForge.sh` *(assicurati che sia eseguibile: `chmod +x Start_WikiForge.sh`)*

L'applicazione si avvierà in background e il tuo browser si aprirà automaticamente su **http://localhost:5173**.

> 💡 **Per arrestare l'applicazione**, usa semplicemente il file `Stop_WikiForge.*` corrispondente.

---

## What's inside

```
.
├── config.toml          # THE ONLY KNOB: title, context, folder layout
├── config/
│   └── scenarios.toml   # Scenario presets (Academic, Business, Research, etc.)
├── scripts/
│   ├── conv2md.py            # Convert PDF/EPUB/DOCX/MD/TXT -> Markdown (raw/)
│   ├── run_convert.sh        # One-command wrapper around scripts/conv2md.py
│   ├── notebooklm_import.py # Import NotebookLM Markdown exports into raw/
│   ├── wiki_stats.py        # Global wiki statistics & METRICS.md
│   ├── suggest_tags.py      # Taxonomy tag suggestions (RAKE/KeyBERT)
│   ├── clip2md.py           # Web clipper -> Markdown (sources/web-clips/)
│   ├── maturity_calculator.py # Maturity Index scores (0-100)
│   ├── check_docs_sync.py   # Verify docs & skills sync
│   ├── migrate_to_okf.py    # Migrate to OKF v0.2
│   ├── okf_lint.py          # Lint OKF bundle frontmatter
│   ├── okf_log.py           # Append OKF log entry
│   ├── okf_reindex.py       # Regenerate OKF indexes
│   ├── okf_stats.py         # OKF bundle analytics
│   ├── generate_thesis.py   # Compile thesis draft
│   ├── export_thesis_pdf.py # Export thesis to PDF
│   └── wizard.py            # Scenario-Driven Interactive Wizard CLI
├── AGENT.md             # Router operating manual for the LLM agent (symlink to docs/AGENT.md)
├── skills/              # Modular Agent Skill packages (ingest, curate, audit, query, study, onboarding)
│   └── README.md        # Human-readable index & progressive disclosure rationale
├── .claude/skills/      # Auto-linked Claude Code skill discovery directory
├── docs/
│   ├── AGENT.md         # Single source of truth for agent operating manual
│   ├── TUTORIAL.md      # User guide & walkthrough
│   ├── SOURCES.md       # Registry of ingested sources (the bibliography)
│   ├── CHANGELOG.md     # Release history
│   ├── METRICS.md       # Wiki statistics & metrics
│   └── KARPATHY_LLM_WIKI.md   # The original idea file (offline copy)
├── index.html            # Web UI entry point (Vite)
├── vite.config.ts        # Vite configuration (with Agent API plugin)
├── src/                  # Web UI source & Agent Server (TypeScript, decoupled)
├── package.json          # Web UI dev/build scripts (npm)
├── sources/  (named backup/)  # Your ORIGINAL files — never modified
├── raw/                 # Converted Markdown (the agent's inbox)
├── wiki/                # The compiled, interlinked knowledge base
├── output/              # Ephemeral query results
├── Dockerfile           # Reproducible toolchain (Python + pandoc)
├── docker-compose.yml   # One-command Docker workflow
├── Makefile             # Convenience shortcuts (Linux/macOS)
└── requirements.txt     # Python dependencies
```

## Quick start (choose one)

### Scenario Wizard (Recommended for New Users)

Run the interactive scenario wizard to guide you step-by-step through setting up your wiki for specific domains (Academic/Thesis, Business KB, Competitive Research, Creative Fiction, or Existing Wiki Navigation):

```bash
python scripts/wizard.py
```

Or run directly with a scenario preset:

```bash
python scripts/wizard.py --preset academic
```

You can also launch scenarios directly in agent chat using `/wizard` or `/wizard academic`.

### Option A — Docker (recommended, zero local install)

```bash
docker compose build
docker compose run --rm wiki convert     # sources/  -> raw/
```

Then open the project in your agent (see "Configure the agent" below). The
container only provides Python + pandoc; your files stay on your machine.

### Option B — Classic install (Python + pandoc)

```bash
python -m venv venv
# Windows:
venv\Scripts\pip install -r requirements.txt
# macOS/Linux:
venv/bin/pip install -r requirements.txt

# Install pandoc: https://pandoc.org/installing.html
#   Windows: winget install JohnMacFarlane.Pandoc

bash run_convert.sh        # sources/ -> raw/
```

## Configure the project (the only step that needs your input)

Open `config.toml` and edit three values:

```toml
[project]
name    = "thesis-wiki"
title   = "Thesis Knowledge Base"
context = "Master's thesis on AI and the transformation of work …"
language = "en"

[paths]
sources = "backup"   # your originals
raw     = "raw"      # converted markdown
wiki    = "wiki"     # compiled knowledge
output  = "output"
```

That's it — the converter and the agent both read this file. To reuse the
template for a completely different subject, copy the repo and change these
values; no code changes required.

## Daily workflow

1. **Add sources** — drop PDF/EPUB/DOCX (or Markdown/TXT) files into `sources/`
   (currently `backup/`). Your originals are never touched.
2. **Convert** — run `bash run_convert.sh` (or the Docker equivalent). New
   files appear in `raw/` as clean Markdown. Already-converted files are skipped.
3. **Compile** — in your agent, run the `compile` workflow. It (a) converts any
   new sources, then (b) reads `raw/`, writes/updates wiki articles, links them,
   and renames processed files with a `_COMPILED` suffix.
4. **Consult** — ask questions; the agent answers from the wiki with citations.
5. **Audit** — occasionally run `audit`/`lint` to keep the wiki healthy.

See [`docs/TUTORIAL.md`](docs/TUTORIAL.md) for a plain-language walkthrough and [`docs/AGENT.md`](docs/AGENT.md) for the full
agent contract. See `ROADMAP.md` for the implementation plan and progress.

## Configure the agent

`AGENT.md` is the single source of truth for the agent's behavior. Most coding
agents expect their own filename, so create a copy or symlink:

| Agent        | Expected file |
|--------------|---------------|
| Claude Code  | `CLAUDE.md`   |
| OpenAI Codex | `AGENTS.md`   |
| OpenCode     | `OPENCODE.md` |
| Gemini CLI   | `GEMINI.md`   |

```bash
cp AGENT.md CLAUDE.md      # or: ln -s AGENT.md CLAUDE.md
```

## Browse & Interact with the wiki (Web UI v2.8)

A lightweight, dependency-light **web application** is included for exploring,
editing, and running agent queries directly in a browser — no Obsidian required.
It is a single-page app (Vite + TypeScript, no framework) with a multi-column
layout and live agent integration. The interface is organised into panels:

- **Header** — Wiki-Forge branding, **Project Switcher** dropdown (select active project from `projects/`), **🛠️ Tools** button to launch the Script Control Panel, **⚙️ Config** button to open the GUI Config Manager, a view-mode switcher (**Editor** /
  **Graph View** / **Split View**) and the **💬 OpenCode Chat** toggle button.
- **Script Control Panel (🛠️ Tools)** — a unified modal interface for running all 15 Python CLI scripts (`conv2md`, `clip2md`, `notebooklm_import`, `migrate_to_okf`, `okf_lint`, `okf_log`, `okf_reindex`, `okf_stats`, `wiki_stats`, `maturity_calculator`, `check_docs_sync`, `suggest_tags`, `generate_thesis`, `export_thesis_pdf`, `wizard`) directly from the browser. Includes dynamic parameter forms and real-time streaming SSE log output console.
- **GUI Config Manager** — tabbed modal interface to edit project properties, folder paths, LLM provider settings (`opencode`, `anthropic`, `openai_compatible`, `ollama`), and OKF type vocabulary directly in the browser, persisting updates to `config.toml` via `smol-toml`.
- **Vault Explorer (sidebar, 280 px)** — an Obsidian-style collapsible file tree
  of the `wiki/` folder and its subfolders, a search box (**Ctrl+K**) that
  filters files in real time, and a **tag cloud** at the bottom. A **file
  operations toolbar** (`📁+` new folder, `📄+` new file, `📤` upload, `✏️`
  rename, `🗑️` delete) manages the vault directly from the browser, selected
  items are highlighted, and **drag-and-drop** moves files/folders between
  directories while the explorer dropzone imports files from your computer.
- **Tag cloud** — tags are sized by frequency, coloured per namespace
  (`topic/ai`, `author/…`, …) and nested tags render as a collapsible
  hierarchy. Clicking a tag (or a namespace root) filters both the explorer and
  the graph; **clear** resets the filter.
- **Editor / Markdown panel** — the selected note rendered as formatted HTML
  (headings, lists, code, tables), with `[[wikilinks]]` shown as clickable
  links. A **💾 Save** button is always in the header (in preview it re-persists
  the note — "Saved to disk! 💾"). Switching to **Edit** opens a **CodeMirror 6**
  editor with syntax highlighting, `[[wikilink]]` autocompletion, and
  `Ctrl/Cmd+S`, `Ctrl/Cmd+B`, `Ctrl/Cmd+I` shortcuts; the header shows
  **💾 Save & Close** (persists edits directly back to disk) and **✖ Cancel**
  (discards unsaved edits).
- **Context panel (right, 280 px)** — node metadata: title, tags, **backlinks**
  and **outbound links** (both clickable) plus an agent status indicator.
- **Graph view** — an interactive force-directed map of `[[wikilinks]]`
  (powered by `force-graph`): scroll to **zoom**, drag the background to **pan**,
  drag nodes to rearrange, hover for a tooltip, and **click a node to open the
  note**. The toolbar above it offers zoom in/out/**Fit**, a node **search box**,
  a **min. connections** filter and **Reset**. Selecting a note highlights it
  and dims the rest; clicking a node switches the editor to split view.
- **OpenCode Chat Drawer** — a side panel with live agent workflow triggers
  grouped by category: Ingestion (`/compile`, `/convert-only`, `/ingest`, `/recompile`),
  Knowledge/Curation (`/new-article`, `/merge`, `/split`, `/stub`, `/retag`),
  Maintenance (`/audit`, `/reindex`, `/prune`, `/lint-frontmatter`),
  Query (`/consult`, `/search`, `/backlinks`, `/related`, `/trace`, `/deep-research`),
  Study & Synthesis (`/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`, `/promote-note`),
  Wizard (`/wizard`), and Utility (`/stats`, `/export`, `/diff`, `/template show`, `/sources regenerate`, `/tag-suggest`, `/help`), alongside a **🪄
  wizard scenario selector** (Academic/Thesis, Business KB, Competitive Research,
  Fiction/Worldbuilding, Existing Wiki) that launches `/wizard <scenario>`
  directly in chat, real-time **LLM response streaming** (SSE), persistent
  session history in `localStorage`, a **Clear history** button, markdown
  responses with `[[wikilinks]]`, and an **Attach to Wiki** button to convert
  chat responses into new or existing wiki notes on disk.
- **Footer** — status bar showing connection/vault and engine state.

### Run it (Web UI)

**Via Docker (zero Node.js local install):**

```bash
docker compose up ui              # build image + start the UI on :5173
docker compose build ui           # rebuild the image (e.g. after Dockerfile change)
docker compose restart ui         # restart after editing config.toml
docker compose logs -f ui         # follow the dev server logs
docker compose down               # stop and remove the container
```

Or with the Makefile shortcuts:

| Target           | Command                          | What it does                             |
|------------------|----------------------------------|------------------------------------------|
| `make ui-docker` | `docker compose up ui`           | UI in a Node container on **:5173**      |
| `make ui`        | `npm run dev`                    | UI with the local Node install on :5173  |
| `make ui-build`  | `npm run build`                  | Production bundle in `dist/`             |
| `make ui-preview`| `npm run preview`                | Serve the built bundle                   |
| `make ui-test`   | `npm run test`                   | Test suite (parser, graph, agent server) |
| `make ui-typecheck` | `npm run typecheck`           | TypeScript type checking                 |
| `make okf-validate` | `python3 scripts/okf_lint.py wiki/` | Validate OKF v0.2 frontmatter & rules |
| `make okf-lint`    | `python3 scripts/okf_lint.py wiki/` | Lint OKF frontmatter schema & timestamps |
| `make okf-reindex` | `python3 scripts/okf_reindex.py wiki/` | Regenerate index.md conforming to OKF §8 |
| `make okf-log`     | `python3 scripts/okf_log.py wiki/` | Append log entry conforming to OKF §9 |
| `make okf-stats`   | `python3 scripts/okf_stats.py wiki/` | Print OKF metrics & trust tier breakdown |

The UI is served at **http://localhost:5173**. Stop any local `npm run dev` first,
otherwise the port is already allocated and Docker will fail to publish it.

**Chat in Docker requires opencode on the host.** The UI container mounts your
local opencode CLI plus its config/data (`${HOME}/.opencode`,
`${HOME}/.config/opencode`, `${HOME}/.local/share/opencode`) into the container
and points `OPENCODE_BIN` at it, so the `/consult` chat works inside Docker too.
Install opencode on the host once (e.g. `curl -fsSL https://opencode.ai/install |
bash`); no image rebuild is needed afterwards — just `docker compose restart ui`.

**Via local Node.js install:**

```bash
npm install        # install UI dev dependencies (Vite, TypeScript)
npm run dev        # start the dev server at http://localhost:5173
```

Other scripts: `npm run build` (production bundle in `dist/`),
`npm run preview` (serve the built bundle), `npm run typecheck`,
`npm run test` (test suite covering the parser, graph extractor, and agent server
endpoints). Remember to stop the Docker container if you switch back to the local
server — both use port 5173.

### Architecture: Multi-Provider LLM Chat & Workflow Persistence

Phases 22–25 bridge the Web UI with live multi-provider LLM execution, real workflow execution, and security hardening:

1. **Multi-Provider LLM Client (`src/server/llmClient.ts`)**:
   - Supports OpenCode CLI (`opencode`), Anthropic API (`claude-3-5-sonnet`), OpenAI-compatible REST endpoints (`gpt-4o`), and local Ollama (`llama3`).
   - Configured via `[agent.llm]` in `config.toml` with safe key handling via environment variables (`api_key_env`).
2. **Decoupled Backend API Server (`src/server/agentServer.ts`)**:
   - `GET /api/wiki/notes`: Fetches all wiki notes from disk in real time.
   - `POST /api/chat`: Injects `AGENT.md` as system prompt and context notes, routing queries to `LlmClient` or executing real workflow commands (`/compile`, `/audit`, `/reindex`, `/consult`, `/trace`, `/wizard`).
   - `POST /api/wiki/save`: Accepts raw Markdown from the UI editor and writes directly to disk under `wiki/`, with path traversal protection (enforcing containment inside `wiki/` directory).
   - `POST /api/wiki/attach`: Appends or converts chat answers into new/existing wiki notes and re-computes backlinks.
   - Vault filesystem management (Phase 26): `POST /api/wiki/folder/create`,
     `POST /api/wiki/file/create`, `POST /api/wiki/rename`, `POST /api/wiki/move`,
     `POST /api/wiki/delete`, `POST /api/wiki/upload` — every path is validated
     against traversal and must stay inside `wiki/` or `raw/`.
3. **Security Hardening**:
   - Path traversal containment on `save` and `attach` endpoints returning HTTP 400 Bad Request on invalid paths.
   - XSS HTML sanitization in `renderMarkdown` (`src/core/utils/html.ts`).
   - Input payload size limits and execution timeouts.
4. **Storage Abstraction & Adapter (`src/storage/ApiStorage.ts`)**:
   - Implements `IStorage` interface, calling server REST endpoints when online and falling back gracefully to static `FileStorage` when offline.
   - `IStorage` now also exposes async filesystem operations (create folder/file, move, rename, delete, upload) backed by the new API endpoints — or by local `fs` calls when offline.
5. **UI Extensions (`src/components/chat/`)**:
   - **Chat Drawer**: Toggleable panel with quick command buttons and interactive message history.
   - **Attach to Wiki**: One-click action on chat responses opening a target selection modal to merge knowledge into notes.
   - **Persistent Editor**: Direct save action with visual confirmation ("Saved to disk! 💾").

### Tag cloud & tag management

The vault explorer shows a **tag cloud**: tags are sized by frequency, coloured
per namespace (`topic/ai` and `topic/hr` share a hue; `author/…` another), and
nested tags render as a collapsible hierarchy. Click any tag (or a whole namespace
root) to filter the explorer **and** the graph; click **clear** to reset.

To keep the taxonomy coherent, tags are drawn from a controlled vocabulary in
`config.toml` (`[tags].allowed` / `[tags].blocked`). Generate suggestions with:

```bash
python scripts/suggest_tags.py wiki/ai/foo.md            # print suggestions for one note
python scripts/suggest_tags.py --all --write             # append suggestions to every note
python scripts/suggest_tags.py wiki/ai/foo.md --semantic # semantic ranking (needs keybert)
```

`suggest_tags.py` is dependency-light (pure-Python RAKE by default; optional
KeyBERT semantic ranking when `keybert` + `sentence-transformers` are installed).
See `AGENT.md` (`tag-suggest` command) for the agent workflow.

### NotebookLM Import Workflow (Importazione da NotebookLM)

To bring study guides, Q&A summaries, or FAQs from Google NotebookLM into `wiki-forge`:

1. Export or copy the Markdown generated in NotebookLM to a local `.md` file (e.g. `study_notes.md`).
2. Run the import script to clean pre-existing headers, add OKF v0.2 YAML frontmatter, and save to `raw/`:
   ```bash
   python scripts/notebooklm_import.py study_notes.md --source "NotebookLM Session"
   ```
3. Run `/compile` in your agent to compile the imported material into native `wiki/` articles.

### Study & Research Suite

`wiki-forge` includes a NotebookLM-inspired study and knowledge synthesis suite for transforming compiled wiki notes into structured learning materials:
- **`study-guide <wiki|article>`**: Generates comprehensive study guides with executive summaries, section breakdowns, key terms, and self-assessment QA in `output/study-guide-*.md`.
- **`quiz <wiki|article> [n]`**: Generates interactive self-test quizzes in `output/quiz-*.md`.
- **`mindmap <article>`**: Extracts concept hierarchies into Markdown tree representations and JSON node-link structures in `output/mindmap-*.md`.
- **`audio-overview <target>`**: Synthesizes 2-speaker Host A / Host B conversational dialogue scripts in `output/audio-script-*.md` with optional TTS audio generation.
- **`deep-research <question>`**: Executes multi-source research synthesis reports with claim attribution matrices and knowledge gap identification in `output/research-*.md`.
- **`note <text>` & `promote-note <id>`**: Records scratchpad quick notes in `notes/` and promotes them into formal indexed wiki articles.
- **`maturity [path]`**: Calculates and updates page maturity scores (0-100) based on sources, links, and questions.
- **`thesis-chapter [min-maturity]`**: Aggregates mature wiki synthesis notes into a unified thesis draft (`output/thesis_compiled.md`).

See `AGENT.md` §5.7–§5.8 for full command contracts and options.

## Design philosophy

- **KISS** — the converter is a ~200-line, single-purpose script with no
  framework. The agent contract is plain prose.
- **Open Knowledge Format (OKF v0.2) Standard** — `wiki/` complies with Google's vendor-neutral OKF v0.2 standard, featuring automatic frontmatter linting, structured provenance signals (`sources`), trust tier tracking (`unverified`, `machine-confirmed`, `human-reviewed`), lifecycle status, reserved indexes (§8), and chronological logs (§9).
- **Decoupled** — conversion (`conv2md.py`), UI, and knowledge work (`AGENT.md`) are
  separate concerns; one can change without the other.
- **Config-driven** — a single `config.toml` adapts the template to any context.
- **Portable** — everything is Markdown files in a folder; readable by Obsidian,
  any editor, and any agent. Back it up with plain git.

## Requirements

- Python 3.11+ (for `tomllib`; older versions still work with built-in defaults)
- `pandoc` for `.docx` / `.epub` (system install, or use the Docker image)
- `pymupdf4llm` for `.pdf` (in `requirements.txt`)
- `rich` and `questionary` for CLI Wizard (in `requirements.txt`)
- A coding agent (Claude Code, OpenCode, Codex, Gemini CLI, Jules, Cursor, …)
- Optional: [Obsidian](https://obsidian.md) for browsing the wiki (graph view)

## Stato attuale (2026-09-08)
- Architettura: core/API separato (src/api/core.py)
- Cache layer attivo (src/cache.py)
- Build Vite ottimizzato
- Test auto (tests/auto/)
- Codice verificato e funzionante
