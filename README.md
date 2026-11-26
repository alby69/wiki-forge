# Wiki-Forge: Dynamic Knowledge Base Engine & Print Compiler

> A minimal, agent-agnostic template for building a **personal dynamic knowledge base
> that an LLM compiles, maintains, and transforms into print-ready documents for you** — based on Andrej Karpathy's
> [LLM Wiki](docs/standard/KARPATHY_LLM_WIKI.md) pattern.

Instead of re-answering questions from raw documents every time (classic RAG),
the LLM acts as an active **Knowledge Engineer** — an intellectual partner that
**incrementally builds, evaluates, and maintains a persistent, interlinked wiki** of
Markdown files conforming to the **Open Knowledge Format (OKF v0.2)** specification
([github.com/GoogleCloudPlatform/open-knowledge-format](https://github.com/GoogleCloudPlatform/open-knowledge-format), detailed in [`docs/standard/OKF_SPEC.md`](docs/standard/OKF_SPEC.md)).

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

- **🚀 Health & Maturity API**: Unified `/api/v1/health` endpoint computing a 0-100 Health Score, L1-L4 Maturity Level, and prioritized "Next Best Actions". Generates `.wikiforge/STATUS.md` and tracks metrics history in `.wikiforge/metrics/history.jsonl` (separate from the Node runtime state in `.wiki-forge/`).
- **⚙️ Stateful Procedure Engine Core**: Executes TOML-based procedures (`config/procedures/*.toml`) with DAG dependency resolution, automated script execution, human review pauses, exit criteria validation, and state persistence in `.wikiforge/state/<run_id>.json` (Python engine), distinct from the Node runtime state in `.wiki-forge/state/`.
- **🔒 Safe Vault & Changeset Review Manager**: Atomic file writes, soft-delete recovery to `.wiki-forge/trash/`, and staged Changeset JSON proposals (`.wiki-forge/changesets/`) ensuring Plan-Review-Apply safety (applied from the chat via `wiki-edit` blocks + **Applica modifica**).
- **🧐 Review Studio**: One modal with four horizontal tabs — **Verifica**, **Critica**, **Digest**, **Confronta versioni** — opened by right-clicking a note, with the **🧐 Revisione** editor button, or via `Ctrl+Alt+R/C/D/F`. Reuses the `/verify` path plus the deterministic quality-gate, digest and snapshot logic, keeps a local pre-write history in `.wiki-forge/snapshots/` (25 snapshots per note), and falls back deterministically when no LLM is configured for the critique tab.
- **🔎 Research Studio**: One modal with six horizontal tabs — **Consult**, **Ricerca**, **Backlink**, **Correlate**, **Traccia**, **Deep Research** — matching the six query commands `/consult`, `/search`, `/backlinks`, `/related`, `/trace`, `/deep-research`. Open it from the **🔎 Research** header button, the **🔎 Ricerca** editor button, the note context menu, `Ctrl+Alt+Q/S/B/L/T/H`, or by typing the command in chat. Search, backlinks, related and trace are deterministic (`/api/notes/research/*`); consult and deep research use the configured LLM and fall back to a deterministic response, with deep-research reports stored in `output/` and `wiki/synthesis/`.
- **📚 Study Studio**: One modal with seven horizontal tabs — **Guida**, **Quiz**, **Mindmap**, **Audio**, **Note**, **Promuovi**, **Tesi** — matching `/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`, `/promote-note`, `/thesis-chapter`. Open it from the **📚 Studio** header/editor buttons, the note context menu, or `Ctrl+Alt+G/K/M/A`. All tabs share deterministic builders (`src/backend/server/studyHelpers.ts`, `POST /api/notes/study/*`); artefacts go to `output/`, quick notes to `notes/quick-notes.md`, and thesis runs also refresh `output/thesis_compiled.md` for the PDF export.
- **🔄 Guided Wizards**: Guided onboarding, add-sources, and weekly-check scenarios (`/wizard`) with backend state in `.wikiforge/wizard_state.json` (UI resume not yet available — the wizard restarts after a reload).
- **⚡ Live Sync & ETag Conflict Prevention**: Live Server-Sent Events (`/api/v1/sync/events`) for real-time file updates, plus SHA256 ETag `If-Match` validation on save to prevent write collisions.
- **📖 Context-Sensitive In-App Guide**: Press **F1** (or the **?** button in the toolbar) for the help panel; `/help [topic]` in chat shows the same content, served from `docs/help/*.md` (works offline).
- **🧩 API Contract Layer & Swagger Browser**: `ROUTES` in `src/shared/api/contracts.ts` generates the OpenAPI 3.1 spec for **105 HTTP routes**; browse it at **http://localhost:3001/api/docs** (or `:5173/api/docs`) with self-hosted Swagger UI, no CDN required. See [`docs/architettura/OPENAPI.md`](docs/architettura/OPENAPI.md).
- **🚌 Bus backend e API tipizzate**: il backend segue kernel/modules/ports: 20 moduli di dominio instradano **158 handler** su `MessageBus`, con risultati HTTP-neutrali e facciata `AgentServer` invariata. Il manifest pubblicato (`src/shared/api/generated/commandManifest.generated.ts`, [`docs/riferimenti/COMMAND_MANIFEST.md`](docs/riferimenti/COMMAND_MANIFEST.md)) è generato dai contratti di route e dalle definizioni MCP condivise ed è consumato da CLI, descrittori dei tool MCP e OpenAPI: **51 comandi slash catalogati / 20 con case dedicato**, **113 tool MCP**, **32 gap noti non bloccanti** e **zero gap `route-without-bus`**, verificati da `npm run manifest:check`. Il frontend usa la sola facciata `apiBus` e un client tipizzato generato da `ROUTES`; `ApiStorage` non ha più fallback a `FileStorage`, il grafo è mappato solo dal `WikiGraphDto` del backend e il fallback dei template canonici passa esplicitamente da `api:error`. Nessun componente chiama `fetch` o un altro componente per raggiungere le API, e nessun adapter importa un altro adapter. Vedi [`docs/architettura/OPENAPI.md`](docs/architettura/OPENAPI.md).
- **🔐 Produzione**: RBAC e auth sempre forzati, token richiesto salvo IdP o user store configurati, CORS allowlist, body limit, correlation id ed endpoint `/api/healthz`, `/api/readyz`, `/api/metrics`. Le sessioni sono persistite via `StateStore`, lo scheduler usa un lock a lease sullo stato (non più un lock PID), il relay dell'outbox delle approvazioni è attivo, il subscriber di audit registra `command:handled`/`command:failed`, `CommandContext.principal` è sempre impostato dal dispatch del bus, i subprocess usano un allowlist di variabili d'ambiente e `@opentelemetry/api` è dichiarato con fallback locale.
- **🚢 Deployment**: Render usa `Dockerfile.render` + `bin/render-start.sh`: un solo processo Node serve la SPA buildata e le API su `$PORT`, con health su `/api/healthz`, nessuna variabile `VITE_*` a runtime, nessun default `admin/admin`, `WIKIFORGE_STATE_DIR=/app/.wiki-forge/state` e utente non-root. Docker Compose mantiene il servizio Vite `ui` solo per lo sviluppo, insieme ad API e worker (`WIKIFORGE_EMBED_SCHEDULER=false`).

---

## 🗺️ Mappa della Documentazione (Documentation Index)

> Percorso didattico completo: **[`docs/README.md`](docs/README.md)**.
> Piano dei miglioramenti: **[`ROADMAP.md`](ROADMAP.md)**.

### 📖 Per Utenti ed Operatori
- **[`docs/guida/GUIDA_OPERATIVA.md`](docs/guida/GUIDA_OPERATIVA.md)** — guida unica non tecnica: attività, flusso tipico e buone pratiche. *Punto di partenza consigliato.*
- **[`docs/guida/USER_GUIDE.md`](docs/guida/USER_GUIDE.md)** — Focus Mode: i tre passi **Carica / Compila / Chiedi** e personalizzazione UI.
- **[`docs/guida/TUTORIAL.md`](docs/guida/TUTORIAL.md)** — interfaccia Web UI, workflow in 5 fasi, comandi chat e troubleshooting.
- **[`docs/guida/THESIS_GUIDE.md`](docs/guida/THESIS_GUIDE.md)** — tesi magistrale come knowledge base dinamica e PDF finale.
- **[`docs/guida/STARTUP.md`](docs/guida/STARTUP.md)** — da una wiki esistente a un nuovo progetto.
- **Screenshot UI/UX**: la cartella **[`img/`](img/)** contiene le schermate aggiornate (21 immagini, JPG 1920×1080) per lo **studente** (01–13) e il **Knowledge Engineer** (14–21).
- **Review Studio (mockup e anteprime)**: **[`docs/riferimenti/mockups/`](docs/riferimenti/mockups/README.md)** contiene il prototipo interattivo e le 5 anteprime.
- **Research Studio**: le sei schede sono descritte in **[`docs/help/research-studio.md`](docs/help/research-studio.md)** e in [`docs/architettura/ARCHITECTURE.md`](docs/architettura/ARCHITECTURE.md) §3.4.
- **Study Studio**: le sette schede sono descritte in **[`docs/help/study-studio.md`](docs/help/study-studio.md)** e in [`docs/architettura/ARCHITECTURE.md`](docs/architettura/ARCHITECTURE.md) §3.4.

### ⚙️ Per Sviluppatori & Knowledge Engineers
- **[`docs/architettura/ARCHITECTURE.md`](docs/architettura/ARCHITECTURE.md)** — architettura v4.1: gateway Node, servizio Python, bus, studio, frontend e deployment.
- **[`docs/architettura/OPENAPI.md`](docs/architettura/OPENAPI.md)** — contratto API generato da TypeScript, Swagger self-hosted e manifest dei comandi.
- **[`docs/architettura/GRAPH_RAG.md`](docs/architettura/GRAPH_RAG.md)** — grafo semantico, export RDF/Cypher e pipeline stateful.
- **[`docs/architettura/EDITOR_MIGRATION.md`](docs/architettura/EDITOR_MIGRATION.md)** — editor ad adapter (CodeMirror/Milkdown-Crepe), frontmatter e wikilink.
- **[`docs/processi/KNOWLEDGE_ENGINEERING.md`](docs/processi/KNOWLEDGE_ENGINEERING.md)** — maturità L1-L4, KE Workbench, ontologie e procedure TOML.
- **[`docs/processi/PROCEDURES.md`](docs/processi/PROCEDURES.md)** — schema TOML, vincoli DAG e criteri di uscita.
- **[`docs/processi/MIGRATION.md`](docs/processi/MIGRATION.md)** — flusso Plan-Review-Apply per modifiche AI.
- **[`docs/standard/OKF_SPEC.md`](docs/standard/OKF_SPEC.md)** — specifica Open Knowledge Format v0.2.
- **[`docs/standard/SELF_WIKI.md`](docs/standard/SELF_WIKI.md)** — `docs/` proiettato nella wiki OKF di `wikiforge`.
- **[`docs/processi/AGENT.md`](docs/processi/AGENT.md)** — operating manual v3.0 per agenti LLM (`AGENT.md` in root è un symlink).

---

## 💬 Agent Slash Commands Reference

The canonical catalog lives in [`docs/riferimenti/SLASH_COMMANDS_REFERENCE.md`](docs/riferimenti/SLASH_COMMANDS_REFERENCE.md). It is the single human-readable source used by the tutorial, the in-app help and the agent manual; the chat **⚡ Comandi** panel is generated from `skills/*/SKILL.md`.

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

Design preview and screenshots: **[`docs/riferimenti/mockups/`](docs/riferimenti/mockups/README.md)**.

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
├── .wiki-forge/              # Root dello stato runtime Node
│   ├── state/                # Stato procedure, sessioni, lock e cursori outbox
│   ├── changesets/           # Proposte di modifica staged da revisionare
│   ├── snapshots/            # Storico pre-scrittura delle note (Review Studio)
│   └── trash/                # Cestino soft-delete con timestamp
├── .wikiforge/               # Root degli artefatti health del servizio Python
│   ├── STATUS.md             # Summary di salute generato automaticamente
│   └── metrics/              # Storico metriche di salute (history.jsonl)
├── bin/
│   ├── wf.ts                 # CLI HTTP-only (`npm run wf`); `wf mcp` avvia l'adapter
│   ├── mcp.ts                # Adapter MCP Node (`npm run mcp`)
│   ├── worker.ts             # Worker scheduler con lock a lease
│   └── render-start.sh       # Avvio produzione su $PORT
├── src/
│   ├── frontend/             # Web UI Client (TypeScript, Vite)
│   ├── shared/api/generated/
│   │   └── commandManifest.generated.ts # Manifest generato (CLI/MCP/OpenAPI)
│   └── backend/
│       ├── app/              # Kernel, moduli di dominio e porte
│       ├── server/
│       │   ├── httpServer.ts # Gateway HTTP/SSE e SPA in produzione
│       │   ├── mcp_server.py # Solo shim di compatibilità (adapter reale: Node)
│       │   ├── bus/, modules/, state/, observability/
│       │   └── generated/    # Registry script generato
│       └── wikiforge/        # Core Python, API FastAPI e semantica
└── wiki/                     # Knowledge Base viva ed interconnessa
```

---

## 📄 Licenza & Requisiti

- **Licenza**: MIT
- **Requisiti**: Node.js >= 20.0.0, Python >= 3.11, Docker Desktop (opzionale).
