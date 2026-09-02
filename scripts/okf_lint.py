#!/usr/bin/env python3
"""
scripts/okf_lint.py
OKF v0.2 Bundle Linter and Validator for wiki-forge.

Validates:
1. Non-reserved Markdown files have valid YAML frontmatter with a non-empty `type`.
2. Timestamps in `generated.at`, `verified[].at`, and `stale_after` follow ISO 8601.
3. Field `status` is one of ['draft', 'stable', 'deprecated'].
4. `sources[].resource` is present and non-empty for source entries.
5. Reserved `index.md` has no frontmatter (except optional `okf_version: "0.2"` at bundle root).
6. Reserved `log.md` follows OKF §9 format with ISO date headings (## YYYY-MM-DD).
7. Actor convention check for `generated.by`, `verified[].by`, and `sources[].author`.
"""

import sys
import re
import os
from pathlib import Path
from datetime import datetime

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required. Install via `pip install pyyaml`", file=sys.stderr)
    sys.exit(1)

ISO_TIMESTAMP_REGEX = re.compile(
    r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$"
)
ACTOR_REGEX = re.compile(
    r"^(human:[a-zA-Z0-9_\-]+|process:[a-zA-Z0-9_\-]+|[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-\.]+)$"
)

def is_iso_timestamp(val: str) -> bool:
    if not isinstance(val, str):
        return False
    return bool(ISO_TIMESTAMP_REGEX.match(val.strip()))

def is_valid_actor(val: str) -> bool:
    if not isinstance(val, str):
        return False
    return bool(ACTOR_REGEX.match(val.strip()))

def parse_frontmatter(content: str):
    if not content.startswith("---"):
        return None, content
    parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
    if len(parts) >= 3:
        try:
            fm = yaml.safe_load(parts[1])
            body = parts[2]
            return (fm if isinstance(fm, dict) else {}), body
        except Exception as e:
            return e, content
    return None, content

def lint_file(file_path: Path, wiki_root: Path) -> list[str]:
    errors = []
    rel_path = file_path.relative_to(wiki_root)
    file_name = file_path.name.lower()
    content = file_path.read_text(encoding="utf-8")

    # Check Reserved File: index.md
    if file_name == "index.md":
        fm, _ = parse_frontmatter(content)
        if isinstance(fm, Exception):
            errors.append(f"{rel_path}: Invalid YAML in index.md frontmatter: {fm}")
        elif fm is not None:
            # Only bundle-root index.md may have frontmatter with okf_version
            if rel_path != Path("index.md"):
                errors.append(f"{rel_path}: Topic index.md MUST NOT contain YAML frontmatter (§8 OKF).")
            else:
                allowed_keys = {"okf_version"}
                extra_keys = set(fm.keys()) - allowed_keys
                if extra_keys:
                    errors.append(f"{rel_path}: Bundle-root index.md frontmatter contains unexpected keys: {extra_keys}. Only 'okf_version' is allowed.")
        return errors

    # Check Reserved File: log.md
    if file_name == "log.md":
        # log.md should have ISO date headings ## YYYY-MM-DD
        headings = re.findall(r"^##\s+(\d{4}-\d{2}-\d{2})", content, re.MULTILINE)
        if not headings:
            errors.append(f"{rel_path}: log.md does not contain any ISO date heading (## YYYY-MM-DD) (§9 OKF).")
        return errors

    # Regular Concept file
    fm, body = parse_frontmatter(content)

    if isinstance(fm, Exception):
        errors.append(f"{rel_path}: YAML Frontmatter parsing error: {fm}")
        return errors

    if fm is None:
        errors.append(f"{rel_path}: Missing YAML frontmatter enclosed in '---'. Every non-reserved OKF file must have frontmatter.")
        return errors

    # Rule 1: REQUIRED `type` field
    concept_type = fm.get("type")
    if not concept_type or not str(concept_type).strip():
        errors.append(f"{rel_path}: Missing or empty REQUIRED 'type' field in frontmatter.")

    # Rule 2: `status` field check
    status = fm.get("status", "stable")
    if status not in ("draft", "stable", "deprecated"):
        errors.append(f"{rel_path}: Invalid 'status': '{status}'. Must be one of ['draft', 'stable', 'deprecated'].")

    # Rule 3: Timestamps check
    stale_after = fm.get("stale_after")
    if stale_after and not is_iso_timestamp(str(stale_after)):
        errors.append(f"{rel_path}: 'stale_after' timestamp '{stale_after}' is not valid ISO 8601.")

    generated = fm.get("generated")
    if generated:
        if isinstance(generated, dict):
            gen_by = generated.get("by")
            gen_at = generated.get("at")
            if gen_by and not is_valid_actor(str(gen_by)):
                errors.append(f"{rel_path}: 'generated.by' actor '{gen_by}' does not conform to actor conventions (<producer>/<version>, human:<id>, or process:<id>).")
            if gen_at and not is_iso_timestamp(str(gen_at)):
                errors.append(f"{rel_path}: 'generated.at' timestamp '{gen_at}' is not valid ISO 8601.")
        else:
            errors.append(f"{rel_path}: 'generated' field must be a dictionary with 'by' and 'at'.")

    verified = fm.get("verified")
    if verified:
        if isinstance(verified, list):
            for idx, v_item in enumerate(verified):
                if isinstance(v_item, dict):
                    v_by = v_item.get("by")
                    v_at = v_item.get("at")
                    if v_by and not is_valid_actor(str(v_by)):
                        errors.append(f"{rel_path}: verified[{idx}].by actor '{v_by}' does not conform to actor conventions.")
                    if v_at and not is_iso_timestamp(str(v_at)):
                        errors.append(f"{rel_path}: verified[{idx}].at timestamp '{v_at}' is not valid ISO 8601.")
                else:
                    errors.append(f"{rel_path}: verified[{idx}] entry must be a dictionary.")

    # Rule 4: Sources structure check
    sources = fm.get("sources")
    if sources:
        if isinstance(sources, list):
            for idx, src in enumerate(sources):
                if isinstance(src, dict):
                    if not src.get("resource"):
                        errors.append(f"{rel_path}: sources[{idx}] is missing REQUIRED 'resource' field.")
                    src_author = src.get("author")
                    if src_author and not is_valid_actor(str(src_author)):
                        errors.append(f"{rel_path}: sources[{idx}].author actor '{src_author}' does not conform to actor conventions.")
                else:
                    errors.append(f"{rel_path}: sources[{idx}] entry must be a dictionary.")

    return errors

def main():
    wiki_dir_arg = sys.argv[1] if len(sys.argv) > 1 else "wiki"
    wiki_root = Path(wiki_dir_arg).resolve()

    if not wiki_root.exists() or not wiki_root.is_dir():
        print(f"Error: Path '{wiki_root}' does not exist or is not a directory.", file=sys.stderr)
        sys.exit(1)

    all_errors = []
    file_count = 0

    for file_path in sorted(wiki_root.glob("**/*.md")):
        file_count += 1
        file_errors = lint_file(file_path, wiki_root)
        all_errors.extend(file_errors)

    if all_errors:
        print(f"❌ OKF Linter found {len(all_errors)} errors across {file_count} files:\n", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"✅ OKF v0.2 Linter Passed! Checked {file_count} Markdown files in '{wiki_dir_arg}'.")
        sys.exit(0)

if __name__ == "__main__":
    main()
