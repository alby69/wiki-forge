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
├── vite.config.ts        # Vite configuration
├── src/                  # Web UI source (TypeScript, decoupled)
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

## Browse the wiki (optional Web UI)

A lightweight, dependency-light **web viewer** is included for exploring the
knowledge base in a browser — no Obsidian required. It is a static
single-page app (Vite + TypeScript) with a three-column layout:

- **Vault sidebar** — all notes grouped by folder, plus a tag cloud and search.
- **Editor / Markdown panel** — the selected note's raw Markdown.
- **Graph viewer** — an interactive node-link map of `[[wikilinks]]` (with
  search and "minimum connections" filters), rendered from the real `wiki/`
  knowledge base (the `raw/` working inbox is intentionally excluded — see
  AGENT.md §2).

> The UI is a **read/explore viewer**. It bundles every Markdown file under
> `wiki/` at build time, so the agent — which edits those files on
> disk — remains the source of truth. Edits made in the UI are session-only.

**Where is the vault path set?** The UI presents the curated knowledge base
only: `wiki/` and its subfolders (thematic wikis). The `raw/` folder is the
agent's working inbox and is deliberately kept out of the viewer. The glob
pattern lives in `src/storage/FileStorage.ts` (`import.meta.glob([...])`) and
is resolved relative to that file, so the root folder is `../../wiki/**`. To
point the UI at a different vault, edit that literal string and rebuild
(`npm run build` or `docker compose build`). Note: Vite requires the glob to
be a literal string, not a variable.

### Run it

**Via Docker (zero Node.js local install):**

```bash
docker compose up ui
```
Or using Makefile shortcut: `make ui-docker`. This starts the Vite dev server inside a Node container and exposes it at `http://localhost:5174` (local `npm run dev` uses `http://localhost:5173`). The dev server does not auto-open a browser — open the URL manually.

**Via local Node.js install:**

```bash
npm install        # install UI dev dependencies (Vite, TypeScript)
npm run dev        # start the dev server at http://localhost:5173
```

Other scripts: `npm run build` (production bundle in `dist/`),
`npm run preview` (serve the built bundle), `npm run typecheck`,
`npm run test` (link/graph unit tests).

If you prefer not to install Node tooling, the knowledge base is also fully
browsable in **Obsidian** (open the project folder as a vault) — see TUTORIAL.md.

## Design philosophy

- **KISS** — the converter is a ~200-line, single-purpose script with no
  framework. The agent contract is plain prose.
- **Decoupled** — conversion (`conv2md.py`) and knowledge work (`AGENT.md`) are
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
