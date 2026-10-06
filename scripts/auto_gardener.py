#!/usr/bin/env python3
"""
scripts/auto_gardener.py

Automated Wiki Gardener 2.0 with Semantic Duplicate Detection for Wiki-Forge.
Analyzes wiki notes for broken links, orphan notes, and semantic duplicates.
Outputs report to `output/gardening_report.md`.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from scripts.ke_common import iter_pages


def tokenize(text: str) -> List[str]:
    """Simple word tokenization for TF-IDF cosine similarity."""
    words = re.findall(r"\b[a-zA-Z0-9_\-]{3,}\b", text.lower())
    stopwords = {
        "the", "and", "for", "that", "this", "with", "from", "are", "was",
        "were", "has", "have", "had", "not", "but", "what", "all", "were",
        "when", "where", "which", "who", "will", "more", "about", "can",
        "con", "del", "della", "delle", "degli", "per", "una", "uno", "che",
    }
    return [w for w in words if w not in stopwords]


def compute_tf_idf_vectors(documents: List[Tuple[str, str]]) -> Dict[str, Dict[str, float]]:
    """Compute TF-IDF vectors for a list of (doc_id, text) tuples."""
    tokenized_docs = {doc_id: tokenize(text) for doc_id, text in documents}
    doc_freq = Counter()
    for doc_id, tokens in tokenized_docs.items():
        unique_tokens = set(tokens)
        for t in unique_tokens:
            doc_freq[t] += 1

    N = max(1, len(documents))
    idf = {term: math.log((N + 1) / (df + 1)) + 1.0 for term, df in doc_freq.items()}

    vectors = {}
    for doc_id, tokens in tokenized_docs.items():
        tf = Counter(tokens)
        total_tokens = max(1, len(tokens))
        vec = {term: (count / total_tokens) * idf[term] for term, count in tf.items()}
        # Normalize vector
        norm = math.sqrt(sum(v * v for v in vec.values()))
        if norm > 0:
            vec = {term: v / norm for term, v in vec.items()}
        vectors[doc_id] = vec

    return vectors


def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Calculate cosine similarity between two normalized TF-IDF vectors."""
    common_terms = set(vec1.keys()) & set(vec2.keys())
    return sum(vec1[term] * vec2[term] for term in common_terms)


def run_gardener(wiki_dir: str = "wiki", output_dir: str = "output", similarity_threshold: float = 0.85) -> Dict[str, Any]:
    p = Path(wiki_dir)
    pages = list(iter_pages(wiki_dir=p)) if p.exists() else []

    page_map = {page.id.lower(): page for page in pages}
    all_links = set()
    linked_targets = set()
    broken_links = []

    for page in pages:
        wikilinks = re.findall(r"\[\[([^\]]+)\]\]", page.body)
        for target in wikilinks:
            clean_target = target.split("|")[0].split("#")[0].strip()
            if not clean_target:
                continue
            norm_target = clean_target.lower()
            all_links.add((page.id, clean_target))
            if norm_target in page_map:
                linked_targets.add(norm_target)
            else:
                broken_links.append((page.id, clean_target))

    orphan_notes = [p.id for p in pages if p.id.lower() not in linked_targets]

    # Semantic duplicates check
    docs = [(page.id, page.body) for page in pages]
    vectors = compute_tf_idf_vectors(docs)

    duplicates = []
    page_list = list(pages)
    for i in range(len(page_list)):
        for j in range(i + 1, len(page_list)):
            p1 = page_list[i]
            p2 = page_list[j]

            raw_tags1 = p1.frontmatter.get("tags", [])
            raw_tags2 = p2.frontmatter.get("tags", [])
            if isinstance(raw_tags1, str):
                raw_tags1 = [t.strip() for t in raw_tags1.split(",")]
            if isinstance(raw_tags2, str):
                raw_tags2 = [t.strip() for t in raw_tags2.split(",")]
            tags1 = set(raw_tags1) if isinstance(raw_tags1, list) else set()
            tags2 = set(raw_tags2) if isinstance(raw_tags2, list) else set()
            common_tags = tags1 & tags2

            sim = cosine_similarity(vectors[p1.id], vectors[p2.id])

            if sim >= similarity_threshold and len(common_tags) >= 2:
                duplicates.append({
                    "note1": p1.id,
                    "note2": p2.id,
                    "similarity": round(sim, 4),
                    "common_tags": list(common_tags),
                    "suggestion": f"/merge {p1.id} {p2.id}"
                })

    # Generate Markdown report
    out_p = Path(output_dir)
    out_p.mkdir(parents=True, exist_ok=True)
    report_file = out_p / "gardening_report.md"

    report_lines = [
        "# 🧹 Automated Wiki Gardener 2.0 Report",
        "",
        f"- **Total Notes Analyzed:** {len(pages)}",
        f"- **Broken Links:** {len(broken_links)}",
        f"- **Orphan Notes:** {len(orphan_notes)}",
        f"- **Possible Conceptual Duplicates:** {len(duplicates)}",
        "",
        "## 🔗 Broken Links",
    ]

    if broken_links:
        for src, tgt in broken_links:
            report_lines.append(f"- Note `[[{src}]]` links to missing target `[[{tgt}]]`")
    else:
        report_lines.append("No broken links found. Everything is well connected!")

    report_lines.extend(["", "## 🏝️ Orphan Notes"])
    if orphan_notes:
        for orphan in orphan_notes:
            report_lines.append(f"- Note `[[{orphan}]]` has no incoming links.")
    else:
        report_lines.append("No orphan notes found.")

    report_lines.extend(["", "## 👯 Possibili Duplicati Concettuali"])
    if duplicates:
        for dup in duplicates:
            report_lines.append(
                f"- **Pair:** `[[{dup['note1']}]]` & `[[{dup['note2']}]]`\n"
                f"  - **Similarity:** {dup['similarity'] * 100:.1f}%\n"
                f"  - **Common Tags:** `{', '.join(dup['common_tags'])}`\n"
                f"  - **Suggested Action:** `{dup['suggestion']}`"
            )
    else:
        report_lines.append("No conceptual duplicates detected above similarity threshold.")

    report_file.write_text("\n".join(report_lines), encoding="utf-8")

    return {
        "total_notes": len(pages),
        "broken_links_count": len(broken_links),
        "orphan_notes_count": len(orphan_notes),
        "duplicates": duplicates,
        "report_path": str(report_file),
    }


def main():
    parser = argparse.ArgumentParser(description="Wiki Gardener 2.0 with Duplicate Detection")
    parser.add_argument("--wiki", default="wiki", help="Path to wiki directory")
    parser.add_argument("--output", default="output", help="Output directory")
    parser.add_argument("--threshold", type=float, default=0.85, help="Similarity threshold (0.0 - 1.0)")
    parser.add_argument("--json", action="store_true", help="Output JSON result")

    args = parser.parse_args()
    res = run_gardener(args.wiki, args.output, args.threshold)

    if args.json:
        import json
        print(json.dumps(res, indent=2))
    else:
        print(f"Gardening report generated at: {res['report_path']}")
        print(f"Summary: {res['broken_links_count']} broken links, {res['orphan_notes_count']} orphans, {len(res['duplicates'])} duplicate pairs.")


if __name__ == "__main__":
    main()
