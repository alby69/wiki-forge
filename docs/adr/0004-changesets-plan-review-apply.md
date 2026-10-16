# 4. Plan → Review → Apply Workflow for LLM Writes

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

When LLM agents execute commands such as `/compile`, `/merge`, `/split`, or `/stub`, files in `wiki/` are written directly to disk without human confirmation. This risks overwriting curated human notes, corrupting wikilinks, or applying hallucinated changes without oversight.

## Decision Drivers

* **Safety First:** Human operators must retain full control over modifications to `wiki/`.
* **Atomic Execution:** Operations touching multiple files (e.g., merging two notes and updating index files) must succeed completely or fail cleanly without partial writes.
* **Undo Support:** Any applied changeset must create a rollback snapshot.

## Considered Options

1. **Direct on-disk write with git commits.**
2. **Interactive CLI prompts for every single modified file.**
3. **Structured Plan → Review → Apply workflow using changesets saved to `.wikiforge/changesets/`.**

## Decision Outcome

Chosen option: **Option 3 (Plan → Review → Apply workflow using changesets)**.

When an LLM agent or automated workflow generates file modifications:
1. **Plan:** The tool writes a structured changeset JSON file (`.wikiforge/changesets/<id>.json`) describing the proposed operations (`create`, `update`, `rename`, `delete`).
2. **Review:** The Web UI Review Queue or CLI `wikiforge changeset show <id>` presents a unified diff and validation report.
3. **Apply:** Upon operator approval (or automated approval if policy `require_review = "never"`), `kb-core` validates path containment, creates a soft-delete/git snapshot, and applies all file operations atomically.

### Positive Consequences

* Non-destructive by default.
* Supports visual diff review, selective hunk approval, and one-click rejection.
* Atomic transactional application prevents partial write corruptions.

### Negative Consequences

* Requires a multi-step user interaction flow during automated compilation.
