# 🚀 Wiki-Forge: Roadmap di Sviluppo

> **Nota**: Questo documento definisce gli obiettivi di sviluppo a breve e medio/lungo termine per la piattaforma **Wiki-Forge** (Engine di Knowledge Engineering, RAG Semantico e Compilatore di Conoscenza OKF v0.2).

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
