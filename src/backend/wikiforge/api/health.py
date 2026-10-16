"""
src/backend/wikiforge/api/health.py

Unified Knowledge Base Health & Metrics Engine for Wiki-Forge.
Aggregates metrics from okf_stats, shacl_validator, ke_maturity, cq_runner,
calculates L1-L4 Maturity Level, generates Next Best Actions, writes .wikiforge/STATUS.md,
and appends historical snapshots to .wikiforge/metrics/history.jsonl.
"""

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.backend.wikiforge.semantics.shacl_validator import validate_shacl
from src.backend.wikiforge.semantics.markdown_parser import parse_markdown_file
from rdflib import Graph

try:
    from scripts.ke_maturity import assess_ke_maturity
except ImportError:
    assess_ke_maturity = None


def compute_health_metrics(repo_root: Path, wiki_dir: Optional[Path] = None) -> Dict[str, Any]:
    if wiki_dir is None:
        wiki_dir = repo_root / "wiki"

    raw_dir = repo_root / "raw"
    wikiforge_dir = repo_root / ".wikiforge"
    metrics_dir = wikiforge_dir / "metrics"
    wikiforge_dir.mkdir(parents=True, exist_ok=True)
    metrics_dir.mkdir(parents=True, exist_ok=True)

    # 1. Pipeline counts
    raw_pending = 0
    if raw_dir.exists():
        for p in raw_dir.rglob("*.md"):
            if "_COMPILED" not in p.name:
                raw_pending += 1

    wiki_articles = 0
    all_notes = []
    known_ids = set()
    verified_stable_count = 0
    stable_count = 0
    notes_with_fm = 0

    if wiki_dir.exists():
        for p in wiki_dir.rglob("*.md"):
            if p.name in ("index.md", "log.md") or "versions" in p.parts:
                continue
            wiki_articles += 1
            try:
                content = p.read_text(encoding="utf-8")
                parsed = parse_markdown_file(p)
                parsed_dict = {
                    "id": parsed.note_id,
                    "title": parsed.title,
                    "frontmatter": parsed.frontmatter,
                    "outbound_links": [link.target_id for link in parsed.links]
                }
                all_notes.append(parsed_dict)
                known_ids.add(parsed.note_id.lower())
                known_ids.add(parsed.title.lower())
                stem = p.stem.lower()
                known_ids.add(stem)

                fm = parsed.frontmatter
                if fm:
                    notes_with_fm += 1

                st = fm.get("status")
                if st == "stable":
                    stable_count += 1
                    v = fm.get("verified", [])
                    if isinstance(v, str):
                        v = [v]
                    if any("human:" in str(x) or (isinstance(x, dict) and "human:" in str(x.get("by", ""))) for x in (v or [])):
                        verified_stable_count += 1
            except Exception:
                continue

    # 2. Orphans & Broken links
    orphans = 0
    broken_links = 0
    if all_notes:
        backlink_counts = {n["id"]: 0 for n in all_notes}
        for n in all_notes:
            for target in n.get("outbound_links", []):
                t_clean = target.lower().strip()
                if t_clean in backlink_counts:
                    backlink_counts[t_clean] += 1
                if t_clean and t_clean not in known_ids and t_clean != "index":
                    broken_links += 1

        for n in all_notes:
            if backlink_counts.get(n["id"], 0) == 0:
                orphans += 1

    orphan_ratio = round(orphans / wiki_articles, 3) if wiki_articles > 0 else 0.0

    # 3. SHACL violations
    shacl_violations = 0
    ttl_path = repo_root / "knowledge_graph.ttl"
    if not ttl_path.exists():
        ttl_path = repo_root / "output" / "wiki_export.ttl"
    shapes_path = repo_root / "src" / "backend" / "wikiforge" / "config" / "shapes.ttl"

    if ttl_path.exists() and shapes_path.exists():
        try:
            g = Graph()
            g.parse(str(ttl_path), format="turtle")
            res = validate_shacl(g, str(shapes_path))
            shacl_violations = len(res.get("violations", []))
        except Exception:
            shacl_violations = 0

    # 4. Competency Questions gaps
    cq_gaps = 0
    cq_file = wiki_dir / "competency_questions.md"
    cq_report = repo_root / "output" / "cq_validation_report.md"
    if cq_report.exists():
        try:
            rep_text = cq_report.read_text(encoding="utf-8")
            cq_gaps = rep_text.count("❌ Unanswered") + rep_text.count("[FAILED]")
        except Exception:
            cq_gaps = 0
    elif cq_file.exists():
        try:
            cq_text = cq_file.read_text(encoding="utf-8")
            cq_gaps = len([line for line in cq_text.splitlines() if line.strip().startswith("- Q") or line.strip().startswith("1.") or line.strip().startswith("2.")])
        except Exception:
            cq_gaps = 0

    # 5. KE Maturity Score (0-100)
    ke_maturity_score = 0.0
    overall_stage = "L1 - Seeded"
    if assess_ke_maturity:
        try:
            mat_res = assess_ke_maturity(repo_root, wiki_dir)
            overall_stage = mat_res.get("overall_stage", "L1")
            avg_lvl = mat_res.get("average_level", 1.0)
            ke_maturity_score = round((avg_lvl / 4.0) * 100, 1)
        except Exception:
            ke_maturity_score = 50.0

    # Determine Maturity Level L1-L4
    maturity_level = "L1"
    maturity_label = "L1 - Seeded"

    if wiki_articles > 0 and notes_with_fm > 0:
        maturity_level = "L1"
        maturity_label = "L1 - Seeded"

    if wiki_articles > 0 and shacl_violations == 0 and broken_links == 0:
        maturity_level = "L2"
        maturity_label = "L2 - Structured"

    if maturity_level in ("L2", "L3") and orphan_ratio < 0.05 and ke_maturity_score >= 60.0:
        maturity_level = "L3"
        maturity_label = "L3 - Connected"

    if maturity_level in ("L3", "L4") and cq_gaps == 0 and (stable_count == 0 or verified_stable_count == stable_count):
        maturity_level = "L4"
        maturity_label = "L4 - Trusted"

    # Overall Health Score 0-100
    health_score = 100.0
    if shacl_violations > 0:
        health_score -= min(30, shacl_violations * 10)
    if broken_links > 0:
        health_score -= min(20, broken_links * 5)
    if orphan_ratio > 0.1:
        health_score -= 15
    if cq_gaps > 0:
        health_score -= min(15, cq_gaps * 5)
    if raw_pending > 0:
        health_score -= min(10, raw_pending * 2)

    health_score = max(0.0, round(health_score, 1))

    # Next Best Actions Engine
    next_best_actions = []

    if shacl_violations > 0:
        next_best_actions.append({
            "id": "ke.ontological-integrity",
            "title": "Validate and Fix SHACL Ontological Integrity",
            "description": f"Resolve {shacl_violations} SHACL shape violations in knowledge graph.",
            "severity": "high",
            "impact": "high",
            "effort": "low",
            "priority": 9.0,
        })

    if raw_pending > 0:
        next_best_actions.append({
            "id": "ke.compile",
            "title": "Compile Staged Raw Sources into Wiki Notes",
            "description": f"Process {raw_pending} pending files in raw/ into structured notes.",
            "severity": "medium",
            "impact": "high",
            "effort": "medium",
            "priority": 8.0,
        })

    if broken_links > 0 or orphan_ratio > 0.05:
        next_best_actions.append({
            "id": "user.weekly-check",
            "title": "Weekly KB Maintenance & Link Audit",
            "description": f"Fix {broken_links} broken links and address orphan ratio ({round(orphan_ratio*100, 1)}%).",
            "severity": "medium",
            "impact": "medium",
            "effort": "low",
            "priority": 7.5,
        })

    if cq_gaps > 0:
        next_best_actions.append({
            "id": "ke.validate-cq",
            "title": "Validate Competency Questions Coverage",
            "description": f"Evaluate and fill {cq_gaps} unanswered competency questions.",
            "severity": "medium",
            "impact": "medium",
            "effort": "medium",
            "priority": 6.5,
        })

    if ke_maturity_score < 80.0:
        next_best_actions.append({
            "id": "ke.export-semantic",
            "title": "Export Enterprise Semantic RDF Graph",
            "description": "Generate W3C JSON-LD and Turtle exports for GraphRAG integration.",
            "severity": "low",
            "impact": "high",
            "effort": "low",
            "priority": 5.0,
        })

    next_best_actions.sort(key=lambda x: x["priority"], reverse=True)

    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    payload = {
        "timestamp": timestamp,
        "health_score": health_score,
        "maturity_level": maturity_level,
        "maturity_label": maturity_label,
        "ke_maturity_score": ke_maturity_score,
        "metrics": {
            "shacl_violations": shacl_violations,
            "cq_gaps": cq_gaps,
            "raw_pending": raw_pending,
            "wiki_articles": wiki_articles,
            "orphan_ratio": orphan_ratio,
            "orphans": orphans,
            "broken_links": broken_links,
            "stable_notes": stable_count,
            "verified_stable_notes": verified_stable_count,
        },
        "next_best_actions": next_best_actions,
    }

    # Write .wikiforge/STATUS.md
    status_md_path = wikiforge_dir / "STATUS.md"
    status_content = generate_status_markdown(payload)
    status_md_path.write_text(status_content, encoding="utf-8")

    # Append snapshot to .wikiforge/metrics/history.jsonl
    history_file = metrics_dir / "history.jsonl"
    with history_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload) + "\n")

    return payload


