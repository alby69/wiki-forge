# Migration Guide — Safe Changeset Review System

## Overview
In Wiki-Forge v4.1, AI file modifications undergo Plan-Review-Apply validation. Direct un-reviewed LLM file overwrites are replaced by staged changesets in `.wikiforge/changesets/`.

## Changeset Lifecycle
1. **Stage**: AI agent proposes file changes via `stage_changeset(...)` or `/api/v1/changesets/stage`.
2. **Review**: The user inspects side-by-side or unified diffs in the **Changeset Review Queue** (`Ctrl+K` -> Changeset Review Queue).
3. **Apply / Reject**: The user approves via **[Accept & Apply]** (`POST /api/v1/changesets/:id/apply`) or rejects with feedback.

## Soft Delete & Atomic Recovery
All file deletions are soft-deleted to `.wikiforge/trash/` with ISO timestamp prefixes, enabling instant recovery if needed.
