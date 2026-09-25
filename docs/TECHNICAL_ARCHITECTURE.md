# Technical Architecture & Usage Analysis: `wiki-forge` with Local LLMs and Knowledge Engineering

This document provides a comprehensive technical breakdown of the **`wiki-forge`** architecture. It details the system design, the separation between parametric and non-parametric memory, the multi-provider LLM backend, the Web UI & Script Control Panel, the Open Knowledge Format (OKF v0.2) compliance layer, the Incremental Versioning engine, and a comparison with from-scratch model training (*nanochat*).

---

## 1. Core Architecture & Memory Paradigms

### 1.1 Parametric Memory vs. Non-Parametric Memory

A fundamental principle of `wiki-forge` is the distinction between **Parametric Memory** (neural network weights) and **Non-Parametric Memory** (external, structured Markdown files):

- **Parametric Memory (Pre-training & Fine-Tuning)**:
  Knowledge resides within neural network weights ($W$). Fine-tuning alters response style or probabilistic associations, but cannot guarantee zero-hallucination factual recall or granular provenance tracing.

- **Non-Parametric Memory (LLM-Wiki & RAG)**:
  Knowledge resides in interlinked Markdown documents (`wiki/`). The LLM operates as an **active Knowledge Engineer** (synthesis, extraction, interlinking, auditing) through in-context learning, reading clean structured articles during inference.

### 1.2 System Component Topology

```
+-----------------------------------------------------------------------------------+
|                                 WEB UI / BROWSER                                  |
| (Vite + TypeScript SPA, Vault Explorer, CodeMirror 6, Force Graph, Chat Drawer)   |
+-----------------------------------------------------------------------------------+
                                   │ REST + SSE (HTTP)
                                   ▼
+-----------------------------------------------------------------------------------+
|                        DECOUPLED AGENT SERVER (agentServer.ts)                   |
| ┌─────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────┐ |
| │ Vault Filesystem API    │ │ Multi-Provider LLM Client│ │ Python Script Engine │ |
| │ (/api/wiki/*, security) │ │ (OpenCode/Anthropic/...) │ │ (/api/scripts/*)     │ |
| └─────────────────────────┘ └──────────────────────────┘ └──────────────────────┘ |
+-----------------------------------------------------------------------------------+
       │                             │                              │
       ▼                             ▼                              ▼
+──────────────+              +──────────────+              +──────────────────────+
|  `wiki/` KB  |              |  Local/Cloud |              | 15 Python CLI        |
|  (OKF v0.2)  |              |  LLM Engine  |              | Scripts & Tooling    |
+──────────────+              +──────────────+              +──────────────────────+
```

---

## 2. Implemented Subsystems & Technical Details

### 2.1 Decoupled Agent Backend & Multi-Provider LLM Client
Implemented in `src/server/agentServer.ts` and `src/server/llmClient.ts`:
- **Provider Support**: OpenCode CLI (`opencode`), Anthropic API (`claude-3-5-sonnet`), OpenAI-compatible endpoints (`gpt-4o`), local Ollama (`llama3`).
- **Configuration**: Managed via `[agent.llm]` in `config.toml` with safe environment variable handling (`api_key_env`).
- **Real-Time SSE Streaming**: `/api/chat` streams chunk-by-chunk LLM responses directly to the Web UI `ChatDrawer`.

### 2.2 Security Hardening & Containment
- **Path Traversal Containment**: All filesystem REST endpoints (`save`, `attach`, `create`, `rename`, `move`, `delete`, `upload`) execute `validateSafePath()`, enforcing strict containment inside `wiki/` or `raw/` and returning HTTP 400 Bad Request on path traversal attempts (`..`).
- **HTML & Markdown Sanitization**: `renderMarkdown` applies XSS sanitization (`src/core/utils/html.ts`), neutralizing dangerous scripts, iframes, and inline event handlers.

