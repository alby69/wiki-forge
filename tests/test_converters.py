import unittest
import tempfile
from pathlib import Path
from src.wikiforge.semantics.markdown_to_rdf import ZettelToRDFConverter, escape_ttl_string, slugify as slugify_ttl
from src.wikiforge.semantics.markdown_to_cypher import ZettelToCypherConverter, escape_cypher_string, slugify as slugify_cypher

class TestConverters(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.input_dir = Path(self.temp_dir.name) / "notes"
        self.input_dir.mkdir(parents=True, exist_ok=True)

        self.note1_path = self.input_dir / "note-001.md"
        self.note1_path.write_text(
            "---\n"
            "id: note-001\n"
            "title: Knowledge Graph Fundamentals\n"
            "created: '2026-03-15'\n"
            "author: Guus Schreiber\n"
            "tags: [kg, rdf, zettelkasten]\n"
            "---\n\n"
            "# Knowledge Graph Fundamentals\n\n"
            "An introduction to Knowledge Graphs and RDF.\n"
            "It [[supports::note-002]] and [[contradicts::legacy-relational-db]].\n",
            encoding="utf-8"
        )

        self.note2_path = self.input_dir / "note-002.md"
        self.note2_path.write_text(
            "---\n"
            "id: note-002\n"
            "title: SHACL Shape Validation\n"
            "created: '2026-03-16'\n"
            "author: Elisa Kendall\n"
            "tags: [shacl, validation]\n"
            "---\n\n"
            "# SHACL Shape Validation\n\n"
            "Validating knowledge structures with SHACL shapes.\n",
            encoding="utf-8"
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_rdf_converter(self):
        converter = ZettelToRDFConverter()
        output_ttl = Path(self.temp_dir.name) / "output.ttl"
        converter.process_directory(self.input_dir, output_ttl)

        content = output_ttl.read_text(encoding="utf-8")
        self.assertIn("wfid:note-001 a wf:PermanentNote", content)
        self.assertIn('dcterms:identifier "note-001"', content)
        self.assertIn('dcterms:title "Knowledge Graph Fundamentals"', content)
        self.assertIn('prov:wasAttributedTo wfid:agent-guus-schreiber', content)
        self.assertIn("wf:supports wfid:note-002", content)
        self.assertIn("wf:contradicts wfid:legacy-relational-db", content)

    def test_cypher_converter(self):
        converter = ZettelToCypherConverter()
        output_cypher = Path(self.temp_dir.name) / "output.cypher"
        converter.process_directory(self.input_dir, output_cypher)

        content = output_cypher.read_text(encoding="utf-8")
        self.assertIn("CREATE CONSTRAINT note_id_unique", content)
        self.assertIn("MERGE (n_note_001:PermanentNote {id: 'note-001'})", content)
        self.assertIn("SET n_note_001.title = 'Knowledge Graph Fundamentals'", content)
        self.assertIn("WAS_ATTRIBUTED_TO", content)
        self.assertIn("SUPPORTS", content)
        self.assertIn("CONTRADICTS", content)

if __name__ == "__main__":
    unittest.main()
