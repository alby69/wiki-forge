# AGENT.md — LLM Wiki Schema v2.0 (agent-agnostic router)

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
> Note: `skills/` is shared across all agent configurations and loaded on demand.

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
The main entry point conforming to OKF §8. It must contain:
1. Optional YAML frontmatter with `okf_version: "0.2"` at bundle root.
2. Section `# Wiki Index — Knowledge Base`.
3. A list of every thematic wiki subfolder and article counts.
4. A `## Recently Updated` section with Markdown links and one-line summaries.
Update it whenever you create a new thematic wiki or substantially change one.

### Master change log: `wiki/log.md`
The chronological update log conforming to OKF §9. It records creation, update, and deprecation events formatted as:
```markdown
# Wiki Update Log

## YYYY-MM-DD
* **Creation**: Added [Concept Title](path/concept.md) concept.
* **Update**: Regenerated [Concept Title](path/concept.md) with updated sources.
```

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

### Example frontmatter (OKF v0.2 Compliant)
```yaml
---
type: Concept
title: "LLM Wiki Pattern"
description: "Andrej Karpathy's pattern for persistent, agent-maintained knowledge bases."
resource: "https://karpathy.ai/blog/llm-wiki.html"
tags: [topic/ai, status/stable]
status: stable
stale_after: 2027-12-31T00:00:00Z
generated:
  by: wiki-forge-agent/v2.7
  at: 2026-09-02T12:00:00Z
verified:
  - by: human:alby69
    at: 2026-09-02T12:30:00Z
sources:
  - id: karpathy-blog
    resource: https://karpathy.ai/blog/llm-wiki.html
    title: "LLM Wiki — Karpathy Blog"
    author: human:karpathy
    last_modified: 2024-01-15T00:00:00Z
  - id: raw-sources
    resource: raw/llm-wiki-sources_COMPILED.md#L10-L25
    title: "Compiled raw sources on LLM Wiki"
    author: process:conv2md
    last_modified: 2026-09-01T00:00:00Z
---
```

### OKF Compliance Checklist
Before declaring any article complete or finishing a compilation pass, verify:
- [ ] `type` field present and drawn from controlled vocabulary in `config.toml`.
- [ ] `title` and concise `description` present.
- [ ] `generated.by` (actor convention) and `generated.at` (ISO 8601 UTC) populated.
- [ ] `sources` array present with `id`, `resource`, `title`, `author`, `last_modified`.
- [ ] Body citations/footnotes match `sources[].id`.
- [ ] `status` set to `draft`, `stable`, or `deprecated`.
- [ ] `wiki/log.md` updated with entry under current date (`## YYYY-MM-DD`).
- [ ] Reserved files `index.md` and `log.md` checked with `make okf-lint`.

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

## 5. Skill Index

wiki-forge's command surface is organized into six Skills under `skills/`.
Load only the skill file matching the user's request; do not load all six.

| Skill | Load when the user wants to… | File |
|---|---|---|
| Ingestion | add sources, convert, compile, (re)ingest a file | `skills/wiki-ingest/SKILL.md` |
| Curation | create/merge/split an article, tag it, stub a missing link | `skills/wiki-curate/SKILL.md` |
| Audit & Maintenance | check health, fix broken links, reindex, prune, lint | `skills/wiki-audit/SKILL.md` |
| Query & Research | ask a question, search, trace a claim, deep-research | `skills/wiki-query/SKILL.md` |
| Study & Synthesis | study guide, quiz, mindmap, audio overview, quick notes | `skills/wiki-study/SKILL.md` |
| Onboarding & Utility | run the scenario wizard, stats, export, tags, help | `skills/wiki-onboarding/SKILL.md` |

If the request doesn't clearly match one skill (e.g. it spans ingestion +
audit), load both — skills are additive context, not exclusive branches.
See `skills/README.md` for the full index and `## 6 Workflow Orchestration`
below for macro-commands (`compile`, `audit`, `consult`) that internally span
multiple skills.

---

## 6. Workflow Orchestration (Macro-commands)

The atomic commands live in their respective `skills/*/SKILL.md` files.
The following are **orchestrated workflows** that chain multiple atomic commands. They exist for convenience but internally call the atomic commands.

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
