# LLM Wiki Template

> A minimal, agent-agnostic template for building a **personal knowledge base
> that an LLM compiles and maintains for you** — based on Andrej Karpathy's
> [LLM Wiki](docs/KARPATHY_LLM_WIKI.md) pattern.

Instead of re-answering questions from raw documents every time (classic RAG),
the LLM **incrementally builds a persistent, interlinked wiki** of Markdown
files that sits between you and your sources. You curate the material and ask
questions; the agent does the summarizing, cross-referencing, and bookkeeping.

This repository is a **reusable template**: change a single config file
(`config.toml`) to point it at any subject — a thesis, a book club, a research
project, a business wiki, personal notes, and so on.

---

## What's inside

```
.
├── config.toml          # THE ONLY KNOB: title, context, folder layout
├── conv2md.py            # Convert PDF/EPUB/DOCX/MD/TXT -> Markdown (raw/)
├── run_convert.sh        # One-command wrapper around conv2md.py
├── AGENT.md             # Operating manual for the LLM agent (agent-agnostic)
├── SOURCES.md           # Registry of ingested sources (the bibliography)
├── docs/
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
└── requirements.txt     # Python dependency: pymupdf4llm
```

## Quick start (choose one)

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

See `TUTORIAL.md` for a plain-language walkthrough and `AGENT.md` for the full
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

## Browse & Interact with the wiki (Web UI v2.1)

A lightweight, dependency-light **web application** is included for exploring,
editing, and running agent queries directly in a browser — no Obsidian required.
It is a single-page app (Vite + TypeScript) with a multi-column layout and agent integration:

- **Vault explorer** — an Obsidian-style collapsible file tree of the `wiki/`
  folder and its subfolders, with search, active-file highlight, and a tag cloud.
- **Editor / Markdown panel** — the selected note rendered as formatted HTML
  (headings, lists, code, tables), with `[[wikilinks]]` shown as clickable
  links, an **Edit** toggle to edit source code, and a **Save Changes** button that persists edits directly back to disk.
- **Graph viewer** — an interactive force-directed map of `[[wikilinks]]`
  (powered by `force-graph`): scroll to **zoom**, drag the background to **pan**,
  drag nodes to rearrange, hover for a tooltip, and **click a node to open the
  note** (the editor switches to split view).
- **Interactive OpenCode Chat Drawer** — a side panel providing live agent workflow triggers (`/consult`, `/compile`, `/audit`, `/trace`, `/reindex`), markdown responses with `[[wikilinks]]`, and an **Attach to Wiki** button to convert chat responses into new or existing wiki notes on disk.

### Run it

**Via Docker (zero Node.js local install):**

```bash
docker compose up ui
```
Or using Makefile shortcut: `make ui-docker`. This starts the Vite dev server inside a Node container and exposes it at `http://localhost:5173` (stop any local `npm run dev` first, otherwise the port is already allocated).

**Chat in Docker requires opencode on the host.** The UI container mounts your local opencode CLI plus its config/data (`${HOME}/.opencode`, `${HOME}/.config/opencode`, `${HOME}/.local/share/opencode`) into the container and points `OPENCODE_BIN` at it. Install opencode on the host once (e.g. `curl -fsSL https://opencode.ai/install | bash`); no image rebuild is needed afterwards — just `docker compose restart ui` if you used an older image.

**Via local Node.js install:**

```bash
npm install        # install UI dev dependencies (Vite, TypeScript)
npm run dev        # start the dev server at http://localhost:5173
```

Other scripts: `npm run build` (production bundle in `dist/`),
`npm run preview` (serve the built bundle), `npm run typecheck`,
`npm run test` (test suite covering parser, graph extractor, and agent server endpoints).

### Architecture: Multi-Provider LLM Chat & Workflow Persistence

Phases 22–25 bridge the Web UI with live multi-provider LLM execution, real workflow execution, and security hardening:

1. **Multi-Provider LLM Client (`src/server/llmClient.ts`)**:
   - Supports OpenCode CLI (`opencode`), Anthropic API (`claude-3-5-sonnet`), OpenAI-compatible REST endpoints (`gpt-4o`), and local Ollama (`llama3`).
   - Configured via `[agent.llm]` in `config.toml` with safe key handling via environment variables (`api_key_env`).
2. **Decoupled Backend API Server (`src/server/agentServer.ts`)**:
   - `GET /api/wiki/notes`: Fetches all wiki notes from disk in real time.
   - `POST /api/chat`: Injects `AGENT.md` as system prompt and context notes, routing queries to `LlmClient` or executing real workflow commands (`/compile`, `/audit`, `/reindex`, `/consult`, `/trace`).
   - `POST /api/wiki/save`: Accepts raw Markdown from the UI editor and writes directly to disk under `wiki/`, with path traversal protection (enforcing containment inside `wiki/` directory).
   - `POST /api/wiki/attach`: Appends or converts chat answers into new/existing wiki notes and re-computes backlinks.
3. **Security Hardening**:
   - Path traversal containment on `save` and `attach` endpoints returning HTTP 400 Bad Request on invalid paths.
   - XSS HTML sanitization in `renderMarkdown` (`src/core/utils/html.ts`).
   - Input payload size limits and execution timeouts.
4. **Storage Abstraction & Adapter (`src/storage/ApiStorage.ts`)**:
   - Implements `IStorage` interface, calling server REST endpoints when online and falling back gracefully to static `FileStorage` when offline.
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
python suggest_tags.py wiki/ai/foo.md            # print suggestions for one note
python suggest_tags.py --all --write             # append suggestions to every note
python suggest_tags.py wiki/ai/foo.md --semantic # semantic ranking (needs keybert)
```

`suggest_tags.py` is dependency-light (pure-Python RAKE by default; optional
KeyBERT semantic ranking when `keybert` + `sentence-transformers` are installed).
See `AGENT.md` (`tag-suggest` command) for the agent workflow.

## Design philosophy

- **KISS** — the converter is a ~200-line, single-purpose script with no
  framework. The agent contract is plain prose.
- **Decoupled** — conversion (`conv2md.py`), UI, and knowledge work (`AGENT.md`) are
  separate concerns; one can change without the other.
- **Config-driven** — a single `config.toml` adapts the template to any context.
- **Portable** — everything is Markdown files in a folder; readable by Obsidian,
  any editor, and any agent. Back it up with plain git.

## Requirements

- Python 3.11+ (for `tomllib`; older versions still work with built-in defaults)
- `pandoc` for `.docx` / `.epub` (system install, or use the Docker image)
- `pymupdf4llm` for `.pdf` (in `requirements.txt`)
- A coding agent (Claude Code, OpenCode, Codex, Gemini CLI, Cursor, …)
- Optional: [Obsidian](https://obsidian.md) for browsing the wiki (graph view)
