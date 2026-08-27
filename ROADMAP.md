# ROADMAP — Build & Maintain the LLM Wiki Template

> A step-by-step implementation plan written for **non-technical users**.
> Each phase states *what* to do, *why*, and *how* (with the simplest possible
> commands). Progress is tracked in the status table below and updated as work
> advances.

---

## Progress dashboard

| # | Phase                                  | Status      | Notes |
|---|----------------------------------------|-------------|-------|
| 0 | Understand the LLM Wiki concept        | ✅ Done     | `docs/KARPATHY_LLM_WIKI.md`, `TUTORIAL.md` |
| 1 | Scaffold project & single config knob  | ✅ Done     | `config.toml` |
| 2 | Dependency setup (Docker + classic)    | ✅ Done     | `Dockerfile`, `docker-compose.yml`, `requirements.txt` |
| 3 | Source ingestion & conversion          | ✅ Done     | `conv2md.py`, `run_convert.sh` (improved + idempotent) |
| 4 | Agent schema & COMPILE integration     | ✅ Done     | `AGENT.md` (agent-agnostic, converts raw in COMPILE) |
| 5 | Compile the existing knowledge base    | ⬜ Todo     | Run `compile` with the agent on current `raw/` |
| 6 | Sources registry                       | ✅ Done     | `SOURCES.md` |
| 7 | Daily use: Consult & Audit             | ⬜ Todo     | Use the three workflows |
| 8 | Documentation pass                     | ✅ Done     | `README.md`, `TUTORIAL.md`, this file |
| 9 | Publish to GitHub (choose a name)      | ⬜ Todo     | See §Repo name suggestions§ below |
| 10| Reuse the template for new subjects    | 🔄 Ongoing  | Change `config.toml`, copy repo |

Legend: ✅ Done · 🔄 Ongoing · ⬜ Todo

---

## Phase 0 — Understand the concept (no action needed)

**Goal:** know *why* this exists before touching anything.

- Read `docs/KARPATHY_LLM_WIKI.md` — the original idea file (offline copy).
- Skim `TUTORIAL.md` — the plain-language explanation.
- Core idea: the AI **compiles** a persistent, interlinked wiki from your
  sources instead of re-reading raw files on every question.

---

## Phase 1 — Scaffold the project & the single config knob

**Goal:** make the project reusable for *any* subject via one file.

- Everything customizable lives in **`config.toml`**:
  - `project.title`, `project.context`, `project.language`
  - `paths.sources`, `paths.raw`, `paths.wiki`, `paths.output`
  - `conversion.ocr`
- To spin up a *new* wiki: copy the repo, edit `config.toml`. No code changes.

---

## Phase 2 — Set up dependencies (two equivalent paths)

**Goal:** get Python + pandoc + `pymupdf4llm` working, with zero fuss.

### Path A — Docker (recommended, nothing installed locally)
```bash
docker compose build
docker compose run --rm wiki convert
```

### Path B — Classic install
```bash
python -m venv venv
venv\Scripts\pip install -r requirements.txt      # Windows
# venv/bin/pip install -r requirements.txt         # macOS/Linux
# Install pandoc: https://pandoc.org/installing.html
bash run_convert.sh
```
Both paths keep your files on your machine; the container is stateless.

---

## Phase 3 — Ingest & convert sources

**Goal:** turn original documents into clean Markdown in `raw/`.

1. Drop PDF / EPUB / DOCX (or MD / TXT) into `sources/` (currently `backup/`).
   Your originals are never modified.
2. Run the conversion:
   - Docker: `docker compose run --rm wiki convert`
   - Classic: `bash run_convert.sh`
3. Converted files appear in `raw/`. Already-converted files are **skipped**
   automatically, so re-running is safe.

**Quality notes on `conv2md.py`** (reviewed and improved this pass):
- Single responsibility: format → Markdown only. No wiki logic inside.
- Idempotent: skips files already present in `raw/` (no duplicates).
- Handles PDF (pymupdf4llm), EPUB/DOCX (pandoc), MD/TXT (copy).
- Configurable via `config.toml`; falls back to safe defaults if absent.
- Plain, commented code; minimal dependencies.

