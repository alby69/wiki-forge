import unittest
import tempfile
import shutil
from pathlib import Path

from scripts.maturity_calculator import calculate_maturity, update_file_maturity
from scripts.generate_thesis import build_thesis

class TestThesisSystem(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.wiki_dir = self.temp_dir / "wiki"
        self.wiki_dir.mkdir()
        self.output_dir = self.temp_dir / "output"

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_calculate_maturity_score(self):
        fm = {
            "sources": ["src1", "src2"],
            "domande_origine": ["q1"],
            "collegamenti": ["link1"],
            "stato": "draft"
        }
        body = "\n\nThis is a sample note with [[wikilink1]] and [[wikilink2]] and some text content to test maturity calculation.\n" * 10
        metrics = calculate_maturity(fm, body)

        # Sources: 2 * 15 = 30
        # Questions: 1 * 5 = 5
        # Links: (1 fm + 2 body wikilinks) * 3 = 9
        # Word count bonus: ~150 words / 50 = 3
        # Total score: 30 + 5 + 9 + 3 = 47
        self.assertEqual(metrics["copertura_fonti"], 2)
        self.assertEqual(metrics["domande_risolte"], 1)
        self.assertEqual(metrics["collegamenti"], 3)
        self.assertEqual(metrics["maturita"], 47)

    def test_update_file_maturity_and_write(self):
        note_path = self.wiki_dir / "sintesi_test.md"
        note_content = """---
id: test-sintesi
tipo: sintesi
titolo: "Test Synthesis"
stato: draft
fonti:
  - fonte-1
  - fonte-2
domande_origine:
  - q1
  - q2
collegamenti:
  - concetto-1
  - concetto-2
---

# Test Synthesis Note

This note includes [[concept-a]] and [[concept-b]] with significant text.
""" + "Word " * 200

        note_path.write_text(note_content, encoding="utf-8")

        res = update_file_maturity(note_path, write=True)
        self.assertGreaterEqual(res["maturita"], 50)
        self.assertTrue(res["updated"])

        updated_text = note_path.read_text(encoding="utf-8")
        self.assertIn("maturita:", updated_text)
        self.assertIn("copertura_fonti: 2", updated_text)

    def test_build_thesis_compilation(self):
        ch1 = self.wiki_dir / "capitolo1.md"
        ch1.write_text("""---
tipo: capitolo_tesi
titolo: "Introduzione all'IA"
capitolo_numero: 1
maturita: 90
---

# Introduzione

Contesto dell'intelligenza artificiale.
""", encoding="utf-8")

        syn1 = self.wiki_dir / "sintesi1.md"
        syn1.write_text("""---
tipo: sintesi
titolo: "Cristianini vs Graeber"
maturita: 85
---

# Sintesi

Analisi comparativa.
""", encoding="utf-8")

        output_file = self.output_dir / "thesis_compiled.md"
        build_thesis(self.wiki_dir, output_file, min_maturity=50, title="Tesi Test")

        self.assertTrue(output_file.exists())
        content = output_file.read_text(encoding="utf-8")
        self.assertIn("Tesi Test", content)
        self.assertIn("Capitolo 1: Introduzione all'IA", content)
        self.assertIn("Cristianini vs Graeber", content)

if __name__ == "__main__":
    unittest.main()
