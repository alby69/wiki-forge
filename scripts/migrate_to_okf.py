#!/usr/bin/env python3
"""
scripts/migrate_to_okf.py
One-shot Migration Script for converting existing wiki-forge Markdown files
to OKF v0.2 compliant frontmatter and bundle structure.
"""

import sys
import os
import re
from pathlib import Path
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    print("Error: PyYAML required. Run `pip install pyyaml`", file=sys.stderr)
    sys.exit(1)

def load_config(repo_root: Path) -> dict:
    config_path = repo_root / "config.toml"
    folder_type_map = {
        "intelligenza-artificiale": "Concept",
        "antropologia-economica": "Concept",
        "papers": "Paper",
        "tools": "Tool",
        "processes": "Process",
        "playbooks": "Playbook"
    }
    default_type = "Concept"

    if config_path.exists():
        try:
            import tomllib
            data = tomllib.loads(config_path.read_text(encoding="utf-8"))
            okf_cfg = data.get("okf", {}).get("migration", {})
            for item in okf_cfg.get("folder_type_map", []):
                if "folder" in item and "type" in item:
                    folder_type_map[item["folder"]] = item["type"]
            default_type = okf_cfg.get("default_type", default_type)
        except Exception:
            pass
    return {"folder_type_map": folder_type_map, "default_type": default_type}

def parse_frontmatter(content: str):
    if not content.startswith("---"):
        return {}, content
    parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
    if len(parts) >= 3:
        try:
            fm = yaml.safe_load(parts[1])
            body = parts[2]
            return (fm if isinstance(fm, dict) else {}), body
        except Exception:
            pass
    return {}, content

def migrate_file(file_path: Path, wiki_root: Path, cfg: dict, now_iso: str) -> bool:
    content = file_path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(content)

    parent_folder = file_path.parent.name
    folder_map = cfg["folder_type_map"]
    default_type = cfg["default_type"]

    # 1. Determine type
    if not fm.get("type"):
        fm["type"] = folder_map.get(parent_folder, default_type)

    # 2. Determine title
    if not fm.get("title"):
        h1_match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        if h1_match:
            fm["title"] = h1_match.group(1).strip()
        else:
            fm["title"] = file_path.stem.replace("-", " ").replace("_", " ").title()

    # 3. Determine description
    if not fm.get("description"):
        desc = ""
        for line in body.splitlines():
            line = line.strip()
            if line and not line.startswith("#") and not line.startswith("---") and not line.startswith("!") and not line.startswith("["):
                desc = line[:140] + "..." if len(line) > 140 else line
                break
        fm["description"] = desc or f"Overview of {fm['title']}"

    # 4. Status
    if not fm.get("status"):
        fm["status"] = "stable"

    # 5. Generated metadata
    if not fm.get("generated"):
        fm["generated"] = {
            "by": "process:migrate-script",
            "at": now_iso
        }

    # 6. Verified metadata
    if "verified" not in fm or not isinstance(fm["verified"], list):
        fm["verified"] = []

    # 7. Standardize sources (support both `sources` and legacy `fonti` field)
    raw_sources = fm.get("sources") or fm.pop("fonti", [])
    if isinstance(raw_sources, str):
        raw_sources = [raw_sources]
    standard_sources = []
    if isinstance(raw_sources, list):
        for idx, src in enumerate(raw_sources):
            if isinstance(src, str):
                src_id = f"src-{idx+1}"
                standard_sources.append({
                    "id": src_id,
                    "resource": src,
                    "title": Path(src).stem.replace("_COMPILED", "").replace("-", " ").title(),
                    "author": "process:conv2md",
                    "last_modified": now_iso
                })
            elif isinstance(src, dict):
                src_dict = {
                    "id": src.get("id", f"src-{idx+1}"),
                    "resource": src.get("resource", "raw/source.md"),
                    "title": src.get("title", "Source Document"),
                    "author": src.get("author", "process:conv2md"),
                    "last_modified": src.get("last_modified", now_iso)
                }
                standard_sources.append(src_dict)
    fm["sources"] = standard_sources

    # Write back updated Markdown file
    yaml_dump = yaml.dump(fm, sort_keys=False, allow_unicode=True).strip()
    new_content = f"---\n{yaml_dump}\n---\n{body.lstrip()}"

    file_path.write_text(new_content, encoding="utf-8")
    return True

