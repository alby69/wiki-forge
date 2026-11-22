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

### 6. API Contract Layer & Documentation Browser (`src/shared/api/`, `src/backend/server/api/`)
`ROUTES` in `contracts.ts` is the single source of truth for method, path,
validation schemas, operation ids and bus command names. `openapi.ts` renders it
as OpenAPI 3.1, merges the FastAPI graph service (live spec or checked-in
snapshot) and adds MCP tool metadata. `docsBrowser.ts` serves
`GET /api/openapi.json` and `GET /api/docs` with Swagger UI assets from the
`swagger-ui-dist` npm package: the browser works offline and in Docker, with no
CDN. Existing endpoints and `AgentServer`'s public methods are unchanged. See
`docs/OPENAPI.md`.

### 6.1 Backend MessageBus & Domain Modules (`src/backend/server/bus/`, `modules/`)
`AgentServer.handleRequest()` matches the request against `ROUTES` and dispatches
the resulting command to an in-process `MessageBus`. Fifteen modules own 82 of
the 87 catalogue commands (catalogue, tools, reviews, ingestion, graph, projects,
changesets, files, scheduler, execution, vault, review studio, research, study
and chat); the remaining routes are the public docs endpoints and the three
FastAPI graph proxies, which stay in the gateway before CORS/token validation.
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
as a compatibility facade and no UI component builds an API URL or calls
`fetch` directly. See `docs/OPENAPI.md`.

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
