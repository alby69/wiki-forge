#!/usr/bin/env python3
"""
scripts/ke_common.py
Shared Knowledge Engineering library for wiki-forge.

Provides core primitives for multi-project resolution, configuration loading,
page parsing, wikilink resolution (supporting prefLabel and altLabel),
schema loading, and machine/human output formatting.
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Any

try:
    import yaml
except ImportError:
    yaml = None  # Handled gracefully if missing

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None


@dataclass
class RelationSchema:
    inverse: str | None = None
    transitive: bool = False
    acyclic: bool = False
    symmetric: bool = False


@dataclass
class TypeSchema:
    required: list[str] = field(default_factory=list)
    optional: list[str] = field(default_factory=list)
    relations: dict[str, str] = field(default_factory=dict)  # relation_name -> expected_target_type


@dataclass
class Schema:
    enabled: bool = False
    strict: bool = False
    types: dict[str, TypeSchema] = field(default_factory=dict)
    relations: dict[str, RelationSchema] = field(default_factory=dict)


@dataclass
class Page:
    id: str
    path: Path
    rel_path: str
    frontmatter: dict[str, Any]
    body: str


def get_project_root(project: str | None = None) -> Path:
    repo_root = Path(__file__).resolve().parent.parent
    if project and project != "default":
        proj_dir = repo_root / "projects" / project
        if proj_dir.exists():
            return proj_dir
    return repo_root


def load_config(project: str | None = None, config_path: Path | str | None = None) -> dict:
    defaults = {
        "project": {"name": project or "default"},
        "paths": {
            "sources": "backup",
            "raw": "raw",
            "wiki": "wiki",
            "output": "output",
            "notes": "notes",
        },
        "schema": {
            "enabled": False,
            "strict": False,
        },
    }

    if config_path:
        cfg_path = Path(config_path)
    else:
        proj_root = get_project_root(project)
        cfg_path = proj_root / "config.toml"
        if not cfg_path.is_file() and project:
            # Fallback to repo root config if project config is missing
            cfg_path = Path(__file__).resolve().parent.parent / "config.toml"

    if cfg_path.is_file():
        with cfg_path.open("rb") as fh:
            data = tomllib.load(fh)
        for section, values in data.items():
            if isinstance(values, dict):
                defaults.setdefault(section, {}).update(values)
            else:
                defaults[section] = values
    return defaults


def parse_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    if not content.startswith("---"):
        return {}, content
    parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
    if len(parts) >= 3:
        if yaml is None:
            return {}, parts[2]
        try:
            fm = yaml.safe_load(parts[1])
            body = parts[2]
            return (fm if isinstance(fm, dict) else {}), body
        except Exception:
            return {}, content
    return {}, content


def iter_pages(project: str | None = None, wiki_dir: Path | str | None = None) -> list[Page]:
    proj_root = get_project_root(project)
    if wiki_dir is None:
        cfg = load_config(project)
        wiki_rel = cfg.get("paths", {}).get("wiki", "wiki")
        wiki_path = proj_root / wiki_rel
    else:
        wiki_path = Path(wiki_dir)
        if not wiki_path.is_absolute():
            wiki_path = proj_root / wiki_path

    if not wiki_path.exists() or not wiki_path.is_dir():
        return []

    pages: list[Page] = []
    for file_path in sorted(wiki_path.rglob("*.md")):
        rel_p = file_path.relative_to(wiki_path)
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        fm, body = parse_frontmatter(content)
        page_id = file_path.stem
        pages.append(
            Page(
                id=page_id,
                path=file_path,
                rel_path=str(rel_p),
                frontmatter=fm,
                body=body,
            )
        )
    return pages


def clean_wikilink(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("[[") and cleaned.endswith("]]"):
        cleaned = cleaned[2:-2]
    if "|" in cleaned:
        cleaned = cleaned.split("|")[0]
    if "#" in cleaned:
        cleaned = cleaned.split("#")[0]
    return cleaned.strip()


def resolve_wikilink(text: str, pages: Iterable[Page]) -> Page | None:
    target = clean_wikilink(text)
    if not target:
        return None

    target_lower = target.lower()
    target_stem = Path(target).stem.lower()

    # 1. Direct match by id/stem or rel_path without extension
    for page in pages:
        if page.id.lower() == target_lower or page.id.lower() == target_stem:
            return page
        if page.rel_path.lower() == target_lower or page.rel_path[:-3].lower() == target_lower:
            return page

    # 2. Match by prefLabel or altLabel in frontmatter (case-insensitive)
    for page in pages:
        pref = str(page.frontmatter.get("prefLabel", "")).strip().lower()
        if pref and pref == target_lower:
            return page

        alt_labels = page.frontmatter.get("altLabel", [])
        if isinstance(alt_labels, str):
            alt_labels = [alt_labels]
        if isinstance(alt_labels, list):
            for alt in alt_labels:
                if str(alt).strip().lower() == target_lower:
                    return page

    return None


def load_schema(config: dict) -> Schema:
    s_cfg = config.get("schema", {})
    enabled = bool(s_cfg.get("enabled", False))
    strict = bool(s_cfg.get("strict", False))

    types_dict: dict[str, TypeSchema] = {}
    raw_types = s_cfg.get("types", {})
    if isinstance(raw_types, dict):
        for type_name, type_def in raw_types.items():
            if isinstance(type_def, dict):
                req = type_def.get("required", [])
                opt = type_def.get("optional", [])
                rel = type_def.get("relations", {})
                types_dict[type_name.lower()] = TypeSchema(
                    required=list(req) if isinstance(req, list) else [],
                    optional=list(opt) if isinstance(opt, list) else [],
                    relations=dict(rel) if isinstance(rel, dict) else {},
                )

    relations_dict: dict[str, RelationSchema] = {}
    raw_relations = s_cfg.get("relations", {})
    if isinstance(raw_relations, dict):
        for rel_name, rel_def in raw_relations.items():
            if isinstance(rel_def, dict):
                relations_dict[rel_name.lower()] = RelationSchema(
                    inverse=rel_def.get("inverse"),
                    transitive=bool(rel_def.get("transitive", False)),
                    acyclic=bool(rel_def.get("acyclic", False)),
                    symmetric=bool(rel_def.get("symmetric", False)),
                )

    return Schema(
        enabled=enabled,
        strict=strict,
        types=types_dict,
        relations=relations_dict,
    )


def emit(result: dict[str, Any], as_json: bool = False, exit_on_error: bool = True) -> None:
    if as_json:
        print(json.dumps(result, indent=2))
    else:
        status_symbol = "✅" if result.get("ok", True) else "❌"
        tool = result.get("tool", "ke_tool")
        summary = result.get("summary", {})
        print(f"=== {tool} ({result.get('project', 'default')}) {status_symbol} ===")
        if summary:
            print(f"Summary: {summary}")
        findings = result.get("findings", [])
        if findings:
            print("\nFindings:")
            for f in findings:
                sev = f.get("severity", "info").upper()
                page = f.get("page", "")
                msg = f.get("message", "")
                code = f.get("id", "")
                hint = f.get("hint", "")
                hint_str = f" [Hint: {hint}]" if hint else ""
                print(f"  [{sev}] {code} ({page}): {msg}{hint_str}")

    if exit_on_error:
        if not result.get("ok", True):
            sys.exit(1)
        sys.exit(0)
