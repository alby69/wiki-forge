# ROADMAP — Build & Maintain the LLM Wiki Template

> A step-by-step implementation plan written for **non-technical users**.
> Each phase states *what* to do, *why*, and *how* (with the simplest possible
> commands). Progress is tracked in the status table below and updated as work
> advances.

---

## Progress dashboard

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 0 | Understand the LLM Wiki concept | ✅ Done | `docs/KARPATHY_LLM_WIKI.md`, `TUTORIAL.md` |
| 1 | Scaffold project & single config knob | ✅ Done | `config.toml` |
| 2 | Dependency setup (Docker + classic) | ✅ Done | `Dockerfile`, `docker-compose.yml`, `requirements.txt` |
| 3 | Source ingestion & conversion | ✅ Done | `conv2md.py`, `run_convert.sh` |
| 4 | Agent schema & COMPILE integration | ✅ Done | `AGENT.md` v1.0 |
| 5 | Compile the existing knowledge base | ✅ Done | Run `compile` on current `raw/` |
| 6 | Sources registry | ✅ Done | `SOURCES.md` |
| 7 | Daily use: Consult & Audit | ✅ Done | Three workflows tested |
| 8 | Documentation pass | ✅ Done | `README.md`, `TUTORIAL.md`, `ROADMAP.md` |
| 9 | Publish to GitHub | ✅ Done | Repo: `alby69/wiki-forge` |
| 10 | Reuse template | ✅ Done | Configured `config.toml`, modular structure |
| 11 | Command Reference system (v2.0) | ✅ Done | 15+ atomic commands in `AGENT.md` |
| 12 | TUTORIAL command cheat sheet | ✅ Done | §11-13 in `TUTORIAL.md` |
| 13 | Article template system | ✅ Done | `templates/article.md` standard template |
| 14 | Project hygiene files | ✅ Done | `.gitignore`, `CHANGELOG.md` |
| 15 | Enhanced Makefile | ✅ Done | Targets for `stats`, `audit`, `reindex`, `clean-output`, etc. |
| 16 | Web clipping support | ✅ Done | `clip2md.py` script |
| 17 | Multi-language wiki support | ✅ Done | `[i18n]` section in `config.toml` & `AGENT.md` guidelines |
| 18 | Metrics & analytics | ✅ Done | `wiki_stats.py` -> `METRICS.md` |
| 19 | Pre-commit hooks | ✅ Done | `.pre-commit-config.yaml` with frontmatter and link checks |
| 20 | CI/CD for conv2md.py | ✅ Done | `.github/workflows/test.yml` GitHub Actions workflow |
| 21 | Web UI & Obsidian Graph Viewer | ✅ Done | Vite app, 3-column viewer, reads real `wiki/` via `FileStorage` |
| 22 | Interactive OpenCode Chat & Persistence Layer | ✅ Done | OpenCode chat drawer, agent command runner, response attachment, and server-persisted Markdown editor |
| 23 | Real Multi-Provider LLM Integration | ✅ Done | Config-driven `[agent.llm]` supporting OpenCode CLI, Anthropic, OpenAI, and Ollama (`src/server/llmClient.ts`) |
| 24 | Workflow Command Engine (`/compile`, `/audit`, `/reindex`, `/consult`, `/trace`) | ✅ Done | On-disk ingestion, file renaming (`_COMPILED.md`), broken link/orphan audit, and automatic index generation |
| 25 | Security Hardening & Protection | ✅ Done | Path traversal protection on `save` & `attach` endpoints (400 Bad Request) and XSS HTML sanitization in `renderMarkdown` |
| 26 | Professional UI & Vault File Management System | ✅ Done | Complete file manager UI with folder/file creation, rename, move, delete, upload, drag-and-drop, and API endpoint integration |
| 27 | UI & Chat Enhancements (CodeMirror 6, Streaming, History, CSS Themes) | ✅ Done | CodeMirror 6 markdown editor with `[[wikilink]]` autocomplete, SSE streaming responses, localStorage chat history, and extracted CSS themes |
| 28 | Scenario-Driven Interactive Wizard System | ✅ Done | Interactive CLI wizard (`scripts/wizard.py`), scenario presets (`config/scenarios.toml`), `/wizard` contract extension in `AGENT.md` |
| 29 | NotebookLM-Inspired Study & Knowledge Synthesis Suite | ✅ Done | Passage-level grounding (`#L<start>-L<end>`), `/study-guide`, `/quiz`, `/deep-research`, `/mindmap`, `/note` & `/promote-note`, `/audio-overview` |
| 30 | Documentation Reconciliation Pass | ✅ Done | Added `[2.5.0]` to `CHANGELOG.md`, bumped `package.json`, aligned command reference in `README.md` & `TUTORIAL.md` |
| 31 | Modular Agent Skills Extraction & Router Conversion | ✅ Done | Extracted verbatim commands to `skills/*/SKILL.md` packages; converted `AGENT.md` to progressive disclosure router |
| 32 | Claude Code / Claude Skills Native Compatibility | ✅ Done | Added `.claude/skills/` syncing (`make skills-link`) and updated setup/troubleshooting guides |
| 33 | Automated Doc/Skill Consistency Verification | ✅ Done | Added `scripts/check_docs_sync.py`, `.pre-commit-config.yaml` hook, CI workflow job, and `make docs-sync` |
| 34 | Final Documentation & Roadmap Synchronization | ✅ Done | Synchronized `ROADMAP.md`, `CHANGELOG.md`, `README.md`, `package.json` for release `2.6.0` |

