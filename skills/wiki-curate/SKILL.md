---
name: wiki-curate
description: >
  Use when the user wants to create, edit, merge, split, stub, or retag articles
  and taxonomy within the wiki-forge knowledge base — e.g. "create new article
  claude-code", "merge article A into article B", "split article X", "stub missing link",
  "retag note".
triggers:
  commands: [new-article, merge, split, stub, retag, export-semantic, verify, human-review]
reads:
  - templates/article.md
  - wiki/**/*.md
writes:
  - wiki/**/*.md
confirm_destructive: true
---

# Wiki Curation & Knowledge Management Skill

### `new-article <article-name> [wiki-name]`
**Scope:** Create a new article from the standard template.
**Action:**
1. Read `templates/article.md` (or use built-in template if missing).
2. Replace `{{TITLE}}` with `<article-name>` (kebab-case → Title Case).
3. Set `created` and `updated` to today's date.
4. Place in `wiki/<wiki-name>/` if specified, else ask the user.
5. Update the thematic index and master index.
**Output:** Path of the new article.

### `merge <article-a> <article-b>`
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

### `split <article-path> <section-heading>`
**Scope:** Divide an article into two at the specified H2 section.
**Action:**
1. Read the article.
2. Split content: everything before `<section-heading>` stays, everything from that heading becomes the new article.
3. Suggest a name for the new article.
4. **Wait for explicit confirmation**.
5. Create both articles, update links, update indexes.
**Confirmation:** ALWAYS required.

### `stub <concept-name>`
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

### `retag <article-path> [+tag1 +tag2 ...] [-tag3 -tag4 ...]`
**Scope:** Modify tags of an existing article.
**Action:**
1. Read article frontmatter.
2. Add tags prefixed with `+`, remove tags prefixed with `-`.
3. Update `updated` date.
4. Save.
**Output:** Before/after tag list.

### `export-semantic`
**Scope:** Export OKF v0.2 knowledge base to W3C semantic formats (JSON-LD and Turtle).
**Action:**
- Executes `python3 scripts/export_semantic.py --wiki-dir wiki --output-dir output`.
- Generates `output/wiki_export.jsonld` and `output/wiki_export.ttl`.
**Output:** Paths to exported semantic graph files.

### `verify <note> [reviewer=<id>] [stable] [comment=<text>]` (alias: `human-review`)
**Scope:** Record a **human** verification event on a note — the only action that promotes a node to the `human-reviewed` trust tier (🟢 instead of 🟡/⚪ in the graph and sidebar).
**Action:**
1. Resolve `<note>` by id, title, or path.
2. Append an OKF v0.2 entry to the note's `verified` list:
   ```yaml
   verified:
     - by: human:<reviewer>
       at: <ISO-8601 timestamp>
   ```
3. If `stable` is passed, set `status: stable` (ontology Rule 3 only permits `stable` for human-verified notes).
4. Append a dated entry to `wiki/log.md`.
**Idempotent:** Re-running for the same reviewer does not duplicate the entry.
**Handled by:** the agent server (`/verify` dispatches to `executeVerifyWorkflow`) — no LLM call, deterministic file edit.
**Example:** `/verify stefano-gatti reviewer=studente stable`
**Output:** Note id, reviewer, timestamp, resulting trust tier, status, and log update.

