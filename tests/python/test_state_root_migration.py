"""Migration, rollback and single-root tests on an anonymized v3 vault."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import migrate_state_roots
from src.backend.wikiforge.procedures import ProcedureEngine

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "state_root_v3_legacy"
MIGRATOR = REPO_ROOT / "scripts" / "migrate_state_roots.py"


def _vault(tmp_path: Path) -> Path:
    vault = tmp_path / "vault"
    shutil.copytree(FIXTURE, vault)
    return vault


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _hashes(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): _sha256(path)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def _run_status(vault: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(MIGRATOR), "--status", "--root", str(vault)],
        capture_output=True,
        text=True,
    )


def test_status_reports_roots_without_writing(tmp_path: Path) -> None:
    vault = _vault(tmp_path)

    result = migrate_state_roots.status(vault)

    assert result["status"] == "not_migrated"
    assert result["legacy_exists"] is True
    assert result["canonical_exists"] is False
    assert result["planned_entries"] == len(_hashes(vault / ".wikiforge"))
    assert not (vault / ".wiki-forge").exists()


def test_status_cli_exits_zero_with_legacy_root(tmp_path: Path) -> None:
    vault = _vault(tmp_path)

    completed = _run_status(vault)

    assert completed.returncode == 0
    assert json.loads(completed.stdout)["legacy_exists"] is True


def test_status_cli_exits_one_on_real_error(tmp_path: Path) -> None:
    vault = _vault(tmp_path)
    manifest = vault / ".wiki-forge" / "state-root-migration.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text("{", encoding="utf-8")

    completed = _run_status(vault)

    assert completed.returncode == 1


def test_apply_migrates_anonymized_vault_losslessly(tmp_path: Path) -> None:
    vault = _vault(tmp_path)
    before = _hashes(vault / ".wikiforge")

    manifest = migrate_state_roots.apply(vault)

    assert manifest["status"] == "applied"
    assert {entry["legacy"] for entry in manifest["entries"]} == set(before)
    for entry in manifest["entries"]:
        target = vault / ".wiki-forge" / entry["canonical"]
        assert _sha256(target) == before[entry["legacy"]] == entry["sha256"]
        assert (vault / ".wikiforge" / entry["legacy"]).is_file()
    assert migrate_state_roots.apply(vault) == manifest


def test_rollback_restores_anonymized_vault(tmp_path: Path) -> None:
    vault = _vault(tmp_path)
    before = _hashes(vault / ".wikiforge")

    manifest = migrate_state_roots.apply(vault)
    migrated = [vault / ".wiki-forge" / entry["canonical"] for entry in manifest["entries"]]
    assert all(path.is_file() for path in migrated)

    rolled_back = migrate_state_roots.rollback(vault)

    assert rolled_back is not None
    assert rolled_back["status"] == "rolled_back"
    assert _hashes(vault / ".wikiforge") == before
    assert all(not path.exists() for path in migrated)
    assert migrate_state_roots.rollback(vault)["status"] == "rolled_back"


def test_rollback_restores_preexisting_canonical_file(tmp_path: Path) -> None:
    vault = _vault(tmp_path)
    canonical_status = vault / ".wiki-forge" / "health" / "STATUS.md"
    canonical_status.parent.mkdir(parents=True)
    canonical_status.write_text("canonical status\n", encoding="utf-8")

    migrate_state_roots.apply(vault)
    migrate_state_roots.rollback(vault)

    assert canonical_status.read_text(encoding="utf-8") == "canonical status\n"
    assert (vault / ".wikiforge" / "STATUS.md").read_text(encoding="utf-8") == "# Health snapshot (anonymized example vault)\nstatus: ok\n"


def test_procedure_engine_ignores_legacy_state(tmp_path: Path) -> None:
    vault = _vault(tmp_path)
    engine = ProcedureEngine(vault, procedures_dir=vault / "config" / "procedures")

    assert engine.get_run("run-example") is None
    assert engine.list_runs() == []

    migrate_state_roots.apply(vault)

    assert engine.get_run("run-example")["run_id"] == "run-example"
    assert [run["run_id"] for run in engine.list_runs()] == ["run-example"]


def test_entrypoint_warns_only_while_legacy_root_exists(tmp_path: Path) -> None:
    vault = _vault(tmp_path)
    entrypoint = REPO_ROOT / "entrypoint.sh"

    before = subprocess.run(
        ["sh", str(entrypoint), "true"],
        cwd=vault,
        capture_output=True,
        text=True,
    )
    assert before.returncode == 0
    assert "WARNING: legacy .wikiforge/ still exists" in before.stderr

    migrate_state_roots.apply(vault)
    shutil.rmtree(vault / ".wikiforge")
    after = subprocess.run(
        ["sh", str(entrypoint), "true"],
        cwd=vault,
        capture_output=True,
        text=True,
    )
    assert after.returncode == 0
    assert "WARNING: legacy .wikiforge/" not in after.stderr
