#!/usr/bin/env python3
"""
scripts/wiki_program_change_propose.py

Fase 76, read-only step of the wiki -> program change bridge. Validates a
proposal (either a structured JSON object or an assistant answer containing
```wiki-edit blocks) and stages it under output/program-changes/ for an F6
human decision. It NEVER writes to program files and always reports rationale
and sources, so the F5 Policy Agent can log a grounded decision.

Usage:
    python scripts/wiki_program_change_propose.py --proposal proposal.json --json
    python scripts/wiki_program_change_propose.py --answer-file answer.md \
        --rationale "..." --sources docs/standard/SELF_WIKI.md --json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from okf_common import repo_root
from program_change_common import (
    atomic_write,
    build_payload,
    load_proposal,
    parse_wiki_edits,
    proposal_id,
    utc_now,
)

BASELINE_SOURCES = [
    "docs/standard/SELF_WIKI.md",
    "config/agent_schedule.toml",
    "config/projects.json",
]


def analyze(root: Path, proposal: dict, stage_dir: Path) -> dict:
    """Validate and stage a proposal. Never touches program files."""
    try:
        payload = build_payload(root, proposal)
    except (ValueError, OSError, UnicodeError) as exc:
        return {"status": "error", "errors": [str(exc)]}

    change_id = proposal_id(proposal)
    target = stage_dir / f"{change_id}.json"
    staged = False
    if not target.exists():
        record = {
            "id": change_id,
            "status": "pending",
            "created_at": utc_now(),
            **payload,
        }
        atomic_write(target, json.dumps(record, ensure_ascii=False, indent=2) + "\n")
        staged = True

    return {
        "status": "success",
        "id": change_id,
        "staged": staged,
        "path": target.relative_to(root).as_posix(),
        "rationale": payload["rationale"],
        "sources": payload["sources"] or BASELINE_SOURCES,
        "edits": len(payload["edits"]),
    }


def _proposal_from_args(args: argparse.Namespace) -> dict:
    """Build the proposal object from either --proposal or --answer-file."""
    if args.proposal:
        return load_proposal(Path(args.proposal).resolve())
    answer = Path(args.answer_file).read_text(encoding="utf-8")
    edits = parse_wiki_edits(answer)
    if not edits:
        raise ValueError("the answer contains no well-formed ```wiki-edit blocks")
    sources = [item.strip() for item in (args.sources or "").split(",") if item.strip()]
    return {
        "title": args.title,
        "rationale": args.rationale,
        "sources": sources or BASELINE_SOURCES,
        "project": args.project,
        "edits": edits,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Stage a validated program-change proposal (read-only).")
    parser.add_argument("--root", default=str(repo_root()))
    parser.add_argument("--proposal", default=None, help="Path to a JSON proposal object.")
    parser.add_argument("--answer-file", default=None, help="Assistant answer text containing wiki-edit blocks.")
    parser.add_argument("--title", default="Modifica al programma")
    parser.add_argument("--rationale", default="")
    parser.add_argument("--sources", default="", help="Comma-separated source paths (with --answer-file).")
    parser.add_argument("--project", default="wikiforge")
    parser.add_argument("--stage-dir", default="output/program-changes")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.proposal and not args.answer_file:
        print(
            json.dumps({"status": "error", "errors": ["--proposal or --answer-file is required"]})
            if args.json else "❌ --proposal or --answer-file is required",
            file=sys.stderr,
        )
        return 1

    root = Path(args.root).resolve()
    stage_dir = (root / args.stage_dir).resolve() if not Path(args.stage_dir).is_absolute() else Path(args.stage_dir).resolve()
    try:
        proposal = _proposal_from_args(args)
    except (ValueError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "errors": [str(exc)]}, ensure_ascii=False)
            if args.json else f"❌ {exc}",
            file=sys.stderr,
        )
        return 1

    result = analyze(root, proposal, stage_dir)
    if result["status"] == "error":
        print(
            json.dumps(result, ensure_ascii=False) if args.json else "❌ " + "; ".join(result["errors"]),
            file=sys.stderr,
        )
        return 1

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"✅ Proposta {result['id']} {'staged' if result['staged'] else 'già presente'} ({result['edits']} edit)")
        print(f"   Motivazione: {result['rationale']}")
        print(f"   Fonti: {', '.join(result['sources'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
