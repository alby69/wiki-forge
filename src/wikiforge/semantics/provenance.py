"""
src/wikiforge/semantics/provenance.py

PROV-O Provenance Tracking Module for Wiki-Forge Semantic Knowledge Graphs.
Attaches and extracts W3C PROV-O annotations (source file, note author, creation date,
line offsets) to support passage-level source grounding and citation.
"""

from __future__ import annotations

import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from rdflib import Graph, URIRef, Literal, Namespace, RDF, XSD, BNode

PROV = Namespace("http://www.w3.org/ns/prov#")
SCHEMA = Namespace("http://schema.org/")
WF = Namespace("https://w3id.org/wikiforge/ontology/")


class ProvenanceRecord(BaseModel):
    source_path: str
    author: str = "unknown"
    created_at: Optional[str] = None
    start_line: int = 1
    end_line: int = 1
    text_snippet: Optional[str] = None
    line_anchor: Optional[str] = None


def attach_provenance_triples(
    g: Graph, subject_uri: URIRef, prov_record: ProvenanceRecord
) -> URIRef:
    """
    Attaches PROV-O provenance metadata to subject_uri in the RDF graph.
    Creates an explicit reified prov:Entity node for passage-level source grounding.
    """
    g.bind("prov", PROV)
    g.bind("wf", WF)
    g.bind("schema", SCHEMA)

    # Compute line anchor if not set
    anchor = prov_record.line_anchor
    if not anchor:
        if prov_record.start_line == prov_record.end_line:
            anchor = f"L{prov_record.start_line}"
        else:
            anchor = f"L{prov_record.start_line}-L{prov_record.end_line}"

    prov_node_uri = URIRef(f"{str(subject_uri)}#prov-{anchor}")

    # Core PROV-O properties
    g.add((subject_uri, PROV.wasDerivedFrom, prov_node_uri))
    g.add((prov_node_uri, RDF.type, PROV.Entity))
    g.add((prov_node_uri, PROV.hadPrimarySource, Literal(prov_record.source_path)))
    g.add((prov_node_uri, PROV.wasAttributedTo, Literal(prov_record.author)))

    full_anchor_ref = f"{prov_record.source_path}#{anchor}"
    g.add((prov_node_uri, WF.lineAnchor, Literal(full_anchor_ref)))
    g.add((prov_node_uri, WF.startLine, Literal(prov_record.start_line, datatype=XSD.integer)))
    g.add((prov_node_uri, WF.endLine, Literal(prov_record.end_line, datatype=XSD.integer)))

    timestamp = prov_record.created_at or datetime.datetime.now(datetime.timezone.utc).isoformat()
    g.add((prov_node_uri, PROV.generatedAtTime, Literal(timestamp, datatype=XSD.dateTime)))

    if prov_record.text_snippet:
        g.add((prov_node_uri, SCHEMA.text, Literal(prov_record.text_snippet)))

    return prov_node_uri


def extract_provenance_records(g: Graph, subject_uri: URIRef) -> List[ProvenanceRecord]:
    """
    Extracts all attached ProvenanceRecord instances for subject_uri from graph g.
    """
    records: List[ProvenanceRecord] = []
    for prov_node in g.objects(subject_uri, PROV.wasDerivedFrom):
        source = g.value(prov_node, PROV.hadPrimarySource)
        author = g.value(prov_node, PROV.wasAttributedTo)
        gen_time = g.value(prov_node, PROV.generatedAtTime)
        start_l = g.value(prov_node, WF.startLine)
        end_l = g.value(prov_node, WF.endLine)
        snippet = g.value(prov_node, SCHEMA.text)
        anchor = g.value(prov_node, WF.lineAnchor)

        if source:
            records.append(
                ProvenanceRecord(
                    source_path=str(source),
                    author=str(author) if author else "unknown",
                    created_at=str(gen_time) if gen_time else None,
                    start_line=int(start_l) if start_l else 1,
                    end_line=int(end_l) if end_l else 1,
                    text_snippet=str(snippet) if snippet else None,
                    line_anchor=str(anchor) if anchor else None,
                )
            )
    return records
