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

> 💡 **Per arrestare l'applicazione**, usa semplicemente il file `bin/Stop_WikiForge.*` corrispondente.

---

## 🗺️ Mappa della Documentazione (Documentation Index)

La documentazione è organizzata in modo modulare per guidare sia gli utenti finali che gli sviluppatori.

### 📖 Per Utenti ed Operatori (Non-Technical & Content Creators)
- **[`docs/TUTORIAL.md`](docs/TUTORIAL.md)** — **Guida Operativa dell'Utente**: Guida passo-passo all'interfaccia Web UI (Focus Mode), prontuario dei comandi chat e risoluzione dei problemi.
- **[`docs/THESIS_GUIDE.md`](docs/THESIS_GUIDE.md)** — **Guida alla Tesi Magistrale**: Esempio pratico completo per costruire una tesi come Knowledge Base dinamica ed esportarla in PDF.
- **[`docs/SOURCES.md`](docs/SOURCES.md)** — **Registro delle Fonti**: Guida alla tracciabilità delle fonti, gestione della cartella `sources/` e best practice per l'ingestione.
- **[`docs/WORKFLOW.md`](docs/WORKFLOW.md)** — **Flussi di Lavoro Operativi**: Diagrammi e dettagli sui flussi di lavoro giornalieri per la manutenzione della wiki.

