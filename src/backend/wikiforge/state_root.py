"""Canonical state-root helpers for Python health and procedure artifacts.

All runtime reads and writes use ``.wiki-forge/``. Legacy vaults are handled
only by ``scripts/migrate_state_roots.py``, which owns the old root name.
"""

from __future__ import annotations

import os
from pathlib import Path

CANONICAL_ROOT_NAME = ".wiki-forge"

HEALTH_STATUS = "health/STATUS.md"
HEALTH_HISTORY = "health/metrics/history.jsonl"
HEALTH_EVAL_REPORT = "health/eval/latest.json"
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


def canonical_path(repo_root: Path | str, relative: str) -> Path:
    return canonical_root(repo_root) / relative
