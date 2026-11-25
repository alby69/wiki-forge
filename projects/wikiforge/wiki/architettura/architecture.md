---
type: Concept
title: "Technical Architecture — Wiki-Forge v4.1"
description: "Wiki-Forge integrates a TypeScript/Vite frontend (static assets + reverse proxy only in development), a standalone Node.js API gateway backed by a…"
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

Wiki-Forge integrates a TypeScript/Vite frontend (static assets + reverse proxy only in development), a standalone Node.js API gateway backed by a kernel/modules/ports architecture, a standalone Python FastAPI service, the stateful Procedure Engine, a live Plan/Review/Apply changeset store, and W3C SHACL/RDF semantics. In production the API process serves the built SPA from `dist/` on `$PORT`; no `VITE_*` runtime variables are used.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Web UI (TypeScript / Vite)                      │
│  [Focus Mode: Guided Pills] [KE Workbench & Chat] [Review Studio]       │
│  Dev: Vite = static server + one shared /api proxy (no AgentServer in-process)│
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
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 4. API Contract Layer (src/shared/api/, api/openapi.ts)          │  │
│  │    - ROUTES -> OpenAPI 3.1 + /api/docs (Swagger self-hosted)      │  │
│  │ 5. MessageBus + domain modules (bus/, modules/)                  │  │
│  │    - catalogue, tools, reviews, ingestion, graph (14 commands)    │  │
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

The diagram shows the development Compose topology (`ui`, `api`, `kg-api`,
`worker`, MCP). Production uses `Dockerfile.render` + `bin/render-start.sh`:
one Node process serves the built SPA and the API on `$PORT`, with health at
`/api/healthz`, `WIKIFORGE_STATE_DIR=/app/.wiki-forge/state`, a non-root user
and no `admin`/`admin` default credentials.

## Key Backend Components

### 1. Unified Health Engine (`src/backend/wikiforge/api/health.py`)
Aggregates health indicators (SHACL violations, CQ gaps, orphan ratio, broken links, raw pending sources) into a single 0-100 score and L1-L4 maturity level. Automatically generates `.wiki-forge/STATUS.md` and appends historical data to `.wiki-forge/metrics/history.jsonl`.

### 2. Procedure Engine (`src/backend/wikiforge/procedures.py`)
Executes declarative TOML workflows (`config/procedures/*.toml`). Features DAG prerequisite checking, automatic script invocation, human review pauses, exit criteria validation, and persistent state in `.wiki-forge/state/` with a lease lock (the old PID lock is historical).

### 3. Safe Filesystem & Changeset Store (`src/backend/server/safeFs.ts`, `src/backend/server/changesetStore.ts`)
Enforces atomic writes via a temp file + rename, soft-deletes files to `<project>/.wiki-forge/trash/` with a JSONL manifest and restore endpoint, and stages AI-proposed edits into `<project>/.wiki-forge/changesets/` for human review before applying. This is the live implementation that replaces the old, never-wired `wikiforge/vault.py` (removed). The active state root is `.wiki-forge/` throughout.

### 4. Review Studio API & Snapshot Store (`src/backend/server/agentServer.ts`)
Serves the four-tab Review Studio (`/api/notes/review/meta|verify|digest|critique|snapshots|diff|restore`). The quality gate, digest, diff and human verification are deterministic; the critique tab uses the configured LLM with a deterministic fallback. Before every save, verification or restore the previous note content is stored in `.wiki-forge/snapshots/<note-path>/<timestamp>.md` with a JSON sidecar (reason and timestamp); the latest 25 snapshots per note are retained. The folder is gitignored and independent of the git-based `VersionTimeline` history.

### 5. Research Studio API & Query Helpers (`src/backend/server/agentServer.ts`, `researchHelpers.ts`)
Serves the six-tab Research Studio (`/api/notes/research/search|backlinks|related|trace` on `GET`, `consult|deep-research` on `POST`). Search, backlinks, related and trace are pure deterministic functions over the loaded notes (`researchHelpers.ts`, unit-tested); consult and deep-research use the configured LLM with a deterministic fallback. Deep research writes `output/research-*.md` and `wiki/synthesis/<slug>.md` with a source-attribution matrix and knowledge gaps.

