# AGENT.md — LLM Wiki Schema v2.0 (agent-agnostic)

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
>   - Google Jules  -> `JULES.md`
> Example: `cp AGENT.md CLAUDE.md` (or `ln -s AGENT.md CLAUDE.md`).

---

## 1. Role

You are the librarian of a personal knowledge base (an "LLM Wiki"). Your job is
to ingest raw material, maintain a structured wiki, and answer queries with
accurate, traceable syntheses. The user curates the sources and asks questions;
you do all the bookkeeping (summarizing, cross-referencing, filing, indexing).

Read `config.toml` first to learn the **project title**, **context**, **language**,
and **folder layout**. Use the `context` field to calibrate tone, taxonomy, and the
kind of connections you draw. Respect `agent.confirm_destructive` setting.

---

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

### `templates/`
- Standard templates for new articles (`templates/article.md`).
- You read from here; the user may customize templates.

---

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

---

## 4. Editorial conventions for articles

### Mandatory structure (in this order)
1. YAML frontmatter with `tags`, `created`, `updated`, `sources`.
2. H1 title with the concept name.
3. Introduction of 2-4 lines.
4. A `## Summary` section with 3-7 high-density bullet points.
5. Body organized in `##` sections.
6. A final `## Related` section with `[[wiki links]]`.
7. A final `## Sources` section with traceable references to files in `raw/`. Rationale and claim-level quotes SHOULD include line-number anchors when available (e.g. `raw/interview-claude_COMPILED.md#L12-L24`).

### Example frontmatter
```yaml
---
tags: [ai-tools, agents, ide]
created: 2026-04-29
updated: 2026-04-29
sources:
  - raw/interview-claude_COMPILED.md#L12-L24
  - raw/tool-ai-article_COMPILED.md#L50-L65
---
```

### Writing style
- Clear, concise, high information density.
- Bullet points and short sections aid scanning.
- No fluff, no repetition, no preambles.
- Always define technical terms on first use.
- Match the `project.language` and `i18n` configurations in `config.toml`. When handling multilingual sources, synthesize articles into the target wiki language specified in configuration while preserving original term references where helpful.

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

---

## 5. COMMAND REFERENCE

> This section defines the **standardized command syntax** the user can type.
> Each command has a clear scope, inputs, outputs, and confirmation rules.
> **Always** acknowledge the command before executing and summarize results.

### 5.1 Ingestion Commands

#### `compile`
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

#### `convert-only`
**Scope:** Conversion sources→raw **without** wiki processing.
**Use when:** The user wants to preview converted text before compiling.
**Action:** Run `bash run_convert.sh` or Docker equivalent. Report files converted.

#### `ingest <file-path>`
**Scope:** Process a **single** raw file into the wiki.
**Use when:** The user wants to compile one specific file without re-scanning all raw/.
**Action:** Read the specified file (ignoring `_COMPILED` status), classify, write/update articles, link, update indexes, rename to `_COMPILED`.
**Output:** Summary of what was created/updated from this single source.

#### `recompile <file-path>`
**Scope:** Force re-processing of a file already marked `_COMPILED`.
**Use when:** The user has updated the source or wants to re-interpret it.
**Action:** Remove `_COMPILED` suffix, process as `ingest`, then re-add suffix.
**Confirmation:** Required if `agent.confirm_destructive` is true (default).

---

### 5.2 Knowledge Commands

#### `new-article <article-name> [wiki-name]`
**Scope:** Create a new article from the standard template.
**Action:**
1. Read `templates/article.md` (or use built-in template if missing).
2. Replace `{{TITLE}}` with `<article-name>` (kebab-case → Title Case).
3. Set `created` and `updated` to today's date.
4. Place in `wiki/<wiki-name>/` if specified, else ask the user.
5. Update the thematic index and master index.
**Output:** Path of the new article.

#### `merge <article-a> <article-b>`
**Scope:** Unify two overlapping articles into one.
**Action:**
1. Read both articles.
2. Present a merge plan to the user (which sections go where, which title wins).
3. **Wait for explicit confirmation** before proceeding.
4. Create the merged article under the preferred title.
5. Update all `[[wikilinks]]` pointing to the removed article.
6. Delete the secondary article.
7. Update indexes.
**Confirmation:** ALWAYS required, regardless of config.

#### `split <article-path> <section-heading>`
**Scope:** Divide an article into two at the specified H2 section.
**Action:**
1. Read the article.
2. Split content: everything before `<section-heading>` stays, everything from that heading becomes the new article.
3. Suggest a name for the new article.
4. **Wait for explicit confirmation**.
5. Create both articles, update links, update indexes.
**Confirmation:** ALWAYS required.

