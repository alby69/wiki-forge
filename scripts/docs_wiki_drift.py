#!/usr/bin/env python3
"""
scripts/docs_wiki_drift.py

Advisory, read-only check for drift between docs/ and the committed OKF wiki
projection. Designed to be run by the F5-guarded scheduler job; it never writes
to the wiki and always exits 0 so a detected drift is a report, not a failure.

Usage:
    python scripts/docs_wiki_drift.py [--json] [--root ROOT]
                                      [--docs-dir DOCS] [--wiki-dir WIKI]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from okf_common import repo_root
from docs_to_wiki import build_bundle, check_bundle

BASELINE_SOURCES = ["docs/README.md", "config/projects.json", "projects/wikiforge/wiki/index.md"]


def analyze(root: Path, docs_dir: Path, wiki_dir: Path) -> dict:
    bundle, warnings = build_bundle(root, docs_dir, wiki_dir)
    problems = check_bundle(bundle, wiki_dir, docs_dir)
    return {
        "status": "drift" if problems else "ok",
        "docs": len(bundle),
        "notes": len(bundle),
        "drift": problems,
        "warnings": warnings,
        "rationale": (
            "La proiezione OKF non corrisponde più a docs/: rigenerare con "
            "`python scripts/docs_to_wiki.py` e verificare il diff." if problems
            else "La proiezione OKF è allineata con docs/."
        ),
        "sources": BASELINE_SOURCES,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Report drift between docs/ and the wiki bundle (read-only).")
    parser.add_argument("--root", default=str(repo_root()))
    parser.add_argument("--docs-dir", default=None)
    parser.add_argument("--wiki-dir", default=None)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    docs_dir = Path(args.docs_dir).resolve() if args.docs_dir else root / "docs"
    wiki_dir = (
        Path(args.wiki_dir).resolve()
        if args.wiki_dir
        else root / "projects" / "wikiforge" / "wiki"
    )
    result = analyze(root, docs_dir, wiki_dir)

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        if result["status"] == "ok":
            print(f"✅ docs/wiki allineate: {result['notes']} note OKF.")
        else:
            print(f"⚠️  docs/wiki disallineate: {len(result['drift'])} problema/i.")
            for problem in result["drift"]:
                print(f"  - {problem}")
        print(f"Fonti: {', '.join(result['sources'])}")
        print(f"Motivazione: {result['rationale']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
