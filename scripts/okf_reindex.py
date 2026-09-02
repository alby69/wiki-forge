#!/usr/bin/env python3
"""
scripts/okf_reindex.py
OKF v0.2 Index Generator for wiki-forge.

Generates:
1. Bundle-root `wiki/index.md` (with `okf_version: "0.2"` frontmatter).
2. Topic-level `wiki/<topic>/index.md` (without frontmatter, conforming to §8 OKF).
"""

import sys
import os
import re
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

def parse_metadata(file_path: Path) -> dict:
    content = file_path.read_text(encoding="utf-8")
    title = file_path.stem.replace("-", " ").replace("_", " ").title()
    description = ""
    status = "stable"

    if content.startswith("---"):
        parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
        if len(parts) >= 3 and yaml:
            try:
                fm = yaml.safe_load(parts[1])
                if isinstance(fm, dict):
                    title = fm.get("title", title)
                    description = fm.get("description", "")
                    status = fm.get("status", "stable")
            except Exception:
                pass

    # Fallback to H1 heading if title was not in frontmatter
    if not title or title == file_path.stem.title():
        h1_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        if h1_match:
            title = h1_match.group(1).strip()

    # Fallback to first non-heading paragraph for description
    if not description:
        for line in content.splitlines():
            line = line.strip()
            if line and not line.startswith("#") and not line.startswith("---") and not line.startswith("!") and not line.startswith("["):
                description = line[:120] + "..." if len(line) > 120 else line
                break

    return {
        "title": title,
        "description": description,
        "status": status,
        "filename": file_path.name,
        "path": file_path
    }

def generate_topic_index(topic_dir: Path, wiki_root: Path):
    topic_name = topic_dir.name.replace("-", " ").title()
    articles = []

    for file_path in sorted(topic_dir.glob("*.md")):
        if file_path.name.lower() in ("index.md", "log.md"):
            continue
        meta = parse_metadata(file_path)
        articles.append(meta)

    lines = [f"# {topic_name} — Topic Index\n"]

    if articles:
        lines.append("## Articles\n")
        for art in articles:
            desc_part = f" — {art['description']}" if art['description'] else ""
            status_tag = f" `[{art['status']}]`" if art['status'] != "stable" else ""
            lines.append(f"* [{art['title']}]({art['filename']}){status_tag}{desc_part}")
        lines.append("")

    index_file = topic_dir / "index.md"
    index_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Generated topic index: {index_file.relative_to(wiki_root)}")

def generate_root_index(wiki_root: Path):
    topic_dirs = [d for d in sorted(wiki_root.iterdir()) if d.is_dir() and not d.name.startswith(".")]

    all_articles = []
    for file_path in sorted(wiki_root.glob("**/*.md")):
        if file_path.name.lower() in ("index.md", "log.md"):
            continue
        meta = parse_metadata(file_path)
        rel_path = file_path.relative_to(wiki_root)
        meta["rel_path"] = str(rel_path)
        meta["mtime"] = file_path.stat().st_mtime
        all_articles.append(meta)

    # Sort recently updated
    all_articles.sort(key=lambda x: x["mtime"], reverse=True)
    recently_updated = all_articles[:5]

    lines = [
        "---",
        'okf_version: "0.2"',
        "---",
        "",
        "# Wiki Index — Knowledge Base\n",
        "## Topics\n"
    ]

    for t_dir in topic_dirs:
        t_title = t_dir.name.replace("-", " ").title()
        index_rel = f"{t_dir.name}/index.md"
        count = len(list(t_dir.glob("*.md"))) - (1 if (t_dir / "index.md").exists() else 0) - (1 if (t_dir / "log.md").exists() else 0)
        lines.append(f"* [{t_title}]({index_rel}) ({max(0, count)} articles)")

    lines.append("\n## Recently Updated\n")
    for art in recently_updated:
        desc_part = f" — {art['description']}" if art['description'] else ""
        lines.append(f"* [{art['title']}]({art['rel_path']}){desc_part}")

    lines.append("")

    root_index = wiki_root / "index.md"
    root_index.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Generated bundle-root index: {root_index.relative_to(wiki_root)}")

def main():
    wiki_dir_arg = sys.argv[1] if len(sys.argv) > 1 else "wiki"
    wiki_root = Path(wiki_dir_arg).resolve()

    if not wiki_root.exists() or not wiki_root.is_dir():
        print(f"Error: Path '{wiki_root}' does not exist.", file=sys.stderr)
        sys.exit(1)

    # Generate index for each sub-directory
    for sub_dir in sorted(wiki_root.iterdir()):
        if sub_dir.is_dir() and not sub_dir.name.startswith("."):
            generate_topic_index(sub_dir, wiki_root)

    # Generate bundle root index
    generate_root_index(wiki_root)
    print("✅ OKF §8 reindexing completed successfully.")

if __name__ == "__main__":
    main()
