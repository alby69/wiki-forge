#!/usr/bin/env python3
"""
scripts/odp_suggester.py
Ontology Design Pattern (ODP) Suggester for Wiki-Forge Knowledge Base.

Scans wiki notes containing informal properties or triggers, compares against
ODP catalog (config/odp_catalog.json), and suggests YAML frontmatter updates
conforming to formal ODP patterns (e.g. Employment, Time-Indexed Property).
Supports --json output and the read-only --findings envelope. There is no
--write mode: applying a suggestion requires a reviewed changeset (A3).
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from okf_common import resolve_dir, resolve_path, load_findings_api

try:
    import yaml
except ImportError:
    yaml = None

def load_odp_catalog(catalog_path: Path) -> list[dict]:
    if not catalog_path.exists():
        return []
    try:
        data = json.loads(catalog_path.read_text(encoding="utf-8"))
        return data.get("patterns", [])
    except Exception:
        return []

def parse_frontmatter(content: str) -> tuple[dict, str]:
    frontmatter = {}
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            body = parts[2].strip()
            if yaml:
                try:
                    parsed = yaml.safe_load(fm_text)
                    if isinstance(parsed, dict):
                        frontmatter = parsed
                except Exception:
                    pass
            if not frontmatter:
                for line in fm_text.splitlines():
                    line = line.strip()
                    if ":" in line and not line.startswith("#"):
                        k, v = line.split(":", 1)
                        frontmatter[k.strip()] = v.strip().strip("'\"")
    return frontmatter, body

def analyze_note_for_odp(file_path: Path, patterns: list[dict], repo_root: Path) -> dict | None:
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception:
        return None

    fm, body = parse_frontmatter(content)
    full_text_lower = (content + " " + json.dumps(fm, default=str)).lower()

    suggestions = []

    for pattern in patterns:
        pat_id = pattern["id"]
        pat_name = pattern["name"]
        triggers = pattern.get("triggers", [])
        informal_keys = pattern.get("informal_keys", [])

        # Check if already implemented in frontmatter
        already_implemented = any(key in fm for key in [pat_id, pat_id.split("_")[0]])
        if already_implemented:
            continue

        triggered_by = []

        # Check informal YAML keys
        for key in informal_keys:
            if key in fm:
                triggered_by.append(f"YAML key: '{key}'")

        # Check body/text triggers
        for trig in triggers:
            if re.search(rf"\b{re.escape(trig)}\b", full_text_lower):
                triggered_by.append(f"Trigger word: '{trig}'")

        if triggered_by:
            suggestions.append({
                "pattern_id": pat_id,
                "pattern_name": pat_name,
                "description": pattern.get("description"),
                "triggered_by": list(set(triggered_by)),
                "suggested_frontmatter": pattern.get("suggested_structure")
            })

    if not suggestions:
        return None

    rel_path = file_path.relative_to(repo_root).as_posix() if file_path.is_relative_to(repo_root) else str(file_path)

    return {
        "note_id": file_path.stem,
        "path": rel_path,
        "suggestions": suggestions
    }


def findings_from_odp(results: list[dict]) -> list:
    """A1 adapter: one advisory finding per ODP suggestion, no writes."""

    api = load_findings_api()
    findings: list = []
    for result in results:
        path = str(result.get("path", "unknown"))
        for suggestion in result.get("suggestions", []):
            pattern_id = str(suggestion.get("pattern_id", ""))
            findings.append(api.make_finding(
                kind="odp_suggestion",
                confidence=0.75,
                evidence=[
                    f"pattern={pattern_id}",
                    *sorted(str(trigger) for trigger in suggestion.get("triggered_by", [])),
                ],
                targetPath=path,
                proposedAction=f"apply-odp:{pattern_id}",
                slug_source=f"{path}:{pattern_id}",
            ))
    return sorted(findings, key=lambda finding: finding.findingId)


def main():
    parser = argparse.ArgumentParser(description="Ontology Design Pattern (ODP) Suggester")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--catalog", default="config/odp_catalog.json", help="Path to ODP catalog")
    parser.add_argument("--json", action="store_true", help="Output result as JSON on stdout")
    parser.add_argument("--findings", action="store_true", help="Emit unified read-only findings JSON")

    args = parser.parse_args()

    repo_root = Path.cwd()
    wiki_dir = resolve_dir(args.wiki_dir)
    catalog_file = resolve_path(args.catalog, "config/odp_catalog.json")

    patterns = load_odp_catalog(catalog_file)
    results = []

    if wiki_dir.exists():
        for file_path in wiki_dir.rglob("*.md"):
            if file_path.name in ("index.md", "log.md") or "versions" in file_path.parts:
                continue
            res = analyze_note_for_odp(file_path, patterns, repo_root)
            if res:
                results.append(res)

    payload = {
        "status": "success",
        "notes_analyzed": len(results),
        "total_suggestions": sum(len(r["suggestions"]) for r in results),
        "results": results
    }

    if args.findings:
        load_findings_api().print_findings(findings_from_odp(results))
    elif args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"💡 ODP Analysis complete. Found {payload['total_suggestions']} ODP suggestions across {len(results)} notes.\n")
        for r in results:
            print(f"📄 [[{r['note_id']}]] ({r['path']}):")
            for s in r["suggestions"]:
                print(f"  - Pattern: {s['pattern_name']} ({s['pattern_id']})")
                print(f"    Triggers: {', '.join(s['triggered_by'])}")
                print(f"    Suggested YAML:\n{json.dumps(s['suggested_frontmatter'], indent=6)}\n")

if __name__ == "__main__":
    main()