Legend: ✅ Done · 🔄 Ongoing · ⬜ Todo

---

## Phase 11 — Command Reference system (v2.0) ✅ Done

**Goal:** give the agent a rich, granular command set instead of 3 macro-workflows.

**Deliverables:**
- Rewrote `AGENT.md` with §5 "COMMAND REFERENCE" (15+ commands).
- Documented each command: syntax, scope, action, output, confirmation rules.
- Added orchestration section (§6) explaining how macro-workflows chain atomic commands.

---

## Phase 12 — TUTORIAL command cheat sheet ✅ Done

**Goal:** make the TUTORIAL a complete user reference, not just a concept guide.

**Deliverables:**
- §11: Command Cheat Sheet (daily / weekly / as-needed).
- §12: Troubleshooting (5 common problems + solutions).
- §13: Long-term care (monthly / quarterly / yearly checklist).

---

## Phase 13 — Article template system ✅ Done

**Goal:** standardize new article creation.

**Deliverables:**
- `templates/article.md` with standard frontmatter and structural placeholders.
- `new-article` command specification in `AGENT.md`.
- `template show` command in `AGENT.md` to view active template.

---

## Phase 14 — Project hygiene files ✅ Done

**Goal:** make the repo production-ready and version-tracked.

**Deliverables:**
- Updated `.gitignore` excluding venv, logs, build noise, and raw binaries.
- Created `CHANGELOG.md` following Semantic Versioning to track changes.

---

## Phase 15 — Enhanced Makefile ✅ Done

**Goal:** provide convenience targets for daily workflows and agent commands.

**New targets:**
- `make audit`
- `make stats`
- `make reindex`
- `make clean-output`
- `make export-json`
- `make lint`
- `make help`

---

## Phase 16 — Web clipping support ✅ Done

**Goal:** ingest web pages directly into raw/ format.

**Deliverables:**
- `clip2md.py` script for fetching URLs, stripping HTML noise, and saving as clean Markdown in `sources/web-clips/`.

---

## Phase 17 — Multi-language wiki support ✅ Done

**Goal:** support wikis in languages other than English.

**Deliverables:**
- `[i18n]` section added to `config.toml` (`default_language`, `supported_languages`, `fallback_language`).
- Extended `AGENT.md` and `TUTORIAL.md` instructions for multilingual content handling and synthesis.

---

## Phase 18 — Metrics & analytics ✅ Done

**Goal:** track wiki growth and health over time.

