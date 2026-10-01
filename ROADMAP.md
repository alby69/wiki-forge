# ROADMAP — Build & Maintain the LLM Wiki Template

> A step-by-step implementation plan written for **non-technical users**.
> Each phase states *what* to do, *why*, and *how* (with the simplest possible
> commands). Progress is tracked in the status table below and updated as work
> advances.

---

## Progress dashboard

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 0 | Understand the LLM Wiki concept | ✅ Done | `docs/KARPATHY_LLM_WIKI.md`, `docs/TUTORIAL.md` |
| 1 | Scaffold project & single config knob | ✅ Done | `config.toml` |
| 2 | Dependency setup (Docker + classic) | ✅ Done | `Dockerfile`, `docker-compose.yml`, `requirements.txt` |
| 3 | Source ingestion & conversion | ✅ Done | `conv2md.py`, `run_convert.sh` |
| 4 | Agent schema & COMPILE integration | ✅ Done | `docs/AGENT.md` v1.0 |
| 5 | Compile the existing knowledge base | ✅ Done | Run `compile` on current `raw/` |
| 6 | Sources registry | ✅ Done | `docs/SOURCES.md` |
| 7 | Daily use: Consult & Audit | ✅ Done | Three workflows tested |
| 8 | Documentation pass | ✅ Done | `README.md`, `docs/TUTORIAL.md`, `ROADMAP.md` |
| 9 | Publish to GitHub | ✅ Done | Repo: `alby69/wiki-forge` |
| 10 | Reuse template | ✅ Done | Configured `config.toml`, modular structure |
| 11 | Command Reference system (v2.0) | ✅ Done | 15+ atomic commands in `AGENT.md` |
| 12 | TUTORIAL command cheat sheet | ✅ Done | §8 in `docs/TUTORIAL.md` |
| 13 | Article template system | ✅ Done | `templates/article.md` standard template |
| 14 | Project hygiene files | ✅ Done | `.gitignore`, `docs/CHANGELOG.md` |
| 15 | Enhanced Makefile | ✅ Done | Targets for `stats`, `audit`, `reindex`, `clean-output`, etc. |
| 16 | Web clipping support | ✅ Done | `clip2md.py` script |
| 17 | Multi-language wiki support | ✅ Done | `[i18n]` section in `config.toml` & `docs/AGENT.md` guidelines |
| 18 | Metrics & analytics | ✅ Done | `wiki_stats.py` -> `docs/METRICS.md` |
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
| 30 | Documentation Reconciliation Pass | ✅ Done | Added `[2.5.0]` to `docs/CHANGELOG.md`, bumped `package.json`, aligned command reference in `README.md` & `docs/TUTORIAL.md` |
| 31 | Modular Agent Skills Extraction & Router Conversion | ✅ Done | Extracted verbatim commands to `skills/*/SKILL.md` packages; converted `AGENT.md` to progressive disclosure router |
| 32 | Claude Code / Claude Skills Native Compatibility | ✅ Done | Added `.claude/skills/` syncing (`make skills-link`) and updated setup/troubleshooting guides |
| 33 | Automated Doc/Skill Consistency Verification | ✅ Done | Added `scripts/check_docs_sync.py`, `.pre-commit-config.yaml` hook, CI workflow job, and `make docs-sync` |
| 34 | Final Documentation & Roadmap Synchronization | ✅ Done | Synchronized `ROADMAP.md`, `docs/CHANGELOG.md`, `README.md`, `package.json` for release `2.6.0` |
| 35 | Open Knowledge Format (OKF v0.2) Integration & Tooling Suite | ✅ Done | Adoption of OKF v0.2 standard across `wiki/`, frontmatter taxonomy validation, migration script, reserved files, Makefile targets, and CI |
| 36 | Web UI OKF Trust Badges & Lifecycle Filters | ✅ Done | Render trust tier badges (unverified/machine-confirmed/human-reviewed) e filtri UI per stato OKF e note "stale". |
| 37 | OKF MCP Server Integration for External Agents | ✅ Done | Esposizione di `search_wiki`, `get_concept_metadata`, e `get_line_anchored_citation` via Model Context Protocol (MCP) server (`make mcp-serve`). |
| 38 | Core/API Separation, Caching & Auto-Tests | ✅ Done | `src/api/core.py`, `src/cache.py`, optimized Vite build, `tests/auto/` |
| 39 | DRY/KISS Skills Symlink Refactoring | ✅ Done | Replaced `cp -r` with `ln -sf` in `Makefile` for single source of truth |
| 40 | Multi-Project Management & GUI Config Manager | ✅ Done | `projects/` directory support, `projects.json` registry, `smol-toml` config API, Project Switcher & GUI Config Manager modal |
| 41 | Web UI Python Script Control Panel | ✅ Done | Unified Control Panel (`ToolsModal.ts`, `LogConsole.ts`) for executing all 16 Python CLI scripts with real-time SSE log streaming |
| 42 | Knowledge Engineer Role Evolution & Operating Manual v3.0 | ✅ Done | Redefined agent contract in `docs/AGENT.md` from librarian to Knowledge Engineer with 6 core capabilities |
| 42b | Incremental KB Versioning & Rollback Engine | ✅ Done | Added `scripts/versioning.py`, `wiki/versions/` snapshot backups, and `/rollback` agent command |
| 43 | Documentation Overhaul & 5-Phase Operator Workflow | ✅ Done | Streamlined `docs/`, eliminated redundant files, updated architecture and tutorial docs |
| 44 | Voice & Multimedia Ingestion (No-Code Entry) | ✅ Done | Integrazione di trascrizione/dettatura vocale (`scripts/voice_ingest.py`) per trasformare registrazioni in note OKF strutturate. |
| 45 | Automated "Thesis Defense" Slide Generation | ✅ Done | Integrazione della skill `slides` e modelli reveal.js (`templates/reveal/`) per generare deck di presentazione offline-ready. |
| 46 | Enterprise Readiness: RBAC & Cloud Sync Hooks | ✅ Done | Aggiunta configurazione `[enterprise]` in `config.toml` con flag RBAC e hook di backup cloud WebDAV. |
| 47 | Semantic Export (RDF/JSON-LD/Turtle) | ✅ Done | Script `export_semantic.py` per l'esportazione W3C semantica (`output/wiki_export.jsonld`, `output/wiki_export.ttl`). |
| 48 | Lightweight Ontology Rule Engine | ✅ Done | Motore di regole `ontology_rules.py` per la validazione logica (unlinked concepts, circular links, stable human review). |
| 49 | Typed Schema System & Linting Engine (T1) | ✅ Done | Schema validation (`scripts/schema_lint.py`), inference (`scripts/schema_infer.py`), and `docs/SCHEMA.md`. |
| 50 | Enterprise Semantic Knowledge Graph & Stateful GraphRAG System | ✅ Done | W3C SHACL shape schema (`src/wikiforge/config/shapes.ttl`), Zettelkasten-to-RDF converter (`markdown_to_rdf.py`), Neo4j Cypher exporter (`markdown_to_cypher.py`), stateful LangGraph GraphRAG pipeline (`graph_rag_pipeline.py`), GitHub Actions CI/CD (`shacl_validation.yml`), unit tests, and `docs/GRAPH_RAG.md`. |
| 51 | Knowledge Engineer Use Case Management & Guided Workbench | ✅ Done | Dedicated KE Workbench (`src/components/ke/KEWorkbenchModal.ts`), 6 guided Use Cases, REST APIs (`GET /api/ke/use-cases`, `POST /api/ke/use-cases/execute`), role separation (Simple Operator vs Knowledge Engineer), and documentation updates in `docs/KNOWLEDGE_ENGINEERING.md` and `docs/TUTORIAL.md`. |