def generate_status_markdown(data: Dict[str, Any]) -> str:
    m = data["metrics"]
    actions = data["next_best_actions"]
    action_items = "\n".join([f"- **[{a['id']}]** {a['title']} — *{a['description']}*" for a in actions]) or "- None (Knowledge base fully healthy!)"

    return f"""# Wiki-Forge Knowledge Base Status & Health Summary

**Updated**: `{data['timestamp']}`
**Health Score**: **{data['health_score']} / 100**
**Maturity Level**: **{data['maturity_label']}** (KE Score: {data['ke_maturity_score']}/100)

---

## 📊 Core Health Metrics
| Metric | Value | Threshold / Status |
|---|---|---|
| **Wiki Articles** | `{m['wiki_articles']}` | Total notes in `wiki/` |
| **Raw Pending Ingestion** | `{m['raw_pending']}` | Staged files in `raw/` |
| **SHACL Violations** | `{m['shacl_violations']}` | Target: `0` |
| **Competency Question Gaps** | `{m['cq_gaps']}` | Target: `0` |
| **Orphan Ratio** | `{round(m['orphan_ratio']*100, 1)}%` ({m['orphans']} notes) | Target: `< 5%` |
| **Broken Links** | `{m['broken_links']}` | Target: `0` |
| **Verified Stable Notes** | `{m['verified_stable_notes']} / {m['stable_notes']}` | Target: 100% human-verified |

---

## 🎯 Next Best Actions
{action_items}

---
*Generated automatically by Wiki-Forge Health Engine. Agent directive: read this file or query `/api/v1/health` at session startup.*
"""