**Deliverables:**
- `wiki_stats.py` script to compute stats (articles, wikilinks, broken links, orphans, sources) and auto-generate `METRICS.md`.

---

## Phase 19 — Pre-commit hooks ✅ Done

**Goal:** prevent broken states or missing metrics from entering the repository.

**Deliverables:**
- `.pre-commit-config.yaml` file with trailing whitespace, EOF fixer, YAML validation, and `wiki-stats-check` hooks.

---

## Phase 20 — CI/CD for conv2md.py ✅ Done

**Goal:** ensure converter and scripts work across environments.

**Deliverables:**
- `.github/workflows/test.yml` GitHub Actions workflow testing Python 3.11/3.12, pandoc installation, `conv2md.py`, `wiki_stats.py`, and `clip2md.py`.

---

## Phase 21 — Web UI & Obsidian Graph Viewer ✅ Done

**Goal:** Provide a sleek, dependency-light, decoupled web interface for exploring
the knowledge base, with an interactive `[[wikilink]]` graph viewer — no Obsidian
required.

**Deliverables (implemented and verified):**
- **Build tooling:** Vite + TypeScript. `npm run dev` (hot-reload at
  `http://localhost:5173`), `npm run build` (static `dist/`), `npm run preview`.
- **Entry point:** `index.html` mounts `WikiForgeApp` (`src/index.ts`).
- **Real-vault loading:** `src/storage/FileStorage.ts` implements `IStorage` and
  bundles every Markdown file under `wiki/` and `raw/` at build time via
  `import.meta.glob` — fully backend-free. Falls back to a demo vault when empty.
- **Three-column layout:** Vault sidebar (notes by folder + tag cloud + search),
  Markdown editor panel, and a node-metadata context panel (`src/components/*`).
- **Interactive graph viewer:** `ForceGraphViewer` renders an SVG node-link map
  of `[[wikilinks]]` with hover highlights, click-to-navigate, and filters
  (search + minimum-connections) via `GraphControls`. No heavy graph dependency.
- **Safety:** `escapeHtml` helper hardens all note content rendered via
  `innerHTML` (sidebar, editor, context panel, graph labels).
- **Tests:** link-extraction and graph-payload unit tests pass (`npm run test`).
- **Scope note:** the UI is a **read/explore viewer**. The coding agent remains
  the source of truth and owns on-disk edits; UI edits are session-only.

---

## Phase 22 — Interactive OpenCode Chat & Persistence Layer ✅ Done

**Goal:** Integrate a dedicated Chat drawer/modal in the Web UI powered by OpenCode (or agent API), allowing users to execute agent workflows/commands (`consult`, `compile`, `audit`, etc.), receive structured synthesized responses, directly attach/append responses into the wiki, and edit/save Markdown files back to disk.

**Deliverables (implemented and verified):**

1. **Decoupled Backend Agent Server (`src/server/agentServer.ts` & Vite Plugin):**
   - Implemented REST API endpoints for agent workflows:
     - `GET /api/wiki/notes`: Loads all Markdown notes in real time from `wiki/`.
     - `POST /api/wiki/save`: Saves edited Markdown content directly to disk under `wiki/`.
     - `POST /api/wiki/attach`: Appends or creates new notes from chat responses.
     - `POST /api/chat`: Processes slash commands (`/consult`, `/compile`, `/audit`, `/trace`, `/reindex`) and queries using `AGENT.md` guidelines, returning structured Markdown answers with `[[wikilinks]]`.
   - Wired seamlessly into `vite.config.ts` dev and preview server middleware.

2. **Storage Adapter & Persistence Layer (`src/storage/ApiStorage.ts`):**
   - Implemented `ApiStorage` extending `IStorage` interface.
   - Synchronizes directly with server API endpoints when online and falls back to static `FileStorage` when offline.

3. **Interactive OpenCode Chat Drawer & Attachment UI (`src/components/chat/*`):**
   - Added slide-out `ChatDrawer` in `MainLayout.ts` with toggle button in `Header.ts`.
   - Added command shortcut buttons (`/consult`, `/compile`, `/audit`, `/trace`, `/reindex`).
   - Integrated `AttachModal` on AI responses allowing users to append or create new wiki notes.

