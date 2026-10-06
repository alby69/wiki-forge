#!/usr/bin/env python3
"""
graph_analytics.py — Louvain Community Detection & Topological Graph Insights for Wiki-Forge.

Scans wiki notes, builds network graph, performs Louvain community detection,
and identifies surprising cross-community links and knowledge gaps.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
import networkx as nx


def build_graph(wiki_dir: Path) -> tuple[nx.Graph, dict[str, str]]:
    G = nx.Graph()
    titles: dict[str, str] = {}

    for md_file in wiki_dir.rglob("*.md"):
        if md_file.name == "index.md" or md_file.name == "log.md":
            continue
        stem = md_file.stem
        G.add_node(stem)
        titles[stem] = stem.replace("-", " ").replace("_", " ").title()

        try:
            content = md_file.read_text(encoding="utf-8")
            import re
            links = re.findall(r"\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]", content)
            for link in links:
                target = link.split("/")[-1].replace(".md", "").strip().lower()
                if target:
                    G.add_node(target)
                    titles.setdefault(target, target.replace("-", " ").title())
                    G.add_edge(stem, target)
        except Exception:
            pass

    return G, titles


def analyze_graph(G: nx.Graph, titles: dict[str, str]) -> dict:
    if G.number_of_nodes() == 0:
        return {"clusters": {}, "surprising_connections": [], "knowledge_gaps": []}

    try:
        communities = nx.community.louvain_communities(G, seed=42)
    except Exception:
        communities = [set(G.nodes())]

    community_map = {}
    clusters = {}
    for idx, comm in enumerate(communities):
        cid = f"community_{idx + 1}"
        clusters[cid] = [node for node in comm]
        for node in comm:
            community_map[node] = cid

    surprising_connections = []
    for u, v in G.edges():
        c_u = community_map.get(u)
        c_v = community_map.get(v)
        if c_u and c_v and c_u != c_v:
            surprising_connections.append({
                "source": u,
                "source_title": titles.get(u, u),
                "target": v,
                "target_title": titles.get(v, v),
                "community_source": c_u,
                "community_target": c_v
            })

    knowledge_gaps = []
    for node in G.nodes():
        deg = G.degree(node)
        if deg <= 1:
            knowledge_gaps.append({
                "node": node,
                "title": titles.get(node, node),
                "degree": deg,
                "reason": "Isolated or low connectivity (<2 links)",
                "action": "Deep Research"
            })

    return {
        "clusters": clusters,
        "community_map": community_map,
        "surprising_connections": surprising_connections,
        "knowledge_gaps": knowledge_gaps
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Graph Louvain Analytics & Insights")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to wiki directory")
    parser.add_argument("--json", action="store_true", help="Output JSON results")

    args = parser.parse_args()
    wiki_path = Path(args.wiki_dir)

    if not wiki_path.exists():
        if args.json:
            print(json.dumps({"error": f"Wiki path {wiki_path} does not exist"}))
        else:
            print(f"Error: {wiki_path} does not exist", file=sys.stderr)
        sys.exit(1)

    G, titles = build_graph(wiki_path)
    res = analyze_graph(G, titles)

    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"Graph Analysis Complete: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
        print(f"Communities detected: {len(res['clusters'])}")
        print(f"Surprising inter-community connections: {len(res['surprising_connections'])}")
        print(f"Knowledge gaps identified: {len(res['knowledge_gaps'])}")


if __name__ == "__main__":
    main()
