"""
prov_exporter.py — PROV-O export for OKF notes with line-anchor citations.

WHAT THIS DOES
--------------
Turns the provenance of every note into W3C PROV-O triples:

* the note itself is a ``prov:Entity`` attributed to its ``author``;
* every ``[^src:ID#Lx-Ly]`` anchor becomes its own ``prov:Entity`` (the exact
  span of the source file) linked with ``prov:wasDerivedFrom`` and carrying
  ``wf:lineAnchor`` / ``wf:startLine`` / ``wf:endLine``;
* every ``verified:`` frontmatter event becomes a ``prov:Activity``
  (``prov:wasGeneratedBy`` + ``prov:endedAtTime`` + ``prov:wasAssociatedWith``).

The exporter inherits from :class:`BaseGraphExporter`, so notes are parsed with
the same OKF/wikilink rules as the RDF and Cypher exporters.
"""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import quote

from rdflib import Graph, Literal, Namespace, RDF, URIRef, XSD

from .base_parser import BaseGraphExporter, slugify
from .provenance import PROV, WF, attach_provenance_triples, ProvenanceRecord

SCHEMA = Namespace("http://schema.org/")

# Same grammar as the shared TypeScript parser (src/shared/domain/citations.ts).
ANCHOR_RE = re.compile(r"\[\^src:([^\]#]+)#L(\d+)(?:-L(\d+))?\]")


def _escape(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


class ProvGraphExporter(BaseGraphExporter):
    """Export OKF notes (with line-anchor citations) as PROV-O graphs."""

    def __init__(self, base_uri: str = "https://w3id.org/wikiforge/id/"):
        self.base_uri = base_uri

    def _note_uri(self, note: dict[str, Any]) -> URIRef:
        return URIRef(f"{self.base_uri}{quote(note['slug'])}")

    def _agent_uri(self, actor: str) -> URIRef:
        return URIRef(f"{self.base_uri}agent-{slugify(actor)}")

    @staticmethod
    def extract_citations(note: dict[str, Any]) -> list[dict[str, Any]]:
        """Every ``[^src:ID#Lx-Ly]`` anchor of a parsed note, resolved against ``sources:``."""
        metadata = note.get("metadata") or {}
        raw_sources = metadata.get("sources") or []
        sources: dict[str, dict[str, Any]] = {}
        if isinstance(raw_sources, list):
            for index, entry in enumerate(raw_sources):
                if not isinstance(entry, dict):
                    continue
                source_id = str(entry.get("id") or entry.get("resource") or f"source-{index}")
                sources[source_id] = entry

        lines = note.get("body", "").splitlines()
        citations: list[dict[str, Any]] = []
        for match in ANCHOR_RE.finditer(note.get("body", "")):
            source_id = match.group(1).strip()
            start_line = int(match.group(2))
            end_line = int(match.group(3) or match.group(2))
            ref = sources.get(source_id, {})
            claim = ""
            for line in lines:
                if match.group(0) in line:
                    claim = line.strip()
                    break
            citations.append({
                "anchor": match.group(0),
                "source_id": source_id,
                "resource": ref.get("resource"),
                "start_line": start_line,
                "end_line": end_line,
                "sha256": ref.get("sha256"),
                "claim": claim,
            })
        return citations

    @staticmethod
    def extract_verification_events(note: dict[str, Any]) -> list[dict[str, str]]:
        """``verified:`` frontmatter entries as ``{by, at}`` dictionaries."""
        metadata = note.get("metadata") or {}
        raw = metadata.get("verified") or []
        events: list[dict[str, str]] = []
        if isinstance(raw, dict):
            raw = [raw]
        for entry in raw:
            if isinstance(entry, dict):
                actor = str(entry.get("by") or entry.get("actor") or "process:api-token")
                at = str(entry.get("at") or note.get("created") or "2026-01-01T00:00:00Z")
            else:
                actor = str(entry)
                at = str(note.get("created") or "2026-01-01T00:00:00Z")
            events.append({"by": actor, "at": at})
        return events

    def build_graph(self, notes_data: list[dict[str, Any]]) -> Graph:
        """Build the PROV-O graph for a list of parsed notes."""
        g = Graph()
        g.bind("prov", PROV)
        g.bind("wf", WF)
        g.bind("schema", SCHEMA)

        for note in notes_data:
            note_uri = self._note_uri(note)
            author_uri = self._agent_uri(note.get("author", "unknown"))

            g.add((note_uri, RDF.type, PROV.Entity))
            g.add((author_uri, RDF.type, PROV.Agent))
            g.add((note_uri, PROV.wasAttributedTo, author_uri))
            g.add((note_uri, SCHEMA.name, Literal(_escape(note.get("title", note["slug"])))))

            for citation in self.extract_citations(note):
                # `attach_provenance_triples` mints `#prov-<line_anchor>`, so the
                # fragment must stay a valid IRI: slug + line range, never the raw
                # `[^src:…]` text (it contains `#` and brackets).
                span = f"{slugify(str(citation['source_id']))}-L{citation['start_line']}-L{citation['end_line']}"
                record = ProvenanceRecord(
                    source_path=str(citation["resource"] or citation["source_id"]),
                    author=str(note.get("author", "unknown")),
                    created_at=str(note.get("created")),
                    start_line=citation["start_line"],
                    end_line=citation["end_line"],
                    text_snippet=citation["claim"] or None,
                    line_anchor=span,
                )
                anchor_uri = attach_provenance_triples(g, note_uri, record)
                g.add((anchor_uri, WF.citationAnchor, Literal(citation["anchor"])))
                if citation.get("sha256"):
                    g.add((anchor_uri, WF.sourceSha256, Literal(str(citation["sha256"]))))

            for index, event in enumerate(self.extract_verification_events(note), start=1):
                activity_uri = URIRef(f"{note_uri}#verified-{index}")
                agent_uri = self._agent_uri(event["by"])
                g.add((activity_uri, RDF.type, PROV.Activity))
                g.add((agent_uri, RDF.type, PROV.Agent))
                g.add((activity_uri, PROV.wasAssociatedWith, agent_uri))
                g.add((activity_uri, PROV.endedAtTime, Literal(event["at"], datatype=XSD.dateTime)))
                g.add((note_uri, PROV.wasGeneratedBy, activity_uri))

        return g

    def export_notes(self, notes_data: list[dict[str, Any]]) -> str:
        """Serialize the PROV-O graph of the given notes as Turtle."""
        return self.build_graph(notes_data).serialize(format="turtle")

    def export_jsonld(self, notes_data: list[dict[str, Any]]) -> str:
        """Serialize the PROV-O graph as JSON-LD."""
        return self.build_graph(notes_data).serialize(format="json-ld")

    def export_report(self, notes_data: list[dict[str, Any]]) -> dict[str, Any]:
        """Deterministic summary used by the CLI and the tests."""
        anchors = [c for note in notes_data for c in self.extract_citations(note)]
        events = [e for note in notes_data for e in self.extract_verification_events(note)]
        graph = self.build_graph(notes_data)
        return {
            "notes": len(notes_data),
            "citations": len(anchors),
            "verification_events": len(events),
            "triples": len(graph),
        }


def serialize_jsonld_fragment(citations: list[dict[str, Any]]) -> str:
    """Plain JSON dump helper for CLI integration."""
    return json.dumps(citations, ensure_ascii=False, indent=2)
