# Changelog

All notable changes to the `wiki-forge` template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Web UI Favicon**: Added `public/favicon.svg` and linked it from `index.html`, removing a 404 on `/favicon.ico`.
- **View Mode Persistence**: The Editor/Graph/Split selection is now stored in `appStore` (`wiki-forge:view-mode`) and restored across reloads.

### Changed
- **Simple Mode Relocated to the Header**: The 3-step flow (`📥 Carica` → `⚡ Compila` → `💬 Chiedi`) moved from a full-width panel above the editor into a compact pill group centred in the top bar, rendered via a new `#simple-mode-slot` in `MainLayout`. The previously hardcoded 60–140% scale slider was removed in favour of fixed compact sizing.
- **Node Metadata Panel Moved Below the Editor**: `ContextPanel` changed from a 280px right-hand sidebar to a full-width horizontal bar under the editor/graph row, with title, tags, OKF trust badges, backlinks and outbound links laid out as inline clickable chips. Its resizer changed from horizontal (`col-resize`, 200–500px) to vertical (`row-resize`, 84–420px).
- **Sidebar Toolbar Single Row**: The five file-operation buttons were hardcoded into two separate containers (`#toolbar-primary` / `#toolbar-secondary`), forcing two rows regardless of available width. They now share one `.sidebar-toolbar` flex container with `flex-wrap`, so they fit on one line and wrap only when the sidebar is narrowed. The previously dead `.sidebar-toolbar` rules in `sidebar.css` were activated and extended with hover/focus states.

### Fixed
- **Onboarding Wizard Blocked the Whole UI**: The wizard overlay was appended to `<body>` with the `.wf-modal-overlay` class (`display: flex`, blurred backdrop) but was never hidden unless `open()` was called. When onboarding had already been completed, the app rendered permanently blurred and unclickable with an invisible modal. The container is now hidden at construction.
- **Onboarding Wizard Clobbered `config.toml`**: `finishOnboarding()` unconditionally overwrote `project.context`, destroying any hand-written project description on re-run. It now only sets the scenario default when the field is empty.
- **View Mode Buttons Had No Active State**: The `Split` button's highlight was hardcoded in `Header`, so clicking `Editor` or `Graph` changed the layout without updating any button. Active state and `aria-selected` are now derived from `appStore.viewMode`.
- **Note Selection Was a No-Op in Graph-Only View**: Selecting a note from the sidebar while the editor was hidden appeared to do nothing; it now falls back to `Split`.

## [3.3.0] - 2026-10-05

### Added
- **Enterprise Semantic Knowledge Graph & Stateful GraphRAG System (Phase 50)**:
  - **W3C SHACL Validation Schema (`src/wikiforge/config/shapes.ttl`)**: Created W3C SHACL shape constraints (`wfs:PermanentNoteShape`, `wfs:AgentShape`) for note identifiers, titles, ISO dates, markdown body, author agent IRI attributions, and typed relationship targets (`wf:supports`, `wf:contradicts`, `wf:refersTo`).
  - **Zettelkasten-to-RDF Converter (`src/wikiforge/semantics/markdown_to_rdf.py`)**: Built `ZettelToRDFConverter` parsing frontmatter YAML, persistent W3ID URI minting (`wfid:`), typed wikilinks (`[[predicate::target]]`), and Turtle RDF graph generation (`.ttl`).
  - **Neo4j Cypher Property Graph Exporter (`src/wikiforge/semantics/markdown_to_cypher.py`)**: Built `ZettelToCypherConverter` generating idempotent Neo4j Cypher scripts with label constraints, property setters, and typed relationships.
  - **Stateful GraphRAG Pipeline (`src/wikiforge/semantics/graph_rag_pipeline.py`)**: Implemented stateful `WikiForgeGraphRAG` engine powered by LangGraph / LangChain with nodes for Entity Extraction, Text-to-Cypher generation, Neo4j/Mock Cypher Execution, conditional error self-correction routing, and grounded synthesis with PROV-O provenance.
  - **Automated CI/CD Workflow (`.github/workflows/shacl_validation.yml`)**: Added GitHub Actions pipeline converting Markdown Zettelkasten notes to Turtle RDF, running PySHACL constraint validation, generating Cypher scripts, and uploading graph artifacts.
  - **Comprehensive Test Suite & Documentation**: Added unit tests in `tests/test_shacl.py`, `tests/test_converters.py`, and `tests/test_graph_rag.py`; created developer & operator manual in `docs/GRAPH_RAG.md`.

