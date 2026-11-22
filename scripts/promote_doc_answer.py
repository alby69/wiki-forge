#!/usr/bin/env python3
"""
scripts/promote_doc_answer.py

Human-only promotion of an approved answer into the curated synthesis layer of
the wiki-forge documentation wiki. Writes a note with an explicit human
`verified` entry and regenerates the bundle indexes; it never changes docs/.

This script is MUTATING and must not be scheduled for automatic execution.

Usage:
    python scripts/promote_doc_answer.py --title "..." --question "..." \
        --answer "..." --sources docs/README.md --reviewer human:alby69
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from actor_provenance import HUMAN_ACTOR_RE
from okf_common import repo_root
import docs_to_wiki

# B5: canonical human-only reviewer grammar shared with okf_lint.py and the
# TypeScript mirror. The CLI contract and error text stay unchanged.
ACTOR_RE = HUMAN_ACTOR_RE


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(title: str) -> str:
    value = title.lower()
    value = re.sub(r"[^a-z0-9à-ÿ]+", "-", value, flags=re.UNICODE)
    return value.strip("-")[:70] or "sintesi"


def build_note(
    title: str, question: str, answer: str, sources: list[str], reviewer: str, at: str
) -> str:
    source_entries = "\n".join(
        f"  - id: source-{index}\n    resource: {source}\n    title: \"{source}\""
        for index, source in enumerate(sources, start=1)
    )
    bullets = "\n".join(f"- `{source}`" for source in sources)
    escaped_title = title.replace('"', '\\"')
    return "\n".join([
        "---",
        "type: Reference",
        f"title: \"{escaped_title}\"",
        "description: \"Risposta approvata da un revisore umano sulla wiki di wiki-forge.\"",
        "tags: [scope/docs, layer/curated, area/sintesi, lang/it, approved-answer]",
        "status: stable",
        "generated:",
        f"  by: {reviewer}",
        f"  at: \"{at}\"",
        "verified:",
        f"  - by: {reviewer}",
        f"    at: \"{at}\"",
        "sources:",
        source_entries,
        "---",
        "",
        f"# {title}",
        "",
        "## Domanda",
        "",
        f"> {question}",
        "",
        "## Risposta",
        "",
        answer.strip(),
        "",
        "## Fonti",
        "",
        bullets,
        "",
    ])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Promote an approved answer into wiki/sintesi/.")
    parser.add_argument("--root", default=str(repo_root()))
    parser.add_argument("--project", default=docs_to_wiki.DEFAULT_PROJECT)
    parser.add_argument("--title", required=True)
    parser.add_argument("--question", required=True)
    parser.add_argument("--answer", default=None)
    parser.add_argument("--answer-file", default=None)
    parser.add_argument("--sources", required=True, help="Comma-separated source paths.")
    parser.add_argument("--reviewer", default="human:alby69")
    parser.add_argument("--slug", default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    errors: list[str] = []
    if not ACTOR_RE.match(args.reviewer):
        errors.append("reviewer must match human:<id>")
    answer = args.answer or ""
    if args.answer_file:
        answer = Path(args.answer_file).read_text(encoding="utf-8")
    if not answer.strip():
        errors.append("an answer is required (--answer or --answer-file)")
    sources = [item.strip() for item in args.sources.split(",") if item.strip()]
    if not sources:
        errors.append("at least one source is required")
    if errors:
        print(json.dumps({"status": "error", "errors": errors}, ensure_ascii=False) if args.json
              else "❌ " + "; ".join(errors), file=sys.stderr)
        return 1

    root = Path(args.root).resolve()
    wiki_dir = root / "projects" / args.project / "wiki"
    slug = args.slug or slugify(args.title)
    target = wiki_dir / "sintesi" / f"{slug}.md"
    if target.exists() and not args.force:
        message = f"{target.relative_to(root)} already exists (use --force)"
        print(json.dumps({"status": "error", "errors": [message]}, ensure_ascii=False) if args.json
              else "❌ " + message, file=sys.stderr)
        return 1

    at = utc_now()
    note = build_note(args.title, args.question, answer, sources, args.reviewer, at)
    written: list[str] = []
    if not args.dry_run:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(note, encoding="utf-8", newline="\n")
        written.append(target.relative_to(root).as_posix())
        bundle, _warnings = docs_to_wiki.build_bundle(root, root / "docs", wiki_dir)
        docs_to_wiki.write_bundle(bundle, wiki_dir)
        written.extend(sorted(bundle.keys()))

    result = {
        "status": "success",
        "path": target.relative_to(root).as_posix(),
        "reviewer": args.reviewer,
        "at": at,
        "dry_run": args.dry_run,
        "files_written": len(written),
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"✅ Sintesi {'simulata' if args.dry_run else 'salvata'}: {result['path']}")
        print(f"   Reviewer: {args.reviewer} · fonti: {len(sources)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
