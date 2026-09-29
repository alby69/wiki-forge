---
name: wiki-adversarial-review
description: >
  Use when the user wants to stress-test, critique, or perform an adversarial review
  of wiki notes, thesis chapters, or syntheses — e.g. "run adversarial review",
  "/adversarial-review note=wiki/chapter1.md", "critique my claims", "find logical gaps".
triggers:
  commands: [adversarial-review]
reads:
  - config.toml
  - wiki/**/*.md
  - raw/**/*.md
writes:
  - output/adversarial_review_*.md
confirm_destructive: false
---

# Wiki Adversarial Review Skill (`/adversarial-review`)

### `adversarial-review [note=<path>] [depth=deep]`
**Scope:** Stress-tests notes, thesis drafts, or syntheses against adversarial criticism, detecting logical contradictions, uncited claims, weak grounding (missing `#L<start>-L<end>`), counterarguments, and OKF v0.2 frontmatter violations.

**Steps:**
1. **Target Selection:** Identify target note(s) from `note=<path>` or scan all `wiki/` notes with `maturity: 100` / `status: stable`.
2. **Fact & Line-Anchor Grounding Audit:**
   - Verify every factual claim in the note links to an explicit raw source line anchor (`raw/file.md#L10-L25`).
   - Flag claims lacking line-anchored citations or backed by single unverified sources.
3. **Logical Contradiction Search:**
   - Cross-reference claims across other `wiki/` and `raw/` notes to detect contradictory statements, conflicting stats, or incompatible assertions.
4. **Adversarial Counter-Arguments:**
   - Formulate 3-5 strongest counter-arguments, edge cases, or potential reviewer criticisms (e.g. thesis committee objections).
5. **OKF Schema Compliance:**
   - Verify frontmatter schema compliance (`type`, `verified`, `sources`, `stale_after`).
6. **Generate Report:** Save findings to `output/adversarial_review_<slug>.md`.

**Output:** Summary report containing missing citations, logical contradictions, counter-arguments, and recommended remediation steps.
