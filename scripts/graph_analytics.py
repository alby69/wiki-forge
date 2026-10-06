#!/usr/bin/env python3
"""
scripts/graph_analytics.py

Graph analytics module for Wiki-Forge notes knowledge graph.
Calculates community detection (using Louvain algorithm via NetworkX) and node centrality metrics.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import re
import networkx as nx
from scripts.ke_common import iter_pages


def build_graph(wiki_dir: str = "wiki") -> nx.Graph:
    """Build an undirected graph of notes and wikilinks."""
    p = Path(wiki_dir)
    pages = list(iter_pages(wiki_dir=p)) if p.exists() else []

    G = nx.Graph()

    # Map target stems and titles for lookup
    page_map = {}
    for page in pages:
        stem = page.path.stem
        title = page.frontmatter.get("title") or page.id
        G.add_node(stem, title=title, path=str(page.path))
        page_map[stem.lower()] = stem
        page_map[str(title).lower()] = stem

    for page in pages:
        src = page.path.stem
        wikilinks = re.findall(r"\[\[([^\]]+)\]\]", page.body)
        for target in wikilinks:
            if not target:
                continue
            norm_target = target.split("|")[0].split("#")[0].strip().lower()
            if norm_target in page_map:
                tgt_stem = page_map[norm_target]
                if src != tgt_stem:
                    G.add_edge(src, tgt_stem)

    return G


def compute_clusters(wiki_dir: str = "wiki") -> Dict[str, Any]:
    """Compute Louvain community detection and degree centrality on note graph."""
    G = build_graph(wiki_dir)

    if G.number_of_nodes() == 0:
        return {"total_nodes": 0, "total_edges": 0, "clusters": []}

    # Community detection using Louvain
    try:
        communities = nx.community.louvain_communities(G, seed=42)
    except Exception:
        # Fallback if graph has no edges or single node
        communities = [set(G.nodes())]

    centrality = nx.degree_centrality(G)

    clusters_list = []
    for cluster_id, comm in enumerate(communities, start=1):
        nodes_in_cluster = []
        for node in sorted(comm):
            node_data = G.nodes[node]
            nodes_in_cluster.append({
                "id": node,
                "title": node_data.get("title", node),
                "path": node_data.get("path", ""),
                "centrality": round(centrality.get(node, 0.0), 4),
            })
        clusters_list.append({
            "cluster_id": cluster_id,
            "node_count": len(nodes_in_cluster),
            "nodes": nodes_in_cluster,
        })

    return {
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "cluster_count": len(clusters_list),
        "clusters": clusters_list,
    }


def main():
    parser = argparse.ArgumentParser(description="Graph Analytics & Community Detection for Wiki-Forge")
    parser.add_argument("--wiki", default="wiki", help="Path to wiki directory")
    parser.add_argument("--json", action="store_true", help="Output JSON result on stdout")

    args = parser.parse_args()
    res = compute_clusters(args.wiki)

    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"Graph Analytics ({res['total_nodes']} nodes, {res['total_edges']} edges, {res['cluster_count']} clusters):")
        for c in res["clusters"]:
            print(f"  Cluster {c['cluster_id']} ({c['node_count']} nodes): {', '.join([n['id'] for n in c['nodes']])}")


if __name__ == "__main__":
    main()
