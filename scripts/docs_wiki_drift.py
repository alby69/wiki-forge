#!/usr/bin/env python3
"""
scripts/docs_wiki_drift.py

Compares docs/ with the committed OKF wiki projection and, by default,
regenerates the projection so the wiki actually matches docs/. Use --check for
the previous read-only advisory report (exit code is always 0).

Relative --docs-dir / --wiki-dir values are resolved against --root, not the
current working directory: scheduler jobs run from a project folder such as
/app/projects/tesi while the paths are repository-relative.

Usage:
    python scripts/docs_wiki_drift.py [--check] [--json] [--root ROOT]
                                      [--docs-dir DOCS] [--wiki-dir WIKI]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from okf_common import repo_root
from docs_to_wiki import (
    actionable_problems as filter_actionable_problems,
    build_bundle,
    check_bundle,
    write_bundle,
)

BASELINE_SOURCES = ["docs/README.md", "config/projects.json", "projects/wikiforge/wiki/index.md"]


def resolve_dir(root: Path, value: str | None, default: Path) -> Path:
    """Resolve a CLI path against the repository root, whatever the cwd is."""
    candidate = Path(value) if value else default
    return (candidate if candidate.is_absolute() else root / candidate).resolve()


def actionable_problems(problems: list[str], wiki_dir: Path | None = None) -> list[str]:
    """Filter drift using the shared docs_to_wiki policy.

    The optional directory keeps older callers working; without it we inspect
    the committed wikiforge projection, which is the one checked in CI.
    """
    target = wiki_dir or (repo_root() / "projects" / "wikiforge" / "wiki")
    return filter_actionable_problems(problems, target)


def analyze(root: Path, docs_dir: Path, wiki_dir: Path) -> dict:
    """Read-only comparison. Kept separate from repair() so it stays testable."""
    bundle, warnings = build_bundle(root, docs_dir, wiki_dir)
    problems = check_bundle(bundle, wiki_dir, docs_dir)
    drift = actionable_problems(problems, wiki_dir)
    return {
        "status": "drift" if drift else "ok",
        "docs": len(bundle),
        "notes": len(bundle),
        "drift": drift,
        "preserved": sorted(set(problems) - set(drift)),
        "warnings": warnings,
        "rationale": (
            "La proiezione OKF non corrisponde più a docs/: rigenerarla con "
            "`python scripts/docs_to_wiki.py` (o con questo script), scrivendo solo i "
            "file generati; le note curate di sintesi sono preservate."
            if drift else "La proiezione OKF è allineata con docs/."
        ),
        "sources": BASELINE_SOURCES,
    }


def repair(root: Path, docs_dir: Path, wiki_dir: Path) -> dict:
    """Regenerate the docs/ projection inside wiki_dir. Returns a short report."""
    bundle, warnings = build_bundle(root, docs_dir, wiki_dir)
    written = write_bundle(bundle, wiki_dir)
    remaining = actionable_problems(check_bundle(bundle, wiki_dir, docs_dir), wiki_dir)
    return {"written": written, "remaining": remaining, "warnings": warnings}


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(
        description="Report docs/wiki drift and regenerate the OKF projection."
    )
    parser.add_argument("--root", default=str(repo_root()))
    parser.add_argument("--docs-dir", default=None)
    parser.add_argument("--wiki-dir", default=None)
    parser.add_argument("--check", action="store_true", help="Only report drift; never write.")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    docs_dir = resolve_dir(root, args.docs_dir, root / "docs")
    wiki_dir = resolve_dir(root, args.wiki_dir, root / "projects" / "wikiforge" / "wiki")

    result = analyze(root, docs_dir, wiki_dir)
    result["written"] = 0
    result["remaining"] = []
    if result["status"] == "drift" and not args.check:
        fix = repair(root, docs_dir, wiki_dir)
        result["written"] = fix["written"]
        result["remaining"] = fix["remaining"]
        result["warnings"] = fix["warnings"]
        if not fix["remaining"]:
            result["status"] = "fixed"
            result["rationale"] = (
                f"Proiezione rigenerata: {fix['written']} file aggiornati in {wiki_dir}. "
                "Le note curate di sintesi e i file utente preservati non sono stati toccati."
            )

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        if result["status"] == "ok":
            print(f"✅ docs/wiki allineate: {result['notes']} note OKF.")
        elif result["status"] == "fixed":
            print(f"✅ docs/wiki aggiornate: {result['written']} file scritti in {wiki_dir}.")
        else:
            mode = " (sola lettura)" if args.check else ""
            print(f"⚠️  docs/wiki disallineate: {len(result['drift'])} problema/i{mode}.")
            for problem in result["drift"]:
                print(f"  - {problem}")
        if result.get("preserved"):
            print(f"ℹ️  preservate: {', '.join(result['preserved'])}")
        print(f"Fonti: {', '.join(result['sources'])}")
        print(f"Motivazione: {result['rationale']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
