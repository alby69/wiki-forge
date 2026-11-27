# Knowledge Engineering Operating Manual

> Operational guide for Knowledge Engineers using `wiki-forge` to build, model, validate, interoperate, and maintain open knowledge bases based on OKF v0.2.

---

## 1. Overview & Role Definition: Cognitive Units & Paradigm Shift

In `wiki-forge`, documents are not treated as passive text files, but as **cognitive units** (entities, relations, rules, situations) within a neuro-symbolic Knowledge Graph. Rather than answering transient questions from raw files on every query (classic RAG), the system constructs and maintains a persistent, interlinked, non-parametric knowledge graph stored as plain Markdown files adhering to **Open Knowledge Format (OKF v0.2)**.

The system bridges **Explicit Representation** (Description Logics, OWL, RDF, SPARQL, Ontology Design Patterns) and **Distributed Representation** (internal LLM latent features as described in Nello Cristianini's *Forma mentis* and *Machina sapiens*).

The Knowledge Engineering lifecycle comprises six primary dimensions:
1. **Knowledge Modeling & Construction**: Defining domain schemas, controlled vocabularies, and frontmatter taxonomy.
2. **Competency Questions (CQ) Validation**: Verifying that the knowledge base contains necessary entities, relations, and business rules to answer predefined natural language questions.
3. **Ontology Design Patterns (ODP)**: Elevating informal properties into formal reusable patterns (Employment, Time-Indexed Properties, Situations).
4. **Neuro-Symbolic Reasoning & Consistency**: Combining syntactic linting (`okf_lint.py`), logical rules (`ontology_rules.py`), and LLM neuro-symbolic inference (`neuro_symbolic_check.py`).
5. **Semantic Interoperability**: Exposing structured knowledge to external AI agent ecosystems via Model Context Protocol (MCP) and exporting W3C standard RDF graphs (JSON-LD and Turtle/TTL).
6. **Maturity & Governance**: Assessing platform progression across L1-L4 maturity levels (`ke_maturity.py`), freshness (`stale_after`), maturity scores (`maturity_calculator.py`), and historical snapshots (`versioning.py`).

---

## 2. Gestione degli Use Case guidati per l'Ingegnere della Conoscenza (KE Workbench)

`wiki-forge` offre un **Pannello di Controllo guidato per il Knowledge Engineer (KE Workbench)** e REST API dedicate (`/api/ke/use-cases` e `/api/ke/use-cases/execute`) che guidano l'Ingegnere della Conoscenza nell'esecuzione dei **7 Use Case professionali** fondamentali per la gestione del ciclo di vita della conoscenza:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧠 KNOWLEDGE ENGINEER WORKBENCH (GUIDED USE CASES)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Schema & Taxonomy Modeling    ──► schema_infer, schema_lint, suggest_tags  │
│ 2. Ontological Validation        ──► ontology_rules, okf_lint                │
│ 3. Competency Questions (CQ)     ──► cq_validator, wiki_stats                │
│ 4. Neuro-Symbolic & ODP          ──► odp_suggester, neuro_symbolic_check     │
│ 5. Enterprise Semantic Export    ──► export_semantic (RDF/TTL/JSON-LD), MOCs │
│ 6. KE Platform Maturity Eval     ──► maturity_calculator, ke_maturity        │
│ 7. Self-Docs Wiki Drift          ──► docs_wiki_drift (rigenera, F6-only)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tabella degli Use Case e REST API

| Use Case ID | Titolo Use Case | Categoria | Script Coinvolti | REST Endpoint / Output |
| :--- | :--- | :--- | :--- | :--- |
| `ke_schema_modeling` | **UC1: Schema & Taxonomy Modeling** | Conceptual Modeling | `schema_infer`, `schema_lint`, `suggest_tags` | `POST /api/ke/use-cases/execute` |
| `ke_ontological_validation` | **UC2: Ontological Integrity & Validation** | Validation & Governance | `ontology_rules`, `okf_lint` | Log di coerenza & cicli diretti |
| `ke_cq_assessment` | **UC3: Competency Questions (CQ) & Coverage** | Knowledge Audit | `cq_validator`, `wiki_stats` | `output/cq_validation_report.md` |
| `ke_neuro_symbolic` | **UC4: Neuro-Symbolic Reasoning & ODP** | Pattern Reasoning | `odp_suggester`, `neuro_symbolic_check` | `output/neuro_symbolic_report.md` |
| `ke_semantic_export` | **UC5: Enterprise Semantic Graph & RDF Export** | Interoperability & Graph | `export_semantic`, `okf_reindex` | `output/wiki_export.ttl` / `.jsonld` |
| `ke_maturity_eval` | **UC6: KE Platform Maturity Evaluation** | Platform Governance | `maturity_calculator`, `ke_maturity` | `output/ke_maturity_report.md` |
| `ke_docs_wiki_drift` | **UC7: Self-Documentation Wiki Drift** | Documentation Governance | `docs_wiki_drift` (rigenera la proiezione; mutante, F6-only; `--check` = report) | wiki OKF rigenerata da `docs/`, note curate preservate; rationale e fonti |
| `ke_wiki_program_change` | **UC8: Wiki-to-Program Change** | Documentation Governance | `wiki_program_change_propose` (read-only), `wiki_program_change_apply` (mutante, F6-only) | proposta in `output/program-changes/`; apply solo dopo approvazione umana |

### Integrazione UI & SSE Streaming
Nell'interfaccia Web in **👑 Developer Mode**, il pulsante **🧠 KE Workbench** apre la finestra modale guidata. È possibile eseguire l'intero workflow con un solo click (**▶ Esegui Tutti i Passaggi dell'Use Case**) oppure eseguire i singoli step con feedback in tempo reale via Server-Sent Events (SSE).

Il Workbench offre due tab: **🧩 Use Case** (gli 8 workflow guidati) e **🤖 Agenti & Schedule** (F4). Quest'ultima mostra una card per ogni job schedulato con ruolo, Use Case, cron leggibile, prossima corsa e ultimo esito; permette di abilitare/disabilitare il job, cambiare orario, avviarlo subito (**Esegui ora**) o annullare la corsa attiva. I log dell'esecuzione manuale appaiono nella Console Output con gli stessi eventi dell'endpoint SSE, mentre lo stream live aggiorna le card e la sidebar mostra gli ultimi run.

La sezione **Policy & Approvazioni** (F5/F6) della stessa tab mostra le decisioni recenti del Policy Agent con azione, origine (LLM o fallback), rationale e fonti, e gli step mutanti in attesa con pulsanti **✅ Approva** / **❌ Rifiuta**. Nessuno step che scrive nella wiki viene eseguito in automatico: dopo la creazione di una nota può partire un job dopo 5 minuti di debounce, ma lo step mutante resta in coda finché una persona non lo approva (con snapshot preventivi e audit dedicato).

La **Console Output** può essere nascosta con il pulsante **▾ / ▴ Console** (come per la barra laterale dei file) e ridimensionata trascinando il separatore sopra di essa: altezza e stato di chiusura vengono conservati in `localStorage` tra un'apertura e l'altra.

> **Manutenzione autonoma**: il piano per eseguire i 6 Use Case in automatico tramite agenti schedulati è confluito in `ROADMAP.md` (fase A10) e nella sezione operatoria qui sotto. Sono completate **F0** (runner condiviso), **F1** (configurazione `config/agent_schedule.toml` con sei job sicuri, tutti `auto_apply = false`), **F2** (motore `scheduler/scheduler.ts`: tick unico, lock PID, single-flight, retry con backoff 1m/5m, timeout con abort, stato atomico in `.wiki-forge/scheduler-state.json`, audit redatto in `output/scheduler/audit.jsonl`) e **F3**: lo scheduler è **attivo** nel processo API (`httpServer.ts`), collegato a `runUseCase()` tramite adapter e controllabile via `GET/PATCH /api/ke/schedule`, `POST /:id/run` (SSE con gli stessi eventi del Workbench), `POST /:id/cancel`, `GET /api/ke/schedule/runs` e `GET /api/ke/schedule/events`. I toggle runtime vengono salvati come override senza riscrivere il TOML. La tab **🤖 Agenti & Schedule** (F4) rende visibili job, esiti, log live e storico senza usare la riga di comando. Con **F5** il Policy Agent LLM è consultivo e fail-closed: ogni decisione finisce in `output/scheduler/decisions.jsonl` con rationale e fonti obbligatorie; gli script che scrivono (`suggest_tags`, `okf_reindex`, `maturity_calculator`) non vengono mai eseguiti automaticamente. Con **F6** eventi `note.created`/`note.modified`/`note.deleted` (webhook `POST /api/ke/schedule/trigger` o creazione note nell'UI) avviano un job dopo il debounce configurato (`debounce_seconds`, default 300) e gli step mutanti restano in attesa in `.wiki-forge/scheduler-approvals.json` fino ad approvazione umana via Workbench o `POST /api/ke/schedule/approvals/:id/approve`.

### Wiki di self-documentazione (Fase 70-75)
La documentazione `docs/` è proiettata in una wiki OKF v0.2 dedicata (`projects/wikiforge/wiki/`) e consultabile dal Research Studio con il pulsante **📚 Wiki Docs** (`Ctrl+Alt+W`), senza cambiare il vault attivo. Ogni risposta approvata può essere promossa a nota curata in `sintesi/` con `scripts/promote_doc_answer.py`, che richiede un `reviewer` umano (`verified: human:<id>`) ed è registrato come script mutante: il Policy Agent F5 non lo esegue mai in automatico. Il job `weekly-docs-wiki-drift` (UC7) rileva il drift tra `docs/` e la proiezione e la rigenera preservando le note curate; essendo mutante è bloccato dal Policy Agent F5 e richiede approvazione F6 per i run schedulati (`--check` dà solo un report consultivo con rationale e fonti). I percorsi relativi sono risolti rispetto alla radice del repository. Il funzionamento completo è descritto in [`SELF_WIKI.md`](../standard/SELF_WIKI.md).

### Review Studio per la governance della conoscenza
La **Review Studio** (`Ctrl+Alt+R/C/D/F`, tasto destro sulla nota o pulsante **🧐 Revisione**) offre al Knowledge Engineer un punto unico per:

- **Verifica**: quality gate deterministico (link, frontmatter OKF, tag, fonti, `stale_after`), storico delle verifiche e registrazione della revisione umana (stesso percorso di `/verify`);
- **Critica**: revisione avversariale con profondità e focus, utile prima di promuovere note a `stable` o di includerle in un capitolo di tesi;
- **Digest**: attività recenti e statistiche di salute, con prossime azioni;
- **Confronta versioni**: diff e ripristino dagli snapshot locali in `.wiki-forge/snapshots/` (25 per nota), indipendenti da git.

> **Nota operativa**: gli endpoint `/api/ke/*` sono serviti dal container `api`, che gira con `npx tsx` **senza hot-reload**. Dopo ogni modifica sotto `src/backend/server/**` esegui `docker compose restart api`, altrimenti la Web UI interroga un processo obsoleto e il pannello resta vuoto. Se l'API non risponde, il modal mostra un box di errore con messaggio ed endpoint in `#ke-usecase-list`.

---

## 3. Knowledge Engineer Maturity Model (L1–L4)

`wiki-forge` evaluates knowledge base platform maturity across 4 levels:

- **L1 - Knowledge Curator**: Basic organization, tags, and `[[wikilink]]` interlinking.
- **L2 - Knowledge Engineer**: Explicit taxonomy, semantic YAML frontmatter properties, W3C RDF export.
- **L3 - AI Knowledge Engineer**: Competency Question (CQ) validation engine, rule enforcement, MCP server integration for structured retrieval.
- **L4 - Cognitive / Agentic KE**: Autonomous agentic workflows suggesting Ontology Design Patterns (ODP), bridging neuro-symbolic reasoning, and identifying knowledge gaps.

Assess maturity using:
```bash
make ke-maturity
# or: python3 scripts/ke_maturity.py --json
```

---

## 4. Knowledge Modeling, Frontmatter Taxonomy & ODP

Every note in the knowledge base declares explicit YAML frontmatter conforming to OKF v0.2:

```yaml
---
okf_version: "0.2"
type: Concept           # Controlled vocabulary: Concept, Process, Entity, Event, Reference, ThesisChapter, Note
title: "Agentic Knowledge Engineering"
description: "Systematic design and curation of non-parametric LLM knowledge graphs."
status: stable          # Lifecycle status: draft, in-review, stable, deprecated
author: "human:alby69"
tags: [knowledge-engineering, llm, okf]
created: 2026-09-29
updated: 2026-09-29
stale_after: 2027-09-29
sources:
  - raw/agentic-ke.md#L10-L45
verified:
  - by: "human:alby69"
    date: 2026-09-29
    type: "manual-review"
employment:
  role: Employee
  contract_type: PartTime
  working_percentage: 60
  valid_from: "2024-01-01"
---
```

### Ontology Design Pattern (ODP) Suggester (`make suggest-odp`)
Scans notes with informal properties (e.g. `contract: PartTime`) and suggests frontmatter updates matching formal patterns in `config/odp_catalog.json`:
```bash
make suggest-odp
# or: python3 scripts/odp_suggester.py --json
```

---

## 5. Competency Questions (CQ) Validation Engine

An ontology or knowledge base is valid only if it can answer pre-defined Competency Questions (CQs). CQs are stored in `wiki/competency_questions.md`:

```bash
# Run CQ validation via Makefile or CLI
make validate-cq

# Or run with JSON output
python3 scripts/cq_validator.py --json
```

The report classifies CQs into:
- `✅ Coperte`: All required entities, relations, and structured properties exist.
- `⚠️ Parzialmente coperte`: Notes match but missing structured relations.
- `❌ Scoperte (knowledge gap)`: Concepts/entities missing from knowledge base.

---

## 6. Logical Ontology Validation & Neuro-Symbolic Reasoning

`wiki-forge` provides a multi-layered validation architecture:

### Layer A: Syntactic Linting (`make okf-lint`)
Ensures OKF frontmatter completeness, ISO 8601 dates, and actor formatting.

### Layer B: Logical Ontology Rule Engine (`make ontology-check`)
Enforces logical constraints (unlinked concepts, direct circular dependencies, stable note human verification).

### Layer C: Neuro-Symbolic Consistency Bridge (`make neuro-check`)
Bridges RDF graphs and LLM reasoning to detect logical contradictions and infer transitive semantic links:
```bash
make neuro-check
# or: python3 scripts/neuro_symbolic_check.py --json
```

---

## 7. Semantic Interoperability & External Ecosystems

### A. Model Context Protocol (MCP Server)
The MCP adapter (`src/backend/mcp/adapter.ts`, `bin/mcp.ts`) exposes tools generated from `COMMAND_MANIFEST.mcpTools` to external AI clients:
- `search_wiki(query)`, `get_concept_metadata(note_id)`, `get_line_anchored_citation(note_id, line_start, line_end)`: API-backed read tools.
- `list_trust_tiers()`, `get_version_history(note_id)`: OKF metadata and snapshot history.
- `validate_competency_question(question)`, `get_ontology_gaps()`, `execute_ke_use_case(use_case_id)`: delegated to the backend use-case kernel with honest status and SSE progress.

Start server:
```bash
make mcp-serve
```

Stdio client:
```bash
npm run mcp -- --project <id> --token <token>
```

**Current state (2026-11-25):** the tool list above is generated from the shared command manifest, which the MCP, CLI and UI adapters all consume; MCP exposes 120 tools from 112 HTTP routes and 166 bus handlers. The authoritative entrypoint is `bin/mcp.ts` (spawned by `wf mcp` as a child process) and `src/backend/server/mcp_server.py` is only a compatibility shim. Every dispatch is recorded by the central command audit, with the principal always present on the bus. `.wiki-forge/` is the unified state root for the Node runtime and the Python health/procedure engine: the Node StateStore remains in `.wiki-forge/state/`, and legacy `.wikiforge/` files are only handled by the explicit migration tool.

### B. W3C Semantic Export (RDF / JSON-LD / Turtle)
Export knowledge base into W3C RDF graph standards (`output/wiki_export.jsonld`, `output/wiki_export.ttl`):
```bash
make export-semantic
```

---

## 9. Maturity Ladder L1–L4 e procedure personalizzate

La scala operativa del KE Workbench usa quattro livelli progressivi con gate
verificabili:

| Livello | Nome | Criterio di gate |
|---|---|---|
| **L1** | Seeded | `wiki_articles > 0` e frontmatter OKF valido |
| **L2** | Structured | `shacl_violations == 0` e `broken_links == 0` |
| **L3** | Connected | `orphan_ratio < 0.05` e `ke_maturity_score >= 60` |
| **L4** | Trusted | `cq_gaps == 0` e tutte le note `stable` con `verified: human:*` |

Per la valutazione usare `/ke-maturity` in chat, il comando
`python3 scripts/ke_maturity.py --json` o l'endpoint Python
`GET /api/v1/health` per lo Health Score 0-100 con azioni successive. I due
percorsi usano la radice unica `.wiki-forge/` (Node in `state/`, Python in
`health/` e `procedures/`); i vecchi file `.wikiforge/` sono gestiti solo da
`scripts/migrate_state_roots.py`, con backup e rollback.

### Procedure TOML personalizzate

Le procedure risiedono in `config/procedures/<id>.toml` e sono eseguite dal
Procedure Engine descritto in `PROCEDURES.md`. Uno schema minimo:

```toml
id = "ke.custom-check"
title = "Custom Domain Check"
role = "ke"
description = "Runs custom domain checks"
requires = ["ke.bootstrap"]

[exit_criteria]
metric = "shacl_violations"
op = "=="
value = 0

[[steps]]
id = "scan"
kind = "auto"
script = "shacl_validator.py"
title = "Run SHACL Scan"

[[steps]]
id = "review"
kind = "review"
title = "Review Warnings"
```

Ogni step `review` è una pausa umana: nessuna procedura può promuovere una nota
a `stable` senza registrazione di un revisore umano.
