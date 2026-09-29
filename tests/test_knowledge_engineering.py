#!/usr/bin/env python3
"""
tests/test_knowledge_engineering.py
Unit tests for Semantic RDF Export (export_semantic.py) and Ontology Rule Engine (ontology_rules.py).
"""

import os
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.export_semantic import export_semantic, generate_jsonld, generate_turtle
from scripts.ontology_rules import run_ontology_checks


class TestKnowledgeEngineering(unittest.TestCase):

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp())
        self.wiki_dir = self.test_dir / "wiki"
        self.output_dir = self.test_dir / "output"
        self.wiki_dir.mkdir(parents=True)
        self.output_dir.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_export_semantic(self):
        # Create test notes
        note1 = self.wiki_dir / "concept-a.md"
        note1.write_text("""---
okf_version: "0.2"
type: Concept
title: "Concept A"
description: "Description of Concept A"
status: stable
author: "human:tester"
tags: [ai, testing]
verified:
  - by: "human:tester"
    date: "2026-09-29"
---

# Concept A

Refers to [[concept-b]].
""", encoding="utf-8")

        note2 = self.wiki_dir / "concept-b.md"
        note2.write_text("""---
okf_version: "0.2"
type: Concept
title: "Concept B"
description: "Description of Concept B"
status: draft
author: "human:tester"
tags: [testing]
---

# Concept B

Details for Concept B.
""", encoding="utf-8")

        res = export_semantic(self.wiki_dir, self.output_dir)
        self.assertEqual(res["notes_count"], 2)
        self.assertTrue(Path(res["jsonld_path"]).exists())
        self.assertTrue(Path(res["ttl_path"]).exists())

        # Verify JSON-LD content
        jsonld_data = json.loads(Path(res["jsonld_path"]).read_text(encoding="utf-8"))
        self.assertIn("@context", jsonld_data)
        self.assertEqual(len(jsonld_data["@graph"]), 2)

        # Verify TTL content
        ttl_text = Path(res["ttl_path"]).read_text(encoding="utf-8")
        self.assertIn("@prefix schema:", ttl_text)
        self.assertIn("urn:wikiforge:note:concept-a", ttl_text)
        self.assertIn("wf:linksTo <urn:wikiforge:note:concept-b>", ttl_text)

    def test_ontology_rules_rule1_unlinked_concept(self):
        # Isolated concept note with 0 links
        note = self.wiki_dir / "isolated-concept.md"
        note.write_text("""---
type: Concept
status: draft
---

# Isolated Concept
No wikilinks here.
""", encoding="utf-8")

        res = run_ontology_checks(self.wiki_dir)
        self.assertEqual(res["total_notes"], 1)
        self.assertEqual(res["violations_count"], 1)
        self.assertEqual(res["violations"][0]["rule"], "Rule 1 (Concept Linkage)")

    def test_ontology_rules_rule2_circular_dependency(self):
        # Direct cycle A -> B and B -> A
        note_a = self.wiki_dir / "note-a.md"
        note_a.write_text("""---
type: Article
status: draft
---
Links to [[note-b]].
""", encoding="utf-8")

        note_b = self.wiki_dir / "note-b.md"
        note_b.write_text("""---
type: Article
status: draft
---
Links to [[note-a]].
""", encoding="utf-8")

        res = run_ontology_checks(self.wiki_dir)
        self.assertEqual(res["violations_count"], 1)
        self.assertEqual(res["violations"][0]["rule"], "Rule 2 (Direct Circular Dependency)")

    def test_ontology_rules_rule3_stable_human_verification(self):
        # Stable note without human verification entry
        note = self.wiki_dir / "stable-unverified.md"
        note.write_text("""---
type: Article
status: stable
verified:
  - by: "process:auto-linter"
---
Links to [[note-x]].
""", encoding="utf-8")

        res = run_ontology_checks(self.wiki_dir)
        self.assertEqual(res["violations_count"], 1)
        self.assertEqual(res["violations"][0]["rule"], "Rule 3 (Stable Human Verification)")

    def test_ontology_rules_passing(self):
        # Valid note setup
        note_a = self.wiki_dir / "valid-a.md"
        note_a.write_text("""---
type: Concept
status: stable
verified:
  - by: "human:alby69"
---
Links to [[valid-b]].
""", encoding="utf-8")

        note_b = self.wiki_dir / "valid-b.md"
        note_b.write_text("""---
type: Article
status: draft
---
Content for valid B.
""", encoding="utf-8")

        res = run_ontology_checks(self.wiki_dir)
        self.assertEqual(res["violations_count"], 0)


if __name__ == "__main__":
    unittest.main()
