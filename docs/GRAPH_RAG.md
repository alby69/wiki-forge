# Enterprise Semantic Knowledge Graph & Stateful GraphRAG System

This guide describes the **Enterprise Semantic Knowledge Graph & Stateful GraphRAG System** implemented in `wiki-forge`.

---

## 1. Architecture Overview

`wiki-forge` transforms Markdown-based Zettelkasten notes into a dual-representation Knowledge Graph:
1. **W3C Semantic Web Graph (RDF/Turtle + RDF-star):** Formally validated using W3C SHACL shapes (`src/wikiforge/config/shapes.ttl`) for interoperability, reasoning, RDF-star edge metadata (`<< s p o >>`), and data quality enforcement.
2. **Labeled Property Graph (Neo4j Cypher):** Idempotent Cypher scripts (`CREATE CONSTRAINT`, `MERGE`) for fast graph traversal and pathfinding.
3. **Multi-Layered View & Shortcut Engine:** SPARQL CONSTRUCT rules & Cypher queries to materialize simplified direct relations (`wf:directCoAuthor`, `wf:agent`, `wf:role`).
4. **Incremental Event-Driven File Watcher:** Live filesystem watcher (`watchdog`) for instant synchronization of created, modified, or deleted notes into Neo4j/RDF graphs.
5. **Hybrid GraphRAG Pipeline (LangGraph):** Agentic Retrieval-Augmented Generation featuring Vector Search + k-hop Ego-Graph Traversal, Text-to-Cypher translation, conditional self-correction error recovery, and grounded synthesis with PROV-O provenance citations.
6. **FastAPI REST API & Unified CLI:** Programmatic REST endpoints (`/api/v1/graph/sync`, `/api/v1/graph/validate`, `/api/v1/graph/rag`) and CLI commands (`python3 -m src.wikiforge.cli`).

---

## 2. Directory & Module Structure

```
src/wikiforge/
├── api/
│   └── api_server.py            # FastAPI REST API Server
├── cli.py                       # Unified CLI Interface
├── watcher/
│   └── graph_watcher.py         # Incremental Live File Watcher (watchdog)
├── config/
│   └── shapes.ttl               # W3C SHACL Validation Shapes
└── semantics/
    ├── markdown_to_rdf.py       # Zettelkasten -> W3C Turtle RDF + RDF-star Mapper
    ├── markdown_to_cypher.py    # Zettelkasten -> Neo4j Cypher Exporter
    ├── shortcut_engine.py       # Multi-Layered View & Shortcut Materialization Engine
    ├── cq_engine.py             # Competency Questions Core Engine
    ├── cq_runner.py             # Competency Questions Test Runner & Report Generator
    ├── shacl_validator.py       # SHACL & OWL Reasoning Engine
    └── graph_rag_pipeline.py    # Hybrid Stateful LangGraph GraphRAG Engine
```

---

## 3. W3C SHACL Validation Schema (`shapes.ttl`)

Located at `src/wikiforge/config/shapes.ttl`, this schema enforces mandatory structural and semantic rules on all Permanent Notes (`wf:PermanentNote`) and Author Agents (`prov:Agent` / `foaf:Agent`):
- **`dcterms:identifier`**: Required unique slug identifier matching `^[a-z0-9-]+$`.
- **`dcterms:title`**: Required title literal of at least 3 characters.
- **`dcterms:created`**: Required ISO date formatted `YYYY-MM-DD`.
- **`wf:content`**: Required text body.
- **`prov:wasAttributedTo`**: Required IRI referencing a valid author agent (`prov:Agent`).
- **Semantic Link Constraints:** `wf:supports`, `wf:contradicts`, and `wf:refersTo` relationships must exclusively target valid `wf:PermanentNote` IRIs.

---

## 4. Converters, REST API & CLI Usage

### Unified CLI
Execute system capabilities directly from terminal:
```bash
# Validate RDF graph against SHACL shapes
python3 -m src.wikiforge.cli validate-shacl --graph knowledge_graph.ttl --shapes src/wikiforge/config/shapes.ttl

# Query Knowledge Graph via Hybrid GraphRAG
python3 -m src.wikiforge.cli query-rag "Quali note trattano di SHACL?"

# Synchronize Markdown notes to RDF Turtle and Cypher
python3 -m src.wikiforge.cli sync-graph --input wiki --output knowledge_graph.ttl

# Run Competency Questions (CQ) test suite
python3 -m src.wikiforge.cli run-cq --suite tests/competency_questions/cqs.yml
```

### FastAPI REST Server
Launch the REST server on port 8000:
```bash
python3 src/wikiforge/api/api_server.py
```
Available endpoints:
- `POST /api/v1/graph/sync`: Syncs Markdown folder to RDF graph.
- `POST /api/v1/graph/validate`: Runs SHACL validation and returns JSON report.
- `POST /api/v1/graph/rag`: GraphRAG query endpoint returning grounded answers.

---

## 5. Hybrid GraphRAG Pipeline (`graph_rag_pipeline.py`)

The GraphRAG engine uses **LangGraph** to process user queries through a multi-stage state machine:

1. **`extract_entities_node`**: Extracts key concepts, note titles, and author names from the question.
2. **`hybrid_retrieval`**:
   - **Phase 1 (Vector Search):** Retrieves top-k similar note nodes.
   - **Phase 2 (Ego-Graph Traversal):** Extracts 1-to-k hop neighborhood for each retrieved node (`MATCH (n)-[r*1..2]-(m)`).
   - **Phase 3 (Context Fusion):** Fuses vector text chunks and graph triples.
3. **`generate_cypher_node`**: Translates user intent into a schema-compliant Cypher query.
4. **`execute_cypher_node`**: Runs Cypher query and hybrid retrieval against database.
5. **Conditional Self-Correction Routing (`should_retry_or_synthesize`)**: Auto-corrects query errors up to 3 retries.
6. **`synthesize_answer_node`**: Synthesizes a grounded response citing note titles and author attributions (PROV-O).

---

## 6. Competency Questions Test Runner & Live File Watcher

### Competency Questions (CQ) Suite
Declarative CQs in YAML (`tests/competency_questions/cqs.yml`) verify graph domain coverage:
```bash
python3 src/wikiforge/semantics/cq_runner.py --suite tests/competency_questions/cqs.yml --graph knowledge_graph.ttl
```

### Live File Watcher
Monitors `wiki/` directory changes in real time:
```bash
python3 src/wikiforge/watcher/graph_watcher.py wiki
```

---

## 7. GitHub Actions CI/CD Pipeline (`.github/workflows/shacl_validation.yml`)

The repository includes an automated CI/CD pipeline that:
1. Converts Markdown notes in `wiki/` to `knowledge_graph.ttl`.
2. Validates the graph against `src/wikiforge/config/shapes.ttl` using `pyshacl`.
3. Exports `knowledge_graph.cypher`.
4. Runs unit tests and uploads graph build artifacts.