### ⚙️ Per Sviluppatori, Data Scientist e Knowledge Engineers
- **[`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)** — **Architettura Tecnica**: Dettagli su FastAPI, client LLM multi-provider, isolamento della memoria non-parametrica, motore di script SSE e confronto con l'addestramento *nanochat*.
- **[`docs/GRAPH_RAG.md`](docs/GRAPH_RAG.md)** — **Enterprise Semantic Knowledge Graph & GraphRAG**: Manuale per validazione W3C SHACL, conversione duale RDF/Cypher, supporto RDF-star, Shortcut Engine, sincronizzazione live (`watchdog`) e pipeline ibrida LangGraph.
- **[`docs/KNOWLEDGE_ENGINEERING.md`](docs/KNOWLEDGE_ENGINEERING.md)** — **Guida al Knowledge Engineering**: Manuale operativo per la modellazione ontologica, validazione di vincoli logici, Neuro-Symbolic Check ed esportazione semantica RDF/JSON-LD.
- **[`docs/OKF_SPEC.md`](docs/OKF_SPEC.md)** — **Open Knowledge Format Spec v0.2**: Specifica tecnica standard per il formato delle note, frontmatter YAML, trust tiers e indici.
- **[`docs/SCHEMA.md`](docs/SCHEMA.md)** — **Typed Schema & Linting**: Guida all'inferenza e validazione dello schema formale `[schema]` nei frontmatter.
- **[`docs/AGENT.md`](docs/AGENT.md)** — **Operating Manual dell'Agente**: Contratto, ruoli, capacità e comandi slash (`/`) definiti per l'agente LLM. *(Nota: `AGENT.md` nella root è un symlink a questo file).*

### 📊 Metrike, Storico e Riferimenti
- **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — **Roadmap di Sviluppo**: Obiettivi a breve termine (Q4 2026, completati) e medio/lungo termine (Q1-Q2 2027: Multi-tenancy, Neo4j bidirezionale, Agenti L4 autonomi).
- **[`docs/CHANGELOG.md`](docs/CHANGELOG.md)** — **Storico dei Rilasci**: Registro dei cambiamenti e versionamento semantico.
- **[`docs/METRICS.md`](docs/METRICS.md)** — **Metriche di Systema**: Spiegazione delle metriche calcolate da `wiki_stats.py` e `okf_stats.py`.
- **[`docs/KARPATHY_LLM_WIKI.md`](docs/KARPATHY_LLM_WIKI.md)** — **Il Concetto Originario**: Copia offline dell'articolo di Andrej Karpathy sull'LLM Wiki pattern.
- **[`docs/STARTUP.md`](docs/STARTUP.md)** — **Guida all'Avvio e Troubleshooting**: Risoluzione dei problemi comuni di avvio, permessi e configurazione Docker.

---

## 🔄 Il Flusso Operativo in 5 Fasi Cronologiche

```
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 1: Configurazione & Inizializzazione                   │
 │ Setup config/config.toml, Scenario Wizard (wizard / /wizard)│
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 2: Ingestione & Conversione Fonti                      │
 │ PDF/EPUB in sources/, conv2md, clip2md, notebooklm_import   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 3: Costruzione Incrementale & Consultazione            │
 │ /compile, /ingest, Web UI Editor, Graph View, /consult,     │
 │ /search, /backlinks, /related, /trace, versioning & /rollback│
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 4: Sintesi, Studio & Calcolo Maturità                  │
 │ /study-guide, /quiz, /mindmap, /audio-overview,             │
 │ /deep-research, /note, /promote-note, /maturity, /tag-suggest│
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 5: Proiezione Statica & Compilazione PDF               │
 │ /thesis-chapter, generate_thesis, export_thesis_pdf (PDF)   │
 └──────────────────────────────┘
```

1. **Fase 1: Configurazione**: Imposta `config/config.toml` o usa la GUI **⚙️ Config** ed avvia il Wizard (`wizard` or `/wizard`).
2. **Fase 2: Ingestione**: Carica i file sorgente in `sources/` e convertili in Markdown con `bash scripts/run_convert.sh` (`convert-only` / `/convert-only`), ritaglia pagine sul web con `clip2md.py` o importa da NotebookLM con `notebooklm_import.py`.
3. **Fase 3: Costruzione & Consultazione**: Avvia `/compile` per elaborare i file in `raw/` o `/ingest` per un singolo file, esegui il riesame con `/recompile`, crea nuove schede con `/new-article`, interroga la wiki con `/consult`, cerca con `/search`, esplora i collegamenti con `/backlinks` e `/related`, e traccia le affermazioni alle fonti originali con `/trace`. Gestisci le versioni e ripristina stati precedenti con `/rollback`.
4. **Fase 4: Sintesi & Maturazione**: Genera materiale didattico ed analisi con `/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/deep-research`, prendi appunti veloci con `/note` e promuovili ad articoli con `/promote-note`, suggerisci tag con `/tag-suggest` e calcola l'indice di completamento delle pagine con `/maturity`.
5. **Fase 5: Compilazione & Stampa PDF**: Aggrega le note mature con `/thesis-chapter` (`generate_thesis.py`), valuta la coerenza con `/adversarial-review`, registra la revisione umana con `/verify` (alias `/human-review`), riassumi i cambiamenti con `/digest`, genera slide reveal.js con `/slides` (`/generate-slides`), ed esporta il PDF finale con `export_thesis_pdf.py` (`make thesis-pdf`). Gestisci la manutenzione della wiki con `/audit`, `/reindex`, `/prune`, `/lint-frontmatter`, `/ontology-check`, `/stats`, `/merge`, `/split`, `/stub`, `/retag`, `/export-semantic`, rigenera la bibliografia con `/sources` (`sources regenerate`), visualizza modelli con `/template` (`template show`), confronta versioni con `/diff`, ed esporta dati con `/export` e `/help`.

---

### 🏛️ Principi Architetturali (KISS & DRY)
Il progetto aderisce rigorosamente alla filosofia Unix:
- **KISS (Keep It Simple, Stupid)**: Ogni script fa una sola cosa (es. `conv2md.py` converte solo formati, non genera testo LLM; la logica CoT è isolata in `enrich_cot.py`). La complessità dell'agente è isolata nei moduli `skills/` e nel motore di orchestrazione.
- **DRY (Don't Repeat Yourself)**: La configurazione è centralizzata (`config.toml`). Le definizioni degli script risiedono in un unico `SCRIPT_REGISTRY` che alimenta sia la CLI che la UI dinamica. I symlink garantiscono una singola fonte di verità per `AGENT.md` e `skills/`, e la classe base `BaseGraphExporter` unifica il parsing dei grafi.
- **Disaccoppiamento**: Frontend (Vite/TS) e Backend (Node/Python) comunicano esclusivamente tramite contratti API REST/SSE ben definiti, senza logica di business condivisa.

---

## 🛠️ Cosa C'è nel Repository

```
.
├── bin/                 # Script di lancio e arresto rapido (Start_*, Stop_*, Update_*)
├── config/
│   ├── config.toml      # Configurazione principale (titolo, percorsi, LLM, OKF)
│   ├── projects.json    # Registro dei progetti
│   └── scenarios.toml   # Preset di scenario (Academic, Business, Research, ecc.)
├── scripts/
│   ├── conv2md.py            # Conversione PDF/EPUB/DOCX -> Markdown (raw/)
│   ├── run_convert.sh        # Wrapper per conv2md.py
│   ├── notebooklm_import.py # Importazione note ed export da NotebookLM
│   ├── wiki_stats.py        # Calcolo metriche wiki e METRICS.md
│   ├── suggest_tags.py      # Suggerimento tag da vocabolario controllato
│   ├── clip2md.py           # Web clipper -> Markdown (sources/web-clips/)
│   ├── maturity_calculator.py # Calcolo Indice di Maturità (0-100)
│   ├── versioning.py        # Snapshot di versione e motore di rollback
│   ├── check_docs_sync.py   # Verificatore di sincronizzazione documentazione/skills
│   ├── migrate_to_okf.py    # Migrazione frontmatter a OKF v0.2
│   ├── okf_lint.py          # Linter e validatore schema OKF v0.2
│   ├── okf_log.py           # Registro cronologico delle modifiche (OKF §9)
│   ├── okf_reindex.py       # Rigenerazione indici tematici (OKF §8)
│   ├── okf_stats.py         # Statistiche ed analisi trust tier OKF
│   ├── generate_thesis.py   # Aggregazione capitoli tesi da note mature
│   ├── export_thesis_pdf.py # Esportazione della tesi in PDF tramite Pandoc
│   ├── export_semantic.py   # Esportazione semantica RDF (JSON-LD / Turtle)
│   ├── ontology_rules.py    # Motore di validazione regole ontologiche
│   ├── cq_validator.py      # CLI wrapper per la validazione delle Competency Questions
│   ├── odp_suggester.py     # CLI wrapper per i suggerimenti Ontology Design Pattern
│   ├── neuro_symbolic_check.py # CLI wrapper per verifiche di coerenza neuro-simbolica
│   ├── ke_maturity.py       # CLI wrapper per la valutazione maturità KE
│   ├── schema_lint.py       # Linter per schemi formali [schema]
│   ├── schema_infer.py      # Inferenziatore di schemi formali candidate
│   └── wizard.py            # CLI guidata per scenari operativi
├── AGENT.md             # Manuale operativo dell'Agente LLM (symlink a docs/AGENT.md)
├── skills/              # Pacchetti di Skill modulari per l'agente
├── docs/                # Documentazione centralizzata (TUTORIAL, THESIS_GUIDE, GRAPH_RAG, ecc.)
├── src/
│   ├── frontend/        # Web UI Client (TypeScript, Vite, CodeMirror, ForceGraph)
│   └── backend/         # Python Domain & Server Engine
│       ├── core.py      # Utility core condivise backend
│       ├── cache.py     # Gestione cache
│       ├── server/
│       │   ├── agentServer.ts           # Agent REST & SSE Server
│       │   ├── httpServer.ts            # Entry point HTTP
│       │   ├── llmClient.ts             # Client LLM Multi-provider
│       │   └── mcp_server.py            # Model Context Protocol (MCP) Server
│       └── wikiforge/
│           ├── api/
│           │   └── api_server.py        # Server REST API FastAPI per servizi Knowledge Graph
│           ├── cli.py                   # CLI unificata (`python3 -m src.backend.wikiforge.cli`)
│           ├── watcher/
│           │   └── graph_watcher.py     # File watcher live event-driven (watchdog)
│           ├── config/
│           │   └── shapes.ttl           # Vincoli W3C SHACL per la validazione delle forme
│           └── semantics/
│               ├── markdown_to_rdf.py   # Convertitore Zettelkasten -> Grafo RDF Turtle + RDF-star
│               ├── markdown_to_cypher.py# Esportatore Zettelkasten -> Script Neo4j Cypher
│               ├── shortcut_engine.py   # Engine di materializzazione scorciatoie (SPARQL & Cypher)
│               ├── cq_runner.py         # Test runner per Competency Questions (YAML -> SPARQL)
│               ├── cq_engine.py         # Motore di valutazione SPARQL/Graph per Competency Questions
│               ├── shacl_validator.py   # Motore di validazione SHACL ed inferenza OWL
│               └── graph_rag_pipeline.py# Pipeline Retrieval Ibrida (Vector + Subgraph Traversal)
├── sources/             # Cartella file sorgenti ORIGINALI (backup/ - mai modificati)
├── raw/                 # Testo grezzo convertito (inbox dell'agente)
├── wiki/                # La Knowledge Base viva ed interconnessa
├── output/              # Risultati temporanei, report e PDF finali
├── Dockerfile           # Ambiente riproducibile (Python + Pandoc)
└── Makefile             # Scorciatoie per terminale
```

---

## 🧠 Funzionalità Avanzate di Knowledge Engineering & GraphRAG

Oltre alla gestione base della conoscenza, `wiki-forge` include strumenti da **Knowledge Engineer** professionale per la validazione formale e l'interoperabilità semantica:
- **Validazione W3C SHACL (`shapes.ttl`)**: Enforcing automatizzato di vincoli di forma strutturali e semantici (`wf:PermanentNoteShape`, `wfs:AgentShape`) tramite `pyshacl` ed il flusso CI/CD `.github/workflows/shacl_validation.yml`.
- **Mappatura Duale Grafo RDF, RDF-star & Neo4j Cypher**: Mappatore Zettelkasten -> W3C Turtle con **RDF-star** (`<< s p o >>`) per metadati su archi (`markdown_to_rdf.py`) ed esportatore per Labeled Property Graphs in Neo4j (`markdown_to_cypher.py`).
- **Engine di Materializzazione Shortcut (`shortcut_engine.py`)**: Materializzazione automatica di archi diretti semplificati (`wf:directCoAuthor`, `wf:agent`, `wf:role`) da strutture ODP reificate a molti salti.
- **File Watcher Incrementale Live (`graph_watcher.py`)**: Sincronizzazione in tempo reale su eventi di file system (`watchdog`) per riflettere creazione, modifica ed eliminazione di note `.md` nel grafo senza ricompilazione totale.
- **Pipeline Hybrid GraphRAG con LangGraph (`graph_rag_pipeline.py`)**: Motore agentico stateful con ricerca vettoriale per similarità (Vector Search) combinata con estrazione di sottografi k-hop (Ego-Graph Traversal), auto-correzione ed autoriflessione con sintesi tracciata PROV-O.
- **Test Runner Competency Questions (`cq_runner.py`)**: Runner automatizzato per verificare i requisiti conoscitivi definiti in YAML (`tests/competency_questions/cqs.yml`) ed esportare report di conformità Markdown.
- **FastAPI REST API & Unified CLI (`api_server.py` & `cli.py`)**: Endpoints API REST (`/api/v1/graph/sync`, `/api/v1/graph/validate`, `/api/v1/graph/rag`) e interfaccia CLI unificata per la gestione completa del Knowledge Graph.
- **Competency Questions Engine (`/validate-cq`)**: Validazione della copertura conoscitiva della wiki rispetto a domande in linguaggio naturale via `python3 scripts/cq_validator.py` (`make validate-cq`).
- **Ontology Design Pattern Suggester (`/suggest-odp`)**: Suggerimento di pattern ontologici formali (Employment, Temporal Properties, Situations) via `python3 scripts/odp_suggester.py` (`make suggest-odp`).
- **Ponte Neuro-Simbolico (`/neuro-check`)**: Analisi di contraddizioni logiche e inferenza di collegamenti mancanti via `python3 scripts/neuro_symbolic_check.py` (`make neuro-check`).
- **Valutazione Maturità KE (`/ke-maturity`)**: Valutazione della maturità del sistema su 6 dimensioni (L1-L4) via `python3 scripts/ke_maturity.py` (`make ke-maturity`).
- **Typed Schema Lint & Inference (`/schema-lint`, `/schema-infer`)**: Validazione rigorosa e proposizione automatica dello schema formale [schema] via `python3 scripts/schema_lint.py` e `python3 scripts/schema_infer.py` (`make schema-lint`, `make schema-infer`).
- **Validazione Ontologica Leggera (`/ontology-check`)**: Controlli di coerenza logica, rilevamento di dipendenze circolari dirette (A -> B -> A) e verifica della revisione umana per le note con stato `stable` via `python3 scripts/ontology_rules.py` (`make ontology-check`).
- **Esportazione Semantica W3C (`/export-semantic`)**: Conversione automatica della Knowledge Base in formati RDF standard (`output/wiki_export.jsonld` e `output/wiki_export.ttl`) per l'interoperabilità con GraphDB e Protégé via `python3 scripts/export_semantic.py` (`make export-semantic`).
- **Model Context Protocol (MCP Server)**: Server nativo (`src/backend/server/mcp_server.py`, `make mcp-serve`) per permettere ad agenti AI esterni di interrogare e navigare la tua wiki in modo strutturato tramite i tool `search_wiki`, `get_concept_metadata`, `get_line_anchored_citation`, `validate_competency_question`, e `get_ontology_gaps`.
- **Manuali di riferimento**: Guida all'interoperabilità semantica in [`docs/KNOWLEDGE_ENGINEERING.md`](docs/KNOWLEDGE_ENGINEERING.md) ed alla pipeline GraphRAG in [`docs/GRAPH_RAG.md`](docs/GRAPH_RAG.md).

---

## 🌐 Web UI & Pannello di Controllo Strumenti

L'applicazione include un'interfaccia Web avanzata (Vite + TypeScript) con:

### Ruoli Utente e Due Modalità Operative Separate

- **🌱 Operatore Semplice (Focus Mode / Modalità Semplice)**: i tre passaggi essenziali per utenti non tecnici sono **nella barra in alto, al centro**, sempre visibili: **📥 1. Carica** → **⚡ 2. Compila** → **💬 3. Chiedi**. L'operatore carica documenti in `sources/`, compila l'inbox `raw/` ed interroga l'Agente per nutrire la Wiki. Nessun comando tecnico richiesto.
- **👑 Knowledge Engineer (Developer Mode / KE Workbench 🧠)**: sblocca il **KE Workbench** per gli specialisti di dominio, oltre a **🛠️ Tools** e **⚙️ Config**. Toggle in alto a destra oppure scorciatoia `Ctrl+Shift+D`.

### Strumenti dell'interfaccia

- **🧠 Knowledge Engineer Workbench (KE Workbench)**: Interfaccia guidata wizard per eseguire i 6 Use Case KE professionali (Schema Modeling, Ontological Integrity, CQ Validation, Neuro-Symbolic & ODP, W3C Semantic RDF Export, KE Maturity Evaluation) con SSE log streaming.
- **Pannello Strumenti (🛠️ Tools)**: Esegue tutti i 15+ script Python direttamente dal browser con form dinamici e console di log in tempo reale tramite Server-Sent Events (SSE).
- **Gestore Configurazione (⚙️ Config)**: Modifica `config.toml` graficamente.
- **Project Switcher**: Gestisci più progetti contemporaneamente isolati in `projects/`.
- **Vault Explorer & CodeMirror 6 Editor**: Naviga nel vault, modifica note con completamento dei `[[wikilink]]` e salvataggio diretto su disco. La barra laterale sinistra si ridimensiona in orizzontale e i pulsanti delle operazioni sui file si dispongono su una riga, andando a capo da soli quando la restringi.
- **Force Graph Viewer**: Mappa interattiva delle relazioni tra note.
- **Node Metadata**: Barra orizzontale sotto l'editor con titolo, tag, badge di affidabilità OKF, backlink, link in uscita e stato dell'agente. Si ridimensiona in verticale.
- **Selettore vista (📝 Editor / 🕸️ Graph / ◧ Split)**: Sceglie il layout dell'area di lavoro — solo editor, solo grafo, o affiancati con trascinatore. La scelta viene ricordata.
- **Chat Drawer**: Assistente agente integrato con streaming delle risposte, tasti scorciatoia ed il pulsante **📌 Attach to Wiki**.

---

## 📄 Requisiti e Requisiti di Sistema

- **Docker Desktop** (consigliato per l'avvio con un click) oppure:
- Python 3.11+
- Pandoc (per la compilazione dei PDF e la conversione DOCX/EPUB)
- Node.js 20+ (per lo sviluppo locale dell'interfaccia Web UI)
