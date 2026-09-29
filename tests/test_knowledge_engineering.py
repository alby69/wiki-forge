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
from scripts.cq_validator import extract_competency_questions, evaluate_cq, load_wiki_notes
from scripts.odp_suggester import load_odp_catalog, analyze_note_for_odp
from scripts.neuro_symbolic_check import check_neuro_symbolic_consistency
from scripts.ke_maturity import assess_ke_maturity
from src.server.mcp_server import execute_tool


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

    def test_cq_validation_engine(self):
        cq_file = self.wiki_dir / "competency_questions.md"
        cq_file.write_text("""# CQs
- CQ1: Quante ferie spettano a Mario, che è part-time al 60%?
""", encoding="utf-8")

        mario_note = self.wiki_dir / "mario.md"
        mario_note.write_text("""---
type: Entity
employment:
  role: Employee
  working_percentage: 60
---
Mario ha un contratto part-time e ferie proporzionate.
""", encoding="utf-8")

        cqs = extract_competency_questions(cq_file)
        self.assertEqual(len(cqs), 1)

        notes = load_wiki_notes(self.wiki_dir)
        eval_res = evaluate_cq(cqs[0], notes)
        self.assertEqual(eval_res["status"], "COVERED")

    def test_odp_suggester(self):
        catalog_path = self.test_dir / "odp_catalog.json"
        catalog_path.write_text(json.dumps({
            "patterns": [
                {
                    "id": "employment_role",
                    "name": "Employment Pattern",
                    "triggers": ["contratto", "part-time"],
                    "informal_keys": ["contract"],
                    "suggested_structure": {"employment": {"role": "Employee"}}
                }
            ]
        }), encoding="utf-8")

        note = self.wiki_dir / "informal-employee.md"
        note.write_text("""---
type: Concept
contract: PartTime
---
Mario ha un contratto part-time.
""", encoding="utf-8")

        patterns = load_odp_catalog(catalog_path)
        res = analyze_note_for_odp(note, patterns, self.test_dir)
        self.assertIsNotNone(res)
        self.assertEqual(len(res["suggestions"]), 1)
        self.assertEqual(res["suggestions"][0]["pattern_id"], "employment_role")

    def test_neuro_symbolic_check(self):
        note_a = self.wiki_dir / "stable-unverified.md"
        note_a.write_text("""---
status: stable
verified: []
---
Links to [[note-b]].
""", encoding="utf-8")

        res = check_neuro_symbolic_consistency(self.test_dir, self.wiki_dir)
        self.assertGreaterEqual(len(res["contradictions"]), 1)
        self.assertEqual(res["contradictions"][0]["note_id"], "stable-unverified")

    def test_ke_maturity_assessment(self):
        assessment = assess_ke_maturity(self.test_dir, self.wiki_dir)
        self.assertIn("overall_stage", assessment)
        self.assertIn("average_level", assessment)

    def test_mcp_new_tools(self):
        cq_file = self.wiki_dir / "competency_questions.md"
        cq_file.write_text("""- CQ1: Test question?""", encoding="utf-8")

        res_cq = execute_tool(self.wiki_dir.parent, "validate_competency_question", {"question": "Test question?"})
        self.assertIn("cq_id", res_cq)

        res_gaps = execute_tool(self.wiki_dir.parent, "get_ontology_gaps", {})
        self.assertIn("summary", res_gaps)


if __name__ == "__main__":
    unittest.main()
