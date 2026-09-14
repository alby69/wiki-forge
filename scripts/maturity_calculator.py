#!/usr/bin/env python3
"""
scripts/maturity_calculator.py
Calculates and updates the Maturity Index (0-100) for wiki notes in Wiki-Forge Thesis Edition.

Formula:
  copertura_fonti = len(sources) or frontmatter.get('copertura_fonti', 0)
  domande_risolte = len(domande_origine) or frontmatter.get('domande_risolte', 0)
  collegamenti = len(collegamenti) + count of [[wikilinks]] in body
  lunghezza = word count of body / 50

  raw_score = (copertura_fonti * 15) + (domande_risolte * 5) + (collegamenti * 3) + min(20, int(lunghezza))
  maturita = min(100, max(0, int(raw_score)))
"""

import sys
import os
import re
import argparse
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required. Install via `pip install pyyaml`", file=sys.stderr)
    sys.exit(1)

WIKILINK_REGEX = re.compile(r"\[\[([^\]\|]+)(?:\|[^\]]+)?\]\]")

def parse_frontmatter(content: str):
    if not content.startswith("---"):
        return {}, content
    parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
    if len(parts) >= 3:
        try:
            fm = yaml.safe_load(parts[1])
            body = parts[2]
            return (fm if isinstance(fm, dict) else {}), body
        except Exception:
            return {}, content
    return {}, content

def calculate_maturity(fm: dict, body: str) -> dict:
    # 1. Sources coverage
    sources = fm.get("sources") or fm.get("fonti") or []
    copertura_fonti = len(sources) if isinstance(sources, list) else int(fm.get("copertura_fonti", 0))

    # 2. Originating / resolved questions
    domande = fm.get("domande_origine") or fm.get("domande_risolte") or []
    domande_risolte = len(domande) if isinstance(domande, list) else int(fm.get("domande_risolte", 0))

    # 3. Connections (frontmatter + body wikilinks)
    links_fm = fm.get("collegamenti") or []
    num_links_fm = len(links_fm) if isinstance(links_fm, list) else 0
    body_wikilinks = WIKILINK_REGEX.findall(body)
    unique_wikilinks = set(body_wikilinks)
    collegamenti_count = num_links_fm + len(unique_wikilinks)

    # 4. Word count
    words = len(re.findall(r"\w+", body))
    length_bonus = min(20, words // 50)

    # Score calculation
    raw_score = (copertura_fonti * 15) + (domande_risolte * 5) + (collegamenti_count * 3) + length_bonus
    maturita = min(100, max(0, int(raw_score)))

    # Determine status if missing or auto-advancing
    stato = fm.get("stato", "draft")
    if maturita >= 80 and stato == "draft":
        stato = "maturo"

    return {
        "maturita": maturita,
        "copertura_fonti": copertura_fonti,
        "domande_risolte": domande_risolte,
        "collegamenti": collegamenti_count,
        "words": words,
        "stato": stato
    }

def update_file_maturity(file_path: Path, write: bool = False) -> dict:
    content = file_path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(content)
    if not content.startswith("---"):
        return {"file": file_path, "maturita": 0, "updated": False, "error": "No frontmatter"}

    metrics = calculate_maturity(fm, body)

    fm["maturita"] = metrics["maturita"]
    fm["copertura_fonti"] = metrics["copertura_fonti"]
    fm["domande_risolte"] = metrics["domande_risolte"]
    fm["stato"] = metrics["stato"]

    if write:
        # Re-serialize yaml
        yaml_str = yaml.dump(fm, sort_keys=False, allow_unicode=True).strip()
        new_content = f"---\n{yaml_str}\n---{body}"
        file_path.write_text(new_content, encoding="utf-8")

    return {
        "file": file_path,
        "maturita": metrics["maturita"],
        "copertura_fonti": metrics["copertura_fonti"],
        "domande_risolte": metrics["domande_risolte"],
        "collegamenti": metrics["collegamenti"],
        "stato": metrics["stato"],
        "updated": write
    }

def main():
    parser = argparse.ArgumentParser(description="Calculate and update Maturity Index for Wiki notes.")
    parser.add_argument("path", nargs="?", default="wiki", help="File or directory path to analyze (default: wiki)")
    parser.add_argument("--write", action="store_true", help="Write calculated maturity values back to YAML frontmatter")
    parser.add_argument("--dry-run", action="store_true", help="Calculate without writing changes")
    parser.add_argument("--min-score", type=int, default=0, help="Filter output by minimum maturity score")

    args = parser.parse_args()
    target_path = Path(args.path).resolve()

    if not target_path.exists():
        print(f"Error: Path '{target_path}' does not exist.", file=sys.stderr)
        sys.exit(1)

    files = [target_path] if target_path.is_file() else list(target_path.glob("**/*.md"))
    results = []

    for f in sorted(files):
        if f.name.lower() in ("index.md", "log.md"):
            continue
        res = update_file_maturity(f, write=args.write and not args.dry_run)
        if res.get("maturita", 0) >= args.min_score:
            results.append(res)

    results.sort(key=lambda x: x.get("maturita", 0), reverse=True)

    print(f"📊 Maturity Overview ({len(results)} notes analyzed):")
    print(f"{'Maturity':<10} {'State':<10} {'Sources':<10} {'Links':<8} {'File'}")
    print("-" * 65)

    for r in results:
        rel_f = r['file'].relative_to(target_path.parent) if target_path.parent in r['file'].parents else r['file'].name
        print(f"{r.get('maturita', 0):<10} {r.get('stato', 'draft'):<10} {r.get('copertura_fonti', 0):<10} {r.get('collegamenti', 0):<8} {rel_f}")

if __name__ == "__main__":
    main()
