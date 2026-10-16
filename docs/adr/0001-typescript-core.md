# 1. Single Deterministic Core in TypeScript (`src/core`)

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

Currently, knowledge base logic (auditing broken links, computing stats, reindexing, frontmatter validation) is implemented three times across different runtimes and formats:
1. Prose guidelines in `docs/AGENT.md` executed nondeterministically by LLM agents.
2. A TypeScript workflow engine inside `src/backend/server/services/workflowEngine.ts`.
3. Python scripts in `scripts/wiki_stats.py` and `scripts/okf_lint.py`.

This duplication causes logic drift, inconsistent reporting numbers, and maintenance overhead across Node.js and Python environments.

## Decision Drivers

* **Single Source of Truth:** Every calculation (health score, link graph, orphan detection, maturity level) must produce identical results across CLI, Web UI, and Agent tool calls.
* **Determinism:** Non-LLM operations must be fast, fully deterministic, and covered by unit tests.
* **Unified Ecosystem:** The Web UI and API Gateway are built in TypeScript/Node.js. Moving core KB logic to a TypeScript module enables direct in-process execution without spawning child processes for standard read/audit/stat queries.

## Considered Options

1. **Keep dual Node/Python logic with shared REST APIs.**
2. **Move all deterministic core logic into Python (`src/backend/wikiforge`).**
3. **Move all deterministic core logic into a pure TypeScript engine (`src/core`).**

## Decision Outcome

Chosen option: **Option 3 (Single deterministic core in TypeScript at `src/core`)**.

All deterministic, non-LLM operations (vault file management, Markdown parsing, link graph traversal, audit rules, metrics computation, maturity evaluation, reindex, export bookkeeping, procedure engine) will reside in `src/core/`.

### Positive Consequences

* Single implementation to maintain and test.
* Instant in-process execution for Web UI and Node.js REST endpoints without child process overhead.
* 100% deterministic results across all interfaces.

### Negative Consequences

* Python scripts in `scripts/` will become thin wrappers invoking the TypeScript CLI (`wikiforge`) or core APIs.
