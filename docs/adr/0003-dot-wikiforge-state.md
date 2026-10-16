# 3. Persistent On-Disk State in `.wikiforge/`

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

Knowledge base state, procedure execution history, and active LLM chat sessions currently rely on ephemeral in-memory variables or browser `localStorage`. When an operator switches browsers, restarts the server, or changes AI agent tools (e.g., from Claude Code to Codex or Gemini), state is lost and sessions cannot be resumed.

## Decision Drivers

* **Interoperability & Memory Persistence:** Multiple agents (Claude, GPT, Ollama) and human operators must share a single, git-friendly source of truth for KB progress.
* **Auditability:** Every file transformation, audit finding, procedure step, and review action should leave a human-readable journal event.
* **Git Friendliness:** Project state should be stored in clear, line-oriented formats (JSON, JSONL, Markdown, TOML).

## Considered Options

1. **Store state in a central SQLite database.**
2. **Store state in browser `localStorage` and agent memory context.**
3. **Store persistent state on disk in `.wikiforge/` as plain JSON, JSONL, TOML, and Markdown files.**

## Decision Outcome

Chosen option: **Option 3 (Persistent on-disk state in `.wikiforge/`)**.

The repository root will contain a `.wikiforge/` directory structured as follows:
* `.wikiforge/manifest.json`: Source file hashes and compilation mappings.
* `.wikiforge/journal.jsonl`: Append-only audit trail of system and user events.
* `.wikiforge/metrics/history.jsonl`: Time-series health score and volume metrics.
* `.wikiforge/state/<run-id>.json`: Active procedure run state files.
* `.wikiforge/changesets/<id>.json`: Staged changesets pending review.
* `.wikiforge/STATUS.md`: Human- and agent-readable summary snapshot generated automatically.

### Positive Consequences

* Git-committable and fully version-controlled (except local `trash/` and `chat/`).
* Plain text and line-oriented formats allow easy diffing and inspection.
* Agents read `.wikiforge/STATUS.md` at session start to immediately resume context ("where was I?").

### Negative Consequences

* File I/O operations must handle concurrent read/write locks safely.