### 2.3 Python Script Execution Engine
Implemented in `src/server/agentServer.ts`, `ToolsModal.ts`, and `LogConsole.ts`:
- **API Endpoints**: `GET /api/scripts/list`, `POST /api/scripts/execute`, `GET /api/files/download`.
- **Execution**: Spawns Python CLI child processes securely via `child_process.spawn('python3', ...)` with strict argument sanitization.
- **Log Streaming**: Real-time Server-Sent Events (SSE) stream `stdout` and `stderr` directly to a terminal-like console in the browser with process cancellation support.

### 2.4 Open Knowledge Format (OKF v0.2) Compliance
Implemented in `config.toml` (`[okf]`), `scripts/okf_*.py`, and Makefile:
- **YAML Frontmatter Schema**: Requires `type` (controlled vocabulary), ISO 8601 timestamps (`generated.at`), actor namespaces (`human:<id>`, `<producer>/<version>`, `process:<id>`), `status`, and provenance (`sources`).
- **Trust Tiers**: Computed dynamically: `unverified`, `machine-confirmed`, `human-reviewed`.
- **Validation & Indexing**: `okf_lint.py` validates schema compliance; `okf_reindex.py` auto-generates OKF §8 `index.md`; `okf_log.py` logs chronological changes into `wiki/log.md` (OKF §9); `okf_stats.py` provides bundle analytics.

### 2.5 Incremental Versioning & Snapshot Rollback Engine
Implemented in `scripts/versioning.py`, `wiki/versions/`, and `AGENT.md` (`/rollback` command):
- **Source/Synthesis Isolation**: Original sources remain untouched in `sources/` (`backup/`) and `raw/`.
- **Version Snapshots**: Every `/compile` or major update creates a version snapshot (`wiki/versions/<note>.v1.md`, `.v2.md`).
- **Agent Rollback**: `/rollback note=<note> [to=version]` restores previous state, appends audit entries to `wiki/log.md`, and updates indices.

### 2.6 Multi-Project Workspace Management
Implemented in `projects/` and `src/components/ConfigManager.ts`:
- **Workspace Isolation**: Projects are stored under `projects/<id>/` with independent `config.toml`, `sources/`, `raw/`, `wiki/`, `output/`, and `notes/`.
- **GUI Config Manager**: Web UI modal allows editing project metadata, folder paths, LLM provider settings, and OKF taxonomy using `smol-toml`.

---

## 3. Comparative Matrix: `wiki-forge` Local RAG vs. From-Scratch Training (`nanochat`)

| Feature / Metric | Solution A: `wiki-forge` Local RAG + LLM | Solution B: From-Scratch `nanochat` Training |
| :--- | :--- | :--- |
| **Primary Goal** | Knowledge Engineering & Production KB | Educational / Transformer Architecture Research |
| **Core Technology** | Non-parametric Markdown KB, RAG, `AGENT.md` | Pre-training, Mid-training, SFT, RL |
| **Knowledge Storage** | External Markdown files (`wiki/`) | Model weights (`.pt` parameters) |
| **Factual Precision** | High (exact passage citations & line-anchors) | Low on specifics (prone to hallucinations) |
| **Compute Cost** | Low (runs on consumer GPU or Apple Silicon) | High (requires multi-GPU clusters for full runs) |
| **Data Ingestion** | Instant (add file and run `compile`) | Slow (requires full re-training or SFT) |
| **Out-of-the-box in `wiki-forge`**| ✅ Native (`[agent.llm]` + Agent Server + UI) | ⬜ External repository (`nanochat`) |

---

## 4. Final Recommendation

1. **For Production Knowledge Base Management**:
   Use `wiki-forge` with your preferred LLM provider (`ollama`, `anthropic`, `openai_compatible`, or `opencode`). Run `make ui-docker` or `npm run dev` to interact via the Web UI or CLI.

2. **For Thesis & Academic Research**:
   Follow the 5-phase chronological workflow (Ingestion -> Incremental KB Compilation -> Study & Maturity Analysis -> Dynamic Interrogation -> PDF Export via Pandoc).
