---
type: Reference
title: "AUDIT_BASELINE — Wiki-Forge Repository Baseline Audit (Phase 0 / Task T0.1)"
description: "├── .claude/ # Claude Code skills symbolic links (.claude/skills/)"
resource: docs/AUDIT_BASELINE.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-audit-baseline-md
    resource: docs/AUDIT_BASELINE.md
    title: "AUDIT_BASELINE — Wiki-Forge Repository Baseline Audit (Phase 0 / Task T0.1)"
    author: human:alby69
---
# AUDIT_BASELINE — Wiki-Forge Repository Baseline Audit (Phase 0 / Task T0.1)

> **Date:** October 2026
> **Auditor:** Jules (Autonomous Agent)
> **Repository:** `alby69/wiki-forge`
> **Branch:** `main` (Audited on `feat/T0.1-baseline-audit`)
> **Purpose:** Baseline verification of directory structure, ROADMAP status, stray files, dependencies, test suite baseline, and architecture risk verification.

---

## 1. Actual Repository File Tree

```
alby69/wiki-forge/
├── .claude/                   # Claude Code skills symbolic links (.claude/skills/*)
├── .github/
│   └── workflows/             # GitHub Actions CI workflows (test.yml, docker-publish.yml, shacl_validation.yml)
├── .wiki-forge/               # Runtime local cache & SQLite ingestion queue (ingest_queue.db)
├── bin/                       # Cross-platform startup & shutdown launchers (Start_WikiForge, Stop_WikiForge, Update_WikiForge)
├── config/                    # Static configuration, project registries, and scenario templates
│   ├── config.toml            # Central Wiki-Forge configuration file
│   ├── odp_catalog.json       # Ontology Design Pattern catalog
│   ├── projects.json          # Multi-project workspace registry
│   └── scenarios.toml         # Scenario-driven wizard presets
├── docs/                      # Repository documentation suite
│   ├── AGENT.md -> ../AGENT.md# Symlinked Knowledge Engineer Operating Manual
│   ├── AUDIT_BASELINE.md      # This document (Phase 0 Audit Baseline)
│   ├── CHANGELOG.md           # Version changelog
│   ├── GRAPH_RAG.md           # Knowledge Graph & GraphRAG documentation
│   ├── KARPATHY_LLM_WIKI.md   # Architectural explanation of the LLM Wiki pattern
│   ├── KNOWLEDGE_ENGINEERING.md# KE platform operating manual
│   ├── METRICS.md             # Knowledge Base metrics documentation
│   ├── OKF_SPEC.md            # Open Knowledge Format (OKF v0.2) specification
│   ├── README.md              # Documentation index
│   ├── ROADMAP.md             # Implementation roadmap
│   ├── SCHEMA.md              # Typed schema and linting specification
│   ├── SOURCES.md             # Raw sources registry
│   ├── STARTUP.md             # Desktop & launcher quickstart guide
│   ├── TECHNICAL_ARCHITECTURE.md# Technical architecture specification
│   ├── THESIS_GUIDE.md        # Master's Thesis compilation guide
│   ├── TUTORIAL.md            # Non-technical operator tutorial & cheat sheet
│   └── WORKFLOW.md            # Hybrid NotebookLM to Wiki-Forge workflow guide
├── extension/                 # Chrome Manifest V3 Web Clipper browser extension
│   ├── background.js
│   ├── content.js
│   ├── manifest.json
│   ├── popup.html
│   └── popup.js
├── projects/                  # Workspace sub-directories (e.g., projects/tesi)
├── public/                    # Static UI assets (favicon.svg)
├── scripts/                   # CLI execution tools & domain scripts
│   ├── check_docs_sync.py     # Doc & skill command synchronization verifier
│   ├── clip2md.py             # Web clipping converter
│   ├── conv2md.py             # Multimodal source document converter
│   ├── cq_validator.py        # Competency Question validator
│   ├── enrich_cot.py          # Chain-of-Thought enrichment processor
│   ├── export_semantic.py     # W3C RDF / Turtle / JSON-LD exporter
│   ├── export_thesis_pdf.py   # Pandoc PDF thesis exporter
│   ├── generate_thesis.py     # Thesis markdown compiler
│   ├── graph_analytics.py     # Louvain community detection & topological analysis
│   ├── ingest_queue.py        # SQLite-backed ingestion queue & state manager
│   ├── ke_common.py           # Knowledge Engineering common parsing utilities
│   ├── ke_maturity.py         # 6-dimension KE maturity evaluator
│   ├── maturity_calculator.py # Thesis maturity calculator
│   ├── migrate_to_okf.py      # OKF v0.2 migration utility
│   ├── neuro_symbolic_check.py# Neuro-symbolic consistency checker
│   ├── notebooklm_import.py   # NotebookLM export importer
│   ├── odp_suggester.py       # Ontology Design Pattern suggester
│   ├── okf_common.py          # OKF path and frontmatter utilities
│   ├── okf_lint.py            # OKF v0.2 frontmatter & link linter
│   ├── okf_log.py             # OKF append-only logger
│   ├── okf_reindex.py         # OKF index regenerator
│   ├── okf_stats.py           # OKF status statistics reporter
│   ├── ontology_rules.py      # Logical ontology rule engine
│   ├── run_convert.sh         # Document conversion shell wrapper
│   ├── schema_infer.py        # TOML schema inferrer
│   ├── schema_lint.py         # TOML schema linter
│   ├── suggest_tags.py        # Faceted tag suggester
│   ├── versioning.py          # Snapshot versioning & rollback engine
│   ├── voice_ingest.py        # Voice recording transcription ingest
│   ├── wiki_stats.py          # Knowledge base analytics reporter
│   └── wizard.py              # Interactive scenario wizard script
├── skills/                    # Modular agent skill packages
│   ├── wiki-adversarial-review/
│   ├── wiki-audit/
│   ├── wiki-curate/
│   ├── wiki-digest/
│   ├── wiki-ingest/
│   ├── wiki-ke-ontology/
│   ├── wiki-onboarding/
│   ├── wiki-query/
│   ├── wiki-slides/
│   ├── wiki-study/
│   └── README.md
├── src/                       # Application source code
│   ├── backend/               # Backend logic
│   │   ├── server/            # Node.js AgentServer API Gateway & Services
│   │   │   ├── agentServer.ts # Main AgentServer HTTP & REST router
│   │   │   ├── httpServer.ts  # Node.js HTTP server entry point
│   │   │   ├── llmClient.ts   # Multi-provider LLM client adapter
│   │   │   ├── mcp_server.py  # MCP compatibility shim (not the primary server; see §8)
│   │   │   ├── routes/        # Express/REST route handlers (scriptRoutes, wikiRoutes)
│   │   │   ├── services/      # Workflow engine & background services
│   │   │   └── utils/         # Path resolvers, script builders, KE use cases
│   │   └── wikiforge/         # Python semantic backend
│   │       ├── api/           # FastAPI REST endpoints & routers
│   │       ├── cli.py         # Python CLI interface
│   │       ├── core/          # Core config, exceptions, and file ops
│   │       ├── semantics/     # RDF, Cypher, SHACL, and GraphRAG modules
│   │       └── watcher/       # Real-time filesystem graph watcher
│   └── frontend/              # Web UI (Vite + TypeScript)
│       ├── components/        # UI components (editor, graph, tools, ke, ui)
│       ├── core/              # Utility functions, HTML sanitizers, markdown renderers
│       ├── services/          # API storage client, graph service, script executor
│       ├── store/             # Global application state store (appStore)
│       ├── styles/            # CSS theme variables & component styles
│       ├── index.ts           # Frontend Web UI entry point
│       └── vite-env.d.ts
├── src-tauri/                 # Tauri v2 native desktop application scaffolding
├── templates/                 # Note and presentation templates (article.md, thesis_*.md, reveal/)
├── tests/                     # Unit, integration, and security test suites
├── AGENT.md                   # Knowledge Engineer Operating Manual v3.0
├── Dockerfile                 # Multi-stage Docker build file
├── Dockerfile.ui              # Frontend Docker container build file
├── Makefile                   # Developer CLI shortcuts & build automation
├── README.md                  # Root repository overview and quickstart
├── ROADMAP.md                 # Project implementation roadmap (Phases 0–62)
├── docker-compose.yml         # Container orchestration manifest
├── entrypoint.sh              # Docker container entrypoint script
├── index.html                 # Web UI HTML entry page
├── knowledge_graph.cypher     # Neo4j Graph export sample
├── package.json               # Node.js package definition & dependencies
├── package-lock.json          # Exact locked npm dependency graph
├── requirements.txt           # Python dependency definition
├── tsconfig.json              # TypeScript compiler configuration
└── vite.config.ts             # Vite build and dev server configuration
```