#### `stub <concept-name>`
**Scope:** Create a minimal placeholder article for a cited but missing concept.
**Action:**
1. Create `wiki/<appropriate-wiki>/<concept-name>.md` with minimal content:
   - Frontmatter with tag `stub`.
   - H1 title.
   - One-line description: "Stub: <concept> is cited in [[article-x]], [[article-y]]."
   - `## Related` with backlinks.
2. Update the thematic index.
3. Flag in session summary: "Created stub for <concept> — please expand."
**Use when:** During `compile` or `audit`, you find `[[links]]` pointing to non-existent articles.

#### `retag <article-path> [+tag1 +tag2 ...] [-tag3 -tag4 ...]`
**Scope:** Modify tags of an existing article.
**Action:**
1. Read article frontmatter.
2. Add tags prefixed with `+`, remove tags prefixed with `-`.
3. Update `updated` date.
4. Save.
**Output:** Before/after tag list.

---

### 5.3 Maintenance Commands

#### `audit` (full)
**Scope:** Complete health-check of the knowledge base.
**Checks:**
- **Duplicates**: overlapping articles that should be merged.
- **Broken links**: `[[wikilinks]]` pointing to non-existent articles.
- **Inconsistencies**: contradictory claims across articles.
- **Orphan articles**: pages with no inbound or outbound links.
- **Isolated wikis**: thematic wikis disconnected from the rest of the KB.
- **Coverage gaps**: concepts cited often but lacking their own article.
- **Index drift**: entries in `index.md` files that don't match real files (and vice versa).
- **Frontmatter lint**: missing or malformed YAML frontmatter.
**Output:**
1. List of problems found, grouped by category.
2. Concrete suggestion for each (specific action + files involved).
3. Any structural improvements (reorganization, merge, split).
**Important:** always wait for explicit user confirmation before applying changes.

#### `audit links`
**Scope:** Check only broken `[[wikilinks]]`.
**Output:** List of broken links with source articles and suggested fixes (create stub / remove link / fix typo).

#### `audit orphans`
**Scope:** Find articles with zero inbound or outbound links.
**Output:** List of orphan articles with suggestions for linking.

#### `audit duplicates`
**Scope:** Identify potential duplicate articles.
**Output:** Pairs of articles with similar titles or overlapping content, suggesting `merge`.

#### `audit indexes`
**Scope:** Verify alignment between `index.md` files and actual files on disk.
**Output:** Missing entries, stale entries, and wikis not listed in master index.

#### `reindex [wiki-name]`
**Scope:** Regenerate index files.
**Action:**
- If `wiki-name` provided: regenerate only `wiki/<wiki-name>/index.md`.
- If omitted: regenerate all thematic indexes AND `wiki/index.md`.
**Use when:** After bulk renames, moves, or manual edits.

#### `prune`
**Scope:** Remove orphan articles and empty stubs after confirmation.
**Action:**
1. Identify orphans and empty stubs (articles with <50 words and no inbound links).
2. Present list to user.
3. **Wait for explicit confirmation**.
4. Delete confirmed files and update indexes.
**Confirmation:** ALWAYS required.

#### `lint-frontmatter`
**Scope:** Validate YAML frontmatter across all articles.
**Checks:**
- Required keys: `tags`, `created`, `updated`, `sources`.
- Date format: `YYYY-MM-DD`.
- `tags` is a list of strings.
- `sources` is a list of strings.
**Output:** List of violations with file paths.

---

### 5.4 Query Commands

#### `deep-research <question>`
**Scope:** Conduct an in-depth, multi-source research synthesis report across the entire wiki.
**Steps:**
1. Identify all relevant articles and thematic wikis across the knowledge base using broader search scope.
2. Synthesize detailed findings into a formal report saved in `output/research-<slug>-<date>.md`.
3. Report structure must include: Executive Summary, Thematic Deep-Dive Sections, Source Attribution Matrix (Claim → Source File), and Identified Knowledge Gaps (areas requiring additional raw sources).
4. Optionally suggest archiving key findings into `wiki/` as a permanent article.
**Output:** Comprehensive report saved in `output/research-<slug>-<date>.md`.

#### `consult <question>`
**Scope:** Answer a user question from the wiki.
**Steps:**
1. Read `wiki/index.md` to identify relevant wikis.
2. Read the `index.md` of relevant wikis to locate pertinent articles.
3. Read only the articles you need, not the whole wiki.
4. Build the answer by synthesizing the gathered information.
5. Cite used articles as `[[wiki links]]`.
6. If the question finds no answer in the KB, say so explicitly and propose which sources the user could ingest to close the gap.
**Output:** Synthesis + citations. If valuable, propose saving to `output/` or as a new article.

