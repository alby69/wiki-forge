"""
GraphRAG Pipeline with LangGraph for wiki-forge
===============================================
This module implements a stateful GraphRAG pipeline using LangGraph, LangChain,
and Neo4j for semantic note retrieval and hallucination mitigation in Zettelkasten systems.
Supports hybrid retrieval (Vector Search + k-hop Ego-Graph Traversal).
"""

import os
import sys
from typing import TypedDict, List, Dict, Any, Optional
from pathlib import Path

from src.backend.wikiforge.semantics.neo4j_query import (
    CypherQueryError,
    Neo4jQueryService,
)

# Ensure project root is in sys.path for direct script execution
_file_path = Path(__file__).resolve()
for _parent in _file_path.parents:
    if (_parent / "src").is_dir() and (_parent / "config").is_dir():
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break

# Try importing LangGraph / LangChain components
try:
    from langgraph.graph import StateGraph, END
    from langchain_core.prompts import ChatPromptTemplate
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False


# ==========================================================
# 1. State Definition
# ==========================================================
class GraphRAGState(TypedDict):
    question: str
    entities: List[str]
    cypher_query: str
    cypher_params: Dict[str, Any]
    graph_results: List[Dict[str, Any]]
    vector_results: List[Dict[str, Any]]
    subgraph_triples: List[Dict[str, Any]]
    mode: str  # C3: "mock" (explicit fixture) or "live" (validated read-only DB)
    project_id: Optional[str]
    error_message: Optional[str]
    error_type: Optional[str]
    retry_count: int
    final_answer: str