---

## 2. Verification of ROADMAP.md Phases (0–62)

Every phase declared in `ROADMAP.md` was audited against the codebase and test suite.

| Phase | Description | Status | Verification Evidence & File References |
|-------|-------------|--------|------------------------------------------|
| 0–10 | Scaffolding, config, conversion, agent schema | ✅ Verified | `config/config.toml`, `scripts/conv2md.py`, `docs/AGENT.md`, `docs/SOURCES.md` |
| 11–15 | Atomic commands, article templates, Makefile | ✅ Verified | `templates/article.md`, `Makefile`, `docs/AGENT.md` |
| 16–20 | Web clip, i18n, stats, pre-commit, CI/CD | ✅ Verified | `scripts/clip2md.py`, `scripts/wiki_stats.py`, `.pre-commit-config.yaml`, `.github/workflows/test.yml` |
| 21–28 | Vite Web UI, AgentServer, LLM Client, Workflows, Security, CodeMirror 6, Wizard | ✅ Verified | `src/frontend/`, `src/backend/server/agentServer.ts`, `src/backend/server/llmClient.ts`, `tests/security.test.ts` |
| 29–34 | Grounding, Study suite, Docs sync, Skill packages | ✅ Verified | `scripts/check_docs_sync.py`, `skills/*/SKILL.md`, `tests/notebooklmFeatures.test.ts` |
| 35–41 | OKF v0.2, Trust badges, MCP Server, Multi-project, Script Panel | ✅ Verified | `docs/OKF_SPEC.md`, `scripts/okf_lint.py`, `src/backend/server/mcp_server.py`, `src/frontend/components/tools/ToolsModal.ts` |
| 42–46 | Operating Manual v3.0, Versioning, Voice Ingest, Slides, Enterprise, Semantic Export, Ontology Rules | ✅ Verified | `scripts/versioning.py`, `scripts/voice_ingest.py`, `scripts/export_semantic.py`, `scripts/ontology_rules.py`, `wiki/versions/` |
| 47–51 | Typed Schema, GraphRAG System, KE Workbench | ✅ Verified | `scripts/schema_lint.py`, `src/backend/wikiforge/semantics/`, `src/frontend/components/ke/KEWorkbenchModal.ts` |
| 52–58 | Desktop Shell, Ingestion Queue, Web Clipper, Deep Research, Topological Graph, Review Queue, Skill Scanner | ✅ Verified | `src-tauri/`, `scripts/ingest_queue.py`, `extension/`, `scripts/graph_analytics.py`, `.llm-wiki/reviews.json`, `skills/` |
| 59–62 | CoT Decoupling, DRY Base Graph Parser, Standard Exceptions, Script Registry API | ✅ Verified | `scripts/enrich_cot.py`, `src/backend/wikiforge/semantics/base_parser.py`, `src/backend/wikiforge/core/exceptions.py` |