---

## Phase 4 — Agent schema & COMPILE integration

**Goal:** give the agent a clear, agent-agnostic operating manual that also
**converts new sources during COMPILE**.

- `AGENT.md` is the single source of truth for agent behavior.
- It is compatible with Claude Code (`CLAUDE.md`), Codex (`AGENTS.md`),
  OpenCode (`OPENCODE.md`), Gemini (`GEMINI.md`) — copy or symlink it.
- The **COMPILE** workflow now: (0) runs the converter so new `sources/` become
  `raw/`, then (1) reads `raw/`, (2) classifies, (3) writes/updates wiki
  articles, (4) links, (5) updates indexes, (6) renames processed files with
  `_COMPILED`.

---

## Phase 5 — Compile the existing knowledge base  ⬜ Todo

**Goal:** turn the current `raw/*_COMPILED.md` (and any new files) into the wiki.

1. Open your coding agent inside this folder.
2. Ensure `AGENT.md` is visible to it (see Phase 4 / README).
3. Type: `compile`
4. Review the agent's summary; correct taxonomy if needed.
5. Repeat whenever you add sources.

> This phase requires an interactive agent session, so it is left as a user
> action rather than an automated script.

---

## Phase 6 — Sources registry  ✅ Done

**Goal:** keep a human-readable bibliography of what feeds the wiki.

- `SOURCES.md` lists every source by author and by topic, linking to the
  `raw/` file and the wiki article. Regenerate/extend it as you add material.

---

## Phase 7 — Daily use: Consult & Audit  ⬜ Todo

**Goal:** get value from the wiki and keep it healthy.

- **Consult:** ask any question; the agent answers from the wiki with citations.
- **Audit / Lint:** periodically ask the agent to find broken links, duplicates,
  orphans, and index drift. Always confirm before the agent applies changes.

---

## Phase 8 — Documentation pass  ✅ Done

- `README.md` — quick start (Docker + classic) and configuration.
- `TUTORIAL.md` — non-technical walkthrough.
- `ROADMAP.md` — this file.
- `docs/KARPATHY_LLM_WIKI.md` — the idea file (reference).

---

## Phase 9 — Publish to GitHub  ⬜ Todo

**Goal:** back up and share the template as a public/versioned repo.

### Repo name suggestions (a template for LLM-Wiki)
Pick one that signals "reusable LLM-wiki template":

1. **`llm-wiki-template`** — clear, searchable, exactly what it is. *(recommended)*
2. **`wiki-forge`** — short, evokes "forging" a wiki from sources.
3. **`mdwiki`** — minimal, Markdown-first.
4. **`second-brain-template`** — speaks to the Karpathy framing.
5. **`compound-wiki`** — hints at the "compounding knowledge" property.
6. **`obsidian-llm-wiki`** — if you want to foreground Obsidian compatibility.

Proposed `.gitignore` (keep data out of git history if desired):
```
venv/
.venv/
__pycache__/
*.pyc
.obsidian/
```
> Note: many users *want* the wiki in git (it is just Markdown). In that case
> commit `wiki/`, `raw/`, `SOURCES.md`, and ignore only `venv/` and `.obsidian/`.

---

## Phase 10 — Reuse for new subjects  🔄 Ongoing

**Goal:** apply the same template to a different context without rewriting code.

1. Copy the repository to a new folder.
2. Edit `config.toml`: new `title`, `context`, folder names if you like.
3. Empty `sources/`, `raw/`, `wiki/` (keep the structure).
4. Start from Phase 3.

Because conversion and knowledge work are decoupled and config-driven, the
template adapts to any domain while the code stays unchanged.

---

## Design principles upheld

- **KISS** — small, single-purpose tools; prose-based agent contract.
- **Decoupled** — `conv2md.py` (conversion) ≠ `AGENT.md` (knowledge work).
- **Config-driven** — one `config.toml` adapts the whole project.
- **Portable** — plain Markdown in a folder; readable by any editor/agent;
  backable with plain git.
- **International & robust** — all code and docs in English; minimal, explicit
  dependencies.
