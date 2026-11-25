# Migration Guide — Safe Changeset Review System

## Overview
In Wiki-Forge v4.1, AI file modifications follow a Plan-Review-Apply validation flow instead of un-reviewed LLM file overwrites.

## Current Review Flow (web chat)
1. **Propose**: the agent answers with a `wiki-edit` block describing the file change instead of writing files directly.
2. **Review**: the user inspects the proposed diff in the chat.
3. **Apply / Reject**: the user applies it with the **Applica modifica** button (or by replying "sì, procedi"), or simply ignores it. `/apply` (alias `/applica`) confirms whether a proposal is pending.

## Backend Changesets Foundation (live)
The safety layer is implemented in `src/backend/server/safeFs.ts` and
`src/backend/server/changesetStore.ts`: atomic writes via temp file + rename,
staged changesets in `.wiki-forge/changesets/` and soft deletes. The old
`wikiforge/vault.py` was never wired and has been removed.

REST endpoints are exposed and bus-dispatched:
`GET /api/v1/changesets`, `POST /api/v1/changesets` (stage),
`GET /api/v1/changesets/:id`, `POST /api/v1/changesets/:id/apply` and
`POST /api/v1/changesets/:id/reject`. The **Review Queue** is available in the
web UI through the `Ctrl+K` command palette and the **Changeset Review** modal,
alongside the chat Apply/Reject flow described above.

## Soft Delete & Atomic Recovery
All file deletions are soft-deleted to `.wiki-forge/trash/` with ISO timestamp prefixes, enabling instant recovery if needed.
