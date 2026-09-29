"""
src/wikiforge/semantics/shortcut_engine.py

Multi-Layered View & Shortcut Engine for Wiki-Forge Semantic Knowledge Graphs.
Bridges formal Content Ontology Design Patterns (CODPs) (e.g. AgentRole, Event, Provenance)
and simplified application views via rule-based SPARQL CONSTRUCT materialization.
"""

from __future__ import annotations

from typing import Dict, List, Optional
from rdflib import Graph, URIRef, Literal, RDF, RDFS


DEFAULT_SHORTCUT_RULES: Dict[str, str] = {
    "agent_role_shortcut": """
        PREFIX wf: <https://w3id.org/wikiforge/ontology/>
        CONSTRUCT {
            ?entity wf:agent ?agent .
            ?entity wf:role ?role .
        } WHERE {
            ?entity wf:hasAgentRole ?ar .
            OPTIONAL { ?ar wf:withAgent ?agent . }
            OPTIONAL { ?ar wf:withRole ?role . }
        }
    """,
    "provenance_shortcut": """
        PREFIX wf: <https://w3id.org/wikiforge/ontology/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        CONSTRUCT {
            ?entity wf:derivedFromSource ?source .
        } WHERE {
            ?entity wf:hasProvenance ?p .
            ?p prov:wasDerivedFrom ?source .
        }
    """,
    "temporal_status_shortcut": """
        PREFIX wf: <https://w3id.org/wikiforge/ontology/>
        CONSTRUCT {
            ?entity wf:activeStatus ?statusVal .
        } WHERE {
            ?entity wf:hasStatusAnnotation ?sa .
            ?sa wf:statusValue ?statusVal .
        }
    """,
}


class ShortcutEngine:
    """
    Materializes simplified direct shortcut properties from multi-hop reified ODP structures.
    """

    def __init__(self, rules: Optional[Dict[str, str]] = None):
        self.rules: Dict[str, str] = dict(DEFAULT_SHORTCUT_RULES)
        if rules:
            self.rules.update(rules)

    def add_rule(self, rule_name: str, construct_sparql: str) -> None:
        """Registers a custom SPARQL CONSTRUCT shortcut rule."""
        self.rules[rule_name] = construct_sparql

    def materialize_shortcuts(self, data_graph: Graph) -> Graph:
        """
        Executes all registered CONSTRUCT queries over data_graph and merges
        the resulting shortcut triples into the graph in-place.
        Returns the augmented graph.
        """
        all_shortcuts = Graph()

        for rule_name, sparql_query in self.rules.items():
            try:
                construct_g = data_graph.query(sparql_query).graph
                if construct_g:
                    for triple in construct_g:
                        all_shortcuts.add(triple)
            except Exception:
                pass

        for triple in all_shortcuts:
            data_graph.add(triple)

        return data_graph

    def create_simplified_view(self, data_graph: Graph) -> Graph:
        """
        Generates a standalone application-layer Graph containing only
        direct core metadata and materialized shortcut properties,
        filtering out complex reified intermediate ODP nodes.
        """
        view_g = Graph()

        # Materialize shortcuts first into a copy
        working_g = Graph()
        for t in data_graph:
            working_g.add(t)
        self.materialize_shortcuts(working_g)

        # Copy over core triples and shortcut triples, skipping intermediate ODP nodes
        # Exclude nodes with rdf:type wf:AgentRole, wf:StatusAnnotation, etc.
        reified_types = {
            URIRef("https://w3id.org/wikiforge/ontology/AgentRoleNode"),
            URIRef("https://w3id.org/wikiforge/ontology/ProvenanceNode"),
            URIRef("https://w3id.org/wikiforge/ontology/StatusAnnotationNode"),
        }

        reified_nodes = set()
        for s, _, o in working_g.triples((None, RDF.type, None)):
            if o in reified_types:
                reified_nodes.add(s)

        for s, p, o in working_g:
            if s not in reified_nodes and o not in reified_nodes:
                view_g.add((s, p, o))

        return view_g
