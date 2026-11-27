#!/usr/bin/env python3
"""
scripts/export_prov.py
Export OKF v0.2 Knowledge Base notes to W3C PROV-O (Turtle and JSON-LD).

Every note becomes a prov:Entity; each `[^src:ID#Lx-Ly]` anchor becomes the
prov:Entity of the exact source span (prov:wasDerivedFrom) and every `verified:`
event becomes a prov:Activity (prov:wasGeneratedBy).

Usage:
  python3 scripts/export_prov.py [--wiki-dir WIKI_DIR] [--output-dir OUTPUT_DIR] [--json]
"""

import sys
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from okf_common import resolve_dir  # noqa: E402
from src.backend.wikiforge.semantics.prov_exporter import ProvGraphExporter  # noqa: E402


def export_prov(wiki_dir: Path, output_dir: Path):
    """Parse every note of wiki_dir and write PROV-O Turtle + JSON-LD files."""
    exporter = ProvGraphExporter()
    notes = exporter.parse_directory(wiki_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    ttl_file = output_dir / "prov_export.ttl"
    ttl_file.write_text(exporter.export_notes(notes), encoding="utf-8")

    jsonld_file = output_dir / "prov_export.jsonld"
    jsonld_file.write_text(exporter.export_jsonld(notes), encoding="utf-8")

    report = exporter.export_report(notes)
    report.update({
        "ttl_path": str(ttl_file),
        "jsonld_path": str(jsonld_file),
    })
    return report


def main():
    parser = argparse.ArgumentParser(description="Export OKF v0.2 KB provenance to W3C PROV-O.")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--output-dir", default="output", help="Path to output directory (default: output)")
    parser.add_argument("--json", action="store_true", help="Output execution results as JSON on stdout")

    args = parser.parse_args()

    wiki_path = resolve_dir(args.wiki_dir)
    output_path = resolve_dir(args.output_dir, default="output")

    if not wiki_path.exists():
        msg = f"Wiki directory not found: {wiki_path}"
        if args.json:
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(f"ERROR: {msg}", file=sys.stderr)
        sys.exit(1)

    result = export_prov(wiki_path, output_path)

    if args.json:
        print(json.dumps({"status": "success", **result}, indent=2))
    else:
        print("✅ PROV-O Export Completed:")
        print(f"  - Notes Processed:  {result['notes']}")
        print(f"  - Line Anchors:     {result['citations']}")
        print(f"  - Verification Acts: {result['verification_events']}")
        print(f"  - Triples:          {result['triples']}")
        print(f"  - Turtle Export:    {result['ttl_path']}")
        print(f"  - JSON-LD Export:   {result['jsonld_path']}")


if __name__ == "__main__":
    main()
