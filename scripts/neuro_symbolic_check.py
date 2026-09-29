#!/usr/bin/env python3
"""
scripts/neuro_symbolic_check.py
Neuro-Symbolic Consistency Bridge for Wiki-Forge Knowledge Base.

Bridges explicit Knowledge Representation (RDF export / OKF frontmatter) and
LLM neuro-symbolic reasoning to identify logical contradictions and infer
missing semantic links across the knowledge graph.
Produces output/neuro_symbolic_report.md and supports --json flag.
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path

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

def check_neuro_symbolic_consistency(repo_root: Path, wiki_dir: Path) -> dict:
    contradictions = []
    inferred_links = []
    notes = []

    if not wiki_dir.exists():
        return {"contradictions": contradictions, "inferred_links": inferred_links}

    # Load all notes
    note_map = {}
    for file_path in wiki_dir.rglob("*.md"):
        if file_path.name in ("index.md", "log.md") or "versions" in file_path.parts:
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(content)
            stem = file_path.stem
            rel_path = file_path.relative_to(repo_root).as_posix()

            # Extract outbound links
            links = re.findall(r"\[\[([^\]\|#]+)(?:\|[^\]]+)?\]\]", content)

            note_info = {
                "stem": stem,
                "path": rel_path,
                "status": fm.get("status", "draft"),
                "verified": fm.get("verified", []),
                "tags": fm.get("tags", []),
                "stale_after": fm.get("stale_after"),
                "type": fm.get("type", "Concept"),
                "outbound_links": links,
                "frontmatter": fm,
                "body": body
            }
            note_map[stem] = note_info
            notes.append(note_info)
        except Exception:
            continue

    # 1. Logical Contradiction Check: Status stable without human verification
    for n in notes:
        verified = n["verified"]
        if isinstance(verified, str):
            verified = [verified] if verified else []
        has_human = any("human:" in str(v) or (isinstance(v, dict) and "human:" in str(v.get("by", ""))) for v in verified)

        if n["status"] == "stable" and not has_human:
            contradictions.append({
                "note_id": n["stem"],
                "rule": "Stable Status Human Verification",
                "severity": "HIGH",
                "details": f"Note '[[{n['stem']}]]' is marked status: stable but lacks human verification in 'verified' list."
            })

    # 2. Transitive Link Inference Check:
    # If A links to B, and B links to C, but A does NOT link to C, and A & C share domain tags
    for n_a in notes:
        a_stem = n_a["stem"]
        a_links = set(n_a["outbound_links"])
        a_tags = set(n_a["tags"]) if isinstance(n_a["tags"], list) else set()

        for b_stem in a_links:
            if b_stem in note_map:
                n_b = note_map[b_stem]
                b_links = set(n_b["outbound_links"])

                for c_stem in b_links:
                    if c_stem != a_stem and c_stem not in a_links and c_stem in note_map:
                        n_c = note_map[c_stem]
                        c_tags = set(n_c["tags"]) if isinstance(n_c["tags"], list) else set()

                        common_tags = a_tags.intersection(c_tags)
                        if common_tags:
                            inferred_links.append({
                                "source_note": a_stem,
                                "intermediate_note": b_stem,
                                "target_note": c_stem,
                                "reason": f"Transitive connection via [[{b_stem}]] with shared tags: {', '.join(common_tags)}",
                                "suggested_link": f"[[{c_stem}]]"
                            })

    return {
        "contradictions": contradictions,
        "inferred_links": inferred_links
    }

def generate_report(analysis: dict, output_path: Path) -> str:
    contradictions = analysis["contradictions"]
    inferred_links = analysis["inferred_links"]

    lines = [
        "# Neuro-Symbolic Consistency & Inference Report",
        "",
        "## Summary",
        f"- **Logical Contradictions Detected**: {len(contradictions)}",
        f"- **Inferred Missing Semantic Links**: {len(inferred_links)}",
        "",
        "## ⚠️ Logical Contradictions & Rule Violations",
        ""
    ]

    if not contradictions:
        lines.append("✅ No logical contradictions found.")
    else:
        for c in contradictions:
            lines.append(f"### `[[{c['note_id']}]]` - [{c['severity']}] {c['rule']}")
            lines.append(f"- **Details**: {c['details']}")
            lines.append("")

    lines.append("")
    lines.append("## 💡 Neuro-Symbolic Inferred Semantic Links")
    lines.append("")

    if not inferred_links:
        lines.append("No missing transitive links inferred.")
    else:
        for link in inferred_links:
            lines.append(f"- Suggest adding `{link['suggested_link']}` to `[[{link['source_note']}]]` (via `[[{link['intermediate_note']}]]` - {link['reason']})")

    report_content = "\n".join(lines)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report_content, encoding="utf-8")
    return report_content

def main():
    parser = argparse.ArgumentParser(description="Neuro-Symbolic Consistency Bridge")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--output", default="output/neuro_symbolic_report.md", help="Output report path")
    parser.add_argument("--json", action="store_true", help="Output result as JSON on stdout")

    args = parser.parse_args()

    repo_root = Path.cwd()
    wiki_dir = repo_root / args.wiki_dir
    output_file = repo_root / args.output

    analysis = check_neuro_symbolic_consistency(repo_root, wiki_dir)
    generate_report(analysis, output_file)

    payload = {
        "status": "success",
        "contradiction_count": len(analysis["contradictions"]),
        "inferred_link_count": len(analysis["inferred_links"]),
        "report_path": output_file.relative_to(repo_root).as_posix() if output_file.is_relative_to(repo_root) else str(output_file),
        "analysis": analysis
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"🧠 Neuro-Symbolic Check complete. Contradictions: {len(analysis['contradictions'])}, Inferred Links: {len(analysis['inferred_links'])}")
        print(f"Report saved to {output_file.relative_to(repo_root) if output_file.is_relative_to(repo_root) else output_file}")

if __name__ == "__main__":
    main()
