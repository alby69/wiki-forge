---
name: wiki-ingest
description: >
  Use when the user wants to convert, ingest, or compile raw source documents into
  the wiki-forge knowledge base — e.g. "compile new sources", "convert files only",
  "ingest raw/paper.md", "recompile chapter 1".
triggers:
  commands: [compile, convert-only, ingest, recompile]
reads:
  - config.toml
  - sources/**/*
  - raw/**/*
writes:
  - raw/**/*
  - wiki/**/*.md
confirm_destructive: false
---

# Wiki Ingestion Skill

### `compile`
**Scope:** Full ingestion workflow. Converts new sources, reads raw, builds wiki.
**Steps:**
0. **Convert.** Run the converter so any new originals become Markdown in `raw/`:
   - Preferred: `bash run_convert.sh` (uses `config.toml` and the local venv).
   - Docker: `docker compose run --rm wiki convert`.
   - If neither Python nor pandoc is available, ask the user to run conversion first.
1. **Read** every file in `raw/` whose name does NOT contain `_COMPILED`.
2. **Classify**: identify one or more relevant thematic wikis.
3. **Decide**:
   - If no existing wiki fits and the material justifies it, create a new thematic wiki.
   - If the file spans multiple topics, distribute content across wikis.
4. **Write**:
   - Create new articles for concepts/entities/events not yet covered.
   - Update existing articles by integrating the new information.
   - Always cite the source file in the `## Sources` section.
5. **Link** new content with `[[wiki links]]` to related concepts.
6. **Update indexes**:
   - The `index.md` of every touched thematic wiki.
   - `wiki/index.md`, if you created a new wiki or changed one's scope.
7. **Rename** the source file in `raw/` by adding `_COMPILED` before the extension.
8. **Skip** any file whose name already contains `_COMPILED`.
**Output:** Structured summary: files processed, wikis created, articles created/updated, ambiguities.

### `convert-only`
**Scope:** Conversion sources→raw **without** wiki processing.
**Use when:** The user wants to preview converted text before compiling.
**Action:** Run `bash run_convert.sh` or Docker equivalent. Report files converted.

### `ingest <file-path>`
**Scope:** Process a **single** raw file into the wiki.
**Use when:** The user wants to compile one specific file without re-scanning all raw/.
**Action:** Read the specified file (ignoring `_COMPILED` status), classify, write/update articles, link, update indexes, rename to `_COMPILED`.
**Output:** Summary of what was created/updated from this single source.

### `recompile <file-path>`
**Scope:** Force re-processing of a file already marked `_COMPILED`.
**Use when:** The user has updated the source or wants to re-interpret it.
**Action:** Remove `_COMPILED` suffix, process as `ingest`, then re-add suffix.
**Confirmation:** Required if `agent.confirm_destructive` is true (default).
