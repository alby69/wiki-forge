# Changelog

All notable changes to the `wiki-forge` template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
