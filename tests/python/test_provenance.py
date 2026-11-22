"""B5 — shared actor grammar and server-only process provenance."""

import json
from pathlib import Path

import pytest

import actor_provenance as provenance
import okf_lint
import promote_doc_answer
import program_change_common as common
import wiki_program_change_apply as apply_script
import wiki_program_change_propose as propose_script


TARGET = "docs/provenance-target.md"
ORIGINAL = "# Target\n\nVecchio valore.\n"


def test_canonical_actor_grammar_is_shared():
    assert provenance.is_canonical_actor("human:alice")
    assert provenance.is_canonical_actor("process:api-token")
    assert provenance.is_canonical_actor("wikiforge/1.0")
    assert not provenance.is_canonical_actor("mario")
    assert not provenance.is_canonical_actor("human:bad id")

    assert okf_lint.ACTOR_REGEX is provenance.ACTOR_RE
    assert promote_doc_answer.ACTOR_RE is provenance.HUMAN_ACTOR_RE
    assert common.REVIEWER_RE is provenance.HUMAN_ACTOR_RE
    assert common.PROCESS_REVIEWER_RE is provenance.PROCESS_ACTOR_RE


def test_canonical_actor_does_not_invent_human_identity():
    assert provenance.canonical_actor("human:alice") == "human:alice"
    assert provenance.canonical_actor("process:api token") == "process:api-token"
    assert provenance.canonical_actor("mario") == "process:api-token"
    assert provenance.actor_kind("process:bot") == "process"
    assert provenance.actor_kind("human:alice") == "human"


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    target = tmp_path / TARGET
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(ORIGINAL, encoding="utf-8")
    (tmp_path / "output").mkdir()
    return tmp_path


def _proposal() -> dict:
    return {
        "title": "Provenance B5",
        "rationale": "Approvazione server-trusted.",
        "sources": ["docs/SELF_WIKI_PLAN.md"],
        "project": "wikiforge",
        "edits": [{"file": TARGET, "find": "Vecchio valore.", "replace": "Nuovo valore."}],
    }


def test_process_actor_requires_explicit_flag(repo: Path):
    stage_dir = repo / "output" / "program-changes"

    denied = apply_script.apply_change(
        repo, _proposal(), "process:bot", stage_dir, allow_process_actor=False
    )
    assert denied["status"] == "error"
    assert any("human:<id>" in error for error in denied["errors"])


def test_process_actor_is_audited_when_server_injects_flag(repo: Path):
    stage_dir = repo / "output" / "program-changes"
    staged = propose_script.analyze(repo, _proposal(), stage_dir)
    assert staged["status"] == "success"

    result = apply_script.apply_change(
        repo,
        _proposal(),
        "process:api-token",
        stage_dir,
        allow_process_actor=True,
    )
    assert result["status"] == "success"
    assert result["reviewer"] == "process:api-token"
    assert "Nuovo valore." in (repo / TARGET).read_text(encoding="utf-8")

    audit = (stage_dir / "audit.jsonl").read_text(encoding="utf-8").strip().splitlines()
    entry = json.loads(audit[-1])
    assert entry["reviewer"] == "process:api-token"
    assert entry["actor"] == "process"
