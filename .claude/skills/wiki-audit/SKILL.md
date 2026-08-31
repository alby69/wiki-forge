---
name: wiki-audit
description: >
  Use when the user wants to check wiki health, audit broken links, find orphans
  or duplicates, reindex, prune empty stubs, or lint frontmatter — e.g. "audit wiki",
  "audit links", "audit orphans", "reindex", "prune empty notes", "lint frontmatter".
triggers:
  commands: [audit, reindex, prune, lint-frontmatter]
reads:
  - wiki/**/*.md
  - .pre-commit-config.yaml
writes:
  - wiki/**/index.md
  - wiki/index.md
confirm_destructive: true
---

# Wiki Audit & Maintenance Skill

### `audit` (full)
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

### `audit links`
**Scope:** Check only broken `[[wikilinks]]`.
**Output:** List of broken links with source articles and suggested fixes (create stub / remove link / fix typo).

### `audit orphans`
**Scope:** Find articles with zero inbound or outbound links.
**Output:** List of orphan articles with suggestions for linking.

### `audit duplicates`
**Scope:** Identify potential duplicate articles.
**Output:** Pairs of articles with similar titles or overlapping content, suggesting `merge`.

### `audit indexes`
**Scope:** Verify alignment between `index.md` files and actual files on disk.
**Output:** Missing entries, stale entries, and wikis not listed in master index.

### `reindex [wiki-name]`
**Scope:** Regenerate index files.
**Action:**
- If `wiki-name` provided: regenerate only `wiki/<wiki-name>/index.md`.
- If omitted: regenerate all thematic indexes AND `wiki/index.md`.
**Use when:** After bulk renames, moves, or manual edits.

### `prune`
**Scope:** Remove orphan articles and empty stubs after confirmation.
**Action:**
1. Identify orphans and empty stubs (articles with <50 words and no inbound links).
2. Present list to user.
3. **Wait for explicit confirmation**.
4. Delete confirmed files and update indexes.
**Confirmation:** ALWAYS required.

### `lint-frontmatter`
**Scope:** Validate YAML frontmatter across all articles.
**Checks:**
- Required keys: `tags`, `created`, `updated`, `sources`.
- Date format: `YYYY-MM-DD`.
- `tags` is a list of strings.
- `sources` is a list of strings.
**Output:** List of violations with file paths.
