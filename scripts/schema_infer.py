#!/usr/bin/env python3
"""
scripts/schema_infer.py
Scans an existing wiki and proposes a [schema] TOML block.
Output is printed to stdout (never modifies config.toml).
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from typing import Any

from ke_common import Page, iter_pages, load_config, resolve_wikilink
from okf_common import detect_project_id


def infer_schema(
    project: str | None = None,
    wiki_dir: str | None = None,
    min_field_occurrence: float = 0.5,
) -> str:
    pages = iter_pages(project, wiki_dir=wiki_dir)
    if not pages:
        return "# No pages found to infer schema from.\n[schema]\nenabled = true\nstrict = false\n"

    types_counter: Counter[str] = Counter()
    fields_by_type: dict[str, Counter[str]] = defaultdict(Counter)
    relations_by_type: dict[str, dict[str, Counter[str]]] = defaultdict(lambda: defaultdict(Counter))
    type_pages_count: Counter[str] = Counter()

    for page in pages:
        fm = page.frontmatter
        raw_type = fm.get("type", "concept")
        page_type = str(raw_type).strip().lower()
        types_counter[page_type] += 1
        type_pages_count[page_type] += 1

        for key, val in fm.items():
            key_lower = key.lower()
            if key_lower in ("type", "title", "id", "version", "generated", "verified", "sources"):
                continue

            fields_by_type[page_type][key_lower] += 1

            # Check if value contains wikilinks -> candidate relation
            is_relation = False
            if isinstance(val, str) and ("[[" in val or val.endswith(".md")):
                is_relation = True
            elif isinstance(val, list):
                if any(isinstance(x, str) and ("[[" in x or x.endswith(".md")) for x in val):
                    is_relation = True

            if is_relation:
                links = val if isinstance(val, list) else [val]
                for link in links:
                    target_page = resolve_wikilink(str(link), pages)
                    if target_page:
                        target_type = str(target_page.frontmatter.get("type", "concept")).strip().lower()
                        relations_by_type[page_type][key_lower][target_type] += 1

    lines = [
        "# Proposed [schema] inferred from existing wiki",
        "[schema]",
        "enabled = true",
        "strict  = false",
        "",
    ]

    for type_name, count in sorted(types_counter.items()):
        total = type_pages_count[type_name]
        req_fields = []
        opt_fields = []
        type_rels: dict[str, str] = {}

        for field_name, f_count in fields_by_type[type_name].items():
            ratio = f_count / total
            if field_name in relations_by_type[type_name]:
                # Find most common target type
                most_common_target, _ = relations_by_type[type_name][field_name].most_common(1)[0]
                type_rels[field_name] = most_common_target
            else:
                if ratio >= min_field_occurrence:
                    req_fields.append(field_name)
                else:
                    opt_fields.append(field_name)

        lines.append(f"[schema.types.{type_name}]")
        req_str = ", ".join(f'"{f}"' for f in sorted(req_fields))
        opt_str = ", ".join(f'"{f}"' for f in sorted(opt_fields))
        lines.append(f"required  = [{req_str}]")
        lines.append(f"optional  = [{opt_str}]")

        rel_items = [f'{r} = "{t}"' for r, t in sorted(type_rels.items())]
        rel_str = ", ".join(rel_items)
        lines.append(f"relations = {{ {rel_str} }}")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Propose a [schema] block inferred from existing wiki")
    parser.add_argument("--project", help="Project ID")
    parser.add_argument("--json", action="store_true", help="Output JSON envelope")
    parser.add_argument("--wiki-dir", help="Override wiki directory path")

    args = parser.parse_args()

    project = args.project or detect_project_id()
    toml_output = infer_schema(project=project, wiki_dir=args.wiki_dir)

    if args.json:
        import json
        print(json.dumps({
            "tool": "schema_infer",
            "project": project or "default",
            "ok": True,
            "proposed_schema_toml": toml_output
        }, indent=2))
    else:
        print(toml_output)


if __name__ == "__main__":
    main()