All 62 phases are fully implemented and verified.

---

## 3. Dead / Stray / Unknown Files Inventory

As part of the baseline audit, a complete scan for unreferenced, temporary, or stray files was performed.

| Path | Status | Notes / Content Summary |
|------|--------|-------------------------|
| `.molg.html` | ✅ Not Found | Absent in working tree (cleaned up in earlier docs overhaul). |
| `.taot.html` | ✅ Not Found | Absent in working tree (cleaned up in earlier docs overhaul). |
| `wikimap.md` | ✅ Not Found | Absent in working tree (cleaned up in Phase 43 docs overhaul). |
| `.wiki-forge/ingest_queue.db` | ✅ Valid Artifact | SQLite database file tracking background document ingestion queue state (`scripts/ingest_queue.py`). |
| `knowledge_graph.cypher` | ✅ Valid Artifact | Neo4j property graph export template / sample. |

---

## 4. Dependency Inventory & Security Audit

### 4.1 Node.js / NPM Dependencies (`package.json`)

**Runtime Dependencies:**
- `@codemirror/autocomplete` (`^6.20.3`)
- `@codemirror/commands` (`^6.11.0`)
- `@codemirror/lang-markdown` (`^6.5.2`)
- `@codemirror/language` (`^6.12.4`)
- `@codemirror/state` (`^6.7.1`)
- `@codemirror/view` (`^6.43.9`)
- `force-graph` (`^1.51.4`)
- `marked` (`^12.0.0`)
- `smol-toml` (`^1.8.0`)

**Development Dependencies:**
- `@types/node` (`^20.19.43`)
- `tsx` (`^4.19.0`)
- `typescript` (`^5.3.3`)
- `vite` (`^8.3.1`)

**Security Audit (`npm audit`):**
- Total packages audited: 78
- Vulnerabilities found: 2 (1 moderate in `smol-toml` <=1.8.0, 1 high in dev dependency `source-map-js` 1.0.0-1.2.1).

### 4.2 Python Dependencies (`requirements.txt`)

