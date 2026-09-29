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

## 2. Knowledge Engineer Maturity Model (L1–L4)

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

## 3. Knowledge Modeling, Frontmatter Taxonomy & ODP

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

## 4. Competency Questions (CQ) Validation Engine

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

## 5. Logical Ontology Validation & Neuro-Symbolic Reasoning

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

## 6. Semantic Interoperability & External Ecosystems

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
