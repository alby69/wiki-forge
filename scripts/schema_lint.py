#!/usr/bin/env python3
"""
scripts/schema_lint.py
Validates wiki pages against the schema defined in config.toml [schema].
"""

from __future__ import annotations

import argparse
import fnmatch
import sys
from pathlib import Path
from typing import Any

from ke_common import (
    Page,
    Schema,
    clean_wikilink,
    emit,
    iter_pages,
    load_config,
    load_schema,
    resolve_wikilink,
)
from okf_common import detect_project_id


def extract_wikilinks_from_value(val: Any) -> list[str]:
    links = []
    if isinstance(val, str):
        if "[[" in val or val.strip():
            links.append(val)
    elif isinstance(val, list):
        for item in val:
            if isinstance(item, str):
                links.append(item)
    return links


def detect_cycles(
    relation_name: str,
    pages: list[Page],
    schema: Schema,
) -> list[dict[str, Any]]:
    findings = []
    # Build graph: page_id -> set of target_page_ids
    graph: dict[str, set[str]] = {p.id.lower(): set() for p in pages}
    page_by_id = {p.id.lower(): p for p in pages}

    for page in pages:
        p_id = page.id.lower()
        rel_val = page.frontmatter.get(relation_name)
        if not rel_val:
            continue
        links = extract_wikilinks_from_value(rel_val)
        for link in links:
            target_page = resolve_wikilink(link, pages)
            if target_page:
                graph[p_id].add(target_page.id.lower())

    # Cycle detection using DFS
    visited: set[str] = set()
    rec_stack: list[str] = []
    reported_cycles: set[tuple[str, ...]] = set()

    def dfs(node: str):
        visited.add(node)
        rec_stack.append(node)

        for neighbor in sorted(graph.get(node, [])):
            if neighbor in rec_stack:
                # Cycle found! Extract cycle path
                idx = rec_stack.index(neighbor)
                cycle_nodes = rec_stack[idx:] + [neighbor]
                # Normalize cycle to avoid duplicate reporting
                min_idx = cycle_nodes[:-1].index(min(cycle_nodes[:-1]))
                norm_cycle = tuple(cycle_nodes[:-1][min_idx:] + cycle_nodes[:-1][:min_idx])

                if norm_cycle not in reported_cycles:
                    reported_cycles.add(norm_cycle)
                    cycle_str = " -> ".join([page_by_id[n].id for n in cycle_nodes])
                    start_page = page_by_id[rec_stack[idx]]
                    findings.append({
                        "id": "SCH-005",
                        "page": start_page.rel_path,
                        "message": f"Cycle detected in acyclic relation '{relation_name}': {cycle_str}",
                        "hint": f"Break the circular dependency in relation '{relation_name}'",
                    })
            elif neighbor not in visited:
                dfs(neighbor)

        rec_stack.pop()

    for node in sorted(graph.keys()):
        if node not in visited:
            dfs(node)

    return findings


