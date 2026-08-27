#!/usr/bin/env python3
"""
wiki_stats.py — Calculate statistics and metrics for the LLM Wiki.

Scans the `wiki/` and `raw/` directories to generate metrics such as:
- Total articles
- Total wikilinks & broken links
- Orphan articles
- Thematic wiki folders
- Ingested sources

Outputs a summary report to stdout and writes/updates `METRICS.md`.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path


def load_config() -> dict:
    defaults = {
        "paths": {
            "sources": "backup",
            "raw": "raw",
            "wiki": "wiki",
            "output": "output",
        }
    }
    try:
        import tomllib
    except ImportError:
        return defaults

    cfg_path = Path("config.toml")
    if cfg_path.is_file():
        with cfg_path.open("rb") as fh:
            data = tomllib.load(fh)
        for section, values in data.items():
            if isinstance(values, dict):
                defaults.setdefault(section, {}).update(values)
    return defaults


def analyze_wiki(wiki_dir: Path, raw_dir: Path) -> dict:
    if not wiki_dir.exists():
        return {
            "total_articles": 0,
            "total_wikilinks": 0,
            "broken_links": 0,
            "orphan_articles": 0,
            "thematic_wikis": 0,
            "sources_ingested": 0,
            "top_linked": [],
        }

    articles = list(wiki_dir.rglob("*.md"))
    article_stems = {a.stem for a in articles}

    # Count thematic wikis (subdirectories of wiki_dir)
    thematic_wikis = [d for d in wiki_dir.iterdir() if d.is_dir()]

    total_wikilinks = 0
    broken_links = 0
    link_targets: dict[str, int] = {}
    inbound_links: dict[str, int] = {a.stem: 0 for a in articles}
    outbound_links: dict[str, int] = {a.stem: 0 for a in articles}

    wikilink_pattern = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")

    for article in articles:
        content = article.read_text(encoding="utf-8", errors="ignore")
        matches = wikilink_pattern.findall(content)
        total_wikilinks += len(matches)

        for match in matches:
            target = match.strip()
            # Handle index links or path links like folder/index
            target_name = target.split("/")[-1]
            link_targets[target_name] = link_targets.get(target_name, 0) + 1

            if target_name in inbound_links:
                inbound_links[target_name] += 1
            outbound_links[article.stem] += 1

            if target_name not in article_stems and target != "index":
                broken_links += 1

    orphan_articles = [
        stem
        for stem in article_stems
        if stem != "index" and inbound_links.get(stem, 0) == 0 and outbound_links.get(stem, 0) == 0
    ]

    top_linked = sorted(link_targets.items(), key=lambda x: x[1], reverse=True)[:10]

    sources_ingested = 0
    if raw_dir.exists():
        sources_ingested = len(
            [f for f in raw_dir.rglob("*") if "_COMPILED" in f.name and f.is_file()]
        )

    return {
        "total_articles": len(articles),
        "total_wikilinks": total_wikilinks,
        "broken_links": broken_links,
        "orphan_articles": len(orphan_articles),
        "thematic_wikis": len(thematic_wikis),
        "sources_ingested": sources_ingested,
        "top_linked": top_linked,
    }


def generate_metrics_md(stats: dict, output_path: Path = Path("METRICS.md")) -> None:
    today = date.today().isoformat()
    top_linked_str = "\n".join(
        f"| [[{item[0]}]] | {item[1]} |" for item in stats["top_linked"]
    ) if stats["top_linked"] else "| None | 0 |"

    content = f"""---
generated: {today}
---

# Wiki Metrics

| Metric | Value |
|--------|-------|
| Total articles | {stats['total_articles']} |
| Total wikilinks | {stats['total_wikilinks']} |
| Broken links | {stats['broken_links']} |
| Orphan articles | {stats['orphan_articles']} |
| Thematic wikis | {stats['thematic_wikis']} |
| Sources ingested | {stats['sources_ingested']} |

## Most Linked Articles

| Article | Inbound Links |
|---------|---------------|
{top_linked_str}
"""
    output_path.write_text(content, encoding="utf-8")


def main() -> None:
    cfg = load_config()
    paths = cfg.get("paths", {})
    wiki_dir = Path(paths.get("wiki", "wiki"))
    raw_dir = Path(paths.get("raw", "raw"))

    stats = analyze_wiki(wiki_dir, raw_dir)

    print("=== Wiki Statistics ===")
    print(f"Total articles:    {stats['total_articles']}")
    print(f"Total wikilinks:   {stats['total_wikilinks']}")
    print(f"Broken links:     {stats['broken_links']}")
    print(f"Orphan articles:  {stats['orphan_articles']}")
    print(f"Thematic wikis:   {stats['thematic_wikis']}")
    print(f"Sources ingested: {stats['sources_ingested']}")

    generate_metrics_md(stats)
    print("\nReport written to METRICS.md")


if __name__ == "__main__":
    main()
