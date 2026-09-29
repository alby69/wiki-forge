"""
tests/test_wikiforge_semantics.py

Unit and Integration Tests for Wiki-Forge Semantic Knowledge Base Extension (src/wikiforge/semantics/).
Tests Module 1 (Markdown Parser & RDF/Cypher Exporter), Module 2 (SHACL & CQ Engine),
Module 3 (Shortcut View Engine), and Module 4 (PROV-O & GraphRAG Pipeline).
"""

import unittest
import tempfile
import shutil
from pathlib import Path
from rdflib import Graph, URIRef, RDF, RDFS, OWL

from src.wikiforge.semantics import (
    ParsedNote,
    SemanticLink,
    mint_uri,
    parse_markdown_content,
    parse_markdown_file,
    build_rdf_graph,
    export_to_turtle,
    export_to_ntriples,
    export_to_cypher,
    export_all_formats,
    validate_shacl,
    apply_owl_reasoning,
    check_owl_disjointness_violations,
    CQEngine,
    CQTestCase,
    CQSuiteResult,
    ShortcutEngine,
    ProvenanceRecord,
    attach_provenance_triples,
    extract_provenance_records,
    GraphRAGPipeline,
)


class TestWikiForgeSemantics(unittest.TestCase):

    def setUp(self):
        self.tmp_dir = Path(tempfile.mkdtemp())
        self.wiki_dir = self.tmp_dir / "wiki"
        self.output_dir = self.tmp_dir / "output"
        self.wiki_dir.mkdir(parents=True)
        self.output_dir.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.tmp_dir)

    def test_module1_markdown_parser(self):
        md_content = """---
title: "Ontology Engineering"
type: "Concept"
status: "stable"
author: "human:alby"
tags: ["kg", "semantic-web"]
aliases: ["OntoEng"]
---

# Ontology Engineering

This note [[supports::knowledge-graphs|Knowledge Graphs Note]] and references [[zettelkasten]].
Line 2 grounding snippet here.
"""
        note_path = self.wiki_dir / "ontology-engineering.md"
        note_path.write_text(md_content, encoding="utf-8")

        parsed = parse_markdown_file(note_path)
        self.assertEqual(parsed.note_id, "ontology-engineering")
        self.assertEqual(parsed.title, "Ontology Engineering")
        self.assertEqual(parsed.note_type, "Concept")
        self.assertEqual(parsed.status, "stable")
        self.assertEqual(parsed.author, "human:alby")
        self.assertIn("kg", parsed.tags)
        self.assertIn("OntoEng", parsed.aliases)

        # Check links
        self.assertEqual(len(parsed.links), 2)
        link1 = parsed.links[0]
        self.assertEqual(link1.predicate, "supports")
        self.assertEqual(link1.target_id, "knowledge-graphs")
        self.assertEqual(link1.label, "Knowledge Graphs Note")

        link2 = parsed.links[1]
        self.assertEqual(link2.predicate, "refersTo")
        self.assertEqual(link2.target_id, "zettelkasten")

        # Test persistent IRI minting
        uri_id = mint_uri("ontology-engineering", "id")
        self.assertEqual(uri_id, "https://w3id.org/wikiforge/id/ontology-engineering")
        uri_pred = mint_uri("supports", "ontology")
        self.assertEqual(uri_pred, "https://w3id.org/wikiforge/ontology/supports")
        uri_class = mint_uri("Concept", "class")
        self.assertEqual(uri_class, "https://w3id.org/wikiforge/class/Concept")

    def test_module1_rdf_cypher_export(self):
        n1 = parse_markdown_content(
            "---\ntitle: Note A\ntype: Concept\nstatus: stable\n---\n[[supports::note-b]]",
            note_id="note-a"
        )
        n2 = parse_markdown_content(
            "---\ntitle: Note B\ntype: Article\nstatus: draft\n---\nBody of B",
            note_id="note-b"
        )

        g = build_rdf_graph([n1, n2])
        self.assertIsInstance(g, Graph)
        self.assertGreater(len(g), 0)

        ttl = export_to_turtle([n1, n2])
        self.assertIn("http://schema.org/", ttl)
        self.assertIn("wfid:note-a", ttl)

        nt = export_to_ntriples([n1, n2])
        self.assertIn("<https://w3id.org/wikiforge/id/note-a>", nt)

        cypher = export_to_cypher([n1, n2])
        self.assertIn("MERGE (n:Note:Concept { id: \"note-a\" })", cypher)
        self.assertIn("MERGE (a)-[r:SUPPORTS]->(b);", cypher)

        exported_files = export_all_formats([n1, n2], self.output_dir)
        self.assertTrue(Path(exported_files["turtle"]).exists())
        self.assertTrue(Path(exported_files["ntriples"]).exists())
        self.assertTrue(Path(exported_files["cypher"]).exists())

    def test_module2_shacl_and_owl_validation(self):
        shapes_ttl = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix schema: <http://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

schema:ArticleShape
    a sh:NodeShape ;
    sh:targetClass schema:Article ;
    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
    ] .
