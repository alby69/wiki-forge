# Migration Guide — Safe Changeset Review System

## Overview
In Wiki-Forge v4.1, AI file modifications follow a Plan-Review-Apply validation flow instead of un-reviewed LLM file overwrites.

## Current Review Flow (web chat)
1. **Propose**: the agent answers with a `wiki-edit` block describing the file change instead of writing files directly.
2. **Review**: the user inspects the proposed diff in the chat.
3. **Apply / Reject**: the user applies it with the **Applica modifica** button (or by replying "sì, procedi"), or simply ignores it. `/apply` (alias `/applica`) confirms whether a proposal is pending.

## Backend Changesets Foundation (not yet exposed)
`src/backend/wikiforge/vault.py` provides the lower-level safety layer used by scripts: atomic writes via `os.replace`, staged changesets written to `.wikiforge/changesets/` via `stage_changeset(...)`, and soft deletes.

> **Note**: there is currently **no REST endpoint** (`/api/v1/changesets/*`) and **no Review Queue UI**; the previously documented `Ctrl+K` palette is not implemented. Apply/Reject happens in the chat flow described above.

## Soft Delete & Atomic Recovery
All file deletions are soft-deleted to `.wikiforge/trash/` with ISO timestamp prefixes, enabling instant recovery if needed.
