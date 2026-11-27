"""Phase 95 — PROV-O export of OKF notes with line-anchor citations."""

from pathlib import Path

from rdflib import Graph, URIRef

from scripts.export_prov import export_prov  # noqa: E402  (PYTHONPATH includes scripts)
from src.backend.wikiforge.semantics.base_parser import BaseGraphExporter
from src.backend.wikiforge.semantics.prov_exporter import ProvGraphExporter
from src.backend.wikiforge.semantics.provenance import PROV, WF

SOURCE = """# Fonte

Riga due della fonte.
Riga tre della fonte.
"""

NOTE = """---
title: Nota citata
author: human:alice
status: stable
created: "2026-11-27"
verified:
  - by: human:alice
    at: "2026-11-27T10:00:00Z"
sources:
  - id: paper
    resource: raw/paper.md
    sha256: deadbeef
---
# Nota citata

Il mercato cresce secondo la fonte.[^src:paper#L2-L3]
"""


def _make_wiki(tmp_path: Path) -> Path:
    """Project layout: the source lives outside the parsed wiki folder."""
    (tmp_path / "raw").mkdir(parents=True)
    (tmp_path / "raw" / "paper.md").write_text(SOURCE, encoding="utf-8")
    wiki = tmp_path / "wiki"
    wiki.mkdir(parents=True, exist_ok=True)
    (wiki / "cited.md").write_text(NOTE, encoding="utf-8")
    return wiki


def test_prov_exporter_uses_base_graph_exporter():
    assert issubclass(ProvGraphExporter, BaseGraphExporter)


def test_extract_citations_resolves_sources(tmp_path):
    exporter = ProvGraphExporter()
    notes = exporter.parse_directory(_make_wiki(tmp_path))
    cited = next(n for n in notes if n["slug"] == "cited")
    citations = ProvGraphExporter.extract_citations(cited)

    assert len(citations) == 1
    assert citations[0]["source_id"] == "paper"
    assert citations[0]["resource"] == "raw/paper.md"
    assert (citations[0]["start_line"], citations[0]["end_line"]) == (2, 3)
    assert citations[0]["claim"].startswith("Il mercato cresce")


def test_prov_graph_contains_derivation_and_verification_activity(tmp_path):
    exporter = ProvGraphExporter()
    notes = exporter.parse_directory(_make_wiki(tmp_path))
    graph = exporter.build_graph(notes)

    note_uri = URIRef("https://w3id.org/wikiforge/id/cited")
    assert (note_uri, None, PROV.Entity) in graph

    derivations = list(graph.objects(note_uri, PROV.wasDerivedFrom))
    assert len(derivations) == 1
    span = derivations[0]
    assert (span, PROV.hadPrimarySource, None) in graph
    assert any(
        str(value) == "[^src:paper#L2-L3]"
        for value in graph.objects(span, WF.citationAnchor)
    )
    assert (span, WF.startLine, None) in graph
    assert (span, WF.endLine, None) in graph

    activities = list(graph.objects(note_uri, PROV.wasGeneratedBy))
    assert len(activities) == 1
    assert (activities[0], None, PROV.Activity) in graph
    assert (activities[0], PROV.wasAssociatedWith, None) in graph


def test_export_prov_cli_writes_turtle_and_jsonld(tmp_path):
    wiki = _make_wiki(tmp_path)
    out = tmp_path / "output"

    report = export_prov(wiki, out)

    assert report["notes"] == 1
    assert report["citations"] == 1
    assert report["verification_events"] == 1
    assert report["triples"] > 0

    turtle = Path(report["ttl_path"]).read_text(encoding="utf-8")
    assert "prov:wasDerivedFrom" in turtle
    assert "prov:wasGeneratedBy" in turtle
    assert Path(report["jsonld_path"]).exists()

    parsed = Graph()
    parsed.parse(data=turtle, format="turtle")
    assert len(parsed) == report["triples"]
