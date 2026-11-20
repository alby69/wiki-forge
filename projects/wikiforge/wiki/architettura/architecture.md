---
type: Concept
title: "Technical Architecture — Wiki-Forge v4.1"
description: "Wiki-Forge integrates a TypeScript/Vite frontend (static assets + reverse proxy only), a standalone Node.js API gateway, a standalone Python FastAPI service…"
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

Wiki-Forge integrates a TypeScript/Vite frontend (static assets + reverse proxy only), a standalone Node.js API gateway, a standalone Python FastAPI service, the stateful Procedure Engine, a live Plan/Review/Apply changeset store, and W3C SHACL/RDF semantics.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Web UI (TypeScript / Vite)                      │
│  [Focus Mode: Guided Pills] [KE Workbench & Chat] [Review Studio]       │
│  Vite = static server + one shared /api proxy (no AgentServer in-process)│
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP / SSE (Server-Sent Events)
┌───────────────────────────────▼─────────────────────────────────────────┐
│          Node API Gateway — standalone AgentServer (port 3001)          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Health Engine — proxied /api/v1/health                        │  │
│  │    - Aggregates: okf_stats, shacl_validator, ke_maturity, cq      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 2. Safe FS + Changesets (safeFs.ts, changesetStore.ts)            │  │
│  │    - atomic writes, .wiki-forge/trash/, .wiki-forge/changesets/   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 3. Review Studio API & Snapshot Store (agentServer.ts)            │  │
│  │    - /api/notes/review/*, .wiki-forge/snapshots/ (25 per note)    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────────┬──────────────────┘
                │ proxy /api/v1/graph/*                │ spawn python3
                │ (FASTAPI_SERVER_URL)                 │ (project-scoped env)
┌───────────────▼────────────────────┐   ┌─────────────▼──────────────────┐
│ FastAPI kg-api — standalone :8000  │   │ Scripts + domain modules      │
│  - api_server.py, health.py        │   │  - LangGraph GraphRAG, SHACL  │
│  - procedures.py                   │   │  - RDF/Cypher export          │
└────────────────────────────────────┘   └────────────────────────────────┘
```

## Key Backend Components

### 1. Unified Health Engine (`src/backend/wikiforge/api/health.py`)
Aggregates health indicators (SHACL violations, CQ gaps, orphan ratio, broken links, raw pending sources) into a single 0-100 score and L1-L4 maturity level. Automatically generates `.wikiforge/STATUS.md` and appends historical data to `.wikiforge/metrics/history.jsonl`.

### 2. Procedure Engine (`src/backend/wikiforge/procedures.py`)
Executes declarative TOML workflows (`config/procedures/*.toml`). Features DAG prerequisite checking, automatic script invocation, human review pauses, exit criteria validation, and persistent state in `.wikiforge/state/`.

### 3. Safe Filesystem & Changeset Store (`src/backend/server/safeFs.ts`, `src/backend/server/changesetStore.ts`)
Enforces atomic writes via a temp file + rename, soft-deletes files to `<project>/.wiki-forge/trash/` with a JSONL manifest and restore endpoint, and stages AI-proposed edits into `<project>/.wiki-forge/changesets/` for human review before applying. This is the live implementation that replaces the old, never-wired `wikiforge/vault.py` (removed). Note the active state root is `.wiki-forge/`; the older `.wikiforge/` paths in sections 1–2 are historical documentation from v4.1.0.

### 4. Review Studio API & Snapshot Store (`src/backend/server/agentServer.ts`)
Serves the four-tab Review Studio (`/api/notes/review/meta|verify|digest|critique|snapshots|diff|restore`). The quality gate, digest, diff and human verification are deterministic; the critique tab uses the configured LLM with a deterministic fallback. Before every save, verification or restore the previous note content is stored in `.wiki-forge/snapshots/<note-path>/<timestamp>.md` with a JSON sidecar (reason and timestamp); the latest 25 snapshots per note are retained. The folder is gitignored and independent of the git-based `VersionTimeline` history.

### 5. Research Studio API & Query Helpers (`src/backend/server/agentServer.ts`, `researchHelpers.ts`)
Serves the six-tab Research Studio (`/api/notes/research/search|backlinks|related|trace` on `GET`, `consult|deep-research` on `POST`). Search, backlinks, related and trace are pure deterministic functions over the loaded notes (`researchHelpers.ts`, unit-tested); consult and deep-research use the configured LLM with a deterministic fallback. Deep research writes `output/research-*.md` and `wiki/synthesis/<slug>.md` with a source-attribution matrix and knowledge gaps.

## Key Frontend Components

### 6. Adapter-based Note Editor (`src/frontend/components/editor/`)
`MarkdownEditor.ts` is the stable shell; the editing surface sits behind the `NoteEditorAdapter` interface (`EditorAdapter.ts`) with two implementations: `CodeMirrorAdapter.ts` (source view / fallback) and `milkdown/MilkdownAdapter.ts` (Crepe 7.23 WYSIWYG, vanilla TS, no React). `resolveEngine()` auto-selects Milkdown in browsers and CodeMirror under mock DOMs/tests; the Milkdown module is dynamically imported so Crepe's ESM-only subpaths never reach the Node test runner. Toolbar actions are semantic (`toggleInline`, `applyBlock`, `insertColor`, `insertAlignment`) with shared pure helpers in `editorMarkdownOps.ts`. OKF frontmatter is preserved byte-for-byte via `WikiNote.frontmatterRaw` and the `rawContent` save path. A custom remark plugin + inline atom (`milkdown/wikilink*.ts`) keeps `[[wikilinks]]` unescaped through serialisation and bridges clicks to navigation. See `docs/EDITOR_MIGRATION.md`.