## [3.2.0] - 2026-10-02

### Added
- **Typed Schema System & Linting Engine (Ticket 1 / Phase 49)**:
  - **Shared KE Library (`scripts/ke_common.py`)**: Centralized multi-project resolution, TOML loading (`load_config`), page iterator (`iter_pages`), wikilink resolver (`resolve_wikilink` supporting `prefLabel` and `altLabel`), schema loader (`load_schema`), and `emit` output helper.
  - **Schema Linter (`scripts/schema_lint.py`)**: Validates wiki pages against `[schema]` definitions in `config.toml`, checking missing required fields (`SCH-001`), unknown relations for types (`SCH-002`), unresolved target wikilinks (`SCH-003`), relation domain/range mismatches (`SCH-004`), cycles in acyclic relations (`SCH-005`), and unknown page types in strict mode (`SCH-006`).
  - **Schema Inferrer (`scripts/schema_infer.py`)**: Scans existing wiki pages and auto-proposes a candidate `[schema]` TOML block to `stdout` or JSON envelope without modifying `config.toml`.
  - **Config Manager GUI Enhancement (`src/components/ConfigManager.ts`)**: Added a read-only "Schema (Read-Only)" tab displaying schema status, strict mode, and defined type schemas.
  - **Scenario Presets (`config/scenarios.toml`)**: Added sensible `[schema]` preset blocks for academic, thesis, business, research, and creative scenarios.
  - **Documentation & Skills**: Created `docs/SCHEMA.md`, updated `docs/AGENT.md`, `skills/wiki-ke-ontology/SKILL.md`, `Makefile` (`make schema-lint`, `make schema-infer`), `README.md`, `docs/TUTORIAL.md`, and `ROADMAP.md`.
  - **Test Suite**: Added test fixtures under `tests/fixtures/ke_wiki/` seeded with violations SCH-001 through SCH-006, and unit tests in `tests/test_schema_lint.py` and `tests/test_schema_infer.py`.

## [3.1.0] - 2026-09-29

### Added
- **Full Knowledge Engineering Suite (Phases 37, 44–48)**:
  - **Semantic Export (RDF / JSON-LD / Turtle)**: Built `scripts/export_semantic.py` exporting OKF v0.2 knowledge bases to standard W3C semantic graph formats (`output/wiki_export.jsonld`, `output/wiki_export.ttl`) for GraphDB / Protégé interoperability. Added `/export-semantic` skill command and `make export-semantic` target.
  - **Lightweight Ontology Rule Engine**: Built `scripts/ontology_rules.py` validating logical ontology constraints: Rule 1 (unlinked `Concept` notes), Rule 2 (direct circular dependencies A -> B -> A), and Rule 3 (human-verification actor requirement for `stable` status notes). Added `/ontology-check` skill command and `make ontology-check` target.
  - **Model Context Protocol (MCP) Server**: Native MCP server (`src/server/mcp_server.py`) exposing `search_wiki`, `get_concept_metadata`, and `get_line_anchored_citation` tools to external AI agent ecosystems via `make mcp-serve`.
  - **Knowledge Engineer Operating Manual**: Created `docs/KNOWLEDGE_ENGINEERING.md` detailing domain modeling, OKF v0.2 quality verification, semantic interoperability, and lifecycle concept drift management.
  - **Web UI & Control Panel Integration**: Registered `export_semantic` and `ontology_rules` tools in `SCRIPT_REGISTRY` and `buildCliArgs` in `src/server/agentServer.ts` for execution via Web UI tools modal.

## [2.9.0] - 2026-09-16

