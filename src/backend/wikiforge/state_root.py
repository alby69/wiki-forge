"""Unified state-root helpers for Python health and procedure artifacts.

Canonical state lives under ``.wiki-forge/``. ``.wikiforge/`` is read as a
compatibility fallback until ``scripts/migrate_state_roots.py --apply`` moves
existing vaults. Writers never touch the legacy root.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator, Tuple

CANONICAL_ROOT_NAME = ".wiki-forge"
LEGACY_ROOT_NAME = ".wikiforge"

HEALTH_STATUS = "health/STATUS.md"
HEALTH_HISTORY = "health/metrics/history.jsonl"
PROCEDURE_STATE = "procedures/state"
PROCEDURE_WIZARD = "procedures/wizard_state.json"
PROGRAM_CHANGE_SNAPSHOTS = "program-change-snapshots"


def _repo_root(repo_root: Path | str) -> Path:
    return Path(repo_root).resolve()


def canonical_root(repo_root: Path | str) -> Path:
    override = os.environ.get("WIKIFORGE_PYTHON_STATE_ROOT")
    if override:
        path = Path(override)
        return (path if path.is_absolute() else _repo_root(repo_root) / path).resolve()
    return _repo_root(repo_root) / CANONICAL_ROOT_NAME


def legacy_root(repo_root: Path | str) -> Path:
    return _repo_root(repo_root) / LEGACY_ROOT_NAME


def canonical_path(repo_root: Path | str, relative: str) -> Path:
    return canonical_root(repo_root) / relative


def legacy_path(repo_root: Path | str, relative: str) -> Path:
    return legacy_root(repo_root) / relative


def resolve_read_path(
    repo_root: Path | str,
    relative: str,
    legacy_relative: str | None = None,
) -> Path | None:
    """Return the canonical path when present, otherwise the legacy fallback."""
    canonical = canonical_path(repo_root, relative)
    if canonical.exists():
        return canonical
    legacy = legacy_path(repo_root, legacy_relative or relative)
    if legacy.exists():
        return legacy
    return None


def iter_read_paths(
    repo_root: Path | str,
    canonical_glob: str,
    legacy_glob: str | None = None,
) -> Iterator[Tuple[str, Path]]:
    """Yield ``(name, path)`` pairs, canonical entries winning over legacy ones."""
    seen: set[str] = set()
    for path in sorted(canonical_root(repo_root).glob(canonical_glob)):
        if path.is_file() and path.name not in seen:
            seen.add(path.name)
            yield path.name, path
    for path in sorted(legacy_root(repo_root).glob(legacy_glob or canonical_glob)):
        if path.is_file() and path.name not in seen:
            seen.add(path.name)
            yield path.name, path
