---
type: Concept
title: "Technical Architecture — Wiki-Forge v4.1"
description: "Wiki-Forge integrates a TypeScript/Vite frontend with a Python FastAPI backend, stateful Procedure Engine, Vault Changeset Manager, Review and Research Studio…"
resource: docs/ARCHITECTURE.md
tags: [scope/docs, layer/generated, area/architettura, lang/en]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-architecture-md
    resource: docs/ARCHITECTURE.md
    title: "Technical Architecture — Wiki-Forge v4.1"
    author: human:alby69
---
# Technical Architecture — Wiki-Forge v4.1

## Overview & Unified System Diagram

Wiki-Forge integrates a TypeScript/Vite frontend with a Python FastAPI backend, stateful Procedure Engine, Vault Changeset Manager, Review and Research Studio APIs, and W3C SHACL/RDF semantics.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Web UI (TypeScript / Vite)                      │
│  [Focus Mode: Guided Pills] [KE Workbench & Chat] [Review Studio]       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP / SSE (Server-Sent Events)
┌───────────────────────────────▼─────────────────────────────────────────┐
│              FastAPI & Node Gateway (src/backend/)                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Unified Health Engine (health.py)                              │  │
│  │    - Aggregates: okf_stats, shacl_validator, ke_maturity, cq      │  │
│  │    - Outputs: .wikiforge/STATUS.md & /api/v1/health (JSON)        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 2. Procedure Engine Core (procedures.py)                          │  │
│  │    - Parses: config/procedures/*.toml (KE & User Wizards)         │  │
│  │    - State: .wikiforge/state/<run_id>.json                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 3. Safe Vault & Changeset Manager (vault.py)                      │  │
│  │    - Atomic writes, .wikiforge/trash/, staged changesets          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 4. Review Studio API & Snapshot Store (agentServer.ts)            │  │
│  │    - /api/notes/review/*, .wiki-forge/snapshots/ (25 per note)    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Subprocess / MCP
┌───────────────────────────────▼─────────────────────────────────────────┐
│  Existing Domain Modules: LangGraph GraphRAG, SHACL, RDF/Cypher Export  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Backend Components

### 1. Unified Health Engine (`src/backend/wikiforge/api/health.py`)
Aggregates health indicators (SHACL violations, CQ gaps, orphan ratio, broken links, raw pending sources) into a single 0-100 score and L1-L4 maturity level. Automatically generates `.wikiforge/STATUS.md` and appends historical data to `.wikiforge/metrics/history.jsonl`.

### 2. Procedure Engine (`src/backend/wikiforge/procedures.py`)
Executes declarative TOML workflows (`config/procedures/*.toml`). Features DAG prerequisite checking, automatic script invocation, human review pauses, exit criteria validation, and persistent state in `.wikiforge/state/`.

### 3. Safe Vault Manager (`src/backend/wikiforge/vault.py`)
Enforces atomic writes via temporary files and `os.replace`, soft deletes files to `.wikiforge/trash/` with timestamping, and stages AI proposed file changes into `.wikiforge/changesets/` for review before applying.

### 4. Review Studio API & Snapshot Store (`src/backend/server/agentServer.ts`)
Serves the four-tab Review Studio (`/api/notes/review/meta|verify|digest|critique|snapshots|diff|restore`). The quality gate, digest, diff and human verification are deterministic; the critique tab uses the configured LLM with a deterministic fallback. Before every save, verification or restore the previous note content is stored in `.wiki-forge/snapshots/<note-path>/<timestamp>.md` with a JSON sidecar (reason and timestamp); the latest 25 snapshots per note are retained. The folder is gitignored and independent of the git-based `VersionTimeline` history.

### 5. Research Studio API & Query Helpers (`src/backend/server/agentServer.ts`, `researchHelpers.ts`)
Serves the six-tab Research Studio (`/api/notes/research/search|backlinks|related|trace` on `GET`, `consult|deep-research` on `POST`). Search, backlinks, related and trace are pure deterministic functions over the loaded notes (`researchHelpers.ts`, unit-tested); consult and deep-research use the configured LLM with a deterministic fallback. Deep research writes `output/research-*.md` and `wiki/synthesis/<slug>.md` with a source-attribution matrix and knowledge gaps.