Key Python libraries:
- `pymupdf4llm` (`1.28.2`), `pymupdf` (`1.28.2`)
- `rdflib` (`7.6.0`), `pyshacl` (`0.40.1`), `owlrl` (`7.6.2`), `html5rdf` (`1.2.1`)
- `fastapi` (`0.143.2`), `uvicorn` (`0.54.0`), `starlette` (`1.8.0`)
- `pydantic` (`2.14.1`), `pydantic-core` (`2.50.1`)
- `pyyaml` (`6.0.3`), `rich` (`15.0.0`), `networkx` (`3.7`), `numpy` (`2.5.4`)
- `pytest` (`9.1.1`), `langchain-core` (`1.6.11`), `langgraph` (`1.2.15`), `openai` (`3.31.0`)

---

## 5. Test & Quality Gate Baseline

The entire test suite was executed to establish the baseline metrics:

- **Node.js Test Runner (`npm test`):**
  - Executed: `node --import tsx --test tests/*.test.ts`
  - Results: **95 passed, 1 skipped, 0 failed** across 21 test suites (10.77s execution time).
  - Skipped: OpenCode CLI test suite (when OpenCode binary is not installed locally).

- **Python Test Runner (`PYTHONPATH=.:scripts python3 -m pytest`):**
  - Executed: `PYTHONPATH=.:scripts python3 -m pytest`
  - Results: **61 passed, 0 failed** across 17 test modules (2.69s execution time).

- **TypeScript Typecheck (`npm run typecheck`):**
  - Executed: `tsc --noEmit`
  - Results: Clean exit (0 errors).

- **Vite Production Build (`npm run build`):**
  - Executed: `vite build`
  - Results: Clean build output generated in `dist/`.

- **Doc & Skill Synchronization (`make docs-sync`):**
  - Executed: `python3 scripts/check_docs_sync.py`
  - Results: **Passed** (49 slash commands verified across skills, README.md, TUTORIAL.md, and CHANGELOG.md).

---

## 6. Verification of §2.2 Architecture Risks

> **Aggiornamento (Fase 77):** la tabella sotto è il *baseline* storico del Phase 0. La
> colonna "Status" riporta ora l'esito **verificato dopo il refactoring succesivo**, non
> più il verdetto originale. I numeri citati sono ricavati dal codice e dai test presenti
> nel repository (`npx tsc --noEmit`, `npm test` → 254 pass / 1 skipped,
> `PYTHONPATH=.:scripts pytest tests/python/` → 44 pass).

| Risk ID | Title | Status (verificato) | Evidence & Code References |
|---------|-------|---------------------|----------------------------|
| **A1** | Triple implementation of same logic | **Parzialmente risolto** | Il reindex ha **un solo writer**: `executeReindexWorkflow()` in `agentServer.ts` chiama `scripts/okf_reindex.py` e propaga gli errori (il writer TypeScript non conforme è stato rimosso). Restano diverse l'audit (prosa in `AGENT.md`, `wiki_stats.py`, `okf_lint.py`). |
| **A2** | Two runtimes (Python + Node) without explicit boundary | **Risolto** | Confine esplicito: gateway Node standalone `:3001` (`httpServer.ts`), FastAPI `kg-api` `:8000` (`api_server.py`) come servizio compose separato con `FASTAPI_SERVER_URL=http://kg-api:8000`, Vite solo proxy. Target Makefile `api` / `kg-api` / `dev-all`. |
| **A3** | Server lives as Vite dev/preview middleware | **Risolto** | `vite.config.ts` non importa più `AgentServer`: registra un unico `apiProxy` streamante in `configureServer` e `configurePreviewServer`. API avviata da `npm run api`; `npm run dev:all` (`scripts/devAll.mjs`) avvia entrambi i processi in locale. |
| **A4** | State encoded in filenames (`_COMPILED.md`) | **Accettato (invariante)** | Invariante deliberato del contratto di ingestione in `scripts/conv2md.py` e nella workflow `/compile`. Nessuna modifica: renamare il file richiederebbe una migrazione dei vault esistenti. |
| **A5** | No persistent KB state / history across sessions | **Mitigato** | Stato strutturato persistente in `.wiki-forge/`: `changesets/`, `trash/`, `snapshots/`, `scheduler-state.json`, `scheduler-approvals.json`, `ingest_queue.db`. Resta fuori dal codice lo STATUS/metrics engine storico documentato in `docs/ARCHITECTURE.md`. |
| **A6** | Command definitions duplicated | **Parzialmente risolto** | Eliminata la duplicazione dei *parametri script*: `SCRIPT_SCHEMAS` (Python) → `src/backend/server/generated/scriptRegistry.generated.ts` (`scripts/gen_script_registry.py --check`), 29 script, zero probe `--json-schema` a runtime. Restano le definizioni dei comandi in prosa (`AGENT.md`, `Makefile`, `skills/*`). |
| **A7** | LLM output written to disk without plan/review step | **Risolto** | Plan→Review→Apply: `src/backend/server/changesetStore.ts` + `/api/v1/changesets*`, pulsante **📋 Proponi changeset** in `ChatDrawer.ts`, coda **📋 Changesets** in `Header.ts`, `ChangesetReviewModal` scoped al progetto. Il vecchio `wikiforge/vault.py` orfano è stato rimosso. F5/F6 restano il gate per gli step schedulati mutanti. |
| **A8** | Config not schema-validated | **Risolto** | `src/backend/wikiforge/core/config_schema.py` valida la forma di `config.toml` con uno schema dichiarativo; `get_project_config()` solleva `ConfigError` su errori di tipo, CLI `python -m src.backend.wikiforge.core.config_schema` con contratto JSON. 12 test dedicati. |
| **A9** | Security surface of local server | **APERTO** | `AgentServer` espone ancora creazione/modifica/cancellazione file; token opzionale e nessuna difesa DNS-rebinding. Non affrontato in questa fase: richiede una decisione di prodotto su auth obbligatoria. |
| **A10** | CI covers Python / basic Node tests | **APERTO** | `.github/workflows/test.yml` esegue pytest + test Node, ma restano assenti E2E Playwright e soglie di copertura. |
| **A11** | Non-atomic writes and no undo/trash | **Risolto** | `src/backend/server/safeFs.ts`: `atomicWriteFile` usato in 23 siti di scrittura, `softDelete` + `listTrash` + `restoreFromTrash`, endpoint `GET /api/wiki/trash` e `POST /api/wiki/trash/restore`. Le vecchie route duplicate `/api/wiki/delete` e `/api/wiki/upload` sono state rimosse. |
| **A12** | `AGENT.md` growing prose contract | **Stale / non applicabile** | Il `AGENT.md` radice è un puntatore a `docs/AGENT.md`, che ora è di **150 righe**, non 450+. Il rischio sollevato nel baseline non sussiste più nella forma descritta. |

