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

- **🚀 Health & Maturity API**: Unified `/api/v1/health` endpoint computing a 0-100 Health Score, L1-L4 Maturity Level, and prioritized "Next Best Actions". Generates `.wikiforge/STATUS.md` and tracks metrics history in `.wikiforge/metrics/history.jsonl`.
- **⚙️ Stateful Procedure Engine Core**: Executes TOML-based procedures (`config/procedures/*.toml`) with DAG dependency resolution, automated script execution, human review pauses, exit criteria validation, and state persistence in `.wikiforge/state/<run_id>.json`.
- **🔒 Safe Vault & Changeset Review Manager**: Atomic file writes, soft-delete recovery to `.wikiforge/trash/`, and staged Changeset JSON proposals (`.wikiforge/changesets/`) ensuring Plan-Review-Apply safety (applied from the chat via `wiki-edit` blocks + **Applica modifica**).
- **🧐 Review Studio**: One modal with four horizontal tabs — **Verifica**, **Critica**, **Digest**, **Confronta versioni** — opened by right-clicking a note, with the **🧐 Revisione** editor button, or via `Ctrl+Alt+R/C/D/F`. Reuses the `/verify` path plus the deterministic quality-gate, digest and snapshot logic, keeps a local pre-write history in `.wiki-forge/snapshots/` (25 snapshots per note), and falls back deterministically when no LLM is configured for the critique tab.
- **🔎 Research Studio**: One modal with six horizontal tabs — **Consult**, **Ricerca**, **Backlink**, **Correlate**, **Traccia**, **Deep Research** — matching the six query commands `/consult`, `/search`, `/backlinks`, `/related`, `/trace`, `/deep-research`. Open it from the **🔎 Research** header button, the **🔎 Ricerca** editor button, the note context menu, `Ctrl+Alt+Q/S/B/L/T/H`, or by typing the command in chat. Search, backlinks, related and trace are deterministic (`/api/notes/research/*`); consult and deep research use the configured LLM and fall back to a deterministic response, with deep-research reports stored in `output/` and `wiki/synthesis/`.
- **📚 Study Studio**: One modal with seven horizontal tabs — **Guida**, **Quiz**, **Mindmap**, **Audio**, **Note**, **Promuovi**, **Tesi** — matching `/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`, `/promote-note`, `/thesis-chapter`. Open it from the **📚 Studio** header/editor buttons, the note context menu, or `Ctrl+Alt+G/K/M/A`. All tabs share deterministic builders (`src/backend/server/studyHelpers.ts`, `POST /api/notes/study/*`); artefacts go to `output/`, quick notes to `notes/quick-notes.md`, and thesis runs also refresh `output/thesis_compiled.md` for the PDF export.
- **🔄 Guided Wizards**: Guided onboarding, add-sources, and weekly-check scenarios (`/wizard`) with backend state in `.wikiforge/wizard_state.json` (UI resume not yet available — the wizard restarts after a reload).
- **⚡ Live Sync & ETag Conflict Prevention**: Live Server-Sent Events (`/api/v1/sync/events`) for real-time file updates, plus SHA256 ETag `If-Match` validation on save to prevent write collisions.
- **📖 Context-Sensitive In-App Guide**: Press **F1** (or the **?** button in the toolbar) for the help panel; `/help [topic]` in chat shows the same content, served from `docs/help/*.md` (works offline).

---

## 🗺️ Mappa della Documentazione (Documentation Index)

> Full index of all guides: **[`docs/README.md`](docs/README.md)**.

### 📖 Per Utenti ed Operatori
- **[`docs/GUIDA_OPERATIVA.md`](docs/GUIDA_OPERATIVA.md)** — **Guida Operativa Unica (non tecnica)**: attività d'uso, flusso di lavoro tipico e buone pratiche. *Punto di partenza consigliato.*
- **[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)** — **Guida Operativa Focus Mode**: Guida passo-passo ai wizard guidati.
- **[`docs/TUTORIAL.md`](docs/TUTORIAL.md)** — **Guida Operativa dell'Utente**: Guida all'interfaccia Web UI, comandi chat e troubleshooting.
- **[`docs/THESIS_GUIDE.md`](docs/THESIS_GUIDE.md)** — **Guida alla Tesi Magistrale**: Esempio pratico per la tesi in Markdown.
- **Screenshot UI/UX**: la cartella **[`img/`](img/)** contiene le schermate aggiornate (21 immagini, JPG 1920×1080) per le situazioni d'uso dello **studente** (01–13) e del **Knowledge Engineer** (14–21), catturate dall'implementazione corrente.
- **Review Studio (mockup e anteprime)**: **[`docs/mockups/`](docs/mockups/README.md)** contiene il prototipo interattivo e le 5 anteprime delle schede Verifica, Critica, Digest, Confronta versioni e del menu contestuale.
- **Research Studio**: le sei schede **Consult · Ricerca · Backlink · Correlate · Traccia · Deep Research** sono descritte in **[`docs/help/research-studio.md`](docs/help/research-studio.md)** (guida in-app) e in `docs/TECHNICAL_ARCHITECTURE.md` §2.12.
- **Study Studio**: le sette schede **Guida · Quiz · Mindmap · Audio · Note · Promuovi · Tesi** sono descritte in **[`docs/help/study-studio.md`](docs/help/study-studio.md)** (guida in-app) e in `docs/TECHNICAL_ARCHITECTURE.md` §2.13.

