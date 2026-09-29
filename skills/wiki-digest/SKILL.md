---
name: wiki-digest
description: >
  Use when the user wants a natural language digest or summary of recent knowledge base activity —
  e.g. "show daily digest", "weekly wiki update", "/digest", "what changed in the wiki recently".
triggers:
  commands: [digest]
reads:
  - wiki/log.md
  - output/gardening_report.md
  - wiki/**/*.md
writes:
  - output/digest_*.md
confirm_destructive: false
---

# Wiki Digest Skill (`/digest`)

### `digest [days=7]`
**Scope:** Scans `wiki/log.md`, recent note modifications, and gardening reports to produce a clear, human-readable natural language summary of recent knowledge base evolutions.

**Steps:**
1. **Log Analysis:** Parse `wiki/log.md` for entries within the specified timeframe (default 7 days).
2. **Note Lifecycle Changes:** Identify newly created notes, updated notes, maturity increases, and deprecated notes.
3. **Gardener & Audit Insights:** Read `output/gardening_report.md` (if present) or scan for broken links, orphan notes, or stale notes (`stale_after`).
4. **Natural Language Digest Construction:**
   - Highlights & key milestones (e.g., "Chapter 2 reached maturity 100", "5 new papers ingested").
   - Knowledge graph updates & new connections.
   - Maintenance alerts (broken links needing repair, stale notes needing review).
5. **Output Generation:** Render formatted summary and save to `output/digest_<date>.md`.

**Output:** High-density executive summary of knowledge base health, updates, and recommended maintenance tasks.