def resolve_default_wiki(repo_root: Path) -> Path:
    """Auto-detect the wiki to migrate.

    Resolution order:
      1. WIKI_FORGE_WIKI_DIR env var (absolute or repo-relative)
      2. <cwd>/wiki  (the runner spawns scripts with cwd = project root)
      3. first existing projects/<id>/wiki (multi-project layout)
      4. legacy repo-root wiki/ folder
    """
    env = os.environ.get("WIKI_FORGE_WIKI_DIR")
    if env:
        return Path(env).expanduser().resolve()

    cwd_wiki = Path.cwd() / "wiki"
    if cwd_wiki.is_dir():
        return cwd_wiki.resolve()

    for candidate in sorted((repo_root / "projects").glob("*/wiki")):
        if candidate.is_dir():
            return candidate.resolve()

    return (repo_root / "wiki").resolve()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="One-shot Migration Script to OKF v0.2 compliant frontmatter")
    parser.add_argument("--wiki-dir", help="Wiki directory to migrate (default: auto-detected project wiki)")
    parser.add_argument("--file", action="append", default=[], help="Only migrate this file (relative to --wiki-dir); repeatable. Skips log/index/reindex.")
    parser.add_argument("--confirm", action="store_true", help="Confirm migration execution")
    parser.add_argument("--json", action="store_true", help="Output result as JSON object on stdout.")

    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    wiki_root = Path(args.wiki_dir).resolve() if args.wiki_dir else resolve_default_wiki(repo_root)

    if not wiki_root.exists():
        msg = f"Error: wiki directory does not exist at '{wiki_root}'"
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    cfg = load_config(repo_root)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    migrated_count = 0

    # Targeted migration: only the listed files, no log/index/reindex updates.
    if args.file:
        missing = [rel for rel in args.file if not (wiki_root / rel).resolve().is_file()]
        if missing:
            msg = f"Error: file(s) not found under '{wiki_root}': {', '.join(missing)}"
            if args.json:
                import json
                print(json.dumps({"status": "error", "message": msg}))
            else:
                print(msg, file=sys.stderr)
            sys.exit(1)
        for rel in args.file:
            migrate_file((wiki_root / rel).resolve(), wiki_root, cfg, now_iso)
            migrated_count += 1
        if args.json:
            import json
            print(json.dumps({"status": "success", "migrated_count": migrated_count, "files": args.file}))
        else:
            print(f"✅ Successfully migrated {migrated_count} Markdown article(s) to OKF v0.2 standard!")
        return

    for file_path in sorted(wiki_root.glob("**/*.md")):
        if file_path.name.lower() in ("index.md", "log.md"):
            continue
        migrate_file(file_path, wiki_root, cfg, now_iso)
        migrated_count += 1

    # Ensure log.md exists
    log_path = wiki_root / "log.md"
    if not log_path.exists():
        log_content = f"# Wiki Update Log\n\n## {now_iso[:10]}\n* **Initialization**: Migrated wiki structure to OKF v0.2 compliant bundle.\n"
        log_path.write_text(log_content, encoding="utf-8")
        print("Created wiki/log.md with initial migration log.")

    # Reindex
    import okf_reindex
    okf_reindex.generate_root_index(wiki_root)
    for sub_dir in wiki_root.iterdir():
        if sub_dir.is_dir() and not sub_dir.name.startswith("."):
            okf_reindex.generate_topic_index(sub_dir, wiki_root)

    if args.json:
        import json
        print(json.dumps({
            "status": "success",
            "migrated_count": migrated_count,
            "wiki_dir": str(wiki_root)
        }))
    else:
        print(f"✅ Successfully migrated {migrated_count} Markdown articles to OKF v0.2 standard!")

if __name__ == "__main__":
    main()
