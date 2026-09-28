#!/usr/bin/env python3
"""
tests/test_standalone_scripts.py
Tests standalone CLI execution of Python scripts in scripts/ with --json flag.
"""

import unittest
import subprocess
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

class TestStandaloneScripts(unittest.TestCase):

    def run_script(self, script_name: str, args: list[str]) -> tuple[int, str, str]:
        cmd = [sys.executable, str(REPO_ROOT / "scripts" / script_name)] + args
        res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO_ROOT))
        return res.returncode, res.stdout, res.stderr

    def test_conv2md_json(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp_dir:
            test_file = Path(tmp_dir) / "test.txt"
            test_file.write_text("Hello world", encoding="utf-8")
            out_dir = Path(tmp_dir) / "out"
            code, out, err = self.run_script("conv2md.py", ["--json", "--input", tmp_dir, "--output", str(out_dir)])
            self.assertEqual(code, 0, f"conv2md failed with stderr: {err}")
            data = json.loads(out)
            self.assertEqual(data.get("status"), "success")

    def test_okf_stats_json(self):
        code, out, err = self.run_script("okf_stats.py", ["wiki", "--json"])
        self.assertEqual(code, 0, f"okf_stats failed with stderr: {err}")
        data = json.loads(out)
        self.assertEqual(data.get("status"), "success")
        self.assertIn("stats", data)

    def test_wiki_stats_json(self):
        code, out, err = self.run_script("wiki_stats.py", ["--json"])
        self.assertEqual(code, 0, f"wiki_stats failed with stderr: {err}")
        data = json.loads(out)
        self.assertEqual(data.get("status"), "success")
        self.assertIn("stats", data)

    def test_maturity_calculator_json(self):
        code, out, err = self.run_script("maturity_calculator.py", ["wiki", "--json"])
        self.assertEqual(code, 0, f"maturity_calculator failed with stderr: {err}")
        data = json.loads(out)
        self.assertEqual(data.get("status"), "success")

    def test_check_docs_sync_json(self):
        code, out, err = self.run_script("check_docs_sync.py", ["--json"])
        # Might return 0 if docs synced
        data = json.loads(out)
        self.assertIn("status", data)

    def test_okf_reindex_json(self):
        code, out, err = self.run_script("okf_reindex.py", ["wiki", "--json"])
        self.assertEqual(code, 0, f"okf_reindex failed with stderr: {err}")
        data = json.loads(out)
        self.assertEqual(data.get("status"), "success")

if __name__ == "__main__":
    unittest.main()
