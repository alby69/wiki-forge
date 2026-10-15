"""
src/wikiforge/semantics/shacl_validator.py

SHACL / ShEx Shape Validator and OWL Reasoner Integration for Wiki-Forge.
Validates RDF graph shapes against SHACL shapes and runs OWL2-RL reasoning to detect
logical contradictions such as owl:disjointWith violations.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pathlib import Path
from rdflib import Graph, URIRef, RDF, RDFS, OWL

try:
    import pyshacl
except ImportError:
    pyshacl = None

try:
    import owlrl
except ImportError:
    owlrl = None


def validate_shacl(
    data_graph: Graph,
    shacl_graph_or_path: Graph | str | Path,
    ont_graph: Optional[Graph] = None,
) -> Dict[str, Any]:
    """
    Validates data_graph against a SHACL shapes graph using pyshacl.
    """
    if pyshacl is None:
        return {
            "conforms": False,
            "error": "pyshacl library is not installed",
            "results_text": "pyshacl library missing",
            "violations": [],
        }

    shapes_g: Graph
    if isinstance(shacl_graph_or_path, (str, Path)):
        shapes_g = Graph()
        shapes_g.parse(source=str(shacl_graph_or_path), format="turtle")
    elif isinstance(shacl_graph_or_path, Graph):
        shapes_g = shacl_graph_or_path
    else:
        shapes_g = Graph()

    conforms, report_graph, report_text = pyshacl.validate(
        data_graph=data_graph,
        shacl_graph=shapes_g,
        ont_graph=ont_graph,
        inference="rdfs",
        abort_on_first=False,
        meta_shacl=False,
        debug=False,
    )

    violations: List[Dict[str, str]] = []
    # Parse report_graph for SHACL result details
    sh_result = URIRef("http://www.w3.org/ns/shacl#ValidationResult")
    sh_focus_node = URIRef("http://www.w3.org/ns/shacl#focusNode")
    sh_result_message = URIRef("http://www.w3.org/ns/shacl#resultMessage")
    sh_result_path = URIRef("http://www.w3.org/ns/shacl#resultPath")

    for result in report_graph.subjects(RDF.type, sh_result):
        fn = report_graph.value(result, sh_focus_node)
        msg = report_graph.value(result, sh_result_message)
        path = report_graph.value(result, sh_result_path)
        violations.append({
            "focus_node": str(fn) if fn else "",
            "message": str(msg) if msg else "SHACL Validation Failure",
            "path": str(path) if path else "",
        })

    return {
        "conforms": bool(conforms),
        "results_text": report_text,
        "violations": violations,
    }


def apply_owl_reasoning(data_graph: Graph) -> Graph:
    """
    Applies OWL2-RL reasoning over the input graph using owlrl.
    Materializes inferred triples in-place and returns the updated graph.
    """
    if owlrl is not None:
        try:
            owlrl.DeductiveClosure(owlrl.OWLRL_Semantics).expand(data_graph)
        except Exception:
            pass
    return data_graph


def check_owl_disjointness_violations(data_graph: Graph) -> List[Dict[str, str]]:
    """
    Detects owl:disjointWith violations in the graph.
    If an entity is typed as both Class A and Class B where Class A owl:disjointWith Class B,
    it returns a violation detail list.
    """
    violations: List[Dict[str, str]] = []

    # Apply reasoning first so subclass / owl types are expanded
    g = apply_owl_reasoning(data_graph)

    # Find disjoint class pairs (ClassA owl:disjointWith ClassB)
    disjoint_pairs = []
    for c1, c2 in g.subject_objects(OWL.disjointWith):
        disjoint_pairs.append((c1, c2))

    if not disjoint_pairs:
        return violations

    # Check each entity's RDF types
    entity_types: Dict[URIRef, set] = {}
    for entity, _, rdf_type in g.triples((None, RDF.type, None)):
        if entity not in entity_types:
            entity_types[entity] = set()
        entity_types[entity].add(rdf_type)

    for entity, types in entity_types.items():
        for c1, c2 in disjoint_pairs:
            if c1 in types and c2 in types:
                violations.append({
                    "entity": str(entity),
                    "class_a": str(c1),
                    "class_b": str(c2),
                    "message": f"Entity {entity} is asserted as both {c1} and {c2}, which are owl:disjointWith.",
                })

    return violations
