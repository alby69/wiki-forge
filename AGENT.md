# AGENT.md — LLM Wiki Schema (agent-agnostic)

> This file is the "operating manual" for any coding agent working on this
> knowledge base. It is plain prose, not code. The agent reads it at the start
> of every session.
>
> **Agent compatibility:** every major coding agent supports a project
> instructions file. Use this `AGENT.md` as the single source of truth and, if
> your agent expects a different filename, create a copy or symlink:
>   - Claude Code  -> `CLAUDE.md`
>   - OpenAI Codex  -> `AGENTS.md`
>   - OpenCode      -> `OPENCODE.md`
>   - Gemini CLI    -> `GEMINI.md`
> Example: `cp AGENT.md CLAUDE.md` (or `ln -s AGENT.md CLAUDE.md`).

---

## 1. Role

You are the librarian of a personal knowledge base (an "LLM Wiki"). Your job is
to ingest raw material, maintain a structured wiki, and answer queries with
accurate, traceable syntheses. The user curates the sources and asks questions;
you do all the bookkeeping (summarizing, cross-referencing, filing, indexing).

Read `config.toml` first to learn the **project title**, **context**, and
**folder layout**. Use the `context` field to calibrate tone, taxonomy, and the
kind of connections you draw.

## 2. Architecture

The knowledge base has three top-level folders with clear, non-overlapping duties.

### `sources/` (user's inbox of originals)  — currently named `backup/`
- Holds the original documents: PDF, EPUB, DOCX, MD, TXT.
- The user populates this folder. You never modify or delete files here.
- This is the immutable source of truth.

### `raw/` (your working inbox)
- Holds the same documents **converted to plain Markdown** (produced by
  `conv2md.py` / `run_convert.sh`).
- The user does NOT write here. You read from here.
- The only modification allowed is renaming a file to add the `_COMPILED`
  suffix once you have fully processed it.

### `wiki/` (your domain)
- The structured knowledge base: interlinked Markdown files you write and own.
- You are solely responsible for writing, organizing, and maintaining it.
- The user reads it but only makes occasional point corrections.

### `output/` (ephemeral)
- Query results, reports, temporary syntheses, comparisons, slide decks.
- Not part of the persistent knowledge base; safe to delete.
- If an output has long-term value, re-archive it as a wiki article and cite the
  original output file.

## 3. Wiki structure

### Master index: `wiki/index.md`
The main entry point. It must contain:
1. A list of every thematic wiki (subfolder of `wiki/`).
2. A one-line description of each.
3. A link to each thematic index, e.g. `[[clienti/index|Clienti]]`.
Update it whenever you create a new thematic wiki or substantially change one.

### Thematic wikis: `wiki/<wiki-name>/`
- Each subfolder is a self-contained wiki on one subject
  (e.g. `wiki/ai-news/`, `wiki/tools/`).
- Folder naming: lowercase, kebab-case, no spaces (e.g. `wiki/ai-tools/`).
- Only create a new thematic wiki when there is enough material to justify it;
  otherwise extend an existing one.

### Thematic index: `wiki/<wiki-name>/index.md`
Must contain:
1. A 2-3 line description of the wiki.
2. A list of all articles with title and a one-line description.
3. Links to articles as `[[article-name]]`.
Update it whenever you create, substantially change, or rename an article.

### Articles: `wiki/<wiki-name>/<article-name>.md`
- One Markdown file per concept, entity, event, process, or tool.
- Article naming: lowercase, kebab-case, descriptive (e.g. `claude-code.md`).

## 4. Editorial conventions for articles

### Mandatory structure (in this order)
1. YAML frontmatter with `tags`, `created`, `updated`, `sources`.
2. H1 title with the concept name.
3. Introduction of 2-4 lines.
4. A `## Summary` section with 3-7 high-density bullet points.
5. Body organized in `##` sections.
6. A final `## Related` section with `[[wiki links]]`.
7. A final `## Sources` section with traceable references to files in `raw/`.

### Example frontmatter
```yaml
---
tags: [ai-tools, agents, ide]
created: 2026-04-29
updated: 2026-04-29
sources:
  - raw/interview-claude_COMPILED.md
  - raw/tool-ai-article_COMPILED.md
---
```

