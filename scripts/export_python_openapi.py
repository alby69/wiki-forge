#!/usr/bin/env python3
"""Export the FastAPI OpenAPI document without starting a server.

The generated JSON is the single source of truth for the Node client:
    python3 scripts/export_python_openapi.py
    python3 scripts/export_python_openapi.py --check

PYTHON_OPENAPI_PATH overrides the target (used by contract tests).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
DEFAULT_OUTPUT = REPO_ROOT / "src" / "shared" / "api" / "generated" / "python.openapi.json"


def output_path(explicit: str | None = None) -> Path:
    target = explicit or os.environ.get("PYTHON_OPENAPI_PATH")
    return Path(target) if target else DEFAULT_OUTPUT


def export_openapi() -> str:
    from src.backend.wikiforge.api.api_server import app

    return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail when the committed schema is stale")
    parser.add_argument("--output", help="write the schema to this path instead of the generated artifact")
    args = parser.parse_args(argv)

    target = output_path(args.output)
    content = export_openapi()
    if args.check:
        current = target.read_text(encoding="utf-8") if target.is_file() else ""
        if current != content:
            print(f"STALE: {target} does not match the FastAPI app", file=sys.stderr)
            return 1
        print(f"OK: {target.relative_to(REPO_ROOT) if target.is_relative_to(REPO_ROOT) else target} is in sync")
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"Wrote {target.relative_to(REPO_ROOT) if target.is_relative_to(REPO_ROOT) else target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