"""
        shapes_path = self.tmp_dir / "shapes.ttl"
        shapes_path.write_text(shapes_ttl, encoding="utf-8")

        n1 = parse_markdown_content("---\ntitle: Test\ntype: Article\n---\nBody", note_id="test")
        g = build_rdf_graph([n1])

        shacl_res = validate_shacl(g, shapes_path)
        self.assertTrue(shacl_res["conforms"])

        # Test OWL disjointness check
        g_owl = Graph()
        entity = URIRef("https://w3id.org/wikiforge/id/conflict-entity")
        class_a = URIRef("https://w3id.org/wikiforge/class/ClassA")
        class_b = URIRef("https://w3id.org/wikiforge/class/ClassB")

        g_owl.add((class_a, OWL.disjointWith, class_b))
        g_owl.add((entity, RDF.type, class_a))
        g_owl.add((entity, RDF.type, class_b))

        violations = check_owl_disjointness_violations(g_owl)
        self.assertEqual(len(violations), 1)
        self.assertIn("conflict-entity", violations[0]["entity"])

    def test_module2_cq_engine(self):
        cq_yaml = """
competency_questions:
  - id: CQ1
    question: "Which notes support concept-a?"
    query: |
      PREFIX wf: <https://w3id.org/wikiforge/ontology/>
      PREFIX wfid: <https://w3id.org/wikiforge/id/>
      SELECT ?supporter WHERE {
        ?supporter wf:supports wfid:concept-a .
      }
    expected_min_results: 1
    expected_bindings:
      - supporter: "https://w3id.org/wikiforge/id/concept-b"
"""
        suite_path = self.tmp_dir / "cq_suite.yaml"
        suite_path.write_text(cq_yaml, encoding="utf-8")

        n1 = parse_markdown_content("---\ntitle: Concept A\n---\nA", note_id="concept-a")
        n2 = parse_markdown_content("---\ntitle: Concept B\n---\nB [[supports::concept-a]]", note_id="concept-b")

        g = build_rdf_graph([n1, n2])
        cq_engine = CQEngine(g)
        res = cq_engine.run_suite(suite_path)

        self.assertEqual(res.total_questions, 1)
        self.assertEqual(res.passed_count, 1)
        self.assertEqual(res.results[0].status, "PASSED")

    def test_module3_shortcut_engine(self):
        g = Graph()
        entity = URIRef("https://w3id.org/wikiforge/id/project-x")
        ar_node = URIRef("https://w3id.org/wikiforge/id/ar-100")
        agent = URIRef("https://w3id.org/wikiforge/id/bob")
        role = URIRef("https://w3id.org/wikiforge/id/architect")

        wf = "https://w3id.org/wikiforge/ontology/"
        g.add((entity, URIRef(wf + "hasAgentRole"), ar_node))
        g.add((ar_node, URIRef(wf + "withAgent"), agent))
        g.add((ar_node, URIRef(wf + "withRole"), role))

        shortcut_engine = ShortcutEngine()
        shortcut_engine.materialize_shortcuts(g)

        agent_triples = list(g.triples((entity, URIRef(wf + "agent"), agent)))
        role_triples = list(g.triples((entity, URIRef(wf + "role"), role)))

        self.assertEqual(len(agent_triples), 1)
        self.assertEqual(len(role_triples), 1)

        simplified_view = shortcut_engine.create_simplified_view(g)
        self.assertIsInstance(simplified_view, Graph)

    def test_module4_provenance_and_graph_rag(self):
        g = Graph()
        subject = URIRef("https://w3id.org/wikiforge/id/claim-1")
        prov_rec = ProvenanceRecord(
            source_path="sources/paper.pdf",
            author="human:researcher",
            start_line=10,
            end_line=15,
            text_snippet="Target claim snippet",
            line_anchor="sources/paper.pdf#L10-L15",
        )

        attach_provenance_triples(g, subject, prov_rec)
        extracted = extract_provenance_records(g, subject)
        self.assertEqual(len(extracted), 1)
        self.assertEqual(extracted[0].source_path, "sources/paper.pdf")
        self.assertEqual(extracted[0].start_line, 10)

        # GraphRAG Pipeline test
        n1 = parse_markdown_content("---\ntitle: Claim 1\ntype: Concept\n---\nClaim 1 body [[refersTo::claim-2]]", note_id="claim-1")
        n2 = parse_markdown_content("---\ntitle: Claim 2\ntype: Article\n---\nClaim 2 body", note_id="claim-2")

        graph_all = build_rdf_graph([n1, n2])
        pipeline = GraphRAGPipeline(graph_all, [n1, n2])

        schema_prompt = pipeline.generate_schema_prompt()
        self.assertIn("Domain Node Classes", schema_prompt)
        self.assertIn("SPARQL Template", schema_prompt)

        subgraph = pipeline.retrieve_subgraph(["claim-1"], max_hops=2)
        self.assertEqual(len(subgraph.nodes), 2)
        self.assertIn("RETRIEVED GROUNDED SUBGRAPH CONTEXT", subgraph.context_text)


if __name__ == "__main__":
    unittest.main()