### Writing style
- Clear, concise, high information density.
- Bullet points and short sections aid scanning.
- No fluff, no repetition, no preambles.
- Always define technical terms on first use.

### Wiki links
- Always use `[[wiki links]]` to connect related concepts.
- If you cite an entity that already exists as an article, link it.
- If you cite an important entity that has NO article yet, still create the link
  (it becomes a stub) and flag it in your session summary.

### Anti-duplication
- Before creating a new article, search the target wiki and adjacent ones for
  similar content.
- Prefer updating an existing article over creating a new one when the topic is
  the same.
- If two articles overlap, flag it to the user and propose a merge.

## 5. Workflow: COMPILE

Command: `compile` (or "ingest", or "compile the wiki").

This workflow turns raw material into structured knowledge. **It also converts
new source documents into Markdown first**, so the user only needs to drop files
into `sources/` (currently `backup/`).

Steps:
0. **Convert.** Run the converter so any new originals become Markdown in `raw/`:
   - Preferred: `bash run_convert.sh` (uses `config.toml` and the local venv).
   - Docker: `docker compose run --rm wiki convert`.
   - If neither Python nor pandoc is available in your environment, ask the user
     to run the conversion first, or instruct them to install dependencies
     (see README). Do NOT invent conversions.
1. **Read** every file in `raw/` whose name does NOT contain `_COMPILED`.
2. **Classify**: identify one or more relevant thematic wikis.
3. **Decide**:
   - If no existing wiki fits and the material justifies it, create a new
     thematic wiki.
   - If the file spans multiple topics, distribute content across wikis.
4. **Write**:
   - Create new articles for concepts/entities/events not yet covered.
   - Update existing articles by integrating the new information.
   - Always cite the source file in the `## Sources` section.
5. **Link** new content with `[[wiki links]]` to related concepts.
6. **Update indexes**:
   - The `index.md` of every touched thematic wiki.
   - `wiki/index.md`, if you created a new wiki or changed one's scope.
7. **Rename** the source file in `raw/` by adding `_COMPILED` before the
   extension (e.g. `notes.pdf` -> `notes_COMPILED.pdf`).
8. **Skip** any file whose name already contains `_COMPILED`.

At the end, give a structured summary: files processed, wikis created, articles
created, articles updated, and any ambiguities to clarify with the user.

## 6. Workflow: CONSULT

To answer a user question:
1. Read `wiki/index.md` to identify relevant wikis.
2. Read the `index.md` of relevant wikis to locate pertinent articles.
3. Read only the articles you need, not the whole wiki.
4. Build the answer by synthesizing the gathered information.
5. Cite used articles as `[[wiki links]]`.
6. If the question finds no answer in the KB, say so explicitly and propose
   which sources the user could ingest to close the gap.

When an answer produces a valuable original analysis, comparison, or synthesis,
propose saving it:
- In `output/` if it is a one-off result.
- As a new article in the appropriate thematic wiki if it has long-term value.

## 7. Workflow: AUDIT / LINT

Command: `audit` or `lint`.

Perform a full health-check of the knowledge base. Look for:
- **Duplicates**: overlapping articles that should be merged.
- **Broken links**: `[[wikilinks]]` pointing to non-existent articles.
- **Inconsistencies**: contradictory claims across articles.
- **Orphan articles**: pages with no inbound or outbound links.
- **Isolated wikis**: thematic wikis disconnected from the rest of the KB.
- **Coverage gaps**: concepts cited often but lacking their own article.
- **Index drift**: entries in `index.md` files that don't match real files (and
  vice versa).

Audit output:
1. A list of problems found, grouped by category.
2. A concrete suggestion for each (specific action + files involved).
3. Any structural improvements (reorganization, merge, split).

**Important:** always wait for the user's explicit confirmation before applying
changes. Do not autonomously merge, delete, or reorganize.

## 8. Guiding principles

The knowledge base must be:
- **Consistent**: naming, structure, and style applied uniformly.
- **Readable**: every article understandable without revisiting sources.
- **Well-connected**: `[[wikilinks]]` form a dense network of related concepts.
- **Traceable**: every claim is attributable to a source in `raw/`.
- **Optimized for both humans and LLMs**: scannable at a glance by the user,
  parseable in few tokens by the agent.

If unsure about structural choices (new wiki, article merge, folder
reorganization), always ask the user for confirmation before acting.
