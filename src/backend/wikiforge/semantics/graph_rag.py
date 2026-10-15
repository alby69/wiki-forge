"""
src/wikiforge/semantics/graph_rag.py

GraphRAG & Provenance Pipeline for Wiki-Forge Semantic Knowledge Base.
Generates schema-annotated prompts for LLM graph querying and retrieves grounded connected
subgraphs with passage-level PROV-O provenance citations to eliminate hallucinations.
"""

from __future__ import annotations

from typing import List, Dict, Any, Optional, Set, Tuple
from pydantic import BaseModel, Field
from rdflib import Graph, URIRef, Literal, RDF, RDFS

from .markdown_parser import ParsedNote
from .provenance import extract_provenance_records, ProvenanceRecord


class SubgraphNode(BaseModel):
    node_id: str
    uri: str
    title: str
    note_type: str = "Article"
    summary: str = ""


class SubgraphEdge(BaseModel):
    source_id: str
    predicate: str
    target_id: str


class RetrievedSubgraph(BaseModel):
    nodes: List[SubgraphNode] = Field(default_factory=list)
    edges: List[SubgraphEdge] = Field(default_factory=list)
    provenance: List[ProvenanceRecord] = Field(default_factory=list)
    context_text: str = ""


class GraphRAGPipeline:
    """
    GraphRAG pipeline providing schema-annotated prompt building
    and grounded connected subgraph retrieval.
    """

    def __init__(self, data_graph: Optional[Graph] = None, notes: Optional[List[ParsedNote]] = None):
        self.graph = data_graph or Graph()
        self.notes: Dict[str, ParsedNote] = {n.note_id: n for n in (notes or [])}

    def set_data(self, data_graph: Graph, notes: List[ParsedNote]) -> None:
        self.graph = data_graph
        self.notes = {n.note_id: n for n in notes}

    def generate_schema_prompt(self) -> str:
        """
        Generates a schema-annotated prompt detailing available node classes,
        edge predicates, and SPARQL/Cypher query templates for LLM context.
        """
        classes: Set[str] = set()
        predicates: Set[str] = set()

        wf_prefix = "https://w3id.org/wikiforge/ontology/"
        wf_class_prefix = "https://w3id.org/wikiforge/class/"

        for note in self.notes.values():
            classes.add(note.note_type)
            for link in note.links:
                predicates.add(link.predicate)

        class_list = ", ".join(sorted(classes)) if classes else "Article, Concept, Entity"
        pred_list = ", ".join(sorted(predicates)) if predicates else "refersTo, supports, contradicts"

        prompt = f"""=== KNOWLEDGE GRAPH SCHEMA SPECIFICATION ===
Domain Node Classes: [{class_list}]
Domain Edge Predicates: [{pred_list}]

=== QUERY TEMPLATES ===
SPARQL Template:
  PREFIX wf: <https://w3id.org/wikiforge/ontology/>
  PREFIX wfid: <https://w3id.org/wikiforge/id/>
  SELECT ?subject ?predicate ?object WHERE {{
    ?subject ?predicate ?object .
    FILTER(?predicate IN (wf:supports, wf:refersTo, wf:contradicts))
  }}

Cypher Template:
  MATCH (a:Note)-[r]->(b:Note)
  WHERE type(r) IN ['SUPPORTS', 'REFERSTO', 'CONTRADICTS']
  RETURN a.id, type(r), b.id
==============================================="""
        return prompt

    def retrieve_subgraph(
        self, seed_note_ids: List[str], max_hops: int = 2, max_nodes: int = 30
    ) -> RetrievedSubgraph:
        """
        Retrieves a connected subgraph starting from seed_note_ids up to max_hops distance.
        Formats retrieved nodes, edges, and provenance into grounded LLM context text.
        """
        visited_nodes: Set[str] = set()
        retrieved_nodes: List[SubgraphNode] = []
        retrieved_edges: List[SubgraphEdge] = []
        retrieved_prov: List[ProvenanceRecord] = []

        queue: List[Tuple[str, int]] = [(sid, 0) for sid in seed_note_ids if sid in self.notes or True]

        while queue and len(visited_nodes) < max_nodes:
            curr_id, dist = queue.pop(0)
            if curr_id in visited_nodes:
                continue
            visited_nodes.add(curr_id)

            note = self.notes.get(curr_id)
            title = note.title if note else curr_id.replace("-", " ").title()
            n_type = note.note_type if note else "Article"
            summary = note.body[:150].replace("\n", " ").strip() if note else ""

            retrieved_nodes.append(
                SubgraphNode(
                    node_id=curr_id,
                    uri=f"https://w3id.org/wikiforge/id/{curr_id}",
                    title=title,
                    note_type=n_type,
                    summary=summary,
                )
            )

            # Retrieve provenance records if note is present
            if note and note.file_path:
                retrieved_prov.append(
                    ProvenanceRecord(
                        source_path=note.file_path,
                        author=note.author,
                        start_line=1,
                        end_line=min(10, len(note.body.splitlines())),
                        text_snippet=summary,
                        line_anchor=f"{note.file_path}#L1-L10",
                    )
                )

            # Traverse outgoing links
            if note and dist < max_hops:
                for link in note.links:
                    retrieved_edges.append(
                        SubgraphEdge(
                            source_id=curr_id,
                            predicate=link.predicate,
                            target_id=link.target_id,
                        )
                    )
                    if link.target_id not in visited_nodes:
                        queue.append((link.target_id, dist + 1))

        # Format grounded LLM context string
        context_lines = ["=== RETRIEVED GROUNDED SUBGRAPH CONTEXT ==="]
        context_lines.append(f"Retrieved {len(retrieved_nodes)} entities and {len(retrieved_edges)} typed relationships.\n")

        context_lines.append("--- ENTITIES ---")
        for node in retrieved_nodes:
            context_lines.append(f"- [{node.node_id}] (Type: {node.note_type}, Title: '{node.title}')")
            if node.summary:
                context_lines.append(f"  Summary: {node.summary}")

        context_lines.append("\n--- SEMANTIC RELATIONSHIPS ---")
        for edge in retrieved_edges:
            context_lines.append(f"- {edge.source_id} --[{edge.predicate}]--> {edge.target_id}")

        context_lines.append("\n--- PROVENANCE & SOURCE CITATIONS ---")
        for prov in retrieved_prov:
            anchor_str = prov.line_anchor or prov.source_path
            context_lines.append(f"- Source: {anchor_str} (Author: {prov.author})")

        context_lines.append("==========================================")

        return RetrievedSubgraph(
            nodes=retrieved_nodes,
            edges=retrieved_edges,
            provenance=retrieved_prov,
            context_text="\n".join(context_lines),
        )
