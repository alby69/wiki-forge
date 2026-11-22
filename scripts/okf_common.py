#!/usr/bin/env python3
"""
scripts/okf_common.py
Shared path-resolution helpers for wiki-forge panel scripts.

Scripts historically assumed they were launched from the repository root with
a single `wiki/` folder. With the multi-project layout (projects/<id>/wiki)
and runners that may chdir to either the repo root or a project root, a bare
relative path like "wiki" must resolve to the first *existing* candidate:

    <cwd>/<value> -> projects/<selected>/<value> -> <repo_root>/<value> -> projects/<id>/<value>

The selected project comes from WIKIFORGE_PROJECT_ID, exported by the Script
Control Panel for the wiki chosen in the header picker. Without it the legacy
behaviour is preserved.

If no candidate exists (e.g. report files that are about to be created) the
cwd candidate is used, preserving legacy behaviour.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def check_json_schema(script_id: str) -> None:
    """Check if --json-schema flag is present in sys.argv and print schema."""
    if "--json-schema" in sys.argv:
        repo = repo_root()
        if str(repo) not in sys.path:
            sys.path.insert(0, str(repo))
        try:
            from src.backend.wikiforge.core.script_schema import check_and_handle_json_schema
            check_and_handle_json_schema(script_id)
        except Exception as e:
            import json
            print(json.dumps({"id": script_id, "error": str(e)}))
            sys.exit(0)


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def ensure_repo_root_on_path() -> None:
    """Make `src.backend.*` importable from a script launched by the runner.

    The runner spawns `python <installation>/scripts/<tool>.py` with the
    *project* directory as cwd, so the repository root is not on `sys.path`.
    This is a side-effect-free path bootstrap shared by the A1 detectors.
    """
    root = str(repo_root())
    if root not in sys.path:
        sys.path.insert(0, root)


def load_findings_api():
    """Lazily import the A1 read-only model (only used by `--findings`).

    Legacy invocations must not depend on the installation's `src/` tree: some
    embedders copy only `scripts/` into the project workspace.
    """
    ensure_repo_root_on_path()
    from src.backend.wikiforge.core import findings
    return findings


ACTIVE_PROJECT_ENV = "WIKIFORGE_PROJECT_ID"


def detect_project_id() -> str | None:
    """Return the id of the wiki project targeted by the current runner.

    The Script Control Panel exports WIKIFORGE_PROJECT_ID for the project
    selected in the header picker. When present (and valid) it takes priority
    over the legacy scan, which used to always return the first project with a
    wiki/ folder -- i.e. `tesi` even while the user was on `wikiforge`.
    Direct CLI invocations without the env var keep the legacy behaviour.
    """
    env_id = os.environ.get(ACTIVE_PROJECT_ENV, "").strip()
    if env_id:
        scoped = repo_root() / "projects" / env_id
        if (scoped / "wiki").is_dir():
            return env_id
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
    bases = [Path.cwd(), repo_root()]
    project_id = detect_project_id()
    if project_id:
        scoped = repo_root() / "projects" / project_id
        if scoped not in bases:
            bases.insert(1, scoped)
    return bases + _project_roots()


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

    if raw in ("config.toml", "config/config.toml"):
        for base in _candidates(raw):
            cand_config = (base / "config" / "config.toml").resolve()
            if cand_config.exists():
                return cand_config
            cand_root = (base / "config.toml").resolve()
            if cand_root.exists():
                return cand_root

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