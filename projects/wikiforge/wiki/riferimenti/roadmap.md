---
type: Reference
title: "🚀 Wiki-Forge: Roadmap di Sviluppo"
description: "I comandi implementati sono nel SLASHCOMMANDSREFERENCE.md; questo evita di documentare come esistenti funzionalità ancora assenti dal router chat."
resource: docs/ROADMAP.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-roadmap-md
    resource: docs/ROADMAP.md
    title: "🚀 Wiki-Forge: Roadmap di Sviluppo"
    author: human:alby69
---
# 🚀 Wiki-Forge: Roadmap di Sviluppo

> **Nota**: Questo documento definisce gli obiettivi di sviluppo a breve e medio/lungo termine per la piattaforma **Wiki-Forge** (Engine di Knowledge Engineering, RAG Semantico e Compilatore di Conoscenza OKF v0.2).

---

## 🧭 Comandi chat pianificati (non implementati)

| Comando | Stato | Alternativa disponibile oggi |
|---|---|---|
| `/rollback` | ⬜ Pianificato | **🕐 Cronologia** nell'editor e scheda **Confronta versioni** della Review Studio |
| `/history` | ⬜ Pianificato | **🕐 Cronologia** nell'editor (`VersionTimeline.ts`) |

I comandi implementati sono nel [`SLASH_COMMANDS_REFERENCE.md`](slash-commands-reference.md); questo evita di documentare come esistenti funzionalità ancora assenti dal router chat.

---

## 📐 Filosofia Architetturale: Unix KISS & DRY

