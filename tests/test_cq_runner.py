"""
tests/test_cq_runner.py

Unit tests for CQRunner and CQEngine.
"""

import unittest
from pathlib import Path
from rdflib import Graph, URIRef, Literal, RDF, Namespace

from src.wikiforge.semantics.cq_runner import CQRunner
from src.wikiforge.semantics.cq_engine import CQEngine, CQTestCase


class TestCQRunner(unittest.TestCase):

    def setUp(self):
        self.wf = Namespace("https://w3id.org/wikiforge/ontology/")
        self.wfid = Namespace("https://w3id.org/wikiforge/id/")
        self.prov = Namespace("http://www.w3.org/ns/prov#")
        self.dcterms = Namespace("http://purl.org/dc/terms/")
        self.foaf = Namespace("http://xmlns.com/foaf/0.1/")

    def test_cq_runner_execution(self):
        g = Graph()
        supporter = self.wfid["supporter-note"]
        target = self.wfid["target-note"]
        author = self.wfid["agent-elisa"]

        g.add((supporter, self.wf["supports"], target))
        g.add((supporter, self.dcterms["title"], Literal("Supporter Title")))
        g.add((supporter, self.prov["wasAttributedTo"], author))
        g.add((author, self.foaf["name"], Literal("Elisa Kendall")))

        runner = CQRunner(data_graph=g)
        suite_path = Path("tests/competency_questions/cqs.yml")
        if suite_path.exists():
            res = runner.run_suite_file(suite_path)
            self.assertGreater(res.total_questions, 0)
            self.assertEqual(res.passed_count, res.total_questions)


if __name__ == "__main__":
    unittest.main()
