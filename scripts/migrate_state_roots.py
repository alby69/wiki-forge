#!/usr/bin/env python3
"""Migrate legacy Python state artifacts into the unified .wiki-forge root."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import socket
import sys
import time
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.wikiforge.state_root import (  # noqa: E402
    HEALTH_HISTORY,
    HEALTH_STATUS,
    PROCEDURE_STATE,
    PROCEDURE_WIZARD,
    PROGRAM_CHANGE_SNAPSHOTS,
    canonical_root,
)

LEGACY_ROOT_NAME = ".wikiforge"
MANIFEST_REL = "state-root-migration.json"
LOCK_REL = "state-root-migration.lock"
BACKUPS_REL = "backups/state-root-migration"
STALE_LOCK_SECONDS = 600

MAPPINGS: tuple[tuple[str, str], ...] = (
    ("STATUS.md", HEALTH_STATUS),
    ("metrics/history.jsonl", HEALTH_HISTORY),
    ("state", PROCEDURE_STATE),
    ("wizard_state.json", PROCEDURE_WIZARD),
    ("program-change-snapshots", PROGRAM_CHANGE_SNAPSHOTS),
)


def legacy_root(root: Path) -> Path:
    return root.resolve() / LEGACY_ROOT_NAME


def _timestamp() -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(path)


def _source_files(root: Path, legacy_rel: str) -> Iterable[Path]:
    source = legacy_root(root) / legacy_rel
    if source.is_file():
        yield source
    elif source.is_dir():
        for path in sorted(source.rglob("*")):
            if path.is_file():
                yield path


def _canonical_path(root: Path, legacy_rel: str, canonical_rel: str, source: Path) -> Path:
    source_root = legacy_root(root) / legacy_rel
    if source_root.is_dir():
        return canonical_root(root) / canonical_rel / source.relative_to(source_root)
    return canonical_root(root) / canonical_rel


def _backup_path(backup_dir: Path, side: str, rel: Path) -> Path:
    return backup_dir / side / rel


def _acquire_lock(root: Path) -> Path:
    lock = canonical_root(root) / LOCK_REL
    lock.parent.mkdir(parents=True, exist_ok=True)
    if lock.exists():
        age = time.time() - lock.stat().st_mtime
        if age < STALE_LOCK_SECONDS:
            raise RuntimeError(f"migration lock is held: {lock} ({lock.read_text(encoding='utf-8').strip()})")
        lock.unlink()
    lock.write_text(f"{socket.gethostname()}:{os.getpid()}\n", encoding="utf-8")
    return lock


def _plan(root: Path) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for legacy_rel, canonical_rel in MAPPINGS:
        for source in _source_files(root, legacy_rel):
            target = _canonical_path(root, legacy_rel, canonical_rel, source)
            entries.append(
                {
                    "legacy": source.relative_to(legacy_root(root)).as_posix(),
                    "canonical": target.relative_to(canonical_root(root)).as_posix(),
                    "legacy_existed": True,
                    "canonical_existed": target.exists(),
                    "sha256": _sha256(source),
                }
            )
    return entries


def apply(root: Path) -> dict[str, Any]:
    manifest_path = canonical_root(root) / MANIFEST_REL
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("status") == "applied":
            return manifest

    lock = _acquire_lock(root)
    try:
        entries = _plan(root)
        stamp = _timestamp()
        backup_dir = canonical_root(root) / BACKUPS_REL / stamp
        for entry in entries:
            legacy_file = legacy_root(root) / entry["legacy"]
            canonical_file = canonical_root(root) / entry["canonical"]
            legacy_backup = _backup_path(backup_dir, "legacy", Path(entry["legacy"]))
            canonical_backup = _backup_path(backup_dir, "canonical", Path(entry["canonical"]))
            legacy_backup.parent.mkdir(parents=True, exist_ok=True)
            canonical_backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(legacy_file, legacy_backup)
            if canonical_file.exists():
                shutil.copy2(canonical_file, canonical_backup)
            else:
                canonical_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(legacy_file, canonical_file)
                entry["canonical_existed"] = False

        manifest = {
            "status": "applied",
            "created_at": stamp,
            "backup": backup_dir.relative_to(canonical_root(root)).as_posix(),
            "entries": entries,
        }
        _atomic_json(manifest_path, manifest)
        return manifest
    finally:
        lock.unlink(missing_ok=True)


def rollback(root: Path) -> dict[str, Any] | None:
    manifest_path = canonical_root(root) / MANIFEST_REL
    if not manifest_path.exists():
        return None
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("status") != "applied":
        return manifest

    lock = _acquire_lock(root)
    try:
        backup_dir = canonical_root(root) / manifest["backup"]
        for entry in manifest["entries"]:
            legacy_file = legacy_root(root) / entry["legacy"]
            canonical_file = canonical_root(root) / entry["canonical"]
            legacy_backup = _backup_path(backup_dir, "legacy", Path(entry["legacy"]))
            canonical_backup = _backup_path(backup_dir, "canonical", Path(entry["canonical"]))

            if legacy_backup.exists():
                legacy_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(legacy_backup, legacy_file)
            else:
                legacy_file.unlink(missing_ok=True)

            if canonical_backup.exists():
                canonical_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(canonical_backup, canonical_file)
            else:
                canonical_file.unlink(missing_ok=True)

        manifest["status"] = "rolled_back"
        _atomic_json(manifest_path, manifest)
        return manifest
    finally:
        lock.unlink(missing_ok=True)


def status(root: Path) -> dict[str, Any]:
    canonical = canonical_root(root)
    manifest_path = canonical / MANIFEST_REL
    result: dict[str, Any] = {
        "canonical_exists": canonical.is_dir(),
        "legacy_exists": legacy_root(root).is_dir(),
    }
    if not manifest_path.is_file():
        result["status"] = "not_migrated"
        result["planned_entries"] = len(_plan(root))
        return result
    result.update(json.loads(manifest_path.read_text(encoding="utf-8")))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--rollback", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    root = args.root.resolve()
    if args.apply:
        result: Any = apply(root)
    elif args.rollback:
        result = rollback(root)
    elif args.status or not args.dry_run:
        result = status(root)
    else:
        result = {"status": "dry_run", "entries": _plan(root)}

    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
