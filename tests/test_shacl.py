import unittest
import tempfile
from pathlib import Path
from rdflib import Graph
from pyshacl import validate

from src.wikiforge.semantics.markdown_to_rdf import ZettelToRDFConverter

class TestSHACLValidation(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.input_dir = Path(self.temp_dir.name) / "notes"
        self.input_dir.mkdir(parents=True, exist_ok=True)
        self.shapes_path = Path("src/wikiforge/config/shapes.ttl")

        # Create valid note
        self.valid_note = self.input_dir / "valid-note-001.md"
        self.valid_note.write_text(
            "---\n"
            "id: note-001\n"
            "title: Valid Zettelkasten Note\n"
            "created: '2026-03-20'\n"
            "author: Sönke Ahrens\n"
            "tags: [zettelkasten, note]\n"
            "---\n\n"
            "# Valid Zettelkasten Note\n\n"
            "This is a valid Zettelkasten note with proper metadata.\n",
            encoding="utf-8"
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_shacl_conformance_valid_notes(self):
        converter = ZettelToRDFConverter()
        output_ttl = Path(self.temp_dir.name) / "knowledge_graph.ttl"
        converter.process_directory(self.input_dir, output_ttl)

        data_g = Graph().parse(str(output_ttl), format="turtle")
        shapes_g = Graph().parse(str(self.shapes_path), format="turtle")

        conforms, results_graph, results_text = validate(
            data_graph=data_g,
            shacl_graph=shapes_g,
            inference="rdfs",
            abort_on_first=False
        )

        self.assertTrue(conforms, f"SHACL validation failed:\n{results_text}")

if __name__ == "__main__":
    unittest.main()
