#!/usr/bin/env python3
"""
scripts/ontology_rules.py
Lightweight Ontology Rule Engine and Validation for wiki-forge.

Rules checked:
1. Rule 1: If `type: Concept`, must have at least 1 incoming or outgoing [[wikilink]].
2. Rule 2: Detection of direct circular dependencies between notes (A -> B -> A).
3. Rule 3: If `status: stable`, must have at least one entry in `verified` array with actor `human:*`.

Usage:
  python3 scripts/ontology_rules.py [WIKI_DIR] [--json] [--strict]
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


def parse_note(file_path: Path):
    """Parses frontmatter and outbound [[wikilinks]] from a note file."""
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
            for line in fm_text.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    frontmatter[k.strip()] = v.strip()

    raw_links = re.findall(r"\[\[([^\]]+)\]\]", body)
    outbound_links = []
    for link in raw_links:
        clean = link.split("|")[0].strip().lower()
        if clean and clean not in outbound_links:
            outbound_links.append(clean)

    note_id = file_path.stem.lower()
    return note_id, frontmatter, outbound_links, str(file_path)


def run_ontology_checks(wiki_dir: Path):
    """Executes logical ontology checks across notes in wiki_dir."""
    notes = {}
    outbound = {}
    inbound = {}

    for root, _, files in os.walk(wiki_dir):
        for f in files:
            if f.endswith(".md"):
                file_path = Path(root) / f
                note_id, fm, links, rel_path = parse_note(file_path)

                notes[note_id] = {
                    "id": note_id,
                    "frontmatter": fm,
                    "path": rel_path
                }
                outbound[note_id] = links
                if note_id not in inbound:
                    inbound[note_id] = []

    # Calculate inbound links
    for source_id, target_links in outbound.items():
        for target in target_links:
            target_id = target.lower()
            if target_id not in inbound:
                inbound[target_id] = []
            if source_id not in inbound[target_id]:
                inbound[target_id].append(source_id)

    violations = []

    # Rule 1: Concept linkage
    for note_id, data in notes.items():
        fm = data["frontmatter"]
        note_type = str(fm.get("type", "")).strip().lower()
        if note_type == "concept":
            out_count = len(outbound.get(note_id, []))
            in_count = len(inbound.get(note_id, []))
            if out_count == 0 and in_count == 0:
                violations.append({
                    "rule": "Rule 1 (Concept Linkage)",
                    "note_id": note_id,
                    "path": data["path"],
                    "message": f"Concept note '{note_id}' is unlinked (0 inbound and 0 outbound links)."
                })

    # Rule 2: Direct circular dependencies (A -> B -> A)
    reported_cycles = set()
    for source_id, targets in outbound.items():
        if source_id.endswith("index") or "index" in source_id:
            continue
        for target_id in targets:
            if target_id == source_id or target_id.endswith("index") or "index" in target_id:
                continue
            # Check if target_id also links back to source_id
            if source_id in outbound.get(target_id, []):
                cycle_pair = tuple(sorted([source_id, target_id]))
                if cycle_pair not in reported_cycles:
                    reported_cycles.add(cycle_pair)
                    violations.append({
                        "rule": "Rule 2 (Direct Circular Dependency)",
                        "note_id": source_id,
                        "path": notes.get(source_id, {}).get("path", source_id),
                        "message": f"Direct circular link detected between '{cycle_pair[0]}' and '{cycle_pair[1]}'."
                    })

    # Rule 3: Stable notes human verification
    for note_id, data in notes.items():
        fm = data["frontmatter"]
        status = str(fm.get("status", "")).strip().lower()
        if status == "stable":
            verified_list = fm.get("verified", [])
            has_human = False
            if isinstance(verified_list, list):
                for entry in verified_list:
                    if isinstance(entry, dict):
                        actor = str(entry.get("by", "")).lower()
                    else:
                        actor = str(entry).lower()
                    if actor.startswith("human:"):
                        has_human = True
                        break

            if not has_human:
                violations.append({
                    "rule": "Rule 3 (Stable Human Verification)",
                    "note_id": note_id,
                    "path": data["path"],
                    "message": f"Stable note '{note_id}' lacks required human verification in frontmatter 'verified' list."
                })

    return {
        "total_notes": len(notes),
        "violations_count": len(violations),
        "violations": violations
    }


def main():
    parser = argparse.ArgumentParser(description="Run lightweight ontology validation on wiki notes.")
    parser.add_argument("wiki_dir", nargs="?", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--json", action="store_true", help="Output execution results as JSON on stdout")
    parser.add_argument("--strict", action="store_true", help="Exit with non-zero code if violations exist")

    args = parser.parse_args()
    wiki_path = resolve_dir(args.wiki_dir, default="wiki")

    if not wiki_path.exists():
        msg = f"Wiki directory not found: {wiki_path}"
        if args.json:
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(f"ERROR: {msg}", file=sys.stderr)
        sys.exit(1)

    result = run_ontology_checks(wiki_path)

    if args.json:
        print(json.dumps({
            "status": "error" if result["violations_count"] > 0 else "success",
            "total_notes": result["total_notes"],
            "violations_count": result["violations_count"],
            "violations": result["violations"]
        }, indent=2))
    else:
        print(f"🧠 Ontology Validation Engine Report:")
        print(f"  - Notes Analyzed:    {result['total_notes']}")
        print(f"  - Violations Found:  {result['violations_count']}")
        if result["violations"]:
            print("\n🚨 Violations:")
            for v in result["violations"]:
                print(f"  - [{v['rule']}] {v['message']} ({v['path']})")
        else:
            print("  - All ontology rules passed successfully! ✅")

    if args.strict and result["violations_count"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