### Added
- **Complete Documentation Overhaul & 5-Phase Operator Workflow**:
  - Eliminated outdated/redundant proposal files (`docs/versioning_proposal.md`, `docs/wikimap.md`) to streamline the `docs/` folder.
  - Renamed and updated `docs/TECHNICAL_ARCHITECTURE.md` as the single technical reference for developers, covering system component topology, multi-provider LLM client, REST/SSE agent server, script execution engine, OKF v0.2, versioning & snapshot rollback engine (`scripts/versioning.py`), and multi-project management.
  - Redesigned `docs/TUTORIAL.md` (Guida Operativa dell'Utente) in clear plain language for non-technical users and content creators, detailing the 5-phase chronological workflow for building a dynamic knowledge base.
  - Updated `docs/THESIS_GUIDE.md` as a step-by-step concrete operator guide for Master's Thesis (Tesi Magistrale) creation with dual output (dynamic searchable wiki + printable PDF via Pandoc).
  - Restructured `README.md` with a clear audience-based document index and 5-phase operator pipeline summary.
  - Synchronized `ROADMAP.md` tracking all completed phases up to v2.9.0.

## [2.8.0] - 2026-09-14

### Added
- **Web UI Python Script Control Panel** (Phases 38–40):
  - Unified Script Control Panel accessible directly from the Web UI navigation header via the "🛠️ Tools" button.
  - Exposes all 15 Python CLI scripts (`conv2md.py`, `clip2md.py`, `notebooklm_import.py`, `migrate_to_okf.py`, `okf_lint.py`, `okf_log.py`, `okf_reindex.py`, `okf_stats.py`, `wiki_stats.py`, `maturity_calculator.py`, `check_docs_sync.py`, `suggest_tags.py`, `generate_thesis.py`, `export_thesis_pdf.py`, `wizard.py`) through categorized graphical menus (Ingestion, OKF Maintenance, Analysis & Metrics, Taxonomy, Thesis & Study, Wizard).
  - Dynamic parameter form component (`ToolsModal.ts`) generating typed input fields (text, number, select/dropdown, checkbox) for each tool.
  - Real-time terminal-like log console (`LogConsole.ts`) streaming Python stdout and stderr using Server-Sent Events (SSE) with process cancellation support and log export.
  - Secure child process execution engine in `src/server/agentServer.ts` (`GET /api/scripts/list`, `POST /api/scripts/execute`, `GET /api/files/download`) using `child_process.spawn('python3', ...)` with strict parameter validation and path containment against command injection.
  - Integration test suite in `tests/scriptControlPanel.test.ts` verifying endpoints, argument building, SSE streaming, and security safeguards.

## [2.7.0] - 2026-09-02

### Added
- Open Knowledge Format (OKF v0.2) Integration & Tooling Suite (Phase 35):
  - Downloaded/saved offline OKF v0.2 Specification in `docs/OKF_SPEC.md`.
  - Added `[okf]` and `[okf.migration]` sections in `config.toml` defining controlled vocabulary (`type`) and folder-to-type migration mapping.
  - One-shot migration script `scripts/migrate_to_okf.py` for transforming existing `wiki/` Markdown articles into valid OKF v0.2 frontmatter with `type`, `title`, `description`, `status`, `generated`, `verified`, and standardized `sources`.
  - Built `scripts/okf_lint.py` validator enforcing required frontmatter fields, ISO 8601 timestamps, actor conventions (<producer>/<version>, human:<id>, process:<id>), and reserved file conventions (`index.md` §8 OKF and `log.md` §9 OKF).
  - Built `scripts/okf_reindex.py` for OKF §8 compliant `index.md` generation (with bundle-root `okf_version: "0.2"`).
  - Built `scripts/okf_log.py` for OKF §9 compliant chronological change logging into `wiki/log.md`.
  - Built `scripts/okf_stats.py` for computing OKF bundle analytics (type distribution, trust tiers: unverified / machine-confirmed / human-reviewed, status, stale items).
  - Added Makefile convenience targets (`okf-validate`, `okf-lint`, `okf-reindex`, `okf-log`, `okf-stats`).
  - Added GitHub Actions workflow `.github/workflows/okf-validate.yml` for automated CI validation.
  - Updated `AGENT.md` and `skills/` skill packages (`wiki-curate`, `wiki-audit`, `wiki-ingest`) with OKF frontmatter schema, credibility signals, and OKF compliance checklist.

## [2.6.0] - 2026-08-28

### Added
- Modular Agent Skills Refactor (Phases 30–34):
  - Created `skills/` directory containing self-contained skill packages with YAML frontmatter metadata (`wiki-ingest`, `wiki-curate`, `wiki-audit`, `wiki-query`, `wiki-study`, `wiki-onboarding`).
  - Converted `AGENT.md` into a lightweight progressive disclosure router referencing `skills/`, reducing token footprint by 75–85% per session.
  - `.claude/skills/` integration and `make skills-link` target in `Makefile` for Claude Code compatibility.
  - Automated doc & skill consistency check script `scripts/check_docs_sync.py` integrated into pre-commit hooks, GitHub Actions CI, and `make docs-sync`.

## [2.5.0] - 2026-08-28

### Added
- NotebookLM-Inspired Study & Knowledge Synthesis Suite (Phase 29):
  - Passage-level grounding with `#L<start>-L<end>` line-anchor citations in frontmatter and wikilinks.
  - `/study-guide`: generates structured study guides with executive summaries, section breakdowns, glossaries, and self-assessment QA in `output/study-guide-*.md`.
  - `/quiz`: generates interactive multi-choice quizzes with answer keys and explanations in `output/quiz-*.md`.
  - `/mindmap`: generates hierarchical Markdown concept trees and JSON node-link mindmaps in `output/mindmap-*.md`.
  - `/audio-overview`: generates Host A / Host B conversational dialogue scripts in `output/audio-script-*.md` with optional TTS integration.
  - `/note` and `/promote-note`: scratchpad logging in `notes/` and promoting notes to full wiki articles.
  - `/deep-research`: multi-source synthesis reports with claim attribution matrix and knowledge gap analysis in `output/research-*.md`.

## [2.4.0] - 2026-08-28

### Added
- Editor action buttons (`src/components/editor/MarkdownEditor.ts`): **💾 Save & Close** and **✖ Cancel** in the editor header while editing, replacing the lossy Edit/Preview toggle. Save & Close persists changes and returns to preview; Cancel discards unsaved edits. `Ctrl/Cmd+S` quick-save unchanged. A **💾 Save** button is now always visible in the header (in preview it re-persists the note), and the "Saved to disk! 💾" confirmation is rendered after the vault refresh instead of being wiped by it.
- **Fix: line wrapping in the CodeMirror editor** (`EditorView.lineWrapping`): long single-line notes (e.g. links) used to stretch the editor to thousands of pixels, pushing the header action buttons off-screen in Edit mode. The editor now wraps lines and the header is hardened (`flex-wrap: wrap`, `min-width: 0`) so actions always stay visible.
- Wizard management in the Web UI (`src/components/chat/ChatDrawer.ts`): `/wizard` shortcut button, a wizard scenario selector (Academic/Thesis, Business KB, Competitive Research, Fiction/Worldbuilding, Existing Wiki) that launches `/wizard <scenario>` directly in chat, and updated welcome message listing `/wizard`.
- Real `/wizard` command support (`src/server/agentServer.ts`): `/wizard` lists the available scenarios; `/wizard <scenario>` runs the scenario workflow through the LLM in both streaming and non-streaming paths, with a structured fallback when a provider is unavailable.
- Expanded `tests/workflows.test.ts` covering the `/wizard` scenario list and scenario execution (44 total passing tests).

## [2.3.0] - 2026-08-28

### Added
- CodeMirror 6 Markdown Editor integration (`src/components/editor/MarkdownEditor.ts`): replaced raw `<textarea>` in edit mode with CodeMirror 6, featuring Markdown syntax highlighting, `[[wikilink]]` autocompletion menu, and keyboard shortcuts (`Ctrl/Cmd+S`, `Ctrl/Cmd+B`, `Ctrl/Cmd+I`).
- Real-Time LLM Response Streaming: Server-Sent Events (SSE) streaming on `/api/chat` and `ApiStorage.sendChatStream()`, with streaming handlers in `LlmClient` for Anthropic, OpenAI-compatible APIs, and Ollama. Responses stream chunk-by-chunk in `ChatDrawer` without UI flickering.
- Chat History Persistence: `ChatDrawer` preserves chat sessions across page reloads using `localStorage` (`wiki-forge:chat-history`), with a "Clear history" button in the drawer header.
- CSS Theme Architecture: extracted inline styles into `src/styles/theme.css` with CSS custom properties (`--bg-primary`, `--border-color`, `--accent-blue`, `--accent-button`) and modular component stylesheets (`sidebar.css`, `chat-drawer.css`, `editor.css`).
- Added unit & integration test suites in `tests/editorAutocomplete.test.ts` and `tests/streaming.test.ts` (42 total passing tests).

## [2.2.0] - 2026-08-28

### Added
- Real Multi-Provider LLM Integration (`src/server/llmClient.ts`): supports OpenCode CLI (`opencode`), Anthropic API (`claude-3-5-sonnet`), OpenAI-compatible REST endpoints (`gpt-4o`), and local Ollama (`llama3`).
- Configurable `[agent.llm]` section in `config.toml` supporting provider selection, model selection, timeouts, and environment-based API key references.
- System prompt integration reading `AGENT.md` guidelines and project context dynamically for chat completions and workflows.
- Real Workflow Command Engine (`/compile`, `/audit`, `/reindex`, `/consult`, `/trace`) in `AgentServer` performing real disk ingestion, raw source renaming (`_COMPILED.md`), broken link/orphan audit, and automatic index writing.
- Security Hardening: Path traversal containment on `POST /api/wiki/save` and `POST /api/wiki/attach` returning HTTP 400 Bad Request on invalid paths; HTML sanitization in `src/core/utils/html.ts` and `src/core/utils/markdown.ts` neutralizing XSS payloads; message size limits (50,000 characters).
- Comprehensive test suites in `tests/llmClient.test.ts`, `tests/workflows.test.ts`, and `tests/security.test.ts` (26 total unit/integration tests).

### Changed
- Updated `ROADMAP.md` tracking Phases 23, 24, and 25 as ✅ Done.
- Updated `TUTORIAL.md` and `README.md` with multi-provider LLM configuration guides and security architecture details.

## [2.1.0] - 2026-08-28

### Added
- Phase 22 implementation: Interactive OpenCode Chat & Persistence Layer.
- Decoupled Backend Agent Server (`src/server/agentServer.ts`) providing REST endpoints (`/api/wiki/notes`, `/api/wiki/save`, `/api/wiki/attach`, `/api/chat`).
- Vite Dev Server plugin (`agentApiPlugin`) in `vite.config.ts` handling `/api` requests seamlessly during development and preview.
- `ApiStorage` class in `src/storage/ApiStorage.ts` implementing `IStorage` interface with live server API communication and static `FileStorage` fallback.
- `ChatDrawer` component in `src/components/chat/ChatDrawer.ts` with OpenCode agent workflow shortcuts (`/consult`, `/compile`, `/audit`, `/trace`, `/reindex`).
- `AttachModal` component in `src/components/chat/AttachModal.ts` enabling one-click response attachment to wiki notes.
- Direct editor file saving with visual confirmation ("Saved to disk! 💾") and automatic real-time re-indexing of graph nodes and backlinks.
- Integration test suite in `tests/agentServer.test.ts` verifying all REST API endpoints and storage adapters.

### Changed
- Updated `ROADMAP.md` marking Phase 22 as ✅ Done.
- Updated `README.md` and `TUTORIAL.md` with complete documentation for OpenCode Chat, API endpoints, and direct file saving.

## [2.0.0] - 2026-08-27

### Added
- Complete Command Reference system in `AGENT.md` (v2.0) with 15+ atomic commands (`ingest`, `new-article`, `merge`, `split`, `stub`, `audit`, `reindex`, `stats`, `export`, `trace`, etc.).
- `TUTORIAL.md` additions: §11 Command Cheat Sheet, §12 Troubleshooting, and §13 Long-Term Care.
- Standard article template `templates/article.md`.
- `CHANGELOG.md` for release and version tracking.
- `wiki_stats.py` script for metrics calculation and `METRICS.md` generation.
- `clip2md.py` script for web page clipping into Markdown.
- GitHub Actions workflow (`.github/workflows/test.yml`) for `conv2md.py` testing.
- Pre-commit hook configuration (`.pre-commit-config.yaml`).

### Changed
- Expanded `config.toml` with `[agent]`, `[naming]`, `[export]`, and `[webclip]` settings.
- Enhanced `Makefile` with targets (`audit`, `stats`, `reindex`, `clean-output`, `export-json`, `lint`, `help`).
- Updated `.gitignore` to cover build artifacts, output logs, and environment files.
- Updated `ROADMAP.md` tracking phases 0–20.

## [1.0.0] - 2026-04-29

### Added
- Initial release of `wiki-forge` template.
- Decoupled converter script (`conv2md.py` & `run_convert.sh`).
- Basic `AGENT.md` operating manual (macro-workflows: compile, consult, audit).
- Config-driven setup via `config.toml`.
- Docker support (`Dockerfile`, `docker-compose.yml`).