Legend: ✅ Done · 🔄 Ongoing · ⬜ Todo

---

## Phase 42b — Incremental KB Versioning & Rollback Engine ✅ Done

**Goal:** Provide full auditability, historical snapshots, and rollback capability for wiki synthesis notes without modifying original source files in `sources/`.

**Deliverables:**
- Implemented `scripts/versioning.py` for creating version snapshots in `wiki/versions/`.
- Updated `AGENT.md` and `skills/wiki-curate/` with the `/rollback note=<note> [to=version]` command contract.
- Integrated logging of version changes into `wiki/log.md` conforming to OKF §9.

---

## Phase 43 — Documentation Overhaul & 5-Phase Operator Workflow ✅ Done

**Goal:** Clean up and streamline all documentation, clearly separating user/operator guides from technical developer specifications, and defining the 5-phase chronological workflow for building a dynamic Knowledge Base (Master's Thesis / Tesi Magistrale example with printable PDF export).

**Deliverables:**
- Eliminated redundant/outdated docs (`docs/versioning_proposal.md`, `docs/wikimap.md`).
- Renamed and expanded `docs/TECHNICAL_ARCHITECTURE.md` as the central developer architecture reference.
- Updated `docs/TUTORIAL.md` and `docs/THESIS_GUIDE.md` with the 5-phase chronological operator pipeline (Initialization -> Ingestion -> Dynamic Construction -> Study & Maturity -> Print PDF Export).
- Reorganized `README.md` with audience-based document index and 5-phase workflow.
- Verified doc/skill synchronization with `scripts/check_docs_sync.py`.

---

## Phase 47 & 48 — Semantic Export & Lightweight Ontology Rule Engine ✅ Done

**Goal:** Elevate `wiki-forge` to a complete Knowledge Engineering platform by implementing W3C semantic exports and formal logical ontology validation rules.

**Deliverables:**
- Implemented `scripts/export_semantic.py` exporting OKF v0.2 notes into JSON-LD and Turtle TTL semantic graph files.
- Implemented `scripts/ontology_rules.py` for logical rule verification (unlinked `Concept` notes, circular dependencies A -> B -> A, and human verification requirements for `stable` status notes).
- Registered tools in AgentServer `SCRIPT_REGISTRY` and Web UI Control Panel.
- Created `docs/KNOWLEDGE_ENGINEERING.md` operating manual for Knowledge Engineers.

---

## Phase 51 — Knowledge Engineer Use Case Management & Guided Workbench ✅ Done

**Goal:** Provide structured Use Case management for Knowledge Engineers with a dedicated KE Workbench UI, 6 guided professional workflows, clear separation from Simple Operator tasks, and full REST API backend integration.

**Deliverables:**
- Implemented `KE_USE_CASES` registry and REST API endpoints (`GET /api/ke/use-cases`, `POST /api/ke/use-cases/execute`) in `src/server/agentServer.ts`.
- Implemented `src/components/ke/KEWorkbenchModal.ts` providing an interactive guided workbench modal for Knowledge Engineers with real-time SSE log streaming.
- Added `🧠 KE Workbench` quick launcher button in `Header.ts` visible in Developer Mode.
- Structured clear user role separation between Simple Operators (Focus Mode 🌱: Carica -> Compila -> Chiedi) and Knowledge Engineers (Developer Mode 👑: Schema Modeling, Ontological Validation, CQ Assessment, Neuro-Symbolic Reasoning, Semantic RDF Export, Platform Maturity Evaluation).
- Updated documentation across `docs/KNOWLEDGE_ENGINEERING.md`, `docs/TUTORIAL.md`, `docs/AGENT.md`, `README.md`, and `ROADMAP.md`.

---

## Phase 50 — Enterprise Semantic Knowledge Graph & Stateful GraphRAG System ✅ Done

**Goal:** Transform `wiki-forge` into an Enterprise Semantic Knowledge Graph system featuring automated W3C SHACL shape validation, dual W3C RDF / Neo4j Property Graph exports, and a stateful LangGraph GraphRAG pipeline with Text-to-Cypher translation and self-correction error recovery.

**Deliverables:**
- Implemented W3C SHACL validation shapes in `src/wikiforge/config/shapes.ttl`.
- Implemented Zettelkasten-to-RDF converter in `src/wikiforge/semantics/markdown_to_rdf.py`.
- Implemented Neo4j Cypher property graph exporter in `src/wikiforge/semantics/markdown_to_cypher.py`.
- Implemented stateful LangGraph GraphRAG pipeline in `src/wikiforge/semantics/graph_rag_pipeline.py`.
- Added GitHub Actions workflow in `.github/workflows/shacl_validation.yml`.
- Added test suites (`tests/test_shacl.py`, `tests/test_converters.py`, `tests/test_graph_rag.py`).
- Added user and architecture documentation in `docs/GRAPH_RAG.md`.