#### `search <term>`
**Scope:** Full-text search across all wiki articles.
**Action:** Scan all `.md` files in `wiki/` for the term (case-insensitive).
**Output:** List of matching articles with context snippets (2 lines before/after match).

#### `backlinks <article-path>`
**Scope:** Show all articles that link to the specified article.
**Action:** Scan all `wiki/**/*.md` for `[[<article-name>]]` or `[[<article-name>|...]]`.
**Output:** List of source articles with context.

#### `related <article-path>`
**Scope:** Suggest articles related to the specified one but not yet linked.
**Action:**
1. Read the article.
2. Identify key concepts in the text.
3. Find other articles mentioning those concepts.
4. Exclude already-linked articles.
**Output:** Suggested new `[[links]]` with rationale.

#### `trace <claim>`
**Scope:** Trace the origin of a specific claim or concept with line-level grounding.
**Action:**
1. Search wiki articles for the claim.
2. Follow `## Sources` references and frontmatter `sources:` to `raw/` files.
3. Extract exact line ranges and text passages from `raw/` files if line anchors (e.g. `#L10-L25`) are present or searchable.
4. Report the primary source(s), line range, passage snippet, and intermediate synthesis chain.
**Output:** Chain: claim → wiki article(s) → raw source(s)#L<start>-L<end> → exact passage snippet.

---

### 5.5 Utility Commands

#### `stats`
**Scope:** Generate statistics about the knowledge base.
**Metrics:**
- Total articles, total wikilinks, broken links, orphan articles.
- Coverage gaps (concepts cited >3 times without article).
- Number of thematic wikis, sources ingested.
- Last compile date, last audit date (from `METRICS.md` or infer).
- Top 10 most linked articles.
- Top 10 tags by frequency.
**Output:** Structured report. Propose saving to `METRICS.md`.

#### `export <format>`
**Scope:** Export the wiki to another format.
**Supported formats:** `json`, `html`, `obsidian-vault`.
**Action:**
- `json`: Create `output/wiki-export.json` with all articles, metadata, and link graph.
- `html`: Create `output/wiki-export/` with interlinked HTML pages.
- `obsidian-vault`: Create `output/obsidian-vault/` with `.obsidian/` config and wiki structure.
**Output:** Path to exported files.

#### `diff <article-path>`
**Scope:** Show changes to an article (requires git).
**Action:** Run `git diff` on the article. If not git-tracked, report last `updated` date and suggest enabling git.
**Output:** Diff or last-modified info.

#### `template show`
**Scope:** Display the standard article template.
**Action:** Read `templates/article.md` or show built-in template.
**Output:** Template content.

#### `sources regenerate`
**Scope:** Rebuild `SOURCES.md` from the current wiki state.
**Action:**
1. Scan all articles for `sources:` in frontmatter.
2. Aggregate unique sources.
3. Group by author (if parseable) and by topic (using tags).
4. Write updated `SOURCES.md` with proper YAML frontmatter.
**Output:** Confirmation + summary of sources found.

#### `tag-suggest [file-or-folder]`
**Scope:** Propose tags for one note or the whole wiki from the controlled vocabulary
in `config.toml` (`[tags].allowed`).
**Action:** Run `python suggest_tags.py <file>` (single note) or
`python suggest_tags.py --all` (whole `wiki/`). The script ranks the allowed tags
by RAKE frequency scoring, or semantically via KeyBERT when `keybert` is installed
(`python suggest_tags.py <file> --semantic`). Use `--write` to append suggestions to
each note's frontmatter `tags:` (existing tags are preserved, duplicates skipped).
**Output:** For each note: existing tags, suggested tags, and the resulting `tags:` list.
**Use when:** Building or rebalancing the taxonomy, or after a large `compile`.

#### `help [command]`
**Scope:** Contextual help.
**Action:** If `[command]` provided, show syntax and description. If omitted, list all commands by category.
**Output:** Help text.

---

### 5.6 Wizard Commands

#### `/wizard`
**Scope:** Interactive scenario guidance and step-by-step workflow execution.
**Action:**
1. Interactively ask the user what domain goal they want to achieve (or present available presets from `config/scenarios.toml`: `academic`, `business`, `research`, `creative`, `existing`).
2. Recommend a target workflow sequence.
3. Execute the corresponding atomic commands step-by-step.

#### `/wizard [scenario]`
**Scope:** Instantly start a predefined scenario workflow (e.g. `/wizard academic`, `/wizard business`, `/wizard research`, `/wizard creative`, `/wizard existing`).
**Action:**
1. Read the specified scenario definition from `config/scenarios.toml`.
2. Announce the scenario goals and primary workflow steps.
3. Execute the workflow commands sequentially.