### 6. API Contract Layer & Documentation Browser (`src/shared/api/`, `src/backend/server/api/`)
`ROUTES` in `contracts.ts` is the single source of truth for method, path,
validation schemas, operation ids and bus command names. `openapi.ts` renders it
as OpenAPI 3.1, merges the FastAPI graph service (live spec or checked-in
snapshot) and adds MCP tool metadata. `docsBrowser.ts` serves
`GET /api/openapi.json` and `GET /api/docs` with Swagger UI assets from the
`swagger-ui-dist` npm package: the browser works offline and in Docker, with no
CDN. The published manifest is generated from `ROUTES` plus the shared MCP
definitions, is checked by `npm run manifest:check`, and is consumed by the CLI,
MCP descriptors and OpenAPI. Existing endpoints and `AgentServer`'s public
methods are unchanged. See `docs/OPENAPI.md`.

### 6.1 Backend MessageBus & Domain Modules (`src/backend/server/bus/`, `modules/`)
`AgentServer.handleRequest()` matches the request against `ROUTES` and dispatches
the resulting command to an in-process `MessageBus`. Twenty domain modules own
the 158 bus commands; `createKernel()` wires projects, template, changesets,
files, scheduler, execution, vault, review studio, research, study, chat, slash,
graph and graph proxy, while `AgentServer` registers user, UI, catalogue, tools,
reviews and ingestion directly plus `auth.me`. All 105 routes are bus-dispatched,
including the two public docs endpoints (with middleware skipped) and the three
FastAPI graph proxies (after the B4 auth gate).
Handlers return `json`, `binary` or `sse` results and never receive
`http.IncomingMessage` or `ServerResponse`. The gateway is the only HTTP adapter,
which keeps the facade and every existing endpoint intact while allowing the
same commands to be called from a scheduler or a test. See `docs/OPENAPI.md`.

### 6.2 Typed API Client & Frontend Bus (`src/shared/api/`, `src/frontend/api/`, `core/apiBus.ts`)
`endpoints.ts` attaches request/response types to every `EndpointId` and fails
`typecheck` if a catalogue route is left untyped. `createApiClient()` generates
one method per endpoint from `ROUTES`, handles path interpolation, query
serialization, project/token headers, `ApiClientError` and incremental SSE
parsing. `apiBus.dispatch()/stream()` adds typed UI events so features react to
API results without calling each other; `ApiStorage` keeps its 51 public methods
as a compatibility facade over the single `apiBus` transport — there is no
`FileStorage` fallback —, the graph service maps only the backend `WikiGraphDto`
and canonical template fallback is explicit via `api:error`. No UI component
builds an API URL or calls `fetch` directly. See `docs/OPENAPI.md`.

### 6.3 Kernel, Modules, Ports and Persistence
`createKernel()` wires domain modules through ports; adapters (HTTP, CLI, MCP,
worker) never import one another. `StateStore` persists sessions, procedure
state, scheduler cursor/lease and the approval outbox under `.wiki-forge/state/`;
the outbox relay forwards decisions back into the bus. The scheduler uses a
state lease lock rather than the old PID lock, and command handlers emit
`command:handled`/`command:failed` audit events. `CommandContext.principal` is
always set by bus dispatch, subprocesses receive an explicit environment
allowlist and `@opentelemetry/api` has a local fallback.

### 6.4 Production Hardening
The production gateway forces RBAC and authentication (token required unless an
IdP or user store is configured), applies a CORS allowlist and body limit,
propagates correlation ids and exposes `/api/healthz`, `/api/readyz` and
`/api/metrics`. `Dockerfile.render` + `bin/render-start.sh` run a single
non-root Node process serving the built SPA and API on `$PORT`, with no default
`admin/admin` credentials and no `VITE_*` runtime variables. Development Compose
keeps the Vite `ui` service alongside API and worker
(`WIKIFORGE_EMBED_SCHEDULER=false`).

## Key Frontend Components

