# Changelog

All notable changes to the `wiki-forge` template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
