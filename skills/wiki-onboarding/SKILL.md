---
name: wiki-onboarding
description: >
  Use when the user wants scenario guidance via wizard, metrics stats, exports, git diffs,
  template viewing, sources regeneration, tag suggestions, or help — e.g. "/wizard",
  "wizard academic", "show stats", "export html", "diff note", "template show",
  "sources regenerate", "suggest tags", "help".
triggers:
  commands: [wizard, stats, export, diff, template show, sources regenerate, tag-suggest, help]
reads:
  - config/scenarios.toml
  - templates/article.md
  - wiki/**/*.md
writes:
  - SOURCES.md
  - output/**/*
confirm_destructive: false
---

# Wiki Onboarding & Utility Skill

### `/wizard`
**Scope:** Interactive scenario guidance and step-by-step workflow execution.
**Action:**
1. Interactively ask the user what domain goal they want to achieve (or present available presets from `config/scenarios.toml`: `academic`, `business`, `research`, `creative`, `existing`).
2. Recommend a target workflow sequence.
3. Execute the corresponding atomic commands step-by-step.

### `/wizard [scenario]`
**Scope:** Instantly start a predefined scenario workflow (e.g. `/wizard academic`, `/wizard business`, `/wizard research`, `/wizard creative`, `/wizard existing`).
**Action:**
1. Read the specified scenario definition from `config/scenarios.toml`.
2. Announce the scenario goals and primary workflow steps.
3. Execute the workflow commands sequentially.

#### Agent Behavior Guidelines for `/wizard`:
1. **Explicit Step Announcement:** The agent MUST explicitly state the step being performed before executing any tool or script.
2. **User Confirmation:** The agent MUST wait for explicit user confirmation before executing major destructive or heavy operations (e.g., full `compile` or destructive `prune`/`recompile`).
3. **Uniform Header Formatting:** Progress updates MUST be formatted with a uniform header structure: `[WIZARD STEP X/Y: Step Name]`.

### `stats`
**Scope:** Generate statistics about the knowledge base.
**Metrics:**
- Total articles, total wikilinks, broken links, orphan articles.
- Coverage gaps (concepts cited >3 times without article).
- Number of thematic wikis, sources ingested.
- Last compile date, last audit date (from `METRICS.md` or infer).
- Top 10 most linked articles.
- Top 10 tags by frequency.
**Output:** Structured report. Propose saving to `METRICS.md`.

### `export <format>`
**Scope:** Export the wiki to another format.
**Supported formats:** `json`, `html`, `obsidian-vault`.
**Action:**
- `json`: Create `output/wiki-export.json` with all articles, metadata, and link graph.
- `html`: Create `output/wiki-export/` with interlinked HTML pages.
- `obsidian-vault`: Create `output/obsidian-vault/` with `.obsidian/` config and wiki structure.
**Output:** Path to exported files.

### `diff <article-path>`
**Scope:** Show changes to an article (requires git).
**Action:** Run `git diff` on the article. If not git-tracked, report last `updated` date and suggest enabling git.
**Output:** Diff or last-modified info.

### `template show`
**Scope:** Display the standard article template.
**Action:** Read `templates/article.md` or show built-in template.
**Output:** Template content.

### `sources regenerate`
**Scope:** Rebuild `SOURCES.md` from the current wiki state.
**Action:**
1. Scan all articles for `sources:` in frontmatter.
2. Aggregate unique sources.
3. Group by author (if parseable) and by topic (using tags).
4. Write updated `SOURCES.md` with proper YAML frontmatter.
**Output:** Confirmation + summary of sources found.

### `tag-suggest [file-or-folder]`
**Scope:** Propose tags for one note or the whole wiki from the controlled vocabulary in `config.toml` (`[tags].allowed`).
**Action:** Run `python suggest_tags.py <file>` (single note) or `python suggest_tags.py --all` (whole `wiki/`). The script ranks the allowed tags by RAKE frequency scoring, or semantically via KeyBERT when `keybert` is installed (`python suggest_tags.py <file> --semantic`). Use `--write` to append suggestions to each note's frontmatter `tags:` (existing tags are preserved, duplicates skipped).
**Output:** For each note: existing tags, suggested tags, and the resulting `tags:` list.
**Use when:** Building or rebalancing the taxonomy, or after a large `compile`.

### `help [command]`
**Scope:** Contextual help.
**Action:** If `[command]` provided, show syntax and description. If omitted, list all commands by category.
**Output:** Help text.