Wiki-Forge rispetta rigorosamente i principi di progettazione software **Unix KISS (Keep It Simple, Stupid)** e **DRY (Don't Repeat Yourself)**:
- **Disaccoppiamento Comandi / API**: Ogni script in `scripts/` è un tool CLI standalone, eseguibile in ambiente Unix indipendente dal server Node.js. Accetta argomenti standard `argparse` e restituisce JSON strutturato su stdout (`--json`).
- **Librerie di Supporto Condivise**: La logica comune (parsing YAML, caricamento OKF, risoluzione wikilink) è centralizzata in `scripts/ke_common.py` senza duplicazione di codice.
- **Interfacce Disaccoppiate**: Il server MCP (`src/server/mcp_server.py`) e l'API Server HTTP/REST (`src/server/agentServer.ts`) usano dichiarazioni di comandi top-level e delegano l'esecuzione ai singoli tool CLI isolati via subprocess.

---

## 📌 Breve Termine (Q4 2026)

L'obiettivo principale del Q4 2026 è elevamento della Developer Experience (DX), il rafforzamento della suite di test e l'estensione dell'interoperabilità agentica per la piattaforma.

- [x] **Task 1: Hot Reload per il Servizio API (Node.js)**
  - Abilitazione del watcher `npx tsx watch` nel container Docker `api` (`docker-compose.yml`) per riavvii trasparenti in dev.
  - Aggiornamento della documentazione architetturale (`docs/TECHNICAL_ARCHITECTURE.md`).

- [x] **Task 2: Espansione della Copertura Test Automatizzati (Python)**
  - Creazione del modulo test `tests/python/` e fixtures `conftest.py`.
  - Copertura completa per `scripts/okf_lint.py` e per i moduli semantici `scripts/markdown_to_rdf.py`, `cq_runner.py` e `cq_engine.py`.
  - Integrazione di `pytest-cov` con soglia di copertura > 70% nel workflow GitHub Actions (`.github/workflows/test.yml`).

- [x] **Task 3: Resilienza UI e Error Parsing nella Console SSE (`LogConsole`)**
  - Intercettazione ed estrazione degli stack trace Python (`Traceback`, `ModuleNotFoundError`, `YAMLError`) nel flusso Server-Sent Events.
  - Formattazione avanzata con box rossi di errore (`alert-error`), troncamento intelligente e suggerimenti di risoluzione per l'utente.

- [x] **Task 4: Ottimizzazione Force Graph Viewer per Wiki di Grandi Dimensioni**
  - Implementazione del clustering automatico/manuale per unificare i nodi per cartella/tipo OKF in super-nodi.
  - Aggiunta del controllo "Attiva Clustering" nella barra dei comandi del grafo (`GraphControls.ts`).

- [x] **Task 5: Estensione del Server MCP con Tool KE Workbench**
  - Registrazione del tool `execute_ke_use_case(use_case_id)` nel server MCP (`src/server/mcp_server.py`).
  - Mappatura completa dei 6 Use Case di Knowledge Engineering (Schema Modeling, SHACL Validation, CQ Assessment, Neuro-Symbolic, Semantic Export, Platform Maturity Evaluation).

- [x] **Task 6: Master Implementation Brief v2.0 (KE Cockpit & Procedure Engine Core)**
  - Implementazione dell'Health & Metrics Engine unificato (`src/backend/wikiforge/api/health.py`) con calcolo dei livelli L1-L4, punteggio di salute 0-100 e raccomandazioni "Next Best Actions".
  - Implementazione del Safe Vault & Changeset Manager (`src/backend/wikiforge/vault.py`) per modifiche atomiche, cestino soft-delete `.wikiforge/trash/` e review queue di modifiche staged in `.wikiforge/changesets/`.
  - Motore di Procedure TOML dichiarative e resummabili (`src/backend/wikiforge/procedures.py`) con supporto per grafi di dipendenze DAG, esecuzione automatica di script, pause per revisione umana e stato persistente in `.wikiforge/state/<run_id>.json`.
  - Integrazione completa nella Web UI: cruscotto KE Cockpit (`KECockpitModal.ts`), Command Palette (`Ctrl+K`), Changeset Review Queue (`ChangesetReviewModal.ts`), Live Sync SSE ed ETag SHA256 per la prevenzione delle collisioni in scrittura.

- [x] **Task 7: Review Studio (UI di revisione unificata)**
  - Modale unica con quattro schede orizzontali: **Verifica**, **Critica**, **Digest**, **Confronta versioni** (`ReviewStudio.ts`, `review-studio.css`).
  - Apertura da menu contestuale della nota (`ReviewContextMenu.ts`), pulsante **🧐 Revisione** nell'editor e scorciatoie `Ctrl+Alt+R/C/D/F`.
  - API dedicate `/api/notes/review/{meta,verify,digest,critique,snapshots,diff,restore}`; verifica umana condivisa con `/verify`, digest e diff deterministici, critica LLM con fallback.
  - Storico locale pre-scrittura in `.wiki-forge/snapshots/` (25 snapshot per nota, gitignored) con diff unificato e ripristino.
  - Mockup interattivo e 5 anteprime in `docs/mockups/`; documentazione utente, tecnica e guida in-app aggiornata.

- [x] **Task 8: Study Studio (UI di studio e sintesi)**
  - Modale unica con sette schede orizzontali: **Guida**, **Quiz**, **Mindmap**, **Audio**, **Note**, **Promuovi**, **Tesi** (`StudyStudio.ts`, `study-studio.css`).
  - Apertura dai pulsanti **📚 Studio** della barra in alto e dell'editor, dal menu contestuale della nota e dalle scorciatoie `Ctrl+Alt+G/K/M/A`.
  - API dedicate `/api/notes/study/{guide,quiz,mindmap,audio-overview,note,promote-note,thesis-chapter}` con builder deterministici condivisi (`studyHelpers.ts`) e test in `tests/studyHelpers.test.ts`.
  - Parità con i comandi chat, quiz a numero esatto di domande (1–25), `sources` basate sui percorsi reali delle note, promozione della voce selezionata dello scratchpad e aggiornamento della bozza canonica `output/thesis_compiled.md`.
  - Documentazione utente, tecnica e guida in-app aggiornata (topic `study-studio`).

- [x] **Task 9: Wiki di self-documentazione da `docs/` (Fase 70-75)**
  - Piano e mapping completo in `docs/SELF_WIKI_PLAN.md`: `docs/` resta sorgente canonica, la wiki è una proiezione OKF v0.2 commitata in `projects/wikiforge/wiki/` (help e mockup inclusi, `METRICS.md` escluso, lingua del sorgente preservata).
  - Generatore deterministico `scripts/docs_to_wiki.py` (`--check`, `--json`, `--dry-run`) con provenienza e tag; progetto dedicato `wikiforge` registrato in `config/projects.json`; verifica drift in `scripts/check_docs_sync.py` e validazione `okf_lint.py`.
  - UX: bottone **📚 Wiki Docs** e `Ctrl+Alt+D` aprono il Research Studio con `projectId=wikiforge` (query + header) senza cambiare vault attivo, con badge di ambito e topic guida `wiki-di-wiki-forge`.
  - Accumulazione curata: `scripts/promote_doc_answer.py` (solo umano, `verified: human:<id>`, script mutante bloccato dal Policy Agent) e job `weekly-docs-wiki-drift` che rigenera la proiezione OKF da `docs/` (note curate preservate), con rationale e fonti; i percorsi relativi sono risolti dalla radice del repo e i run schedulati richiedono approvazione F6.
  - Fase 76: ponte wiki → modifiche al programma con Use Case 8 `ke_wiki_program_change`; `wiki_program_change_propose.py` (sola lettura) accoda la proposta, `wiki_program_change_apply.py` (mutante, F6-only) la applica con snapshot e audit solo dopo approvazione umana. Nessuna mutazione automatica.

---

## 🔮 Medio / Lungo Termine (Q1-Q2 2027)

L'evoluzione futura di Wiki-Forge si focalizzerà sull'autonomia agentica completa, l'enterprise multi-tenancy e la sincronizzazione graph in tempo reale.

### 1. Livello L4 di Maturità KE (Fully-Autonomous Agentic Workflows)
- Agenti autonomi in background in grado di scansionare continuamente il vault OKF.
- Suggerimento automatico proattivo di Ontology Design Patterns (ODP) e generazione di note per colmare i knowledge gaps.
- Auto-riparazione delle incoerenze semantiche e risoluzione automatica delle entità orfane.

### 2. Supporto Nativo Multi-Utente con Ruoli e Permessi (RBAC)
- Autenticazione enterprise (OAuth2, OIDC, SAML 2.0).
- Permessi granulari a livello di progetto e cartella (Role-Based Access Control: Reader, Contributor, Knowledge Engineer, Admin).
- Tracciamento della provenienza per le modifiche umane e sintetiche (`human:<id>` e `process:<id>`).

### 3. Integrazione Bidirezionale in Tempo Reale con Neo4j
- Connessione diretta tramite driver Neo4j e sincronizzazione del grafo mediante il watcher `graph_watcher.py`.
- Interrogazione live in Cypher con sincronizzazione bidirezionale tra il vault Markdown e le istanze Neo4j aziendali.
- Riconciliazione automatica delle modifiche effettuate sia dal browser che dal database a grafi.

> **Piano operativo**: lo studio del codice, la scomposizione in 23 step (A0–A5,
> B0–B7, C0–C8), le dipendenze, i criteri di accettazione, i test di verifica e
> la tabella del **grado di implementazione raggiunto** (aggiornata a ogni step)
> sono in [`ROADMAP_Q1_Q2_2027_PLAN.md`](../processi/roadmap-q1-q2-2027-plan.md). Baseline:
> L4 ~2.5/5, RBAC ~1/5, Neo4j ~0.5/5; implementazione non ancora avviata.