### 7. Adapter-based Note Editor (`src/frontend/components/editor/`)
`MarkdownEditor.ts` is the stable shell; the editing surface sits behind the `NoteEditorAdapter` interface (`EditorAdapter.ts`) with two implementations: `CodeMirrorAdapter.ts` (source view / fallback) and `milkdown/MilkdownAdapter.ts` (Crepe 7.23 WYSIWYG, vanilla TS, no React). `resolveEngine()` auto-selects Milkdown in browsers and CodeMirror under mock DOMs/tests; the Milkdown module is dynamically imported so Crepe's ESM-only subpaths never reach the Node test runner. Toolbar actions are semantic (`toggleInline`, `applyBlock`, `insertColor`, `insertAlignment`) with shared pure helpers in `editorMarkdownOps.ts`. OKF frontmatter is preserved byte-for-byte via `WikiNote.frontmatterRaw` and the `rawContent` save path. A custom remark plugin + inline atom (`milkdown/wikilink*.ts`) keeps `[[wikilinks]]` unescaped through serialisation and bridges clicks to navigation. See `docs/EDITOR_MIGRATION.md`.

## Shared Frontend Foundations (Fase 78)

The UI now has a small set of cross-cutting modules so features no longer
reimplement the same behaviour in each component:

| Module | Responsibility |
|---|---|
| `styles/tokens.css` | Colours, spacing, radii, motion — one source of truth mirrored to the legacy `theme.css` aliases. |
| `styles/primitives.css` | Reusable `.wf-btn`, `.wf-field`, `.wf-modal*`, `.wf-menu*`, `.wf-toast*`, `.wf-tab*`, `.wf-palette*` classes. |
| `core/actions.ts` | **Single action catalogue** (`global`, `note`, `studio` groups). Header, note header, context menu and command palette render from it; handlers are bound once in `WikiForgeApp.bindGlobalActions()`. |
| `core/shortcuts.ts` | **One** global `keydown` listener, all combos registered through `registerShortcut()`. Fixed the old `Ctrl+Alt+D` collision (digest = `Ctrl+Alt+D`, wiki docs = `Ctrl+Alt+W`). |
| `core/events.ts` | Typed `eventBus` (`project:changed`, `vault:changed`, `note:selected`, `note:saved`, API lifecycle and studio-change events). |
| `core/apiBus.ts` | Frontend command bus: components dispatch catalogue ids instead of calling APIs or each other. |
| `core/i18n/strings.ts` | IT/EN dictionary with `t(key, vars)`, persisted language selection, updates `document.documentElement.lang`. |
| `core/ui/resizer.ts` | Shared `bindResizer()` — replaces four separate drag implementations. |
| `services/notificationService.ts` | Styled toasts + accessible `confirm()` / `prompt()` dialogs. No native `alert`/`confirm`/`prompt` remains in the frontend. |
| `store/appStore.ts` | Single source of truth for the active project; `ApiStorage` delegates to it. |

Research and Studio are now **global-only** actions: the duplicated buttons were
removed from the note header. The note header keeps only Node Info, Review,
History, Save/Edit. The header includes a language selector (IT/EN) and an
overflow menu generated from the action catalogue.

## Project Lifecycle (Fase 78)

Backend (`src/backend/server/projectService.ts`, routes in `agentServer.ts`):

- `GET /api/projects?includeArchived=true`, `POST /api/projects`
- `PATCH /api/projects/:id` (display name only; `config.toml` stays in sync)
- `POST /api/projects/:id/clone`, `/archive`, `/restore`
- `DELETE /api/projects/:id?mode=unregister|trash|permanent&confirm=<id>` —
  **default mode is `trash`**: files are moved to `.wiki-forge/trash/` and can be
  restored. `permanent` requires an explicit confirm token and never targets the
  `default` project.
- `GET /api/projects/:id/export`, `POST /api/projects/import`, `GET /api/projects/:id/stats`

Frontend (`src/frontend/services/projectService.ts` +
`components/projects/ProjectManagerModal.ts`) exposes the same operations with
inline forms and trash-by-default deletion. `ConfigManager` no longer owns
project creation/deletion; its project selector bar was removed to avoid
duplication. See `docs/help/progetti-config.md`.
