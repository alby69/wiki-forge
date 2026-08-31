---
name: wiki-query
description: >
  Use when the user wants to consult, search, trace claims, find backlinks or related
  notes, or execute deep research reports — e.g. "consult what is X", "search term",
  "backlinks to article", "trace claim", "deep research on topic".
triggers:
  commands: [consult, search, backlinks, related, trace, deep-research]
reads:
  - wiki/**/*.md
  - raw/**/*.md
writes:
  - output/research-*.md
confirm_destructive: false
---

# Wiki Query & Research Skill

### `deep-research <question>`
**Scope:** Conduct an in-depth, multi-source research synthesis report across the entire wiki.
**Steps:**
1. Identify all relevant articles and thematic wikis across the knowledge base using broader search scope.
2. Synthesize detailed findings into a formal report saved in `output/research-<slug>-<date>.md`.
3. Report structure must include: Executive Summary, Thematic Deep-Dive Sections, Source Attribution Matrix (Claim → Source File), and Identified Knowledge Gaps (areas requiring additional raw sources).
4. Optionally suggest archiving key findings into `wiki/` as a permanent article.
**Output:** Comprehensive report saved in `output/research-<slug>-<date>.md`.

### `consult <question>`
**Scope:** Answer a user question from the wiki.
**Steps:**
1. Read `wiki/index.md` to identify relevant wikis.
2. Read the `index.md` of relevant wikis to locate pertinent articles.
3. Read only the articles you need, not the whole wiki.
4. Build the answer by synthesizing the gathered information.
5. Cite used articles as `[[wiki links]]`.
6. If the question finds no answer in the KB, say so explicitly and propose which sources the user could ingest to close the gap.
**Output:** Synthesis + citations. If valuable, propose saving to `output/` or as a new article.

### `search <term>`
**Scope:** Full-text search across all wiki articles.
**Action:** Scan all `.md` files in `wiki/` for the term (case-insensitive).
**Output:** List of matching articles with context snippets (2 lines before/after match).

### `backlinks <article-path>`
**Scope:** Show all articles that link to the specified article.
**Action:** Scan all `wiki/**/*.md` for `[[<article-name>]]` or `[[<article-name>|...]]`.
**Output:** List of source articles with context.

### `related <article-path>`
**Scope:** Suggest articles related to the specified one but not yet linked.
**Action:**
1. Read the article.
2. Identify key concepts in the text.
3. Find other articles mentioning those concepts.
4. Exclude already-linked articles.
**Output:** Suggested new `[[links]]` with rationale.

### `trace <claim>`
**Scope:** Trace the origin of a specific claim or concept with line-level grounding.
**Action:**
1. Search wiki articles for the claim.
2. Follow `## Sources` references and frontmatter `sources:` to `raw/` files.
3. Extract exact line ranges and text passages from `raw/` files if line anchors (e.g. `#L10-L25`) are present or searchable.
4. Report the primary source(s), line range, passage snippet, and intermediate synthesis chain.
**Output:** Chain: claim → wiki article(s) → raw source(s)#L<start>-L<end> → exact passage snippet.
