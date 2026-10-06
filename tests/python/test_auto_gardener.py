import tempfile
from pathlib import Path
import pytest
from scripts.auto_gardener import run_gardener

def test_auto_gardener_duplicate_detection():
    with tempfile.TemporaryDirectory() as tmpdir:
        wiki_p = Path(tmpdir) / "wiki"
        out_p = Path(tmpdir) / "output"
        wiki_p.mkdir()

        # Create two notes with high text similarity and sharing 2 tags
        note1 = wiki_p / "artificial_intelligence.md"
        note1.write_text(
            "---\ntitle: Artificial Intelligence\ntags: [ai, tech, science]\n---\n"
            "# Artificial Intelligence\n"
            "Artificial intelligence machine learning deep learning neural networks algorithms and data models.",
            encoding="utf-8"
        )

        note2 = wiki_p / "machine_learning_ai.md"
        note2.write_text(
            "---\ntitle: Machine Learning AI\ntags: [ai, tech, engineering]\n---\n"
            "# Machine Learning AI\n"
            "Artificial intelligence machine learning deep learning neural networks algorithms and data models.",
            encoding="utf-8"
        )

        res = run_gardener(wiki_dir=str(wiki_p), output_dir=str(out_p), similarity_threshold=0.85)

        assert res["total_notes"] == 2
        assert len(res["duplicates"]) == 1
        dup = res["duplicates"][0]
        assert dup["similarity"] >= 0.85
        assert set(dup["common_tags"]) == {"ai", "tech"}
        assert "/merge" in dup["suggestion"]

        report_content = (out_p / "gardening_report.md").read_text(encoding="utf-8")
        assert "Possibili Duplicati Concettuali" in report_content
        assert "/merge" in report_content
