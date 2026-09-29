# Enterprise Semantic Knowledge Graph & Stateful GraphRAG System

This guide describes the **Enterprise Semantic Knowledge Graph & Stateful GraphRAG System** implemented in `wiki-forge`.

---

## 1. Architecture Overview

`wiki-forge` transforms Markdown-based Zettelkasten notes into a dual-representation Knowledge Graph:
1. **W3C Semantic Web Graph (RDF/Turtle):** Formally validated using W3C SHACL shapes (`src/wikiforge/config/shapes.ttl`) for interoperability, reasoning, and data quality enforcement.
2. **Labeled Property Graph (Neo4j Cypher):** Idempotent Cypher scripts (`CREATE CONSTRAINT`, `MERGE`) for fast graph traversal and pathfinding.
3. **Stateful GraphRAG Pipeline (LangGraph):** Agentic Retrieval-Augmented Generation featuring Entity Extraction, Text-to-Cypher translation, Neo4j execution, conditional self-correction error recovery, and grounded synthesis with PROV-O provenance citations.

---

## 2. Directory & Module Structure

```
src/wikiforge/
├── config/
│   └── shapes.ttl               # W3C SHACL Validation Shapes
└── semantics/
    ├── markdown_to_rdf.py       # Zettelkasten -> W3C Turtle RDF Mapper
    ├── markdown_to_cypher.py    # Zettelkasten -> Neo4j Cypher Exporter
    ├── shacl_validator.py       # SHACL & OWL Reasoning Engine
    └── graph_rag_pipeline.py    # Stateful LangGraph GraphRAG Engine
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

## 4. Converters & CLI Usage

### RDF Turtle Conversion
Convert a directory of Markdown notes into a W3C Turtle RDF Knowledge Graph:
```bash
python src/wikiforge/semantics/markdown_to_rdf.py --input ./wiki --output ./knowledge_graph.ttl
```

### Neo4j Cypher Script Generation
Generate an idempotent Cypher script for loading into Neo4j:
```bash
python src/wikiforge/semantics/markdown_to_cypher.py --input ./wiki --output ./knowledge_graph.cypher
```

---

## 5. Stateful GraphRAG Pipeline (`graph_rag_pipeline.py`)

The GraphRAG engine uses **LangGraph** to process user queries through a multi-stage state machine:

1. **`extract_entities_node`**: Extracts key concepts, note titles, and author names from the question.
2. **`generate_cypher_node`**: Translates user intent into a schema-compliant Cypher query targeting `(:PermanentNote)` and `(:Agent)` nodes.
3. **`execute_cypher_node`**: Runs the Cypher query against Neo4j (or mock graph engine).
4. **Conditional Self-Correction Routing (`should_retry_or_synthesize`)**: If query execution returns an error and `retry_count < 3`, the pipeline routes back to `generate_cypher_node` with error context for self-correction.
5. **`synthesize_answer_node`**: Synthesizes a grounded response citing note titles and author attributions (PROV-O).

### Example Execution
```bash
python src/wikiforge/semantics/graph_rag_pipeline.py
```

---

## 6. GitHub Actions CI/CD Pipeline (`.github/workflows/shacl_validation.yml`)

The repository includes an automated CI/CD pipeline that:
1. Converts Markdown notes in `wiki/` to `knowledge_graph.ttl`.
2. Validates the graph against `src/wikiforge/config/shapes.ttl` using `pyshacl`.
3. Exports `knowledge_graph.cypher`.
4. Uploads graph files as workflow build artifacts.