#### Agent Behavior Guidelines for `/wizard`:
1. **Explicit Step Announcement:** The agent MUST explicitly state the step being performed before executing any tool or script.
2. **User Confirmation:** The agent MUST wait for explicit user confirmation before executing major destructive or heavy operations (e.g., full `compile` or destructive `prune`/`recompile`).
3. **Uniform Header Formatting:** Progress updates MUST be formatted with a uniform header structure: `[WIZARD STEP X/Y: Step Name]`.

---

### 5.7 Quick Notes & Scratchpad Commands

#### `note <text>`
**Scope:** Record a quick scratchpad note without indexing it into the formal `wiki/index.md`.
**Action:**
1. Append the dated note to `notes/quick-notes.md` (or create `notes/note-<slug>.md` if text is long).
2. The `notes/` directory is excluded from `wiki/index.md` until explicitly promoted.
**Output:** File path and confirmation of stored note.

#### `audio-overview <article-path|wiki-name>`
**Scope:** Generate a 2-speaker conversational dialogue script (Host A / Host B podcast synthesis) from target wiki content.
**Action:**
1. Read target article(s) or thematic wiki notes.
2. Generate an engaging multi-turn dialogue script synthesizing key themes, saved in `output/audio-script-<name>.md`.
3. Check `[audio]` configuration in `config.toml`. If `provider = "none"` (default), report that script is generated and TTS is disabled. If a TTS provider is configured, trigger synthesis into `output/audio/<name>.mp3`.
**Output:** Dialogue script in `output/audio-script-<name>.md` and optional `.mp3` audio file.

#### `promote-note <note-id> [wiki-name]`
**Scope:** Promote a scratchpad quick note into a full, structured wiki article.
**Action:**
1. Read the specified quick note from `notes/`.
2. Generate standard article structure with frontmatter, H1 title, summary, related wikilinks, and sources.
3. Save to `wiki/<wiki-name>/<note-id>.md` and update thematic and master indexes.
4. Mark or archive the quick note as promoted in `notes/`.
**Output:** Path of the newly created wiki article.

---

### 5.8 Study & Analysis Commands

#### `study-guide <wiki-name|article-path>`
**Scope:** Generate a structured study guide from target wiki articles.
**Action:**
1. Read target article(s) or all notes in the thematic wiki.
2. Generate structured synthesis containing: Executive Summary, Section Breakdown, Key Glossary/Terms, and 5-10 Self-Assessment Questions with Answers.
3. Save Markdown to `output/study-guide-<name>.md` with frontmatter pointing to source articles.
**Output:** File path `output/study-guide-<name>.md` and summary report.

#### `mindmap <article-path>`
**Scope:** Generate a hierarchical mind map structure for a single article or topic.
**Action:**
1. Read the target article or topic notes.
2. Extract headings (`##`, `###`), key bullet points, and concept relationships.
3. Generate an indented tree Markdown representation and JSON node-link structure in `output/mindmap-<name>.md`.
**Output:** Markdown tree structure in `output/mindmap-<name>.md`.

#### `quiz <wiki-name|article-path> [n-questions]`
**Scope:** Generate an interactive self-test quiz from target wiki content.
**Action:**
1. Read target article(s) or thematic wiki notes.
2. Generate structured Markdown quiz containing `[n-questions]` (default 5): Question, Multiple Choice Options (A/B/C/D), Correct Answer, Explanation, and Source Citation.
3. Save to `output/quiz-<name>.md`.
**Output:** File path `output/quiz-<name>.md` and preview of questions.

---

## 6. Workflow Orchestration (Macro-commands)

The commands in §5 are **atomic**. The following are **orchestrated workflows** that chain multiple atomic commands. They exist for convenience but internally call the atomic commands.

### `compile` (orchestrated)
Equivalent to: `convert-only` → `ingest` (for each new raw file) → `reindex` → `audit indexes` (light).

### `audit` (orchestrated)
Equivalent to: `audit links` → `audit orphans` → `audit duplicates` → `audit indexes` → `lint-frontmatter` → `stats` (light).

### `consult` (orchestrated)
Equivalent to: `search` (internal) → read articles → synthesize.

---

## 7. Guiding principles

The knowledge base must be:
- **Consistent**: naming, structure, and style applied uniformly.
- **Readable**: every article understandable without revisiting sources.
- **Well-connected**: `[[wikilinks]]` form a dense network of related concepts.
- **Traceable**: every claim is attributable to a source in `raw/`.
- **Optimized for both humans and LLMs**: scannable at a glance by the user, parseable in few tokens by the agent.
- **Non-destructive by default**: never delete, merge, or reorganize without explicit user confirmation.

If unsure about structural choices (new wiki, article merge, folder reorganization), always ask the user for confirmation before acting.