4. **Direct Markdown Editor Persistence & Auto-Reindexing:**
   - Updated `MarkdownEditor.ts` to show instant save status ("Saved to disk! 💾").
   - Wired `WikiForgeApp` (`src/index.ts`) to save edits directly to disk and automatically recompute backlinks, tag clouds, and graph view in real time.

5. **Tests & Quality Assurance:**
   - Added integration test suite `tests/agentServer.test.ts` covering all REST endpoints and storage methods (100% pass rate across 11 test cases).

---

## Phase 23 — Real Multi-Provider LLM Integration ✅ Done

**Goal:** Replace mock chat string matching with real LLM completions driven by system prompt guidelines from `AGENT.md` and `config.toml`.

**Deliverables:**
- Added `[agent.llm]` configuration in `config.toml` supporting `provider` (`"opencode"`, `"anthropic"`, `"openai_compatible"`, `"ollama"`), model parameters, timeouts, and API key environment variable references.
- Implemented `src/server/llmClient.ts` with `OpenCodeCliClient` (safe `spawn`), `HttpLlmClient` (Anthropic & OpenAI REST API), `OllamaClient`, and `LlmClientFactory`.
- Integrated `LlmClient` into `AgentServer` (`src/server/agentServer.ts`) with note context retrieval and graceful error fallback.
- Added test suite `tests/llmClient.test.ts`.

---

## Phase 24 — Workflow Command Engine ✅ Done

**Goal:** Execute real filesystem operations on disk when running agent slash commands from the Web UI.

**Deliverables:**
- Real `/compile`: scans `raw/`, invokes LLM synthesis, creates compiled notes in `wiki/`, renames raw sources with `_COMPILED.md`, and updates indexes.
- Real `/audit`: computes orphan notes, broken `[[wikilinks]]`, YAML frontmatter linting (skipping index files), and index alignment.
- Real `/reindex`: programmatically regenerates `wiki/index.md` and `wiki/<theme>/index.md`.
- Real `/consult` & `/trace`: relevance scoring for top 3–5 context articles and claim tracing across outbound links.
- Added test suite `tests/workflows.test.ts`.

---

## Phase 25 — Security Hardening & Protection ✅ Done

**Goal:** Ensure safe operation before exposing the Web UI beyond local environments.

**Deliverables:**
- Path traversal protection in `saveWikiNote` and `attachToNote` endpoints in `AgentServer`, enforcing target path containment within `wiki/` directory and rejecting `..` traversal paths with HTTP 400 Bad Request.
- XSS protection in `src/core/utils/html.ts` and `src/core/utils/markdown.ts`, sanitizing script tags, iframes, and inline event handlers (`onerror`, `onload`).
- Request length limit (50,000 characters) on `/api/chat` and subprocess execution timeouts.
- Added test suite `tests/security.test.ts`.

---

## Phase 26 — Professional UI & Vault File Management System ✅ Done

**Goal:** Transform the Web UI into a professional IDE-grade knowledge base manager supporting full filesystem control over wiki folders and files.

**Deliverables:**
- **Full Filesystem Operations API:** REST endpoints (`/api/wiki/folder/create`, `/api/wiki/file/create`, `/api/wiki/rename`, `/api/wiki/move`, `/api/wiki/delete`, `/api/wiki/upload`) implemented with path traversal security containment.
- **Storage Layer Abstraction:** Updated `IStorage`, `ApiStorage`, and `FileStorage` interfaces with async methods for creating, moving, renaming, deleting, and uploading files/folders.
- **Professional File Explorer UI:** High-density desktop UI sidebar with action toolbar buttons for 📁 New Folder, 📄 New File, 📤 Upload File, ✏️ Rename, ✂️ Move, and 🗑️ Delete.
- **Drag-and-Drop & File Upload:** Support for dragging notes/folders within the file tree and dropping local computer files onto the explorer drop zone.
- **Tests & Verification:** Integration test suite `tests/fsOperations.test.ts` ensuring 100% pass rate.

