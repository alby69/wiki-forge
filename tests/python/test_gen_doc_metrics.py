"""Regression tests for manifest-derived documentation metrics."""

import json
from pathlib import Path

import check_docs_sync
import gen_doc_metrics


def _fixture(tmp_path: Path) -> Path:
    manifest = {
        "routes": [{}, {}],
        "busCommands": ["a", "b", "c"],
        "slashCommands": [{}, {}, {}, {}],
        "implementedSlashCommands": ["a"],
        "mcpTools": [{}, {}, {}, {}, {}],
        "gaps": [{}],
    }
    manifest_path = tmp_path / gen_doc_metrics.MANIFEST_REL
    manifest_path.parent.mkdir(parents=True)
    manifest_path.write_text(
        gen_doc_metrics.MANIFEST_PREFIX + json.dumps(manifest) + ";\n",
        encoding="utf-8",
    )
    for rel in gen_doc_metrics.ACTIVE_DOCS:
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if rel in gen_doc_metrics.METRIC_DOCS:
            content = "# Doc\n\n<!-- metrics:start -->\nold\n<!-- metrics:end -->\n"
        else:
            content = "# Doc\n"
        path.write_text(content, encoding="utf-8")
    roadmap = tmp_path / "ROADMAP.md"
    roadmap.write_text(
        "Baseline: **2 route HTTP**, **3 handler bus**, **4 comandi slash / 1 con case dedicato**, "
        "**5 tool MCP**, **1 gap noti**.\n",
        encoding="utf-8",
    )
    return tmp_path


def test_load_counts_reads_generated_manifest(tmp_path: Path) -> None:
    root = _fixture(tmp_path)
    assert gen_doc_metrics.load_counts(root) == {
        "routes": 2,
        "bus_handlers": 3,
        "slash_commands": 4,
        "slash_implemented": 1,
        "mcp_tools": 5,
        "gaps": 1,
    }


def test_apply_docs_refreshes_metric_blocks(tmp_path: Path) -> None:
    root = _fixture(tmp_path)
    assert gen_doc_metrics.apply_docs(root) == []
    for rel in gen_doc_metrics.METRIC_DOCS:
        content = (root / rel).read_text(encoding="utf-8")
        assert "| Route HTTP | 2 |" in content
        assert "| Tool MCP | 5 |" in content
    assert gen_doc_metrics.check_docs(root) == []


def test_stale_prose_is_reported(tmp_path: Path) -> None:
    root = _fixture(tmp_path)
    gen_doc_metrics.apply_docs(root)
    roadmap = root / "ROADMAP.md"
    roadmap.write_text(roadmap.read_text(encoding="utf-8").replace("**5 tool MCP**", "**118 tool MCP**"))
    errors = gen_doc_metrics.check_docs(root)
    assert any("ROADMAP.md:1" in error and "Tool MCP" in error for error in errors)


def test_missing_marker_is_reported(tmp_path: Path) -> None:
    root = _fixture(tmp_path)
    readme = root / "README.md"
    readme.write_text(readme.read_text(encoding="utf-8").replace("<!-- metrics:end -->", ""))
    errors = gen_doc_metrics.check_docs(root)
    assert any("README.md" in error and "metrics:end" in error for error in errors)


def test_check_docs_sync_includes_metric_errors(tmp_path: Path) -> None:
    root = _fixture(tmp_path)
    assert check_docs_sync.check_doc_metrics(root)
    gen_doc_metrics.apply_docs(root)
    assert check_docs_sync.check_doc_metrics(root) == []
