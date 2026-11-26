"""Tests for the Fase 76 wiki -> program change bridge."""

import json
from pathlib import Path

import pytest

import program_change_common as common
import wiki_program_change_apply as apply_script
import wiki_program_change_propose as propose_script


TARGET = "docs/program-change-target.md"
ORIGINAL = "# Target\n\nValore iniziale.\n\nFine.\n"


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    target = tmp_path / TARGET
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(ORIGINAL, encoding="utf-8")
    (tmp_path / "output").mkdir()
    return tmp_path


def _proposal(find: str = "Valore iniziale.", replace: str = "Valore finale.", file: str = TARGET) -> dict:
    return {
        "title": "Aggiorna valore",
        "rationale": "La wiki documenta il nuovo valore approvato.",
        "sources": ["docs/standard/SELF_WIKI.md", "projects/wikiforge/wiki/index.md"],
        "project": "wikiforge",
        "edits": [{"file": file, "find": find, "replace": replace}],
    }


def test_parse_wiki_edits_from_assistant_answer():
    answer = (
        "Ho consultato la wiki e propongo:\n\n"
        "```wiki-edit\n"
        "file: docs/program-change-target.md\n"
        "find: |\n"
        "  Valore iniziale.\n"
        "replace: |\n"
        "  Valore finale.\n"
        "```\n\n"
        "Fammi sapere se procedo.\n"
    )
    edits = common.parse_wiki_edits(answer)
    assert len(edits) == 1
    assert edits[0]["file"] == TARGET
    assert edits[0]["find"] == "Valore iniziale."
    assert edits[0]["replace"] == "Valore finale."


def test_validate_edit_rejects_out_of_scope_and_ambiguous(repo: Path):
    with pytest.raises(ValueError, match="allowlist"):
        common.validate_edit(repo, {"file": ".git/config", "find": "a", "replace": "b"})
    with pytest.raises(ValueError, match="traversal"):
        common.validate_edit(repo, {"file": "../secret.md", "find": "a", "replace": "b"})
    with pytest.raises(ValueError, match="ambiguous"):
        common.validate_edit(repo, {"file": TARGET, "find": "\n", "replace": "x"})
    with pytest.raises(ValueError, match="not found"):
        common.validate_edit(repo, {"file": TARGET, "find": "inesistente", "replace": "x"})


def test_propose_is_read_only_deterministic_and_grounded(repo: Path):
    stage_dir = repo / "output" / "program-changes"
    proposal = _proposal()

    first = propose_script.analyze(repo, proposal, stage_dir)
    second = propose_script.analyze(repo, proposal, stage_dir)

    assert first["status"] == "success"
    assert first["staged"] is True
    assert second["staged"] is False
    assert first["id"] == second["id"]
    assert first["rationale"]
    assert "docs/standard/SELF_WIKI.md" in first["sources"]
    assert (repo / TARGET).read_text(encoding="utf-8") == ORIGINAL, "propose must not write program files"
    record = json.loads((stage_dir / f"{first['id']}.json").read_text(encoding="utf-8"))
    assert record["status"] == "pending"
    assert record["id"] == first["id"]


def test_propose_rejects_missing_rationale_or_sources(repo: Path):
    bad = _proposal()
    bad["rationale"] = ""
    result = propose_script.analyze(repo, bad, repo / "output" / "program-changes")
    assert result["status"] == "error"
    assert any("rationale" in error for error in result["errors"])


def test_apply_requires_human_reviewer_and_confirmation(repo: Path):
    proposal = _proposal()
    stage_dir = repo / "output" / "program-changes"

    result = apply_script.apply_change(repo, proposal, "process:bot", stage_dir, dry_run=True)
    assert result["status"] == "error"
    assert any("human:<id>" in error for error in result["errors"])
    assert (repo / TARGET).read_text(encoding="utf-8") == ORIGINAL


def test_apply_requires_the_proposal_to_be_staged(repo: Path):
    stage_dir = repo / "output" / "program-changes"
    result = apply_script.apply_change(repo, _proposal(), "human:alby69", stage_dir, dry_run=True)
    assert result["status"] == "error"
    assert any("not staged" in error for error in result["errors"])


def test_apply_writes_snapshot_audit_and_refuses_replay(repo: Path):
    stage_dir = repo / "output" / "program-changes"
    proposal = _proposal()
    staged = propose_script.analyze(repo, proposal, stage_dir)
    assert staged["status"] == "success"

    result = apply_script.apply_change(repo, proposal, "human:alby69", stage_dir)
    assert result["status"] == "success"
    assert result["files"] == [TARGET]
    assert result["snapshots"], "a snapshot must be taken before the write"
    assert "Valore finale." in (repo / TARGET).read_text(encoding="utf-8")

    record = json.loads((stage_dir / f"{staged['id']}.json").read_text(encoding="utf-8"))
    assert record["status"] == "applied"
    assert record["applied_by"] == "human:alby69"

    audit = (repo / "output" / "program-changes" / "audit.jsonl").read_text(encoding="utf-8").strip().splitlines()
    assert len(audit) == 1
    entry = json.loads(audit[0])
    assert entry["actor"] == "human"
    assert entry["change_id"] == staged["id"]
    assert entry["sources"]

    replay = apply_script.apply_change(repo, proposal, "human:alby69", stage_dir)
    assert replay["status"] == "error"
    assert any("already applied" in error for error in replay["errors"])
    assert "Valore finale." in (repo / TARGET).read_text(encoding="utf-8")
