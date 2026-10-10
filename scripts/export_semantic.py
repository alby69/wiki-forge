#!/usr/bin/env python3
"""
scripts/export_semantic.py
Export OKF v0.2 Knowledge Base notes to Semantic Web standards (RDF/JSON-LD and Turtle/TTL).

Usage:
  python3 scripts/export_semantic.py [--wiki-dir WIKI_DIR] [--output-dir OUTPUT_DIR] [--json]
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from okf_common import resolve_dir

try:
    import yaml
except ImportError:
    yaml = None


def parse_frontmatter_and_links(file_path: Path):
    """Parses YAML frontmatter and [[wikilinks]] from a markdown file."""
    content = file_path.read_text(encoding="utf-8")
    frontmatter = {}
    body = content

    fm_match = re.search(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if fm_match:
        fm_text = fm_match.group(1)
        body = content[fm_match.end():]
        if yaml:
            try:
                frontmatter = yaml.safe_load(fm_text) or {}
            except Exception:
                frontmatter = {}
        else:
            # Fallback simple parser
            for line in fm_text.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    frontmatter[k.strip()] = v.strip()

    # Extract [[wikilinks]]
    # Match [[target]] or [[target|label]]
    raw_links = re.findall(r"\[\[([^\]]+)\]\]", body)
    outbound_links = []
    for link in raw_links:
        clean_link = link.split("|")[0].strip()
        if clean_link and clean_link not in outbound_links:
            outbound_links.append(clean_link)

    # Derive stem ID
    stem_id = file_path.stem
    if stem_id == "index":
        # Keep parent folder context if folder index
        rel_parent = file_path.parent.name
        stem_id = f"{rel_parent}-index" if rel_parent and rel_parent != "wiki" else "index"

    return stem_id, frontmatter, outbound_links, body


def sanitize_uri(identifier: str) -> str:
    """Sanitizes identifier for URI usage."""
    clean = re.sub(r"[^a-zA-Z0-9_\-]", "-", identifier.lower()).strip("-")
    return clean or "note"


def generate_jsonld(notes_data: list) -> dict:
    """Generates JSON-LD representation of the wiki knowledge graph."""
    context = {
        "@vocab": "http://schema.org/",
        "wf": "http://wikiforge.org/ontology#",
        "linksTo": {
            "@id": "wf:linksTo",
            "@type": "@id"
        },
        "status": "wf:status",
        "staleAfter": "wf:staleAfter",
        "verified": "wf:verified",
        "maturityScore": "wf:maturityScore",
        "okfVersion": "wf:okfVersion"
    }

    graph = []
    for item in notes_data:
        note_id = item["id"]
        fm = item["frontmatter"]
        links = item["links"]

        note_uri = f"urn:wikiforge:note:{sanitize_uri(note_id)}"
        note_type = fm.get("type", "Article")

        obj = {
            "@id": note_uri,
            "@type": ["schema:Article", f"wf:{note_type}"],
            "name": fm.get("title", note_id.replace("-", " ").title()),
            "description": fm.get("description", ""),
            "author": fm.get("author", "unknown"),
            "status": fm.get("status", "draft"),
            "keywords": fm.get("tags", []),
            "linksTo": [f"urn:wikiforge:note:{sanitize_uri(link)}" for link in links]
        }

        if "stale_after" in fm:
            obj["staleAfter"] = fm["stale_after"]
        if "verified" in fm:
            obj["verified"] = fm["verified"]
        if "maturity_score" in fm:
            obj["maturityScore"] = fm["maturity_score"]
        if "okf_version" in fm:
            obj["okfVersion"] = fm["okf_version"]

        graph.append(obj)

    return {
        "@context": context,
        "@graph": graph
    }


def generate_turtle(notes_data: list) -> str:
    """Generates Turtle (TTL) representation of the wiki knowledge graph."""
    lines = [
        "@prefix schema: <http://schema.org/> .",
        "@prefix wf: <http://wikiforge.org/ontology#> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        ""
    ]

    for item in notes_data:
        note_id = item["id"]
        fm = item["frontmatter"]
        links = item["links"]

        note_uri = f"<urn:wikiforge:note:{sanitize_uri(note_id)}>"
        note_type = fm.get("type", "Article")
        title = (fm.get("title") or note_id.replace("-", " ").title()).replace('"', '\\"')
        desc = (fm.get("description") or "").replace('"', '\\"')
        status = fm.get("status", "draft")
        author = fm.get("author", "unknown")

        lines.append(f"{note_uri} a schema:Article , wf:{note_type} ;")
        lines.append(f'    schema:name "{title}" ;')
        lines.append(f'    schema:description "{desc}" ;')
        lines.append(f'    wf:status "{status}" ;')
        lines.append(f'    schema:author "{author}" ;')

        for tag in fm.get("tags", []):
            clean_tag = str(tag).replace('"', '\\"')
            lines.append(f'    schema:keywords "{clean_tag}" ;')

        for link in links:
            target_uri = f"<urn:wikiforge:note:{sanitize_uri(link)}>"
            lines.append(f"    wf:linksTo {target_uri} ;")

        # Strip trailing semicolon and end with period
        if lines[-1].endswith(" ;"):
            lines[-1] = lines[-1][:-2] + " ."
        else:
            lines.append("    .")
        lines.append("")

    return "\n".join(lines)


def export_semantic(wiki_dir: Path, output_dir: Path):
    """Processes all markdown notes and exports JSON-LD and TTL files."""
    notes_data = []

    for root, _, files in os.walk(wiki_dir):
        for f in files:
            if f.endswith(".md"):
                file_path = Path(root) / f
                note_id, fm, links, _ = parse_frontmatter_and_links(file_path)
                notes_data.append({
                    "id": note_id,
                    "path": str(file_path.relative_to(wiki_dir)),
                    "frontmatter": fm,
                    "links": links
                })

    output_dir.mkdir(parents=True, exist_ok=True)

    jsonld_data = generate_jsonld(notes_data)
    jsonld_file = output_dir / "wiki_export.jsonld"
    jsonld_file.write_text(json.dumps(jsonld_data, indent=2, ensure_ascii=False), encoding="utf-8")

    ttl_data = generate_turtle(notes_data)
    ttl_file = output_dir / "wiki_export.ttl"
    ttl_file.write_text(ttl_data, encoding="utf-8")

    return {
        "notes_count": len(notes_data),
        "jsonld_path": str(jsonld_file),
        "ttl_path": str(ttl_file)
    }


def main():
    parser = argparse.ArgumentParser(description="Export OKF v0.2 KB to RDF/JSON-LD and Turtle formats.")
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

    result = export_semantic(wiki_path, output_path)

    if args.json:
        print(json.dumps({
            "status": "success",
            "notes_exported": result["notes_count"],
            "files": [result["jsonld_path"], result["ttl_path"]]
        }, indent=2))
    else:
        print(f"✅ Semantic Export Completed:")
        print(f"  - Notes Processed: {result['notes_count']}")
        print(f"  - JSON-LD Export:  {result['jsonld_path']}")
        print(f"  - Turtle Export:   {result['ttl_path']}")


if __name__ == "__main__":
    main()