def lint_schema(
    project: str | None = None,
    strict_override: bool = False,
    path_pattern: str | None = None,
    wiki_dir: str | None = None,
    config_path: str | Path | None = None,
) -> dict[str, Any]:
    cfg = load_config(project, config_path=config_path)
    schema = load_schema(cfg)

    is_strict = schema.strict or strict_override
    severity = "error" if is_strict else "warning"

    if not schema.enabled:
        return {
            "tool": "schema_lint",
            "project": project or "default",
            "ok": True,
            "summary": {"status": "disabled", "message": "schema disabled"},
            "findings": [],
        }

    pages = iter_pages(project, wiki_dir=wiki_dir)
    if path_pattern:
        pages = [
            p for p in pages if fnmatch.fnmatch(p.rel_path, path_pattern) or fnmatch.fnmatch(p.id, path_pattern)
        ]

    findings: list[dict[str, Any]] = []

    # Map of global relations (from [schema.relations] and all [schema.types.*.relations])
    global_relations = set(schema.relations.keys())
    for t_schema in schema.types.values():
        global_relations.update(t_schema.relations.keys())

    for page in pages:
        fm = page.frontmatter
        raw_type = fm.get("type")
        page_type = str(raw_type).strip().lower() if raw_type else None

        # Check SCH-006: Unknown page type when strict = true
        if is_strict:
            if not page_type or page_type not in schema.types:
                findings.append({
                    "id": "SCH-006",
                    "severity": severity,
                    "page": page.rel_path,
                    "message": f"Unknown page type '{raw_type}' in strict mode",
                    "hint": f"Define type '{raw_type}' in [schema.types] in config.toml or use a known type",
                })

        type_schema = schema.types.get(page_type) if page_type else None

        if type_schema:
            # Check SCH-001: Missing required field
            for req_field in type_schema.required:
                val = fm.get(req_field)
                if val is None or (isinstance(val, str) and not val.strip()) or (isinstance(val, (list, dict)) and len(val) == 0):
                    findings.append({
                        "id": "SCH-001",
                        "severity": severity,
                        "page": page.rel_path,
                        "message": f"Missing required field '{req_field}' for type '{raw_type}'",
                        "hint": f"Add field '{req_field}' to page frontmatter",
                    })

            # Check SCH-002: Unknown relation name for the page type
            declared_relations = set(type_schema.relations.keys())
            for key, val in fm.items():
                key_lower = key.lower()
                if key_lower in global_relations and key_lower not in declared_relations:
                    findings.append({
                        "id": "SCH-002",
                        "severity": severity,
                        "page": page.rel_path,
                        "message": f"Unknown relation name '{key}' for page type '{raw_type}'",
                        "hint": f"Declare relation '{key}' in [schema.types.{raw_type}.relations] or remove it",
                    })

            # Check SCH-003 & SCH-004: Target exists & Target type check for declared relations
            for rel_name, expected_target_type in type_schema.relations.items():
                rel_val = fm.get(rel_name)
                if not rel_val:
                    continue
                links = extract_wikilinks_from_value(rel_val)
                for link in links:
                    target_page = resolve_wikilink(link, pages)
                    if not target_page:
                        # SCH-003
                        findings.append({
                            "id": "SCH-003",
                            "severity": severity,
                            "page": page.rel_path,
                            "message": f"Relation '{rel_name}' points to non-existent target '{link}'",
                            "hint": f"Create target page or correct wikilink '{link}'",
                        })
                    else:
                        # SCH-004: Domain / range check
                        target_type = str(target_page.frontmatter.get("type", "")).strip().lower()
                        if expected_target_type and target_type != expected_target_type.lower():
                            findings.append({
                                "id": "SCH-004",
                                "severity": severity,
                                "page": page.rel_path,
                                "message": f"Relation '{rel_name}' target '{target_page.id}' has type '{target_page.frontmatter.get('type')}', expected '{expected_target_type}'",
                                "hint": f"Expected target type '{expected_target_type}' but found '{target_page.frontmatter.get('type')}'",
                            })

    # Check SCH-005: Cycles in acyclic relations
    for rel_name, rel_schema in schema.relations.items():
        if rel_schema.acyclic:
            cycle_findings = detect_cycles(rel_name, pages, schema)
            for f in cycle_findings:
                f["severity"] = severity
                findings.append(f)

    # Sort findings by SCH code and page
    findings.sort(key=lambda x: (x["id"], x["page"]))

    errors_count = sum(1 for f in findings if f["severity"] == "error")
    warnings_count = sum(1 for f in findings if f["severity"] == "warning")
    ok = (errors_count == 0)

    return {
        "tool": "schema_lint",
        "project": project or "default",
        "ok": ok,
        "summary": {
            "errors": errors_count,
            "warnings": warnings_count,
            "pages_checked": len(pages),
        },
        "findings": findings,
    }


def main():
    parser = argparse.ArgumentParser(description="Validate wiki pages against schema in config.toml [schema]")
    parser.add_argument("--project", help="Project ID")
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")
    parser.add_argument("--strict", action="store_true", help="Treat violations as errors")
    parser.add_argument("--path", help="Filter pages by path pattern")
    parser.add_argument("--wiki-dir", help="Override wiki directory path")
    parser.add_argument("--config", help="Override config.toml path")

    args = parser.parse_args()

    result = lint_schema(
        project=args.project or detect_project_id(),
        strict_override=args.strict,
        path_pattern=args.path,
        wiki_dir=args.wiki_dir,
        config_path=args.config,
    )

    emit(result, as_json=args.json, exit_on_error=True)


if __name__ == "__main__":
    main()
