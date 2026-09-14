#!/usr/bin/env python3
"""
scripts/generate_thesis.py
Aggregates thesis chapter drafts and mature synthesis wiki notes into a single cohesive draft.

Outputs:
  output/thesis_compiled.md
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

def build_thesis(wiki_dir: Path, output_file: Path, min_maturity: int = 0, title: str = "Tesi di Laurea"):
    wiki_notes = list(wiki_dir.glob("**/*.md"))

    chapters = []
    syntheses = []

    for f in wiki_notes:
        if f.name.lower() in ("index.md", "log.md"):
            continue
        content = f.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(content)

        doc_type = fm.get("tipo", fm.get("type", "")).lower()
        maturita = int(fm.get("maturita", 0))

        rel_path = f.relative_to(wiki_dir)

        if doc_type in ("capitolo_tesi", "capitolo"):
            chapters.append({
                "file": f,
                "rel_path": rel_path,
                "number": int(fm.get("capitolo_numero", 999)),
                "title": fm.get("titolo", fm.get("title", f.stem)),
                "body": body,
                "fm": fm
            })
        elif doc_type in ("sintesi", "concetto", "concept") or "sintesi" in str(rel_path):
            if maturita >= min_maturity:
                syntheses.append({
                    "file": f,
                    "rel_path": rel_path,
                    "maturita": maturita,
                    "title": fm.get("titolo", fm.get("title", f.stem)),
                    "body": body,
                    "fm": fm
                })

    chapters.sort(key=lambda c: c["number"])
    syntheses.sort(key=lambda s: s["maturita"], reverse=True)

    compiled_text = []
    compiled_text.append(f"# {title}\n")
    compiled_text.append("*Tesi Dinamica Evolutiva generata da Wiki-Forge Thesis Edition*\n")
    compiled_text.append("---\n\n")

    if chapters:
        compiled_text.append("## Parte I: Capitoli Strutturati\n\n")
        for ch in chapters:
            compiled_text.append(f"### Capitolo {ch['number']}: {ch['title']}\n")
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

    print(f"✅ Generated thesis markdown: {output_file} ({len(chapters)} capitoli, {len(syntheses)} sintesi incluse)")

def main():
    parser = argparse.ArgumentParser(description="Generate compiled thesis markdown from wiki vault.")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--output", default="output/thesis_compiled.md", help="Output Markdown path")
    parser.add_argument("--min-maturity", type=int, default=0, help="Minimum maturity score for synthesis notes (0-100)")
    parser.add_argument("--title", default="Tesi di Laurea - Architettura Cognitiva Evolutiva", help="Thesis Title")

    args = parser.parse_args()
    build_thesis(Path(args.wiki_dir).resolve(), Path(args.output).resolve(), args.min_maturity, args.title)

if __name__ == "__main__":
    main()
