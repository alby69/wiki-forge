"""Tests for dual-read and migration of unified Python state roots."""

from __future__ import annotations

import json
from pathlib import Path

import migrate_state_roots
from src.backend.wikiforge.procedures import ProcedureEngine


def _make_legacy(root: Path) -> None:
    legacy = root / ".wikiforge"
    (legacy / "metrics").mkdir(parents=True)
    (legacy / "state").mkdir(parents=True)
    (legacy / "program-change-snapshots" / "docs__README.md").mkdir(parents=True)
    (legacy / "STATUS.md").write_text("legacy status\n", encoding="utf-8")
    (legacy / "metrics" / "history.jsonl").write_text('{"score": 1}\n', encoding="utf-8")
    (legacy / "state" / "run-old.json").write_text(
        json.dumps({"run_id": "run-old", "procedure_id": "p", "status": "completed"}),
        encoding="utf-8",
    )
    (legacy / "wizard_state.json").write_text('{"run_id": "run-old"}\n', encoding="utf-8")
    (legacy / "program-change-snapshots" / "docs__README.md" / "stamp.bak").write_text(
        "legacy file\n", encoding="utf-8"
    )


def test_apply_copies_legacy_files_and_creates_backup(tmp_path: Path) -> None:
    _make_legacy(tmp_path)

    manifest = migrate_state_roots.apply(tmp_path)

    assert manifest["status"] == "applied"
    assert (tmp_path / ".wiki-forge" / "health" / "STATUS.md").read_text(encoding="utf-8") == "legacy status\n"
    assert (tmp_path / ".wiki-forge" / "procedures" / "state" / "run-old.json").is_file()
    assert (tmp_path / ".wiki-forge" / "procedures" / "wizard_state.json").is_file()
    assert (tmp_path / ".wiki-forge" / "program-change-snapshots" / "docs__README.md" / "stamp.bak").is_file()
    assert (tmp_path / ".wikiforge" / "STATUS.md").is_file()
    backup = tmp_path / ".wiki-forge" / manifest["backup"]
    assert (backup / "legacy" / "STATUS.md").is_file()
    assert (backup / "canonical" / "health" / "STATUS.md").exists() is False
    assert migrate_state_roots.apply(tmp_path) == manifest


def test_rollback_restores_backup_and_removes_migrated_only_files(tmp_path: Path) -> None:
    _make_legacy(tmp_path)
    canonical_status = tmp_path / ".wiki-forge" / "health" / "STATUS.md"
    canonical_status.parent.mkdir(parents=True)
    canonical_status.write_text("canonical status\n", encoding="utf-8")

    migrate_state_roots.apply(tmp_path)
    rolled_back = migrate_state_roots.rollback(tmp_path)

    assert rolled_back is not None
    assert rolled_back["status"] == "rolled_back"
    assert (tmp_path / ".wikiforge" / "STATUS.md").read_text(encoding="utf-8") == "legacy status\n"
    assert canonical_status.read_text(encoding="utf-8") == "canonical status\n"
    assert not (tmp_path / ".wiki-forge" / "procedures" / "state" / "run-old.json").exists()
    assert migrate_state_roots.rollback(tmp_path)["status"] == "rolled_back"


def test_procedure_reads_legacy_state_before_and_after_migration(tmp_path: Path) -> None:
    _make_legacy(tmp_path)
    engine = ProcedureEngine(tmp_path, procedures_dir=tmp_path / "config" / "procedures")

    assert engine.get_run("run-old")["run_id"] == "run-old"
    assert [run["run_id"] for run in engine.list_runs()] == ["run-old"]

    migrate_state_roots.apply(tmp_path)

    assert engine.get_run("run-old")["run_id"] == "run-old"
    assert [run["run_id"] for run in engine.list_runs()] == ["run-old"]
