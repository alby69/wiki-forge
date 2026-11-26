"""A0 — the L4 gate must count real competency-question gaps.

The CQ validator writes `❌ **Uncovered (Knowledge Gaps)**: N` in the summary
and `❌ Scoperte (knowledge gap)` in each detailed status line. The health
engine used to count only `❌ Unanswered` / `[FAILED]`, so `cq_gaps` stayed 0
and L4 could be reported with real gaps still open.
"""

from pathlib import Path

import pytest

from src.backend.wikiforge.api import health
from src.backend.wikiforge.procedures import ProcedureEngine


CLEAN_REPORT = """# Competency Questions (CQ) Validation Report

**Coverage Summary**: 3/3 (100.0%) CQs Fully Covered

- ✅ **Covered**: 3
- ⚠️ **Partially Covered**: 0
- ❌ **Uncovered (Knowledge Gaps)**: 0

## Detailed Question Breakdown

### CQ-01: Quali enti sono collegati?
- **Status**: ✅ Coperte
"""


GAPPY_REPORT = """# Competency Questions (CQ) Validation Report

**Coverage Summary**: 0/3 (0.0%) CQs Fully Covered

- ✅ **Covered**: 0
- ⚠️ **Partially Covered**: 0
- ❌ **Uncovered (Knowledge Gaps)**: 3

## Detailed Question Breakdown

### CQ-01: Prima domanda?
- **Status**: ❌ Scoperte (knowledge gap)
- **Identified Gap**: Missing structured properties

### CQ-02: Seconda domanda?
- **Status**: ❌ Scoperte (knowledge gap)

### CQ-03: Terza domanda?
- **Status**: ❌ Scoperte (knowledge gap)
"""


def test_summary_line_is_the_authoritative_gap_count():
    assert health.count_cq_gaps(GAPPY_REPORT) == 3


def test_detail_lines_are_counted_when_summary_is_absent():
    report = GAPPY_REPORT.replace("- ❌ **Uncovered (Knowledge Gaps)**: 3", "")
    assert health.count_cq_gaps(report) == 3


def test_legacy_english_markers_are_still_recognised():
    report = "\n".join(
        [
            "- ❌ Unanswered: why?",
            "- [FAILED] on another question",
            "- ✅ Covered: fine",
        ]
    )
    assert health.count_cq_gaps(report) == 2


def test_casing_and_emoji_variants_do_not_reset_the_count():
    report = "\n".join(
        [
            "- ❌ **UNCOVERED (KNOWLEDGE GAPS)**: 2",
            "- **status**: ❌ scoperte (Knowledge Gap)",
        ]
    )
    assert health.count_cq_gaps(report) == 2


def test_clean_report_has_no_gaps():
    assert health.count_cq_gaps(CLEAN_REPORT) == 0


def test_real_cq_validator_output_is_parsed(tmp_path: Path):
    """Use the actual report builder so a future label change is caught."""
    from scripts.cq_validator import generate_report

    results = [
        {
            "cq_id": f"CQ-0{i}",
            "question": f"Domanda {i}?",
            "status": "UNCOVERED",
            "status_label": "❌ Scoperte (knowledge gap)",
            "coverage_score": 0.0,
            "matched_notes": [],
            "missing_elements": ["Missing structured properties or relations"],
        }
        for i in range(1, 4)
    ]
    report = generate_report(results, tmp_path / "cq_validation_report.md")

    assert health.count_cq_gaps(report) == 3


def _make_repo(tmp_path: Path, report: str) -> Path:
    """Minimal wiki with one self-linked note and a controllable CQ report."""
    wiki = tmp_path / "wiki"
    wiki.mkdir()
    (wiki / "self-note.md").write_text(
        """---
title: Self Note
type: Article
status: draft
---

# Self Note

Vedi [[self-note]] per il contesto.
""",
        encoding="utf-8",
    )
    out = tmp_path / "output"
    out.mkdir()
    (out / "cq_validation_report.md").write_text(report, encoding="utf-8")
    return tmp_path


def _gate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        health,
        "assess_ke_maturity",
        lambda repo_root, wiki_dir: {"overall_stage": "L3", "average_level": 3.0},
    )
    return health.compute_health_metrics(tmp_path, wiki_dir=tmp_path / "wiki")


def test_gate_stays_below_l4_with_real_gaps(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    result = _gate(_make_repo(tmp_path, GAPPY_REPORT), monkeypatch)

    assert result["metrics"]["cq_gaps"] == 3
    assert result["maturity_level"] != "L4"
    assert any(a["id"] == "ke.validate-cq" for a in result["next_best_actions"])
    assert result["health_score"] < 100.0


def test_gate_can_reach_l4_when_report_is_clean(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    result = _gate(_make_repo(tmp_path, CLEAN_REPORT), monkeypatch)

    assert result["metrics"]["cq_gaps"] == 0
    assert result["maturity_level"] == "L4"
    assert all(a["id"] != "ke.validate-cq" for a in result["next_best_actions"])


def test_health_artifacts_stay_in_unified_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    _gate(_make_repo(tmp_path, CLEAN_REPORT), monkeypatch)

    assert (tmp_path / ".wiki-forge" / "health" / "STATUS.md").is_file()
    assert (tmp_path / ".wiki-forge" / "health" / "metrics" / "history.jsonl").is_file()
    assert not (tmp_path / ".wikiforge").exists()


def test_procedure_state_stays_in_unified_root(tmp_path: Path):
    engine = ProcedureEngine(tmp_path, procedures_dir=tmp_path / "config" / "procedures")

    assert engine.state_dir == tmp_path / ".wiki-forge" / "procedures" / "state"
    assert engine.state_dir.is_dir()
    assert not (tmp_path / ".wikiforge" / "state").exists()
