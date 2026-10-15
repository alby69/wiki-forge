"""
Wiki-Forge Semantics Package.

Provides semantic knowledge graph modeling, Zettelkasten-to-KG mapping,
CQ engine & SHACL validation, multi-layered view shortcut materialization,
GraphRAG provenance retrieval, and stateful LangGraph GraphRAG pipeline.
"""

from .markdown_parser import (
    ParsedNote,
    SemanticLink,
    mint_uri,
    parse_markdown_content,
    parse_markdown_file,
)
from .rdf_exporter import (
    build_rdf_graph,
    export_to_turtle,
    export_to_ntriples,
    export_to_cypher,
    export_all_formats,
)
from .markdown_to_rdf import (
    ZettelToRDFConverter,
    escape_ttl_string,
    slugify as slugify_ttl,
)
from .markdown_to_cypher import (
    ZettelToCypherConverter,
    escape_cypher_string,
    slugify as slugify_cypher,
)
from .shacl_validator import (
    validate_shacl,
    apply_owl_reasoning,
    check_owl_disjointness_violations,
)
from .cq_engine import (
    CQEngine,
    CQTestCase,
    CQTestResult,
    CQSuiteResult,
)
from .shortcut_engine import (
    ShortcutEngine,
    DEFAULT_SHORTCUT_RULES,
)
from .provenance import (
    ProvenanceRecord,
    attach_provenance_triples,
    extract_provenance_records,
)
from .graph_rag import (
    GraphRAGPipeline,
    RetrievedSubgraph,
    SubgraphNode,
    SubgraphEdge,
)
from .graph_rag_pipeline import (
    WikiForgeGraphRAG,
    GraphRAGState,
    build_graph_rag_app,
)

__all__ = [
    "ParsedNote",
    "SemanticLink",
    "mint_uri",
    "parse_markdown_content",
    "parse_markdown_file",
    "build_rdf_graph",
    "export_to_turtle",
    "export_to_ntriples",
    "export_to_cypher",
    "export_all_formats",
    "ZettelToRDFConverter",
    "ZettelToCypherConverter",
    "validate_shacl",
    "apply_owl_reasoning",
    "check_owl_disjointness_violations",
    "CQEngine",
    "CQTestCase",
    "CQTestResult",
    "CQSuiteResult",
    "ShortcutEngine",
    "DEFAULT_SHORTCUT_RULES",
    "ProvenanceRecord",
    "attach_provenance_triples",
    "extract_provenance_records",
    "GraphRAGPipeline",
    "RetrievedSubgraph",
    "SubgraphNode",
    "SubgraphEdge",
    "WikiForgeGraphRAG",
    "GraphRAGState",
    "build_graph_rag_app",
]
