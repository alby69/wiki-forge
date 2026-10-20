# Technical Architecture — Wiki-Forge v4.1

## Overview & Unified System Diagram

Wiki-Forge integrates a TypeScript/Vite frontend with a Python FastAPI backend, stateful Procedure Engine, Vault Changeset Manager, and W3C SHACL/RDF semantics.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Web UI (TypeScript / Vite)                      │
│  [Focus Mode: Guided Pills]  [KE Workbench & Chat Commands]             │
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
