"""
config.py — Centralized Configuration Loader for Wiki-Forge.

WHAT THIS DOES
--------------
Provides a single source of truth for loading `config.toml`, resolving relative directory
paths to absolute Path objects, and managing default configurations across all scripts
and backend services.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from src.backend.wikiforge.core.exceptions import ConfigError


def get_repo_root() -> Path:
    """Return the absolute path to the repository root directory."""
    return Path(__file__).resolve().parent.parent.parent.parent.parent


def resolve_config_path(target_dir: str | Path | None = None) -> Path:
    """
    Locate the config.toml file for the project or repository.
    """
    root = get_repo_root()
    candidates = []

    if target_dir:
        t_path = Path(target_dir).expanduser().resolve()
        candidates.extend([
            t_path / "config" / "config.toml",
            t_path / "config.toml",
        ])

    candidates.extend([
        Path.cwd() / "config" / "config.toml",
        Path.cwd() / "config.toml",
        root / "config" / "config.toml",
        root / "config.toml",
    ])

    for cand in candidates:
        if cand.is_file():
            return cand

    return root / "config" / "config.toml"


def get_project_config(target_dir: str | Path | None = None) -> dict[str, Any]:
    """
    Load `config.toml`, resolve directory paths absolutely, and return merged dictionary.

    Returns:
        dict containing 'project', 'paths', 'resolved_paths', 'conversion', and 'audio'.
    """
    repo_root = get_repo_root()
    base_dir = Path(target_dir).expanduser().resolve() if target_dir else Path.cwd()

    defaults: dict[str, Any] = {
        "project": {
            "name": "llm-wiki",
            "title": "LLM Wiki Knowledge Base",
            "language": "en",
            "context": "",
        },
        "paths": {
            "sources": "backup",
            "raw": "raw",
            "wiki": "wiki",
            "output": "output",
            "notes": "notes",
        },
        "conversion": {
            "ocr": False,
        },
        "audio": {
            "enabled": False,
            "provider": "none",
        },
    }

    cfg_file = resolve_config_path(target_dir)

    data: dict[str, Any] = {}
    if cfg_file.is_file():
        try:
            import tomllib
            with cfg_file.open("rb") as fh:
                data = tomllib.load(fh)
        except Exception as exc:
            raise ConfigError(f"Failed to parse configuration file at {cfg_file}: {exc}") from exc

    merged: dict[str, Any] = {
        "project": {**defaults["project"], **data.get("project", {})},
        "paths": {**defaults["paths"], **data.get("paths", {})},
        "conversion": {**defaults["conversion"], **data.get("conversion", {})},
        "audio": {**defaults["audio"], **data.get("audio", {})},
        "config_file": str(cfg_file),
    }

    # Include any extra sections from config.toml
    for key, val in data.items():
        if key not in merged and isinstance(val, dict):
            merged[key] = val

    # Resolve paths absolutely
    resolved_paths: dict[str, Path] = {}
    for p_key, p_val in merged["paths"].items():
        raw_p = Path(str(p_val)).expanduser()
        if raw_p.is_absolute():
            resolved_paths[p_key] = raw_p
        else:
            # Check base_dir first, then repo_root
            cand_base = (base_dir / raw_p).resolve()
            cand_root = (repo_root / raw_p).resolve()
            if cand_base.exists():
                resolved_paths[p_key] = cand_base
            elif cand_root.exists():
                resolved_paths[p_key] = cand_root
            else:
                resolved_paths[p_key] = cand_base

    merged["resolved_paths"] = resolved_paths
    return merged
