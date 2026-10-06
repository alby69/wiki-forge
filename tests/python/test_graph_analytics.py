import tempfile
from pathlib import Path
import pytest
from scripts.graph_analytics import compute_clusters

def test_graph_analytics_computation():
    with tempfile.TemporaryDirectory() as tmpdir:
        wiki_p = Path(tmpdir)

        note1 = wiki_p / "note1.md"
        note1.write_text("# Note 1\nLink to [[note2]]", encoding="utf-8")

        note2 = wiki_p / "note2.md"
        note2.write_text("# Note 2\nLink to [[note1]] and [[note3]]", encoding="utf-8")

        note3 = wiki_p / "note3.md"
        note3.write_text("# Note 3\nLink to [[note2]]", encoding="utf-8")

        res = compute_clusters(str(wiki_p))
        assert res["total_nodes"] == 3
        assert res["total_edges"] == 2
        assert res["cluster_count"] >= 1
        assert "clusters" in res
