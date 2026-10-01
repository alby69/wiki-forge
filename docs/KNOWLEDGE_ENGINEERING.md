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

`wiki-forge` offre un **Pannello di Controllo guidato per il Knowledge Engineer (KE Workbench)** e REST API dedicate (`/api/ke/use-cases` e `/api/ke/use-cases/execute`) che guidano l'Ingegnere della Conoscenza nell'esecuzione dei **6 Use Case professionali** fondamentali per la gestione del ciclo di vita della conoscenza:

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

### Integrazione UI & SSE Streaming
Nell'interfaccia Web in **👑 Developer Mode**, il pulsante **🧠 KE Workbench** apre la finestra modale guidata. È possibile eseguire l'intero workflow con un solo click (**▶ Esegui Tutti i Passaggi dell'Use Case**) oppure eseguire i singoli step con feedback in tempo reale via Server-Sent Events (SSE).

> **Nota operativa**: gli endpoint `/api/ke/*` sono serviti dal container `api`, che gira con `npx tsx` **senza hot-reload**. Dopo ogni modifica sotto `src/server/**` esegui `docker compose restart api`, altrimenti la Web UI interroga un processo obsoleto e il pannello resta vuoto. Se l'API non risponde, il modal mostra un box di errore con messaggio ed endpoint in `#ke-usecase-list`.

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
The MCP server (`src/server/mcp_server.py`) exposes tools to external AI clients:
- `search_wiki(query)`: Search notes.
- `get_concept_metadata(note_id)`: Retrieve metadata and trust tier.
- `get_line_anchored_citation(note_id, start_line, end_line)`: Grounded passage retrieval.
- `validate_competency_question(question)`: CQ coverage status.
- `get_ontology_gaps()`: Active ODP suggestions and logical contradictions.

Start server:
```bash
make mcp-serve
```

### B. W3C Semantic Export (RDF / JSON-LD / Turtle)
Export knowledge base into W3C RDF graph standards (`output/wiki_export.jsonld`, `output/wiki_export.ttl`):
```bash
make export-semantic
```