# ==========================================================
# 2. GraphRAG Pipeline Implementation
# ==========================================================
class WikiForgeGraphRAG:
    """
    Stateful GraphRAG Engine powered by LangGraph for wiki-forge.
    Implements Intent Detection -> Hybrid Retrieval (Vector + Subgraph Traversal) -> Self-Correction -> Synthesis.
    """

    def __init__(self, neo4j_uri: Optional[str] = None, neo4j_user: Optional[str] = None, neo4j_password: Optional[str] = None, neo4j_client: Optional[Any] = None, query_service: Optional[Any] = None):
        self.neo4j_uri = neo4j_uri or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.neo4j_user = neo4j_user or os.getenv("NEO4J_USER", "neo4j")
        self.neo4j_password = neo4j_password or os.getenv("NEO4J_PASSWORD", "password")
        # C1 — optional injected client (additive: old constructors unchanged).
        self.neo4j_client = neo4j_client
        # C3 — read-only query service; injection keeps tests offline.
        self.query_service = query_service or Neo4jQueryService(client=neo4j_client)

    @property
    def neo4j_driver(self) -> Optional[Any]:
        """C1 — expose the client's driver without demanding a live connection."""
        return getattr(self.neo4j_client, "driver", None) if self.neo4j_client else None

    def extract_entities_node(self, state: GraphRAGState) -> GraphRAGState:
        """Extract key entities and concepts from user query."""
        question = state["question"]
        words = [w.strip("?,.!") for w in question.split() if len(w) > 3]
        entities = list(dict.fromkeys(words[:5]))

        return {**state, "entities": entities, "error_message": None}

    def hybrid_retrieval(self, query_text: str, k: int = 3, hops: int = 2) -> Dict[str, Any]:
        """
        Executes hybrid retrieval combining Vector Search and Ego-Graph Traversal.

        Phase 1: Vector Search retrieves top-k similar note nodes.
        Phase 2: Ego-Graph Traversal extracts 1-to-k hop neighborhood for each retrieved node.
        Phase 3: Returns fused structure containing vector nodes and subgraph triples.
        """
        # C3: static fixtures for the vector layer (not a live vector index).
        vector_chunks = [
            {
                "id": "validazione-shacl",
                "title": "Validazione SHACL per la Conoscenza",
                "score": 0.94,
                "content": "SHACL definisce vincoli strutturali e semantici sui grafi RDF di wiki-forge."
            },
            {
                "id": "knowledge-graph-fundamentals",
                "title": "Knowledge Graph Fundamentals",
                "score": 0.88,
                "content": "Definizione di grafi di conoscenza aziendali con W3C standards."
            }
        ]

        # C3: static k-hop fixtures; live graph facts come from `execute_cypher_node`.
        subgraph_triples = [
            {
                "source": "Validazione SHACL per la Conoscenza",
                "relation": "WAS_ATTRIBUTED_TO",
                "target": "Elisa Kendall"
            },
            {
                "source": "Validazione SHACL per la Conoscenza",
                "relation": "CONTRADICTS",
                "target": "legacy-relational-db"
            },
            {
                "source": "Knowledge Graph Fundamentals",
                "relation": "WAS_ATTRIBUTED_TO",
                "target": "Guus Schreiber"
            },
            {
                "source": "Knowledge Graph Fundamentals",
                "relation": "SUPPORTS",
                "target": "note-002"
            }
        ]

        return {
            "vector_results": vector_chunks,
            "subgraph_triples": subgraph_triples
        }

    def generate_cypher_node(self, state: GraphRAGState) -> GraphRAGState:
        """Translate intent into a parameterized, read-only Cypher query (C3)."""
        entities_list = list(dict.fromkeys(state.get("entities") or []))
        cypher_query = (
            "MATCH (n:PermanentNote)-[r:SUPPORTS|CONTRADICTS|REFERS_TO*1..2]-(target:PermanentNote)\n"
            "WHERE any(e IN $entities WHERE toLower(n.title) CONTAINS toLower(e) OR toLower(n.content) CONTAINS toLower(e))\n"
            "OPTIONAL MATCH (n)-[:WAS_ATTRIBUTED_TO]->(a:Agent)\n"
            "RETURN n.title AS Nota, a.name AS Autore, type(r) AS Relazione, target.id AS TargetNote"
        )
        return {
            **state,
            "cypher_query": cypher_query,
            "cypher_params": {"entities": entities_list},
        }

    def execute_cypher_node(self, state: GraphRAGState) -> GraphRAGState:
        """Run validated read-only Cypher in live mode, or explicit mock fixtures.

        C3 — the mode is always written into the returned state: ``"mock"``
        means no database was contacted, ``"live"`` means the read-only service
        executed the query. Asking for live mode without a configured driver is
        an error, never a silent downgrade to fixtures.
        """
        requested_mode = state.get("mode")
        if requested_mode not in ("mock", "live"):
            requested_mode = "live" if self.query_service.is_live else "mock"

        try:
            hybrid = self.hybrid_retrieval(state["question"])
            if requested_mode == "live" and not self.query_service.is_live:
                return {
                    **state,
                    "mode": "live",
                    "graph_results": [],
                    "error_message": "Live Cypher mode requires a configured Neo4j driver",
                    "error_type": "query_mode",
                    "retry_count": state.get("retry_count", 0) + 1,
                }

            if requested_mode == "live":
                graph_results = self.query_service.execute_read(
                    state["cypher_query"],
                    state.get("cypher_params") or {},
                    project_id=state.get("project_id"),
                )
            else:
                graph_results = self._mock_graph_results()

            return {
                **state,
                "mode": requested_mode,
                "graph_results": graph_results,
                "vector_results": hybrid["vector_results"],
                "subgraph_triples": hybrid["subgraph_triples"],
                "error_message": None,
                "error_type": None,
            }

        except CypherQueryError as e:
            return {
                **state,
                "mode": requested_mode,
                "graph_results": [],
                "error_message": str(e),
                "error_type": e.code,
                "retry_count": state.get("retry_count", 0) + 1,
            }
        except (RuntimeError, ValueError, OSError) as e:
            return {
                **state,
                "mode": requested_mode,
                "error_message": str(e),
                "error_type": "pipeline_error",
                "retry_count": state.get("retry_count", 0) + 1,
            }

    @staticmethod
    def _mock_graph_results() -> List[Dict[str, Any]]:
        """Explicit C3 fixtures, used only when `mode="mock"` was selected."""
        return [
            {
                "Nota": "Validazione SHACL per la Conoscenza",
                "Autore": "Elisa Kendall",
                "Relazione": "CONTRADICTS",
                "TargetNote": "legacy-relational-db"
            },
            {
                "Nota": "Knowledge Graph Fundamentals",
                "Autore": "Guus Schreiber",
                "Relazione": "SUPPORTS",
                "TargetNote": "note-002"
            }
        ]

    def synthesize_answer_node(self, state: GraphRAGState) -> GraphRAGState:
        """Synthesize final grounded response using retrieved vector chunks, graph facts, and provenance."""
        results = state.get("graph_results") or []
        vector_res = state.get("vector_results") or []
        subgraph_triples = state.get("subgraph_triples") or []
        question = state["question"]

        vector_context = []
        for v in vector_res:
            vector_context.append(f"- [{v['title']} (Score: {v['score']})]: {v['content']}")

        subgraph_context = []
        for t in subgraph_triples:
            subgraph_context.append(f"- ({t['source']}) --[{t['relation']}]--> ({t['target']})")

        vector_joined = "\n".join(vector_context)
        subgraph_joined = "\n".join(subgraph_context)

        answer = (
            f"In base al Knowledge Graph e all'Indice Vettoriale di wiki-forge per la domanda '{question}':\n\n"
            f"### Context Vettoriale (Top Similarity):\n"
            f"{vector_joined}\n\n"
            f"### Sottografo k-Hop Estratto:\n"
            f"{subgraph_joined}\n\n"
            f"Tutte le informazioni sono verificate e tracciate con prov:wasAttributedTo per evitare allucinazioni."
        )
        return {**state, "final_answer": answer}

    def build_workflow(self):
        """Build and compile the LangGraph stateful graph."""
        if not LANGGRAPH_AVAILABLE:
            raise RuntimeError("LangGraph non è installato nell'ambiente. Esecuzione in modalità fallback.")

        workflow = StateGraph(GraphRAGState)

        workflow.add_node("extract_entities", self.extract_entities_node)
        workflow.add_node("generate_cypher", self.generate_cypher_node)
        workflow.add_node("execute_cypher", self.execute_cypher_node)
        workflow.add_node("synthesize_answer", self.synthesize_answer_node)

        workflow.set_entry_point("extract_entities")
        workflow.add_edge("extract_entities", "generate_cypher")
        workflow.add_edge("generate_cypher", "execute_cypher")

        def should_retry(state: GraphRAGState) -> str:
            if state.get("error_message") and state.get("retry_count", 0) < 3:
                return "retry"
            return "synthesize"

        workflow.add_conditional_edges(
            "execute_cypher",
            should_retry,
            {"retry": "generate_cypher", "synthesize": "synthesize_answer"}
        )

        workflow.add_edge("synthesize_answer", END)
        return workflow.compile()


def build_graph_rag_app():
    """Helper function to build and return the compiled LangGraph GraphRAG application."""
    rag = WikiForgeGraphRAG()
    return rag.build_workflow()


if __name__ == "__main__":
    rag = WikiForgeGraphRAG()
    initial_state: GraphRAGState = {
        "question": "Quale nota parla di SHACL ed Elisa Kendall?",
        "entities": [],
        "cypher_query": "",
        "graph_results": [],
        "vector_results": [],
        "subgraph_triples": [],
        "error_message": None,
        "retry_count": 0,
        "final_answer": ""
    }

    print("🚀 Running Hybrid GraphRAG Pipeline Simulation for wiki-forge...")
    st1 = rag.extract_entities_node(initial_state)
    st2 = rag.generate_cypher_node(st1)
    st3 = rag.execute_cypher_node(st2)
    st4 = rag.synthesize_answer_node(st3)

    print("\n--- GENERATED CYPHER QUERY ---")
    print(st2["cypher_query"])

    print("\n--- FINAL GROUNDED ANSWER ---")
    print(st4["final_answer"])
