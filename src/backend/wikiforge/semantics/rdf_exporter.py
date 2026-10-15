"""
src/wikiforge/semantics/rdf_exporter.py

RDF & LPG Dual Exporter for Wiki-Forge Semantic Knowledge Graphs.
Exports ParsedNote collections to RDF Turtle (.ttl), N-Triples (.nt),
and Neo4j Cypher ingestion scripts (.cypher).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional, Dict, Any
from rdflib import Graph, Literal, Namespace, RDF, RDFS, URIRef, XSD, SKOS
from rdflib.namespace import OWL

from .markdown_parser import ParsedNote, mint_uri, DEFAULT_BASE_IRI


SCHEMA = Namespace("http://schema.org/")
PROV = Namespace("http://www.w3.org/ns/prov#")
WF = Namespace("https://w3id.org/wikiforge/ontology/")
WFCLASS = Namespace("https://w3id.org/wikiforge/class/")
WFID = Namespace("https://w3id.org/wikiforge/id/")


def build_rdf_graph(notes: List[ParsedNote], base_iri: str = DEFAULT_BASE_IRI) -> Graph:
    """
    Constructs an RDF Graph in rdflib from a list of ParsedNote objects.
    """
    g = Graph()
    g.bind("schema", SCHEMA)
    g.bind("prov", PROV)
    g.bind("wf", WF)
    g.bind("wfclass", WFCLASS)
    g.bind("wfid", WFID)
    g.bind("skos", SKOS)
    g.bind("owl", OWL)

    for note in notes:
        subject_uri = URIRef(note.entity_uri or mint_uri(note.note_id, "id", base_iri))

        # Types
        g.add((subject_uri, RDF.type, SCHEMA.Article))
        class_uri = URIRef(mint_uri(note.note_type, "class", base_iri))
        g.add((subject_uri, RDF.type, class_uri))

        # Core Metadata
        g.add((subject_uri, SCHEMA.name, Literal(note.title)))
        g.add((subject_uri, RDFS.label, Literal(note.title)))
        g.add((subject_uri, WF.status, Literal(note.status)))
        g.add((subject_uri, SCHEMA.author, Literal(note.author)))
        g.add((subject_uri, PROV.wasAttributedTo, Literal(note.author)))

        if note.file_path:
            g.add((subject_uri, PROV.hadPrimarySource, Literal(note.file_path)))

        # Tags & Keywords
        for tag in note.tags:
            g.add((subject_uri, SCHEMA.keywords, Literal(tag)))

        # Aliases / altLabels
        for alias in note.aliases:
            g.add((subject_uri, SKOS.altLabel, Literal(alias)))

        # Additional Frontmatter key-values
        for key, value in note.frontmatter.items():
            if key in ("title", "type", "status", "author", "tags", "aliases", "prefLabel", "altLabel"):
                continue
            pred_uri = URIRef(mint_uri(key, "ontology", base_iri))
            if isinstance(value, (int, float)):
                g.add((subject_uri, pred_uri, Literal(value)))
            elif isinstance(value, bool):
                g.add((subject_uri, pred_uri, Literal(value, datatype=XSD.boolean)))
            elif isinstance(value, str):
                g.add((subject_uri, pred_uri, Literal(value)))

        # Semantic Typed Links
        for link in note.links:
            target_uri = URIRef(mint_uri(link.target_id, "id", base_iri))
            pred_uri = URIRef(mint_uri(link.predicate, "ontology", base_iri))
            g.add((subject_uri, pred_uri, target_uri))

    return g


def export_to_turtle(notes: List[ParsedNote], base_iri: str = DEFAULT_BASE_IRI) -> str:
    """Exports notes to RDF Turtle (.ttl) string format."""
    g = build_rdf_graph(notes, base_iri=base_iri)
    return g.serialize(format="turtle")


def export_to_ntriples(notes: List[ParsedNote], base_iri: str = DEFAULT_BASE_IRI) -> str:
    """Exports notes to N-Triples (.nt) string format."""
    g = build_rdf_graph(notes, base_iri=base_iri)
    return g.serialize(format="nt")


def export_to_cypher(notes: List[ParsedNote], base_iri: str = DEFAULT_BASE_IRI) -> str:
    """
    Exports notes to Neo4j Cypher (.cypher) ingestion script.
    Creates node MERGE statements and relationship MERGE statements.
    """
    lines = [
        "// Wiki-Forge Cypher Ingestion Script",
        "// Generated for Neo4j / Property Graph Engines",
        ""
    ]

    # Create Nodes
    for note in notes:
        node_id = note.note_id.replace('"', '\\"')
        title = note.title.replace('"', '\\"')
        note_type = re.sub(r"[^a-zA-Z0-9]", "", note.note_type) or "Article"
        status = note.status.replace('"', '\\"')
        author = note.author.replace('"', '\\"')
        tags = [t.replace('"', '\\"') for t in note.tags]
        tags_str = str(tags).replace("'", '"')

        cypher_node = (
            f'MERGE (n:Note:{note_type} {{ id: "{node_id}" }}) '
            f'SET n.title = "{title}", n.status = "{status}", n.author = "{author}", '
            f'n.uri = "{note.entity_uri}", n.tags = {tags_str};'
        )
        lines.append(cypher_node)

    lines.append("")

    # Create Relationships
    for note in notes:
        source_id = note.note_id.replace('"', '\\"')
        for link in note.links:
            target_id = link.target_id.replace('"', '\\"')
            rel_type = re.sub(r"[^a-zA-Z0-9_]", "_", link.predicate.upper()) or "REFERS_TO"
            cypher_rel = (
                f'MATCH (a:Note {{ id: "{source_id}" }}), (b:Note {{ id: "{target_id}" }}) '
                f'MERGE (a)-[r:{rel_type}]->(b);'
            )
            lines.append(cypher_rel)

    return "\n".join(lines)


def export_all_formats(
    notes: List[ParsedNote], output_dir: Path | str, base_iri: str = DEFAULT_BASE_IRI
) -> Dict[str, str]:
    """
    Generates and saves .ttl, .nt, and .cypher files in the specified output directory.
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    ttl_str = export_to_turtle(notes, base_iri=base_iri)
    ttl_file = out_path / "knowledge_graph.ttl"
    ttl_file.write_text(ttl_str, encoding="utf-8")

    nt_str = export_to_ntriples(notes, base_iri=base_iri)
    nt_file = out_path / "knowledge_graph.nt"
    nt_file.write_text(nt_str, encoding="utf-8")

    cypher_str = export_to_cypher(notes, base_iri=base_iri)
    cypher_file = out_path / "knowledge_graph.cypher"
    cypher_file.write_text(cypher_str, encoding="utf-8")

    return {
        "turtle": str(ttl_file),
        "ntriples": str(nt_file),
        "cypher": str(cypher_file),
    }
