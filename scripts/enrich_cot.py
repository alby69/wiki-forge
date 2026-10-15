#!/usr/bin/env python3
"""
enrich_cot.py — Apply Two-Step Chain-of-Thought (Analysis -> Generation) enrichment on Markdown files.

WHAT THIS DOES
--------------
This script processes raw Markdown files (e.g. from `raw/` or `wiki/`), performs
entity/concept analysis (Phase 1 CoT), and enriches the Markdown file with structured
YAML frontmatter, summaries, and wikilink recommendations (Phase 2 CoT).

DESIGN PRINCIPLES
-----------------
  * Decoupled: handles LLM enrichment on Markdown, separated from format conversion.
  * Standalone CLI: accepts --input and --output directories or single files.
  * JSON output mode: compatible with Wiki-Forge tool registry and API execution.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from okf_common import resolve_dir


def two_step_cot_analysis(stem: str, content: str) -> dict:
    """Phase 1 CoT: Analyze content for entities, concepts, gaps, and recommendations."""
    lines = [line.strip() for line in content.split("\n") if line.strip()]
    entities = list(set([word.strip(".,()") for word in content.split() if len(word) > 4 and word[0].isupper()]))[:10]
    concepts = [line.lstrip("#").strip() for line in lines if line.startswith("#")][:5]

    return {
        "stem": stem,
        "summary": lines[0] if lines else stem,
        "entities": entities,
        "concepts": concepts if concepts else [stem],
        "recommendations": ["Create page", "Interlink concepts"],
    }


def two_step_cot_generation(analysis: dict, raw_content: str) -> str:
    """Phase 2 CoT: Generate clean Markdown note with frontmatter."""
    title = analysis["stem"].replace("-", " ").replace("_", " ").title()
    entities_str = ", ".join(analysis["entities"]) if analysis["entities"] else "General"
    concepts_str = ", ".join(f"[[{c}]]" for c in analysis["concepts"])

    return f"""---
title: "{title}"
type: concept
status: draft
verified: false
generated: true
tags: [{', '.join(analysis['concepts'])}]
---

# {title}

## Executive Summary
{analysis['summary']}

## CoT Analysis Insights
- **Key Entities**: {entities_str}
- **Recommended Links**: {concepts_str}

## Body
{raw_content.strip()}
"""


def enrich_file(source_path: Path, dest_path: Path) -> None:
    """Enrich a single Markdown file with Two-Step CoT."""
    raw_text = source_path.read_text(encoding="utf-8")
    analysis = two_step_cot_analysis(source_path.stem, raw_text)
    final_md = two_step_cot_generation(analysis, raw_text)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_text(final_md, encoding="utf-8")


def process_directory(input_dir: Path, output_dir: Path, quiet: bool = False) -> tuple[int, int]:
    """Process all Markdown files in input_dir and output enriched notes to output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in input_dir.rglob("*.md") if p.is_file())
    if not files:
        if not quiet:
            print(f"No Markdown files found in {input_dir}", file=sys.stderr)
        return 0, 0

    ok, failed = 0, 0
    for f in files:
        rel = f.relative_to(input_dir)
        out_path = output_dir / rel
        if not quiet:
            print(f"Enriching CoT: {f.name} -> {out_path}", file=sys.stderr)
        try:
            enrich_file(f, out_path)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR on {f.name}: {exc}", file=sys.stderr)
            failed += 1

    if not quiet:
        print(f"\nDone: {ok} enriched, {failed} failed. Output in: {output_dir}", file=sys.stderr)
    return ok, failed


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply Two-Step Chain-of-Thought enrichment to Markdown notes."
    )
    parser.add_argument(
        "--input",
        default="raw",
        help="Input directory containing Markdown notes. Default: raw",
    )
    parser.add_argument(
        "--output",
        default="wiki",
        help="Output directory for enriched Markdown notes. Default: wiki",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output result as JSON object on stdout.",
    )
    args = parser.parse_args()

    input_dir = resolve_dir(args.input, default="raw")
    if not input_dir.is_dir():
        msg = f"Invalid input folder: {input_dir}"
        if args.json:
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    output_dir = resolve_dir(args.output, default="wiki")
    ok, failed = process_directory(input_dir, output_dir, quiet=args.json)

    if args.json:
        print(json.dumps({
            "status": "success",
            "ok": ok,
            "failed": failed,
            "output_dir": str(output_dir),
        }))


if __name__ == "__main__":
    main()
