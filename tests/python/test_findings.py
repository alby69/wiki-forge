"""A1 — unified read-only Finding model and detector adapters."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

import cq_validator
import graph_analytics
import okf_lint
import odp_suggester
from src.backend.wikiforge.core.findings import (
    FINDINGS_SCHEMA,
    VALID_KINDS,
    Finding,
    findings_envelope,
    make_finding,
)

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
ID_RE = re.compile(r"^[a-z_]+-[a-z0-9-]+-[0-9a-f]{12}$")


def _finding(kind: str = "knowledge_gap", **overrides) -> Finding:
    values = {
        "kind": kind,
        "confidence": 0.8,
        "evidence": ["cq=CQ-1", "status=UNCOVERED"],
        "targetPath": "wiki/competency_questions.md",
        "proposedAction": "deep-research",
    }
    values.update(overrides)
    return make_finding(**values)


def _assert_schema(findings: list[Finding]) -> None:
    envelope = findings_envelope(findings)
    assert set(envelope) == {"schema", "count", "findings"}
    assert envelope["schema"] == FINDINGS_SCHEMA
    assert envelope["count"] == len(findings)
    for item in envelope["findings"]:
        assert set(item) == {
            "findingId", "kind", "confidence", "evidence", "targetPath", "proposedAction",
        }
        assert item["kind"] in VALID_KINDS
        assert 0.0 <= item["confidence"] <= 1.0
        assert isinstance(item["evidence"], list) and item["evidence"]
        assert ID_RE.match(item["findingId"]), item["findingId"]


def test_finding_id_is_deterministic_and_order_independent():
    first = _finding()
    again = _finding(evidence=["status=UNCOVERED", "cq=CQ-1"])
    assert first == again
    assert first.findingId.startswith("knowledge_gap-wiki-competency-questions-md-")
    assert first.findingId == again.findingId

    different = _finding(evidence=["cq=CQ-2", "status=UNCOVERED"])
    assert different.findingId != first.findingId


def test_finding_validates_its_inputs():
    with pytest.raises(ValueError):
        _finding(kind="unknown")
    with pytest.raises(ValueError):
        _finding(confidence=1.5)
    with pytest.raises(ValueError):
        _finding(proposedAction="")
    with pytest.raises(ValueError):
        _finding(evidence=[])


def test_adapters_emit_the_same_read_only_schema():
    cq_results = [{
        "cq_id": "CQ-1", "question": "Quali policy sono documentate?",
        "status": "UNCOVERED", "status_label": "❌ Scoperte (knowledge gap)",
        "coverage_score": 0.0, "matched_notes": [],
        "missing_elements": ["Missing structured properties"],
    }]
    graph_result = {
        "clusters": {}, "community_map": {},
        "surprising_connections": [{
            "source": "a", "target": "b",
            "community_source": "community_1", "community_target": "community_2",
        }],
        "knowledge_gaps": [{
            "node": "lonely", "title": "Lonely", "degree": 0,
            "reason": "Isolated or low connectivity (<2 links)", "action": "Deep Research",
        }],
    }
    odp_results = [{
        "note_id": "contract", "path": "wiki/contract.md",
        "suggestions": [{
            "pattern_id": "employment_role", "pattern_name": "Employment",
            "triggered_by": ["Trigger word: 'contratto'", "YAML key: 'contract'"],
            "suggested_frontmatter": {"employment": {}},
        }],
    }]
    lint_errors = ["wiki/bad.md: Missing YAML frontmatter enclosed in '---'."]

    batches = [
        cq_validator.findings_from_cq(cq_results),
        graph_analytics.findings_from_graph(graph_result, {"lonely": "wiki/lonely.md"}),
        odp_suggester.findings_from_odp(odp_results),
        okf_lint.findings_from_lint(lint_errors),
    ]
    for findings in batches:
        _assert_schema(findings)
        assert findings == sorted(findings, key=lambda finding: finding.findingId)

    assert {finding.kind for finding in batches[0]} == {"knowledge_gap"}
    assert {finding.kind for finding in batches[1]} == {"inconsistency", "orphan_node"}
    assert {finding.kind for finding in batches[2]} == {"odp_suggestion"}
    assert {finding.kind for finding in batches[3]} == {"inconsistency"}

    # Reversing detector-internal ordering must not change the ids.
    reversed_odp = [{
        "note_id": "contract", "path": "wiki/contract.md",
        "suggestions": [{
            "pattern_id": "employment_role",
            "triggered_by": ["YAML key: 'contract'", "Trigger word: 'contratto'"],
            "suggested_frontmatter": {},
        }],
    }]
    assert [f.findingId for f in odp_suggester.findings_from_odp(reversed_odp)] == [
        f.findingId for f in batches[2]
    ]


@pytest.fixture
def wiki(tmp_path: Path) -> Path:
    root = tmp_path / "project"
    notes = root / "wiki"
    notes.mkdir(parents=True)
    (notes / "index.md").write_text('---\nokf_version: "0.2"\n---\n# Index\n', encoding="utf-8")
    (notes / "log.md").write_text("## 2026-11-22\n- Initialized.\n", encoding="utf-8")
    # The CQ file lives outside the vault: otherwise the validator would match
    # the question against its own text and report it as COVERED.
    (root / "cq.md").write_text(
        "# Competency Questions\n\n- CQ1: Quali policy quantum-safe sono documentate?\n",
        encoding="utf-8",
    )
    (notes / "contract_note.md").write_text(
        "---\ntitle: Contract Note\ntype: Concept\nstatus: stable\n---\n"
        "# Contract\n\nIl contratto prevede uno salary indicizzato.\n",
        encoding="utf-8",
    )
    (notes / "bad.md").write_text("# Solo Markdown\n", encoding="utf-8")
    (root / "output").mkdir()
    return root


def _snapshot(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*")) if path.is_file()
    }


def _run_detector(script: str, cwd: Path, *args: str) -> dict:
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        [sys.executable, str(SCRIPTS / f"{script}.py"), "--findings", *args],
        cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", check=True,
    )
    payload = json.loads(completed.stdout)
    assert payload["schema"] == FINDINGS_SCHEMA
    assert payload["count"] == len(payload["findings"])
    return payload


def test_cli_findings_are_unified_deterministic_and_read_only(wiki: Path):
    before = _snapshot(wiki)
    commands = {
        "cq_validator": ("--cq-file", "cq.md"),
        "graph_analytics": (),
        "odp_suggester": ("--catalog", str(ROOT / "config" / "odp_catalog.json")),
        "okf_lint": (),
    }

    first = {name: _run_detector(name, wiki, *args) for name, args in commands.items()}
    second = {name: _run_detector(name, wiki, *args) for name, args in commands.items()}

    for name in commands:
        assert first[name] == second[name], f"{name} emitted non-deterministic findings"
        for item in first[name]["findings"]:
            assert set(item) == {
                "findingId", "kind", "confidence", "evidence", "targetPath", "proposedAction",
            }
            assert ID_RE.match(item["findingId"])

    kinds = {item["kind"] for payload in first.values() for item in payload["findings"]}
    assert {"knowledge_gap", "orphan_node", "inconsistency", "odp_suggestion"} <= kinds
    assert _snapshot(wiki) == before
    assert not (wiki / "output" / "cq_validation_report.md").exists()