### ⚙️ Per Sviluppatori & Knowledge Engineers
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — **Architettura di Sistema v4.1**: Diagramma unico del backend FastAPI, Procedure Engine, Vault Manager, Review Studio e Health Engine.
- **[`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)** — **Analisi tecnica approfondita**: moduli, versioning, API della Review Studio e snapshot store, MCP, export RDF.
- **[`docs/EDITOR_MIGRATION.md`](docs/EDITOR_MIGRATION.md)** — **Editor note**: architettura ad adapter (CodeMirror/Milkdown-Crepe), conservazione frontmatter OKF e wikilink.
- **[`docs/KE_PLAYBOOK.md`](docs/KE_PLAYBOOK.md)** — **Playbook del Knowledge Engineer**: Guida alla Scala di Maturità L1-L4, uso del KE Workbench e procedure TOML.
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
- Knowledge Engineering: `/export-semantic`, `/suggest-odp`, `/neuro-check`, `/ke-maturity`, `/validate-cq`, `/tag-suggest`, `/maturity`
- Utilities & Setup: `/wizard`, `/sources` (`sources regenerate`), `/template` (`template show`), `/export`, `/help [topic]`, `/skill`, `/apply` (alias `/applica`)

> In the app, press **F1** (or the **?** button) for the context-sensitive in-app guide; `/help [topic]` in chat returns the same content.

---

## 🧐 Review Studio (Web UI)

A single review console for the active note, built from four horizontal tabs:

| Tab | What it does | Backend |
|---|---|---|
| **Verifica** | Quality gate (links, OKF frontmatter, tags, sources, `stale_after`), verification history and the human-review form (`reviewer`, `stable`, comment). | `GET /api/notes/review/meta`, `POST /api/notes/review/verify` |
| **Critica** | Adversarial critique with depth (`fast`/`standard`/`deep`), focus areas and structured findings; deterministic fallback when no LLM provider is configured. | `POST /api/notes/review/critique` |
| **Digest** | Last N days of `wiki/log.md` grouped by day, plus freshness/link-health stats, next actions and a Markdown export. | `GET /api/notes/review/digest` |
| **Confronta versioni** | Unified line-by-line diff against a local pre-write snapshot (both line-number columns), with one-click restore. | `GET /api/notes/review/snapshots`, `GET /api/notes/review/diff`, `POST /api/notes/review/restore` |

**How to open it**
- Right-click a note in the left file tree → **Verifica umana / Revisione critica / Digest attività / Confronta versioni**.
- Click **🧐 Revisione** in the editor header.
- Keyboard: `Ctrl+Alt+R` (Verifica), `Ctrl+Alt+C` (Critica), `Ctrl+Alt+D` (Digest), `Ctrl+Alt+F` (Confronta versioni).

The review history is local and independent of git: before each save/verify/restore the previous content is stored in `.wiki-forge/snapshots/<note-path>/<timestamp>.md` with a `.json` sidecar (reason and timestamp). The latest **25** snapshots per note are kept; the folder is gitignored. The chat `/verify` (alias `/human-review`) command shares the exact same code path; `/digest`, `/adversarial-review` and `/diff` remain available as agent commands, while their Review Studio tabs are deterministic.

Design preview and screenshots: **[`docs/mockups/`](docs/mockups/README.md)**.

---

## 📚 Study Studio (Web UI)

A single study console for the knowledge base, built from seven horizontal tabs:

| Tab | Command | Output |
|---|---|---|
| **Guida** | `/study-guide [topic]` | `output/study-guide-<slug>.md` — summary, per-note sections, glossary, self-assessment questions. |
| **Quiz** | `/quiz [topic] [n]` | `output/quiz-<slug>.md` — exactly 1–25 multiple-choice questions with answers and explanations. |
| **Mindmap** | `/mindmap [note]` | `output/mindmap-<slug>.md` — heading tree plus the JSON payload for the graph. |
| **Audio** | `/audio-overview [topic]` | `output/audio-script-<slug>.md` — Host A / Host B podcast script (TTS off by default). |
| **Note** | `/note <text>` | `notes/quick-notes.md` — scratchpad entry, excluded from `wiki/index.md`. |
| **Promuovi** | `/promote-note <id> [folder]` | `wiki/<folder>/<slug>.md` — article created from the selected entry, indexes updated. |
| **Tesi** | `/thesis-chapter [topic]` | `output/thesis-<slug>.md` plus the canonical `output/thesis_compiled.md`. |

**How to open it**
- Click **📚 Studio** in the top bar or in the editor header.
- Right-click a note → **Study Studio** (guide, quiz, mindmap, audio).
- Keyboard: `Ctrl+Alt+G` (Guida), `Ctrl+Alt+K` (Quiz), `Ctrl+Alt+M` (Mindmap), `Ctrl+Alt+A` (Audio).
- Chat commands use the same deterministic generators (`POST /api/notes/study/*`); no LLM is required.

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
│   ├── snapshots/            # Storico pre-scrittura delle note (Review Studio)
│   ├── trash/                # Cestino soft-delete con timestamp
│   └── metrics/              # Storico metriche di salute (history.jsonl)
├── src/
│   ├── frontend/             # Web UI Client (TypeScript, Vite, CodeMirror 6)
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
