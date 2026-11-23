from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from src.backend.wikiforge.semantics.orphan_repair import collect_findings

ROOT = Path(__file__).resolve().parents[2]


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _source(links: str) -> str:
    return (
        "---\ntitle: Source\ntype: Concept\nstatus: draft\n---\n\n"
        f"# Source\n\n{links}\n"
    )


def test_collect_findings_is_deterministic_and_ignores_resolved_links(tmp_path: Path) -> None:
    wiki = tmp_path / "wiki"
    _write(wiki / "source.md", _source("[[deep/nested/target]] [[Missing Page]] [[existing]]"))
    _write(wiki / "existing.md", _source("no links"))

    first = collect_findings(wiki)
    second = collect_findings(wiki)

    assert [item.findingId for item in first] == [item.findingId for item in second]
    assert first == second
    orphans = [item for item in first if item.kind == "orphan_node"]
    assert [item.targetPath for item in orphans] == [
        "wiki/deep-nested-target.md",
        "wiki/missing-page.md",
    ]
    assert all(item.proposedAction == "repair-orphan" for item in orphans)
    assert all("source=wiki/source.md" in item.evidence for item in orphans)


def test_collect_findings_is_idempotent_after_stub_creation(tmp_path: Path) -> None:
    wiki = tmp_path / "wiki"
    _write(wiki / "source.md", _source("[[Missing Page]]"))

    before = collect_findings(wiki)
    assert len([item for item in before if item.kind == "orphan_node"]) == 1

    _write(wiki / "missing-page.md", _source("no links"))
    after = collect_findings(wiki)
    assert after == []


def test_collect_findings_reports_frontmatter_inconsistencies(tmp_path: Path) -> None:
    wiki = tmp_path / "wiki"
    _write(wiki / "bad.md", "---\ntitle: Bad\ntype: Concept\nstatus: obsolete\n---\n\n# Bad\n")
    _write(wiki / "missing-type.md", "# Missing type\n")

    findings = collect_findings(wiki)
    assert [item.kind for item in findings] == ["inconsistency", "inconsistency"]
    assert all(item.proposedAction == "fix-okf-frontmatter" for item in findings)
    assert [item.targetPath for item in findings] == [
        "wiki/bad.md",
        "wiki/missing-type.md",
    ]


def test_cli_emits_read_only_findings_envelope(tmp_path: Path) -> None:
    wiki = tmp_path / "wiki"
    _write(wiki / "source.md", _source("[[Missing Page]]"))

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "src.backend.wikiforge.semantics.orphan_repair",
            "--findings",
            "--wiki-dir",
            str(wiki),
            "--wiki-rel",
            "wiki",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    envelope = json.loads(result.stdout)
    assert envelope["schema"] == "wikiforge.finding/v1"
    assert envelope["count"] == 1
    assert envelope["findings"][0]["targetPath"] == "wiki/missing-page.md"
