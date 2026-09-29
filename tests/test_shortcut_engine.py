"""
tests/test_shortcut_engine.py

Unit tests for ShortcutEngine in src/wikiforge/semantics/shortcut_engine.py
"""

import unittest
from rdflib import Graph, URIRef, Literal, RDF, Namespace

from src.wikiforge.semantics.shortcut_engine import ShortcutEngine


class TestShortcutEngine(unittest.TestCase):

    def setUp(self):
        self.wf = Namespace("https://w3id.org/wikiforge/ontology/")
        self.wfid = Namespace("https://w3id.org/wikiforge/id/")
        self.prov = Namespace("http://www.w3.org/ns/prov#")

    def test_direct_co_author_materialization(self):
        g = Graph()

        note1 = self.wfid["note-1"]
        note2 = self.wfid["note-2"]
        agent1 = self.wfid["agent-alice"]
        agent2 = self.wfid["agent-bob"]

        g.add((note1, RDF.type, self.wf["PermanentNote"]))
        g.add((note2, RDF.type, self.wf["PermanentNote"]))
        g.add((note1, self.prov["wasAttributedTo"], agent1))
        g.add((note2, self.prov["wasAttributedTo"], agent2))
        g.add((note1, self.wf["supports"], note2))

        engine = ShortcutEngine()
        augmented_g = engine.materialize_shortcuts(g)

        self.assertIn((note1, self.wf["directCoAuthor"], agent2), augmented_g)

    def test_simplified_view_creation(self):
        g = Graph()
        note = self.wfid["note-1"]
        ar_node = self.wfid["ar-1"]

        g.add((note, RDF.type, self.wf["PermanentNote"]))
        g.add((ar_node, RDF.type, self.wf["AgentRoleNode"]))

        engine = ShortcutEngine()
        view_g = engine.create_simplified_view(g)

        self.assertIn((note, RDF.type, self.wf["PermanentNote"]), view_g)
        self.assertNotIn((ar_node, RDF.type, self.wf["AgentRoleNode"]), view_g)


if __name__ == "__main__":
    unittest.main()