---

## 7. Conclusion

Il Phase 0 Reality Check ha confermato uno stato sano del repository e ha fornito le evidenze
dei rischi architetturali. Il refactoring successivo (Fase 77) ha chiuso A2, A3, A7, A8 e A11,
ha mitigato A1, A5 e A6, e ha accertato che A12 era una misurazione obsoleta. Restano aperti,
per scelta di prodotto, A9 (autenticazione obbligatoria del server locale) e A10 (E2E/copertura
CI), mentre A4 è stato accettato come invariante del formato di ingestione.

Vedi `docs/CHANGELOG.md` (sezione "Architettura coerente — Fase 77") per l'elenco dei file
toccati e dei test di validazione.

---

## 8. Current state — 2026-11-25 (post-decoupling)

The tree, phase table and risk verdicts above remain the Phase 0 / Fase 77 baseline.
The verified final architecture is:

- **MCP**: the authoritative implementation is the Node adapter
  (`src/backend/mcp/adapter.ts`) with entrypoint `bin/mcp.ts`; `wf mcp` spawns it
  as a child process. `src/backend/server/mcp_server.py` is a compatibility shim
  only, so the tree entry above is historical.
- **Shared contract**: 105 HTTP routes, 158 bus handlers, 51 slash commands (20
  with a dedicated case), 113 MCP tools, 32 known gaps and zero
  route-without-bus gaps. `npm run manifest:check` now fails on a
  route-without-bus gap; CLI, MCP and UI all consume the generated manifest.
- **Frontend**: a single `apiBus` facade; no `FileStorage` fallback in
  `ApiStorage`, backend `WikiGraphDto` as the only graph source and an explicit
  template fallback via `api:error`.
- **State and governance**: sessions persisted in `StateStore`, scheduler state
  protected by a lease lock, approval outbox relay, central command audit,
  principal always present on bus dispatch, environment allowlist for
  subprocesses and non-root containers. The historical A9 entry above is
  superseded on these points.
- **Runtime**: the API is a single process serving the SPA and `/api/healthz`;
  no `VITE_*` runtime variables and no default `admin/admin` bootstrap.
- **Paths**: `.wiki-forge/` is the active state root; `.wikiforge/` is historical
  only.

### Final verification

- `npm test`: **593/593** with the Python venv installed from `requirements.txt`.
- `pytest tests/python/test_semantic_engine.py -q`: **6/6**.
- `npm run typecheck`, `npm run manifest:check`, `npm run build`,
  `docker compose config --quiet` and `git diff --check`: all green.
