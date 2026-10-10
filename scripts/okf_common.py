#!/usr/bin/env python3
"""
scripts/okf_common.py
Shared path-resolution helpers for wiki-forge panel scripts.

Scripts historically assumed they were launched from the repository root with
a single `wiki/` folder. With the multi-project layout (projects/<id>/wiki)
and runners that may chdir to either the repo root or a project root, a bare
relative path like "wiki" must resolve to the first *existing* candidate:

    <cwd>/<value> -> <repo_root>/<value> -> projects/<id>/<value>

If no candidate exists (e.g. report files that are about to be created) the
cwd candidate is used, preserving legacy behaviour.
"""

from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def detect_project_id() -> str | None:
    """Return the id of the first project whose wiki/ folder exists."""
    for proj in _project_roots():
        if (proj / "wiki").is_dir():
            return proj.name
    return None


def _project_roots() -> list[Path]:
    projects = repo_root() / "projects"
    if not projects.is_dir():
        return []
    return [p for p in sorted(projects.iterdir()) if p.is_dir()]


def _candidates(value: str) -> list[Path]:
    return [Path.cwd(), repo_root()] + _project_roots()


def resolve_path(value: str | None, default: str = "") -> Path:
    """Resolve `value` (or `default`) to an absolute path.

    Absolute inputs are returned as-is. Relative inputs are matched against
    the cwd, the repo root, and each project root; the first existing
    candidate wins, otherwise the cwd-relative path is returned.
    """
    raw = (value or "").strip() or default
    p = Path(raw).expanduser()
    if p.is_absolute() or not raw:
        return p

    for base in _candidates(raw):
        cand = (base / raw).resolve()
        if cand.exists():
            return cand

    return (Path.cwd() / raw).resolve()


def resolve_dir(value: str | None, default: str = "wiki", env: str = "WIKI_FORGE_WIKI_DIR") -> Path:
    """Resolve a *directory* argument (default: the wiki folder).

    Prefers existing directories; falls back to resolve_path semantics so
    output/ingest directories that do not exist yet still get created in cwd.
    """
    raw = (value or "").strip()
    if not raw and env:
        raw = os.environ.get(env, "").strip()
    if not raw:
        raw = default

    p = Path(raw).expanduser()
    if p.is_absolute():
        return p

    candidates = _candidates(raw)
    for base in candidates:
        cand = (base / raw).resolve()
        if cand.is_dir():
            return cand
    for base in candidates:
        cand = (base / raw).resolve()
        if cand.exists():
            return cand

    return (Path.cwd() / raw).resolve()