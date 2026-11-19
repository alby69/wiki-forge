#!/usr/bin/env python3
"""
scripts/wiki_program_change_apply.py

Fase 76, mutating step of the wiki -> program change bridge. Applies a staged
proposal with an exact, single-occurrence find/replace. This script is MUTATING:
it refuses to run without an explicit human reviewer and --confirm, snapshots
every target file before writing and appends an audit entry. It is hard-blocked
from automatic execution by MUTATING_SCRIPT_IDS and is only reached by the F6
approval flow.

Usage:
    python scripts/wiki_program_change_apply.py --proposal proposal.json \
        --reviewer human:alby69 --confirm --json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from okf_common import repo_root
from program_change_common import (
    REVIEWER_RE,
    append_audit,
    atomic_write,
    build_payload,
    load_proposal,
    proposal_id,
    snapshot_file,
    utc_now,
)


def apply_change(
    root: Path,
    proposal: dict,
    reviewer: str,
    stage_dir: Path,
    dry_run: bool = False,
) -> dict:
    """Apply a validated, staged proposal. Requires a human reviewer."""
    if not REVIEWER_RE.match(reviewer):
        return {"status": "error", "errors": ["reviewer must match human:<id>"]}

    try:
        change_id = proposal_id(proposal)
    except ValueError as exc:
        return {"status": "error", "errors": [str(exc)]}
    staged = stage_dir / f"{change_id}.json"
    if not staged.is_file():
        return {
            "status": "error",
            "errors": [f"change '{change_id}' is not staged; run the propose step first"],
        }
    try:
        record = load_proposal(staged)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return {"status": "error", "errors": [f"cannot read staged proposal: {exc}"]}
    if record.get("status") == "applied":
        return {"status": "error", "errors": [f"change '{change_id}' was already applied"]}

    try:
        payload = build_payload(root, proposal)
    except (ValueError, OSError, UnicodeError) as exc:
        return {"status": "error", "errors": [str(exc)]}

    at = utc_now()
    files = [edit["file"] for edit in payload["edits"]]
    snapshots: list[str] = []
    if not dry_run:
        for edit in payload["edits"]:
            snapshots.append(snapshot_file(root, edit["file"], at))
            target = (root / edit["file"]).resolve()
            content = target.read_text(encoding="utf-8").replace("\r\n", "\n")
            updated = content.replace(edit["find"].replace("\r\n", "\n"), edit["replace"].replace("\r\n", "\n"))
            atomic_write(target, updated)

        record.update({"status": "applied", "applied_by": reviewer, "applied_at": at})
        atomic_write(staged, json.dumps(record, ensure_ascii=False, indent=2) + "\n")
        append_audit(root, {
            "at": at,
            "action": "program-change-applied",
            "change_id": change_id,
            "reviewer": reviewer,
            "actor": "human",
            "files": files,
            "rationale": payload["rationale"],
            "sources": payload["sources"],
        })

    return {
        "status": "success",
        "id": change_id,
        "reviewer": reviewer,
        "at": at,
        "dry_run": dry_run,
        "files": files,
        "snapshots": snapshots,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Apply a human-approved program-change proposal.")
    parser.add_argument("--root", default=str(repo_root()))
    parser.add_argument("--proposal", required=True, help="Path to the JSON proposal object.")
    parser.add_argument("--reviewer", required=True, help="Human actor, e.g. human:alby69.")
    parser.add_argument("--confirm", action="store_true", help="Explicit human confirmation.")
    parser.add_argument("--stage-dir", default="output/program-changes")
    parser.add_argument("--project", default="wikiforge", help="Project scope (provenance only).")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    def fail(errors: list[str]) -> int:
        result = {"status": "error", "errors": errors}
        print(json.dumps(result, ensure_ascii=False) if args.json else "❌ " + "; ".join(errors), file=sys.stderr)
        return 1

    if not args.confirm:
        return fail(["--confirm is required: a program change needs explicit human approval"])
    if not REVIEWER_RE.match(args.reviewer):
        return fail(["reviewer must match human:<id>"])

    root = Path(args.root).resolve()
    stage_dir = (root / args.stage_dir).resolve() if not Path(args.stage_dir).is_absolute() else Path(args.stage_dir).resolve()
    try:
        proposal = load_proposal(Path(args.proposal).resolve())
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return fail([f"cannot read proposal: {exc}"])

    result = apply_change(root, proposal, args.reviewer, stage_dir, dry_run=args.dry_run)
    if result["status"] == "error":
        return fail(result["errors"])

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"✅ Modifica {result['id']} {'simulata' if result['dry_run'] else 'applicata'} da {result['reviewer']}")
        print(f"   File: {', '.join(result['files'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
