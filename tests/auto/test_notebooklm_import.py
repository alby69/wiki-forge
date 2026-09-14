import unittest
import tempfile
import shutil
from pathlib import Path

from scripts.notebooklm_import import process_file, generate_okf_frontmatter
from scripts.okf_lint import lint_file

class TestNotebookLMImport(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.raw_dir = self.temp_dir / "raw"
        self.raw_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_generate_okf_frontmatter(self):
        fm = generate_okf_frontmatter("Sample Title", "Research Notes")
        self.assertIn("type: StudyGuide", fm)
        self.assertIn("status: draft", fm)
        self.assertIn("by: human:utente", fm)
        self.assertIn("NotebookLM Export: Research Notes", fm)
        self.assertIn("topic/notebooklm", fm)

    def test_process_file_without_existing_frontmatter(self):
        input_file = self.temp_dir / "study_session.md"
        input_content = "# NotebookLM Notes\n\nThis is a summary of the uploaded document."
        input_file.write_text(input_content, encoding="utf-8")

        output_path = process_file(input_file, self.raw_dir, "AI Research Paper")

        self.assertTrue(output_path.exists())
        self.assertEqual(output_path.name, "study_session_NOTEBOOKLM.md")

        content = output_path.read_text(encoding="utf-8")
        self.assertIn("type: StudyGuide", content)
        self.assertIn("# NotebookLM Notes", content)

        # OKF lint validation
        errors = lint_file(output_path, self.raw_dir)
        self.assertEqual(errors, [])

    def test_process_file_with_existing_frontmatter(self):
        input_file = self.temp_dir / "export_with_fm.md"
        input_content = """---
title: Old Frontmatter Title
tags: [old, tag]
---

# Clean Content

Content after existing frontmatter.
"""
        input_file.write_text(input_content, encoding="utf-8")

        output_path = process_file(input_file, self.raw_dir, "Podcast Notes")

        content = output_path.read_text(encoding="utf-8")
        self.assertIn("type: StudyGuide", content)
        self.assertNotIn("title: Old Frontmatter Title", content)
        self.assertIn("# Clean Content", content)

        # OKF lint validation
        errors = lint_file(output_path, self.raw_dir)
        self.assertEqual(errors, [])

if __name__ == "__main__":
    unittest.main()
