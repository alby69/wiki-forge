# 6. Single Command Registry in `config/commands.toml`

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

Slash commands and macro tools (`/compile`, `/audit`, `/reindex`, `/consult`, `/study-guide`, `/rollback`, etc.) are documented in multiple places: `docs/AGENT.md`, `docs/TUTORIAL.md` cheat sheet, `Makefile` targets, and UI button arrays in `ToolsModal.ts`. As new features are added, documentation and UI shortcuts drift out of sync.

## Decision Drivers

* **Single Source of Truth:** Command names, arguments, descriptions, role requirements, and examples must be defined once.
* **Automated Code & Doc Generation:** Documentation sections (`AGENT.md` §5, `TUTORIAL.md` cheat sheet, Makefile help) must be generated or verified automatically.
* **Role Enforcement:** Commands must specify role permissions (`reader`, `author`, `ke`).

## Considered Options

1. **Maintain manual documentation across README, AGENT.md, and TUTORIAL.md.**
2. **Define commands in TypeScript code constants.**
3. **Define commands in a declarative registry file (`config/commands.toml`) with automated documentation generators.**

## Decision Outcome

Chosen option: **Option 3 (Single command registry in `config/commands.toml`)**.

`config/commands.toml` serves as the authoritative definition for all commands. A build/verification script (`wikiforge docs:commands` / `scripts/check_docs_sync.py`) generates:
* The command reference block in `docs/AGENT.md`.
* The command cheat sheet in `docs/TUTORIAL.md`.
* Makefile help output.
* The Web UI Command Palette (`Ctrl+K`) choices.

### Positive Consequences

* Zero documentation drift across agent operating manuals, user guides, and UI.
* CI fails build if generated command blocks are stale or unaligned.

### Negative Consequences

* Adding a new command requires updating `config/commands.toml` and running the sync generator.
