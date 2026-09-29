---
name: wiki-ke-ontology
description: Knowledge Engineering & Ontology Suite for Competency Questions (CQ) validation, Ontology Design Pattern (ODP) suggestions, Neuro-Symbolic consistency checking, and KE Maturity Assessment.
triggers:
  commands:
    - validate-cq
    - suggest-odp
    - neuro-check
    - ke-maturity
---

# 🛠️ Wiki Knowledge Engineering & Ontology Skill (`wiki-ke-ontology`)

This skill package provides AI Knowledge Engineers with automated tooling based on Knowledge Representation principles, Ontology Design Patterns (ODP), and Neuro-Symbolic graph reasoning.

## Capabilities & Workflows

### 1. Competency Questions (CQ) Validation (`/validate-cq`)
Validates whether the knowledge base contains necessary entities, relations, and rules to answer natural language CQs.
- **CLI / Script**: `python3 scripts/cq_validator.py [--json]`
- **Makefile Target**: `make validate-cq`
- **Output Report**: `output/cq_validation_report.md`

### 2. Ontology Design Pattern (ODP) Suggester (`/suggest-odp`)
Scans informal YAML frontmatter and note content to suggest formal Ontology Design Patterns (Employment, Temporal Properties, Situations, Classifications).
- **CLI / Script**: `python3 scripts/odp_suggester.py [--json]`
- **Makefile Target**: `make suggest-odp`
- **Catalog**: `config/odp_catalog.json`

### 3. Neuro-Symbolic Consistency Bridge (`/neuro-check`)
Bridges explicit RDF Knowledge Representation and LLM neuro-symbolic reasoning to identify logical contradictions and infer missing transitive links across the graph.
- **CLI / Script**: `python3 scripts/neuro_symbolic_check.py [--json]`
- **Makefile Target**: `make neuro-check`
- **Output Report**: `output/neuro_symbolic_report.md`

### 4. KE Maturity Assessment (`/ke-maturity`)
Evaluates platform maturity across 6 competency dimensions (L1 Knowledge Curator → L4 Cognitive/Agentic KE) with quantitative metrics and action plans.
- **CLI / Script**: `python3 scripts/ke_maturity.py [--json]`
- **Makefile Target**: `make maturity`
- **Output Report**: `output/ke_maturity_report.md`
