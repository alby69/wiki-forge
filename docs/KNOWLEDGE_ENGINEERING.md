# Knowledge Engineering Operating Manual

> Operational guide for Knowledge Engineers using `wiki-forge` to build, model, validate, interoperate, and maintain open knowledge bases based on OKF v0.2.

---

## 1. Overview & Role Definition

In `wiki-forge`, the LLM agent and human operator collaborate as **Knowledge Engineers (KE)**. Rather than answering transient questions from raw files on every query (classic RAG), the system constructs and maintains a persistent, interlinked, non-parametric knowledge graph stored as plain Markdown files adhering to **Open Knowledge Format (OKF v0.2)**.

The Knowledge Engineering lifecycle comprises four primary dimensions:
1. **Knowledge Modeling & Construction**: Defining domain schemas, controlled vocabularies, and frontmatter taxonomy.
2. **Quality Verification & Logical Validation**: Combining syntactic linting (`okf_lint.py`) and logical ontology rule validation (`ontology_rules.py`).
3. **Semantic Interoperability**: Exposing structured knowledge to external AI agent ecosystems via Model Context Protocol (MCP) and exporting W3C standard RDF graphs (JSON-LD and Turtle/TTL).
4. **Lifecycle & Concept Drift Management**: Monitoring trust tiers, freshness (`stale_after`), maturity scores (`maturity_calculator.py`), and historical snapshots (`versioning.py`).

---

## 2. Knowledge Modeling & Frontmatter Taxonomy

Knowledge modeling begins by configuring domain presets in `config/scenarios.toml` or `config.toml`. Every note in the knowledge base must declare explicit YAML frontmatter conforming to OKF v0.2:

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
---
```

---

## 3. Logical Ontology Validation & Linting

`wiki-forge` provides a dual-layer validation engine:

### Layer A: Syntactic Linting (`make okf-lint`)
Runs `scripts/okf_lint.py` to ensure:
- Required YAML frontmatter keys are present (`type`, `title`, `description`, `status`, `generated`).
- ISO 8601 dates and proper actor formatting (`human:<id>`, `process:<id>`).
- Reserved index files (`index.md` per OKF §8 and `log.md` per OKF §9).

### Layer B: Logical Ontology Rule Engine (`make ontology-check`)
Runs `scripts/ontology_rules.py` to enforce formal logical graph constraints:
- **Rule 1 (Concept Linkage)**: Every note declared with `type: Concept` must have at least one incoming or outgoing `[[wikilink]]` to prevent unlinked, isolated concepts.
- **Rule 2 (Direct Circular Dependency Detection)**: Detects direct circular dependencies between notes (e.g., Note A links to Note B and Note B links to Note A), flagging potential logical redundancies or circular reasoning.
- **Rule 3 (Human Review Requirement for Stable Status)**: Every note promoted to `status: stable` must contain at least one verification entry in `verified` attributed to a human actor (`human:*`).

```bash
# Run ontology rules check via CLI or Makefile
make ontology-check

# Run with JSON output for automated CI integration
python3 scripts/ontology_rules.py wiki/ --json --strict
```

---

## 4. Semantic Interoperability & External Ecosystems

`wiki-forge` provides native integration with external AI agent ecosystems and ontology tools:

### A. Model Context Protocol (MCP Server)
The native MCP server (`src/server/mcp_server.py`) allows external AI clients (e.g., Claude Desktop, IDE extensions, or custom agent frameworks) to query and inspect the wiki safely:
- `search_wiki(query)`: Search notes by title, content, or tags.
- `get_concept_metadata(note_id)`: Retrieve OKF metadata, trust tier, and backlinks.
- `get_line_anchored_citation(note_id, start_line, end_line)`: Extract grounded passage text.

Start the MCP server with:
```bash
make mcp-serve
```

### B. W3C Semantic Export (RDF / JSON-LD / Turtle)
Export the entire knowledge base into W3C semantic graph standards for visualization in Protégé, GraphDB, or SPARQL query engines:
- Generates `output/wiki_export.jsonld` (JSON-LD context and graph).
- Generates `output/wiki_export.ttl` (Turtle RDF graph).

```bash
# Run semantic export via Makefile
make export-semantic

# Or execute script directly
python3 scripts/export_semantic.py --wiki-dir wiki --output-dir output
```

---

## 5. Lifecycle Maintenance & Concept Drift Management

To prevent knowledge obsolescence (concept drift) and maintain high KB quality:

1. **Expiration Tracking**: Monitor notes approaching or exceeding `stale_after` dates.
2. **Maturity Indexing**: Execute `python3 scripts/maturity_calculator.py wiki --write` to update maturity scores (0–100) based on citation density, backlink completeness, and structure.
3. **Incremental Versioning & Safety Rollback**: Inspect version history and execute `/rollback note=<note-id> to=v1` whenever bad synthesis or regression occurs.
4. **Audit & Reindexing**: Periodically run `make audit` and `make reindex` to eliminate broken links, re-evaluate backlinks, and update thematic index files.