---

## Phase 27 — UI & Chat Enhancements (CodeMirror 6, Streaming, History, CSS Themes) ✅ Done

**Goal:** Elevate the Web UI writing experience with CodeMirror 6, real-time LLM response streaming, chat history persistence, and clean modular CSS themes.

**Deliverables:**
- **CodeMirror 6 Markdown Editor:** Integrated `@codemirror` replacing raw `<textarea>` in edit mode with full Markdown syntax highlighting, `[[wikilink]]` autocompletion menu on typing `[[`, and keyboard shortcuts (`Ctrl/Cmd+S`, `Ctrl/Cmd+B`, `Ctrl/Cmd+I`).
- **LLM Response Streaming:** Implemented Server-Sent Events (SSE) streaming on `/api/chat` and `ApiStorage.sendChatStream()`, with streaming handlers in `LlmClient` for Anthropic API, OpenAI-compatible APIs, and Ollama. Responses stream chunk-by-chunk in `ChatDrawer` without component flickering.
- **Chat History Persistence:** Automatically persists chat messages in `localStorage` (`wiki-forge:chat-history`), restored across page refreshes, and includes a "Clear history" button in the chat drawer header.
- **CSS Theme Refactoring:** Extracted inline styles into `src/styles/theme.css` with CSS custom properties (`--bg-primary`, `--border-color`, `--accent-blue`, `--accent-button`) and modular component stylesheets (`sidebar.css`, `chat-drawer.css`, `editor.css`).
- **Tests & Verification:** Added `tests/editorAutocomplete.test.ts` and `tests/streaming.test.ts` (100% pass rate).

---

## Phase 28 — Scenario-Driven Interactive Wizard System ✅ Done

---

## Phase 29 — NotebookLM-Inspired Study & Knowledge Synthesis Suite ✅ Done

**Goal:** Integrate NotebookLM-inspired synthesis and study workflows without sacrificing file-based, agent-agnostic, git-friendly principles.

**Deliverables:**
- **Precise Source Grounding (4.1):** Line-anchored source citation support (`raw/file.md#L10-L20`) in `AGENT.md`, line passage extraction in `/trace`, and Web UI source link data attributes.
- **Study Guide & Quiz Generator (4.2):** Implemented `/study-guide` and `/quiz` workflow commands producing structured Markdown files in `output/`.
- **Deep Research Synthesis (4.3):** Implemented `/deep-research` command producing multi-source reports with attribution matrix and knowledge gap identification.
- **Per-Article Mind Maps (4.5):** Implemented `/mindmap` command extracting heading tree hierarchies and JSON node-link structures into `output/`.
- **Quick Notes Scratchpad (4.6):** Added `notes` directory configuration in `config.toml`, `/note` for scratchpad logging, and `/promote-note` for promoting scratchpad notes to formal wiki articles.
- **Audio Overview Dialogue Scripts (4.4):** Added `[audio]` config section and `/audio-overview` command generating Host A / Host B conversational dialogue scripts.
- **Automated Testing:** Added `tests/notebooklmFeatures.test.ts` integration test suite.

**Goal:** Provide scenario-driven wizard workflows for domain-specific use cases (Academic/Thesis, Business KB, Research, Creative Fiction, Existing Wiki).

**Deliverables:**
- **Scenario Presets (`config/scenarios.toml`):** Defined steps, descriptions, and prompts for domain scenarios (`academic`, `business`, `research`, `creative`, `existing`).
- **CLI Wizard (`scripts/wizard.py`):** Rich interactive menu and `--preset` command-line execution for source checking, transparent `conv2md.py` conversion, and formatted agent prompt hand-offs.
- **Agent Contract Extension (`AGENT.md`):** Documented `/wizard` and `/wizard [scenario]` commands with uniform progress headers `[WIZARD STEP X/Y: Step Name]` and confirmation rules.
- **Documentation & Build:** Updated `README.md`, `ROADMAP.md`, and added `make wizard` shortcut in `Makefile`.
