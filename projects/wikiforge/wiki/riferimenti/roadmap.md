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

- [x] **Task 10: Accesso obbligatorio, bootstrap Admin ed esportazione Wiki ZIP**
  - Gateway di login all'avvio: `refreshIdentity()` viene risolto prima di graph events, vault e onboarding; sessioni anonime o scadute mostrano una modale bloccante e il sign-out riapre il gate.
  - Bootstrap predefinito `admin`/`admin` in `UserStore` quando le variabili `WIKIFORGE_ADMIN_USERNAME` / `WIKIFORGE_ADMIN_PASSWORD` non sono impostate; credenziali configurate mantengono la precedenza. La modale **👥 Utenti** resta in Modalità Sviluppo per creare utenti e assegnare ruoli.
  - Nuova route additiva `GET /api/projects/:id/export/markdown.zip` (`projects.exportMarkdownZip`, `application/zip`, auth locale obbligatoria).
  - Writer ZIP store-only in `src/backend/server/zipFile.ts` (CRC32, nomi UTF-8, timestamp DOS, validazione path, nessuna dipendenza runtime) e raccolta deterministica di tutti i `.md` sotto `[paths].wiki` in `ProjectService`.
  - Azione **📦 Esporta Wiki ZIP** pinata in Modalità Sviluppo e nascosta in Modalità Focus; download tramite `apiBus` con nome `<project>-wiki.zip`.

- [x] **Task 11: Matrice capabilities RBAC progressiva**
  - Source of truth condivisa in `src/shared/auth/capabilities.ts`: `OPERATION_MIN_ROLE` e `ACTION_MIN_ROLE` alimentano `OPERATION_ROLES` del backend e `canRenderAction()` / `canUseOperation()` del frontend.
  - Ruoli progressivi Reader → Contributor → KnowledgeEngineer → Admin: scritture note, upload e changeset staging a Contributor; verifica, deep research, script/scheduler e apply/reject changeset a KnowledgeEngineer; utenti, progetti, config write e approvazioni F6 ad Admin.
  - UI filtrata per identità managed: header, command palette, scorciatoie, editor, sidebar, tab degli studio, modali progetti/config/tools/changeset/KE, comandi chat e onboarding. Le sessioni legacy/anonymous mantengono la superficie storica.
  - Copertura test in `tests/capabilityMatrix.test.ts`, `tests/authUi.test.ts`, `tests/userUi.test.ts`, `tests/rbacMiddleware.test.ts` e `tests/graphRoutes.test.ts`.

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
- Connessione opzionale tramite driver Neo4j e sincronizzazione del grafo mediante il watcher `graph_watcher.py` (debounced, non istantanea).
- Interrogazione live in Cypher con whitelist read-only e sincronizzazione bidirezionale tra il vault Markdown e le istanze Neo4j: DB → vault produce solo changeset revisionabili.
- Riconciliazione delle modifiche da browser e database con metadata `wf:*`, dedupe, echo suppression e propagate SSE `graph:changed` al browser, filtrata per progetto; nessuna scrittura automatica nel vault.

> **Piano operativo**: lo studio del codice, la scomposizione in 23 step (A0–A5,
> B0–B7, C0–C8), le dipendenze, i criteri di accettazione, i test di verifica e
> la tabella del **grado di implementazione raggiunto** (aggiornata a ogni step)
> sono in [`ROADMAP_Q1_Q2_2027_PLAN.md`](../processi/roadmap-q1-q2-2027-plan.md). Baseline:
> L4 ~2.5/5, RBAC ~1/5, Neo4j ~0.5/5. Completati **A0** (gate `cq_gaps`
> corretto, L4 ~3.0/5), **A1** (modello `Finding` unificato e read-only con
> ID deterministici, L4 ~3.2/5), **A2** (eventi F6 persistenti su disco con
> restore al restart e dedupe, emitter `note.modified`/`note.deleted`, L4 ~3.4/5),
> **A3** (finding → changeset proposti con snapshot/rollback e tab Proposte nella
> Review Studio, L4 ~3.6/5), **B0** (baseline auth senza cambi funzionali), **B1**
> (Principal server-derived), **B2** (catalogo ruoli), **B3** (gate RBAC opt-in),
> **B4** (bypass auth chiuso), **B5** (provenance vincolata in strict mode),
> **B6** (adapter IdP OIDC/SAML/OAuth2), **B7** (UI identità via transport
> tipizzato e `GET /api/auth/me` additiva; autenticazione, ruoli, provenance e
> UI 5/5, RBAC 5/5 — pilastro completato), **C0** (config Neo4j inerte) e
> **C1** (client Neo4j injettabile con lazy import del driver e test con fake),
> **C2** (sync vault → Neo4j reale e idempotente con MERGE parametrizzato ed
> eventi strutturati), **C3** (Cypher live read-only con whitelist e modi
> mock/live espliciti) e **C4** (tre route Neo4j additive dichiarate in TS,
> protette da B4 con ruoli RBAC espliciti e proxy FastAPI legacy invariato;
> OpenAPI 95 endpoint/90 comandi su bus). **C5** chiude la direzione DB → vault
> con proposte staged via `process:neo4j-reconciler`, conflitti su `wf:baseHash`
> e nessuna scrittura prima di `changesets.apply`. **C6** aggiunge metadata
> `wf:origin/localHash/dbHash`, ledger di dedupe ed echo suppression e staging
> sempre scoped a `X-Project-Id`; **C7** propaga `graph:changed` via SSE
> `graph.events` consumata da `apiBus.stream()`, con frame filtrati per progetto;
> **C8** allinea documentazione e gate. **A4** introduce autonomia `bounded`
> con allowlist, doppia rivalidazione, rollback e audit
> `process:wiki-forge-autonomy` senza mai attivare `auto_apply`; **A5** chiude
> l'auto-repair deterministico di orfani e frontmatter con conflitti a 0
> scritture. Track Neo4j ~5/5, L4 ~4.5/5, **23/23 step chiusi**.
>
> **Stato piano**: i §12–§13 di
> [`ROADMAP_Q1_Q2_2027_PLAN.md`](../processi/roadmap-q1-q2-2027-plan.md) contengono il
> checkpoint del track C e il checkpoint finale 23/23 (step chiusi, gate,
> dipendenze e vincoli), aggiornati insieme al registro §11.
