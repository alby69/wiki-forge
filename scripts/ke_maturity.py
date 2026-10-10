#!/usr/bin/env python3
"""
scripts/ke_maturity.py
Knowledge Engineering (KE) Maturity Assessment Engine.

Evaluates repository maturity across 6 key dimensions (L1-L4) based on objective metrics:
1. Knowledge Engineering & Modeling
2. LLM & AI Reasoning
3. Information Retrieval & Grounding
4. AI Systems Engineering
5. Agentic AI Integration
6. Knowledge Governance & Organization

Generates output/ke_maturity_report.md and supports --json flag.
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

def assess_ke_maturity(repo_root: Path, wiki_dir: Path) -> dict:
    # Gather repository metrics
    notes = []
    total_notes = 0
    valid_okf_notes = 0
    stable_notes = 0
    human_verified_notes = 0
    notes_with_odp = 0
    notes_with_grounding = 0

    if wiki_dir.exists():
        for file_path in wiki_dir.rglob("*.md"):
            if file_path.name in ("index.md", "log.md") or "versions" in file_path.parts:
                continue
            total_notes += 1
            try:
                content = file_path.read_text(encoding="utf-8")
                fm, body = parse_frontmatter(content)

                # Check OKF validity (has okf_version or status/tags)
                if fm.get("okf_version") or (fm.get("status") and fm.get("tags")):
                    valid_okf_notes += 1

                if fm.get("status") == "stable":
                    stable_notes += 1

                verified = fm.get("verified", [])
                if isinstance(verified, str):
                    verified = [verified] if verified else []
                if any("human:" in str(v) or (isinstance(v, dict) and "human:" in str(v.get("by", ""))) for v in verified):
                    human_verified_notes += 1

                # ODP check (has employment, classification, temporal_property, participation)
                if any(k in fm for k in ("employment", "classification", "temporal_property", "participation")):
                    notes_with_odp += 1

                # Line anchored grounding check
                sources = fm.get("sources", [])
                if isinstance(sources, list) and any("#L" in str(s) for s in sources):
                    notes_with_grounding += 1
            except Exception:
                continue

    # Check existence of key infrastructure artifacts
    rdf_export_exists = (repo_root / "output" / "wiki_export.jsonld").exists() or (repo_root / "output" / "wiki_export.ttl").exists()
    mcp_server_exists = (repo_root / "src" / "server" / "mcp_server.py").exists()
    cq_file_exists = (repo_root / "wiki" / "competency_questions.md").exists()
    skills_exist = (repo_root / "skills").exists() and len(list((repo_root / "skills").glob("*"))) > 0

    pct_okf = (valid_okf_notes / total_notes * 100) if total_notes > 0 else 0
    pct_grounded = (notes_with_grounding / total_notes * 100) if total_notes > 0 else 0

    # Dimension 1: Knowledge Engineering & Modeling
    if notes_with_odp > 0 and rdf_export_exists:
        d1_level = 4
    elif rdf_export_exists or pct_okf >= 80:
        d1_level = 3
    elif pct_okf >= 50:
        d1_level = 2
    else:
        d1_level = 1

    # Dimension 2: LLM & AI Reasoning
    if (repo_root / "output" / "neuro_symbolic_report.md").exists() or (repo_root / "scripts" / "neuro_symbolic_check.py").exists():
        d2_level = 4
    elif (repo_root / "scripts" / "ontology_rules.py").exists():
        d2_level = 3
    else:
        d2_level = 2

    # Dimension 3: Information Retrieval & Grounding
    if pct_grounded >= 50 and mcp_server_exists:
        d3_level = 4
    elif mcp_server_exists or pct_grounded > 0:
        d3_level = 3
    else:
        d3_level = 2

    # Dimension 4: AI Systems Engineering
    if (repo_root / "src" / "server" / "agentServer.ts").exists() and (repo_root / "package.json").exists():
        d4_level = 4
    else:
        d4_level = 3

    # Dimension 5: Agentic AI Integration
    if skills_exist and mcp_server_exists:
        d5_level = 4
    elif skills_exist:
        d5_level = 3
    else:
        d5_level = 2

    # Dimension 6: Knowledge Governance & Organization
    if (repo_root / "scripts" / "versioning.py").exists() and (repo_root / "wiki" / "log.md").exists():
        d6_level = 4
    elif (repo_root / "wiki" / "index.md").exists():
        d6_level = 3
    else:
        d6_level = 2

    dimensions = [
        {"name": "Knowledge Engineering & Modeling", "level": d1_level, "target": 4},
        {"name": "LLM & AI Reasoning", "level": d2_level, "target": 4},
        {"name": "Information Retrieval & Grounding", "level": d3_level, "target": 4},
        {"name": "AI Systems Engineering", "level": d4_level, "target": 4},
        {"name": "Agentic AI Integration", "level": d5_level, "target": 4},
        {"name": "Knowledge Governance & Organization", "level": d6_level, "target": 4},
    ]

    avg_level = sum(d["level"] for d in dimensions) / len(dimensions)

    if avg_level >= 3.8:
        overall_stage = "L4 - Cognitive/Agentic Knowledge Engineering Platform"
    elif avg_level >= 2.8:
        overall_stage = "L3 - AI Knowledge Engineering Platform"
    elif avg_level >= 1.8:
        overall_stage = "L2 - Knowledge Engineering Platform"
    else:
        overall_stage = "L1 - Knowledge Curation Base"

    return {
        "overall_stage": overall_stage,
        "average_level": round(avg_level, 2),
        "metrics": {
            "total_notes": total_notes,
            "valid_okf_notes": valid_okf_notes,
            "pct_okf": round(pct_okf, 1),
            "stable_notes": stable_notes,
            "human_verified_notes": human_verified_notes,
            "notes_with_odp": notes_with_odp,
            "pct_grounded": round(pct_grounded, 1),
            "rdf_export_exists": rdf_export_exists,
            "mcp_server_exists": mcp_server_exists,
            "cq_file_exists": cq_file_exists
        },
        "dimensions": dimensions
    }

def generate_report(assessment: dict, output_path: Path) -> str:
    dims = assessment["dimensions"]
    metrics = assessment["metrics"]

    lines = [
        "# Knowledge Engineer (KE) Maturity Assessment Report",
        "",
        f"**Overall Platform Level**: **{assessment['overall_stage']}** (Average Level: {assessment['average_level']}/4.0)",
        "",
        "## Dimension Breakdown Table",
        "",
        "| Competency Dimension | Current Level | Target Level | Status |",
        "|---|---|---|---|"
    ]

    for d in dims:
        status_icon = "✅ Target Reached" if d["level"] >= d["target"] else "⚠️ In Progress"
        lines.append(f"| {d['name']} | **L{d['level']}** | L{d['target']} | {status_icon} |")

    lines.extend([
        "",
        "## Key Quantitative Metrics",
        f"- **Total Wiki Notes**: {metrics['total_notes']}",
        f"- **OKF v0.2 Compliant Notes**: {metrics['valid_okf_notes']} ({metrics['pct_okf']}%)",
        f"- **Human-Verified Notes**: {metrics['human_verified_notes']}",
        f"- **Notes with ODP Structures**: {metrics['notes_with_odp']}",
        f"- **Line-Anchored Grounded Passages**: {metrics['pct_grounded']}%",
        f"- **W3C Semantic RDF Export Available**: {'Yes' if metrics['rdf_export_exists'] else 'No'}",
        f"- **MCP Server Enabled**: {'Yes' if metrics['mcp_server_exists'] else 'No'}",
        "",
        "## Priority Action Plan for Level Advancement",
        "1. **Validation**: Execute `make validate-cq` to verify competency questions coverage.",
        "2. **Ontology Design Patterns**: Execute `make suggest-odp` to convert informal YAML properties into formal ODP structures.",
        "3. **Neuro-Symbolic Reasoning**: Run `make neuro-check` to identify logical contradictions and missing link inferences.",
        "4. **Semantic Export**: Run `make export-semantic` to update W3C RDF graphs (`output/wiki_export.ttl` & `.jsonld`)."
    ])

    report_content = "\n".join(lines)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report_content, encoding="utf-8")
    return report_content

def main():
    parser = argparse.ArgumentParser(description="KE Maturity Assessment Engine")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory (default: wiki)")
    parser.add_argument("--output", default="output/ke_maturity_report.md", help="Output report path")
    parser.add_argument("--json", action="store_true", help="Output result as JSON on stdout")

    args = parser.parse_args()

    repo_root = Path.cwd()
    wiki_dir = resolve_dir(args.wiki_dir)
    output_file = resolve_path(args.output, "output/ke_maturity_report.md")

    assessment = assess_ke_maturity(repo_root, wiki_dir)
    generate_report(assessment, output_file)

    payload = {
        "status": "success",
        "overall_stage": assessment["overall_stage"],
        "average_level": assessment["average_level"],
        "report_path": output_file.relative_to(repo_root).as_posix() if output_file.is_relative_to(repo_root) else str(output_file),
        "assessment": assessment
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"📊 KE Maturity Assessment complete: Level = {assessment['overall_stage']} ({assessment['average_level']}/4.0)")
        print(f"Report saved to {output_file.relative_to(repo_root) if output_file.is_relative_to(repo_root) else output_file}")

if __name__ == "__main__":
    main()
