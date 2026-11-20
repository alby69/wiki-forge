"""
config_schema.py — Declarative shape validation for `config.toml`.

WHAT THIS DOES
--------------
Defines ONE declarative schema for the repository configuration and a
side-effect-free validator that returns a list of human-readable problems.

Design rules (KISS / DRY):
  * The schema lives here, not in each script that reads config.
  * Validation never mutates the data and never raises: callers decide how to
    surface problems (``core/config.py`` raises ``ConfigError``, the CLI prints
    JSON). This keeps the validator reusable from Python *and* from Node via a
    single subprocess contract.
  * Unknown sections/keys are tolerated (forward compatibility). We validate
    the *shape of what we know*, not the absence of what we do not.

Field specification mini-language:
  ``str`` / ``bool`` / ``int`` / ``float`` / ``list`` / ``dict``  -> expected type
  ``frozenset({int, float})``                                    -> union of types
  ``(list, <spec>)``                                             -> list of <spec>
  ``{"key": <spec>, ...}``                                       -> nested table
  ``{"*": <spec>}``                                              -> every key maps to <spec>
  ``"any"``                                                      -> no constraint
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

# A single source of truth for the shape of config.toml.
CONFIG_SCHEMA: dict[str, Any] = {
    "project": {"name": str, "title": str, "language": str, "context": str},
    "paths": {"*": str},
    "conversion": {"ocr": bool},
    "audio": {
        "enabled": bool,
        "provider": str,
        "voice_host_a": str,
        "voice_host_b": str,
        "output_folder": str,
    },
    "agent": {
        "confirm_destructive": bool,
        "llm": {
            "provider": str,
            "opencode_command": str,
            "opencode_args": (list, str),
            "api_base_url": str,
            "api_key_env": str,
            "model": str,
            "max_tokens": int,
            "timeout_seconds": frozenset({int, float}),
        },
    },
    "naming": {
        "article_case": str,
        "wiki_folder_case": str,
        "forbidden_chars": (list, str),
    },
    "export": {
        "formats": (list, str),
        "include_raw": bool,
        "include_sources": bool,
    },
    "webclip": {"enabled": bool, "folder": str, "format": str},
    "i18n": {
        "default_language": str,
        "supported_languages": (list, str),
        "fallback_language": str,
    },
    "okf": {
        "version": str,
        "type_vocabulary": (list, str),
        "migration": {
            "default_type": str,
            "folder_type_map": (list, {"folder": str, "type": str}),
        },
    },
    "tags": {"allowed": (list, str), "blocked": (list, str)},
    "versioning": {"enabled": bool, "fields": (list, str)},
    "enterprise": {"enable_rbac": bool, "cloud_backup_webdav": str},
}


def _type_name(spec: Any) -> str:
    if isinstance(spec, frozenset):
        return " | ".join(sorted(t.__name__ for t in spec))
    if isinstance(spec, type):
        return spec.__name__
    return str(spec)


def _validate(value: Any, spec: Any, path: str, problems: list[str]) -> None:
    if spec == "any":
        return

    if isinstance(spec, frozenset):
        matched = any(
            isinstance(value, t) and not (t is int and isinstance(value, bool))
            for t in spec
        )
        if not matched:
            problems.append(
                f"{path}: expected {_type_name(spec)}, got {type(value).__name__}"
            )
        return

    if isinstance(spec, tuple) and len(spec) == 2:
        container, item_spec = spec
        if not isinstance(value, container):
            problems.append(
                f"{path}: expected {container.__name__}, got {type(value).__name__}"
            )
            return
        for index, item in enumerate(value):
            _validate(item, item_spec, f"{path}[{index}]", problems)
        return

    if isinstance(spec, dict):
        if not isinstance(value, dict):
            problems.append(f"{path}: expected table, got {type(value).__name__}")
            return
        for key, child_spec in spec.items():
            if key == "*":
                for child_key, child_value in value.items():
                    _validate(child_value, child_spec, f"{path}.{child_key}", problems)
            elif key in value:
                _validate(value[key], child_spec, f"{path}.{key}", problems)
        return

    if isinstance(spec, type):
        ok = isinstance(value, spec)
        # bool is a subclass of int in Python; an integer field must not accept
        # `true`/`false` silently.
        if spec is int and isinstance(value, bool):
            ok = False
        if not ok:
            problems.append(
                f"{path}: expected {spec.__name__}, got {type(value).__name__}"
            )
        return

    problems.append(f"{path}: unsupported schema spec {spec!r}")


def validate_config_shape(data: Any, *, source: str = "config.toml") -> list[str]:
    """Return a list of shape problems; an empty list means ``data`` is valid.

    Unknown keys are ignored on purpose so that adding a new TOML section never
    breaks older consumers of this validator.
    """
    problems: list[str] = []
    if not isinstance(data, dict):
        return [f"{source}: root must be a TOML table, got {type(data).__name__}"]
    _validate(data, CONFIG_SCHEMA, source, problems)
    return problems


def validate_config_file(path: str | Path) -> list[str]:
    """Parse a TOML file and validate its shape. Parse errors become problems."""
    target = Path(path)
    try:
        import tomllib
        with target.open("rb") as fh:
            data = tomllib.load(fh)
    except Exception as exc:  # noqa: BLE001 - surfaced as a validation problem
        return [f"{target}: {exc}"]
    return validate_config_shape(data, source=str(target))


def main(argv: list[str] | None = None) -> int:
    """CLI: ``python -m src.backend.wikiforge.core.config_schema [files...]``.

    Prints JSON (single object for one file, array for many) and returns 1 when
    any file is invalid. The Node backend reuses this exact contract.
    """
    args = list(sys.argv[1:] if argv is None else argv[1:])
    paths = args or ["config/config.toml"]
    results = []
    for raw in paths:
        problems = validate_config_file(raw)
        results.append({"file": raw, "valid": not problems, "problems": problems})
    out = results[0] if len(results) == 1 else results
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 1 if any(not item["valid"] for item in results) else 0


if __name__ == "__main__":  # pragma: no cover - exercised via subprocess tests
    raise SystemExit(main())
