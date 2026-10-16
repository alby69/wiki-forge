# Wiki-Forge: Dynamic Knowledge Base Engine & Print Compiler

> A minimal, agent-agnostic template for building a **personal dynamic knowledge base
> that an LLM compiles, maintains, and transforms into print-ready documents for you** — based on Andrej Karpathy's
> [LLM Wiki](docs/KARPATHY_LLM_WIKI.md) pattern.

Instead of re-answering questions from raw documents every time (classic RAG),
the LLM acts as an active **Knowledge Engineer** — an intellectual partner that
**incrementally builds, evaluates, and maintains a persistent, interlinked wiki** of
Markdown files conforming to the **Open Knowledge Format (OKF v0.2)** specification
([github.com/GoogleCloudPlatform/open-knowledge-format](https://github.com/GoogleCloudPlatform/open-knowledge-format), detailed in [`docs/OKF_SPEC.md`](docs/OKF_SPEC.md)).

This repository supports building **dynamic, incremental knowledge bases** (e.g. for a **Master's Thesis / Tesi Magistrale**, research projects, business wikis, or personal study) with a **dual output**:
1. **Dynamic Interactive Wiki**: Searchable, interlinked, interrogable via chat, and continually evolving.
2. **Static Print Output**: Compiled into formal chapters and exported as a publication-ready PDF via Pandoc.

---

## 🚀 Avvio Rapido (Per tutti gli utenti)

Non serve installare Python o Node.js! Segui questi tre semplici passaggi:

1. **Installa Docker Desktop** (se non lo hai già): [Scarica qui](https://www.docker.com/products/docker-desktop)
2. **Scarica questo repository** come file ZIP ed estrailo.
3. **Fai doppio click** sul file di avvio nella cartella `bin/` corrispondente al tuo sistema operativo:
   - 🪟 Windows: `bin/Start_WikiForge.bat`
   - 🍎 macOS: `bin/Start_WikiForge.command` *(al primo avvio: clic destro → "Apri")*
   - 🐧 Linux: `bin/Start_WikiForge.sh` *(assicurati che sia eseguibile: `chmod +x bin/Start_WikiForge.sh`)*

L'applicazione si avvierà e il tuo browser si aprirà automaticamente su **http://localhost:5173**.

---

## ✨ System Architecture & Key Enhancements (v4.1)

- **🚀 Knowledge Engineer Cockpit**: Unified `/api/v1/health` endpoint computing a 0-100 Health Score, L1-L4 Maturity Level, and prioritized "Next Best Actions". Generates `.wikiforge/STATUS.md` and tracks metrics history in `.wikiforge/metrics/history.jsonl`.
- **⚙️ Stateful Procedure Engine Core**: Executes TOML-based procedures (`config/procedures/*.toml`) with DAG dependency resolution, automated script execution, human review pauses, exit criteria validation, and state persistence in `.wikiforge/state/<run_id>.json`.
- **🔒 Safe Vault & Changeset Review Manager**: Atomic file writes, soft-delete recovery to `.wikiforge/trash/`, and staged Changeset JSON proposals (`.wikiforge/changesets/`) ensuring Plan-Review-Apply safety.
- **🔄 Resumable User Wizards & Focus Mode**: Guided onboarding, add-sources, and weekly-check wizards saved to `.wikiforge/wizard_state.json`, allowing operators to close their browser and resume mid-wizard with one click.
- **⚡ Live Sync & ETag Conflict Prevention**: Live Server-Sent Events (`/api/v1/sync/events`) for real-time file updates, plus SHA256 ETag `If-Match` validation on save to prevent write collisions.
- **🔍 Command Palette (`Ctrl+K`)**: Unified fuzzy search for wiki notes, procedures, and global actions filtered by role.

---

## 🗺️ Mappa della Documentazione (Documentation Index)

### 📖 Per Utenti ed Operatori
- **[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)** — **Guida Operativa Focus Mode**: Guida passo-passo ai wizard guidati e ripresa sessione.
- **[`docs/TUTORIAL.md`](docs/TUTORIAL.md)** — **Guida Operativa dell'Utente**: Guida all'interfaccia Web UI, comandi chat e troubleshooting.
- **[`docs/THESIS_GUIDE.md`](docs/THESIS_GUIDE.md)** — **Guida alla Tesi Magistrale**: Esempio pratico per la tesi in Markdown.

### ⚙️ Per Sviluppatori & Knowledge Engineers
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — **Architettura di Sistema v4.1**: Diagramma unico del backend FastAPI, Procedure Engine, Vault Manager e Health Engine.
- **[`docs/KE_PLAYBOOK.md`](docs/KE_PLAYBOOK.md)** — **Playbook del Knowledge Engineer**: Guida alla Scala di Maturità L1-L4, uso del Cockpit e procedure TOML.
- **[`docs/PROCEDURES.md`](docs/PROCEDURES.md)** — **Specifica del Procedure Engine**: Definizione dello schema TOML, vincoli DAG e criteri di uscita.
- **[`docs/MIGRATION.md`](docs/MIGRATION.md)** — **Guida alla Migrazione Changeset Review**: Sistema Plan-Review-Apply per modifiche AI.
- **[`docs/OKF_SPEC.md`](docs/OKF_SPEC.md)** — **Open Knowledge Format Spec v0.2**: Specifica tecnica standard per le note OKF.
- **[`docs/AGENT.md`](docs/AGENT.md)** — **Operating Manual dell'Agente**: Manuale operativo v3.0 per agenti LLM (`AGENT.md` in root).

---

## 💬 Agent Slash Commands Reference

The LLM Knowledge Engineer agent supports the following slash commands:

- Ingestion: `/compile`, `/convert-only`, `/ingest`, `/recompile`
- Curation & Editing: `/new-article`, `/merge`, `/split`, `/stub`, `/retag`, `/verify` (alias `/human-review`), `/diff`
- Audit & Maintenance: `/audit`, `/reindex`, `/prune`, `/lint-frontmatter`, `/ontology-check`, `/stats`, `/schema-lint`, `/schema-infer`
- Query & Research: `/consult`, `/search`, `/backlinks`, `/related`, `/trace`, `/deep-research`
- Study & Synthesis: `/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`, `/promote-note`, `/thesis-chapter`, `/adversarial-review`, `/digest`, `/slides` (alias `/generate-slides`)
- Knowledge Engineering: `/export-semantic`, `/suggest-odp`, `/neuro-check`, `/ke-maturity`, `/validate-cq`, `/tag-suggest`
- Utilities & Setup: `/wizard`, `/sources` (`sources regenerate`), `/template` (`template show`), `/export`, `/help`

---

## 🛠️ Struttura del Repository

```
.
├── config/
│   ├── config.toml           # Configurazione principale
│   ├── projects.json         # Registro dei progetti
│   ├── scenarios.toml        # Preset di scenario
│   └── procedures/           # Procedure TOML guidate (ke.*.toml e user.*.toml)
├── .wikiforge/               # Stato persistente del sistema
│   ├── STATUS.md             # Summary di salute generato automaticamente
│   ├── state/                # Stato di esecuzione delle procedure (.json)
│   ├── changesets/           # Proposte di modifica staged da revisionare
│   ├── trash/                # Cestino soft-delete con timestamp
│   └── metrics/              # Storico metriche di salute (history.jsonl)
├── src/
│   ├── frontend/             # Web UI Client (TypeScript, Vite, CodeMirror 6, KECockpitModal)
│   └── backend/              # Python Domain & Server Engine
│       ├── server/
│       │   ├── agentServer.ts # REST & SSE API Gateway
│       │   └── mcp_server.py  # Model Context Protocol (MCP) Server
│       └── wikiforge/
│           ├── api/
│           │   ├── api_server.py # FastAPI REST Server
│           │   └── health.py     # Unified Health & Metrics Engine
│           ├── vault.py          # Safe Vault & Changeset Manager
│           └── procedures.py     # Procedure Engine Core
└── wiki/                     # Knowledge Base viva ed interconnessa
```

---

## 📄 Licenza & Requisiti

- **Licenza**: MIT
- **Requisiti**: Node.js >= 20.0.0, Python >= 3.11, Docker Desktop (opzionale).
