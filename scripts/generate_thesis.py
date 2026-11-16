#!/usr/bin/env python3
"""
scripts/generate_thesis.py
Aggregates thesis chapter drafts and mature synthesis wiki notes into a single cohesive draft.

Outputs:
  output/thesis_compiled.md

A note is treated as a thesis chapter when:
  - its frontmatter `tipo`/`type` is `capitolo_tesi` or `capitolo`, or
  - it carries the tag `thesis/chapter`, or
  - it lives in a `capitoli/` folder (or the wiki directory itself is `capitoli`).

Chapter order comes from `capitolo_numero` when present, otherwise from the
numeric prefix of the filename (e.g. `01-introduzione.md` -> 1).
"""

import sys
import os
import re
import argparse
from pathlib import Path
from okf_common import resolve_dir, resolve_path

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required. Install via `pip install pyyaml`", file=sys.stderr)
    sys.exit(1)

CHAPTER_TYPES = {"capitolo_tesi", "capitolo"}
SYNTHESIS_TYPES = {"sintesi", "concetto", "concept"}
CHAPTER_TAGS = {"thesis/chapter", "type/chapter", "chapter"}
SKIP_NAMES = {"index.md", "log.md"}

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

def _as_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def _tags(fm: dict) -> set:
    tags = fm.get("tags", fm.get("tag", []))
    if isinstance(tags, str):
        tags = [tags]
    if not isinstance(tags, (list, tuple, set)):
        return set()
    return {str(t).strip().lower() for t in tags}

def _is_chapter_note(doc_type: str, fm: dict, rel_path: Path, wiki_is_chapters: bool) -> bool:
    if doc_type in CHAPTER_TYPES:
        return True
    if _tags(fm) & CHAPTER_TAGS:
        return True
    if wiki_is_chapters:
        return True
    return any(part.lower() == "capitoli" for part in rel_path.parts[:-1])

def _chapter_number(fm: dict, stem: str) -> int:
    number = _as_int(fm.get("capitolo_numero"))
    if number is not None:
        return number
    match = re.match(r"^(\d+)", stem)
    if match:
        return int(match.group(1))
    return 999

def _chapter_heading(number: int, title: str) -> str:
    # Avoid "Capitolo 1: Capitolo 1: ..." when the title already carries the number.
    if re.match(r"^capitolo\b", str(title), flags=re.IGNORECASE):
        return str(title)
    if number > 0 and number < 999:
        return f"Capitolo {number}: {title}"
    return str(title)

def build_thesis(wiki_dir: Path, output_file: Path, min_maturity: int = 0, title: str = "Tesi di Laurea"):
    wiki_notes = sorted(wiki_dir.glob("**/*.md"))
    wiki_is_chapters = wiki_dir.name.lower() == "capitoli"

    chapters = []
    syntheses = []

    for f in wiki_notes:
        if f.name.lower() in SKIP_NAMES:
            continue
        content = f.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(content)

        doc_type = str(fm.get("tipo", fm.get("type", "")) or "").strip().lower()
        maturita = _as_int(fm.get("maturita"), 0) or 0

        rel_path = f.relative_to(wiki_dir)

        if _is_chapter_note(doc_type, fm, rel_path, wiki_is_chapters):
            number = _chapter_number(fm, f.stem)
            chapters.append({
                "file": f,
                "rel_path": rel_path,
                "number": number,
                "title": fm.get("titolo", fm.get("title", f.stem)),
                "body": body,
                "fm": fm
            })
        elif doc_type in SYNTHESIS_TYPES or "sintesi" in str(rel_path):
            if maturita >= min_maturity:
                syntheses.append({
                    "file": f,
                    "rel_path": rel_path,
                    "maturita": maturita,
                    "title": fm.get("titolo", fm.get("title", f.stem)),
                    "body": body,
                    "fm": fm
                })

    chapters.sort(key=lambda c: (c["number"], str(c["rel_path"]).lower()))
    syntheses.sort(key=lambda s: s["maturita"], reverse=True)

    compiled_text = []
    compiled_text.append(f"# {title}\n")
    compiled_text.append("*Tesi Dinamica Evolutiva generata da Wiki-Forge Thesis Edition*\n")
    compiled_text.append("---\n\n")

    if chapters:
        compiled_text.append("## Parte I: Capitoli Strutturati\n\n")
        for ch in chapters:
            compiled_text.append(f"### {_chapter_heading(ch['number'], ch['title'])}\n")
            compiled_text.append(f"*(Maturità capitolo: {ch['fm'].get('maturita', 0)}/100)*\n\n")
            compiled_text.append(ch["body"].strip() + "\n\n---\n\n")

    if syntheses:
        compiled_text.append("## Parte II: Sintesi e Modelli Concettuali (Knowledge Base)\n\n")
        for syn in syntheses:
            compiled_text.append(f"### {syn['title']}\n")
            compiled_text.append(f"*(Tipo: {syn['fm'].get('tipo', 'sintesi')} | Maturità: {syn['maturita']}/100)*\n\n")
            compiled_text.append(syn["body"].strip() + "\n\n---\n\n")

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text("".join(compiled_text), encoding="utf-8")

    print(f"Generated thesis markdown: {output_file} ({len(chapters)} capitoli, {len(syntheses)} sintesi incluse)")

def main():
    parser = argparse.ArgumentParser(description="Generate compiled thesis markdown from wiki vault.")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--output", default="output/thesis_compiled.md", help="Output Markdown path")
    parser.add_argument("--min-maturity", type=int, default=0, help="Minimum maturity score for synthesis notes (0-100)")
    parser.add_argument("--title", default="Tesi di Laurea - Architettura Cognitiva Evolutiva", help="Thesis Title")
    parser.add_argument("--json", action="store_true", help="Output result as JSON object on stdout.")

    args = parser.parse_args()
    out_path = resolve_path(args.output, "output/thesis_compiled.md")
    build_thesis(resolve_dir(args.wiki_dir), out_path, args.min_maturity, args.title)
    if args.json:
        import json
        print(json.dumps({
            "status": "success",
            "output_path": str(out_path),
            "min_maturity": args.min_maturity,
            "title": args.title
        }))

if __name__ == "__main__":
    main()
