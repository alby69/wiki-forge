#!/usr/bin/env python3
"""
scripts/cq_validator.py
Competency Questions (CQ) Validation Engine for Wiki-Forge Knowledge Base.

Evaluates whether the wiki/ knowledge base contains necessary entities,
relations, and rules to answer natural language competency questions.
Generates output/cq_validation_report.md and supports --json flag.
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from okf_common import resolve_dir, resolve_path

try:
    import yaml
except ImportError:
    yaml = None

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

def extract_competency_questions(cq_file_path: Path) -> list[dict]:
    questions = []
    if not cq_file_path.exists():
        return questions

    content = cq_file_path.read_text(encoding="utf-8")
    lines = content.splitlines()

    for line_idx, line in enumerate(lines, 1):
        line_str = line.strip()
        # Match lines like "- CQ1: ...", "1. CQ: ...", "- Question: ..."
        m = re.match(r"^(?:[\-\*]|\d+\.)\s*(?:CQ\d*:|Question\d*:)?\s*(.+)$", line_str)
        if m:
            text = m.group(1).strip()
            if text and not text.startswith("#") and not text.startswith("Competency Questions"):
                questions.append({
                    "id": f"CQ-{len(questions)+1}",
                    "text": text,
                    "line": line_idx
                })
    return questions

def load_wiki_notes(wiki_dir: Path) -> list[dict]:
    notes = []
    if not wiki_dir.exists():
        return notes

    for file_path in wiki_dir.rglob("*.md"):
        if file_path.name in ("index.md", "log.md") or "versions" in file_path.parts:
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(content)
            notes.append({
                "file_path": file_path,
                "stem": file_path.stem,
                "title": fm.get("title") or file_path.stem.replace("-", " ").title(),
                "frontmatter": fm,
                "body": body,
                "full_text": content.lower()
            })
        except Exception:
            continue
    return notes

def evaluate_cq(cq: dict, notes: list[dict]) -> dict:
    q_text = cq["text"]
    q_lower = q_text.lower()

    # Extract key terms (excluding common stopwords)
    stopwords = {"quante", "quanti", "quale", "quali", "come", "cosa", "sono", "della", "delle", "degli", "dello", "dalla", "dalle", "dallo", "spettano", "a", "di", "per", "i", "il", "la", "le", "lo", "un", "una", "uno", "che", "e", "in", "su", "con", "da"}
    raw_tokens = re.findall(r"\w+", q_lower)
    tokens = [t for t in raw_tokens if len(t) > 2 and t not in stopwords]

    matched_notes = []
    found_structured_props = False

    for note in notes:
        score = 0
        text = note["full_text"]
        for token in tokens:
            if token in text:
                score += 1

        if score > 0:
            matched_notes.append({
                "note_id": note["stem"],
                "title": note["title"],
                "score": score,
                "frontmatter": note["frontmatter"]
            })

            # Check if note has relevant structured properties (YAML frontmatter)
            fm = note["frontmatter"]
            for k, v in fm.items():
                if any(tok in str(k).lower() or tok in str(v).lower() for tok in tokens):
                    found_structured_props = True

    matched_notes.sort(key=lambda x: x["score"], reverse=True)

    # Classification logic
    if not matched_notes:
        status = "UNCOVERED"
        status_label = "❌ Scoperte (knowledge gap)"
        coverage_score = 0.0
    elif found_structured_props or matched_notes[0]["score"] >= max(2, len(tokens) // 2):
        status = "COVERED"
        status_label = "✅ Coperte"
        coverage_score = 1.0
    else:
        status = "PARTIALLY_COVERED"
        status_label = "⚠️ Parzialmente coperte (missing relations)"
        coverage_score = 0.5

    return {
        "cq_id": cq["id"],
        "question": q_text,
        "status": status,
        "status_label": status_label,
        "coverage_score": coverage_score,
        "matched_notes": [m["note_id"] for m in matched_notes[:3]],
        "missing_elements": [] if status == "COVERED" else [
            f"Missing structured properties or relations for tokens: {', '.join(tokens)}"
        ]
    }

def generate_report(results: list[dict], output_path: Path) -> str:
    total = len(results)
    covered = sum(1 for r in results if r["status"] == "COVERED")
    partially = sum(1 for r in results if r["status"] == "PARTIALLY_COVERED")
    uncovered = sum(1 for r in results if r["status"] == "UNCOVERED")

    pct = (covered / total * 100) if total > 0 else 0.0

    lines = [
        "# Competency Questions (CQ) Validation Report",
        "",
        f"**Coverage Summary**: {covered}/{total} ({pct:.1f}%) CQs Fully Covered",
        "",
        f"- ✅ **Covered**: {covered}",
        f"- ⚠️ **Partially Covered**: {partially}",
        f"- ❌ **Uncovered (Knowledge Gaps)**: {uncovered}",
        "",
        "## Detailed Question Breakdown",
        ""
    ]

    for res in results:
        notes_str = ", ".join([f"`[[{n}]]`" for n in res["matched_notes"]]) if res["matched_notes"] else "None"
        lines.append(f"### {res['cq_id']}: {res['question']}")
        lines.append(f"- **Status**: {res['status_label']}")
        lines.append(f"- **Matched Notes**: {notes_str}")
        if res["missing_elements"]:
            lines.append(f"- **Identified Gap**: {'; '.join(res['missing_elements'])}")
        lines.append("")

    report_content = "\n".join(lines)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report_content, encoding="utf-8")
    return report_content

def main():
    parser = argparse.ArgumentParser(description="Competency Questions (CQ) Validation Engine")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--cq-file", default="wiki/competency_questions.md", help="Path to CQ file")
    parser.add_argument("--output", default="output/cq_validation_report.md", help="Output report path")
    parser.add_argument("--json", action="store_true", help="Output result as JSON on stdout")

    args = parser.parse_args()

    repo_root = Path.cwd()
    wiki_dir = resolve_dir(args.wiki_dir)
    cq_file = resolve_path(args.cq_file, "wiki/competency_questions.md")
    output_file = resolve_path(args.output, "output/cq_validation_report.md")

    cqs = extract_competency_questions(cq_file)
    notes = load_wiki_notes(wiki_dir)

    results = [evaluate_cq(cq, notes) for cq in cqs]

    covered_count = sum(1 for r in results if r["status"] == "COVERED")
    total_count = len(results)

    generate_report(results, output_file)

    payload = {
        "status": "success",
        "total_cqs": total_count,
        "covered_cqs": covered_count,
        "partially_covered_cqs": sum(1 for r in results if r["status"] == "PARTIALLY_COVERED"),
        "uncovered_cqs": sum(1 for r in results if r["status"] == "UNCOVERED"),
        "report_path": output_file.relative_to(repo_root).as_posix() if output_file.is_relative_to(repo_root) else str(output_file),
        "results": results
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"✅ CQ Validation complete. {covered_count}/{total_count} CQs covered.")
        print(f"Report saved to {output_file.relative_to(repo_root) if output_file.is_relative_to(repo_root) else output_file}")

if __name__ == "__main__":
    main()
