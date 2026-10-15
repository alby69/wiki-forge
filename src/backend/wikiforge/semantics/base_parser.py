"""
base_parser.py — Base class for Knowledge Graph Exporters in Wiki-Forge.

WHAT THIS DOES
--------------
Provides common parsing functionality for Markdown Zettelkasten notes,
extracting YAML frontmatter, headings, OKF metadata, tags, and semantic
wikilinks (`[[predicate::target | {meta}]]`).

Subclasses should inherit from `BaseGraphExporter` and implement `export_notes()`.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any
import yaml


def slugify(text: str) -> str:
    """Generate a clean slug for RDF IRIs or Neo4j node identifiers."""
    if not text:
        return "note"
    text = text.lower().strip()
    text = text.replace('_', '-').replace('/', '-').replace('\\', '-')
    text = re.sub(r'[^\w\s-]', '', text)
    res = re.sub(r'[\s_-]+', '-', text).strip('-')
    return res or "note"


class BaseGraphExporter:
    """Base exporter class providing standardized Markdown and OKF parsing."""

    def parse_markdown_file(self, filepath: Path, input_dir: Path = Path(".")) -> dict[str, Any]:
        """Extract YAML frontmatter, title, tags, author, and semantic wikilinks."""
        content = filepath.read_text(encoding="utf-8")
        metadata: dict[str, Any] = {}
        body = content

        frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)
        if frontmatter_match:
            yaml_text, body = frontmatter_match.groups()
            try:
                metadata = yaml.safe_load(yaml_text) or {}
            except yaml.YAMLError as e:
                print(f"⚠️ YAML parse error in {filepath.name}: {e}")

        try:
            rel_path = filepath.relative_to(input_dir)
        except ValueError:
            rel_path = filepath

        if metadata.get("id") or metadata.get("identifier"):
            raw_id = metadata.get("id") or metadata.get("identifier")
            note_slug = slugify(str(raw_id))
        elif rel_path.parent != Path("."):
            note_slug = slugify(f"{rel_path.parent.as_posix()}-{rel_path.stem}")
        else:
            note_slug = slugify(filepath.stem)

        title = metadata.get("title")
        if not title:
            h1_match = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
            title = h1_match.group(1).strip() if h1_match else filepath.stem

        created_date = metadata.get("created") or metadata.get("date") or "2026-01-01"
        author = metadata.get("author") or "Anonymus"
        tags = metadata.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",")]

        semantic_links = []
        wikilink_pattern = re.compile(r'\[\[(?:([^\]:]+)::)?([^\]\s|]+)(?:\s*\|?\s*(\{.*\}))?\]\]')

        for match in wikilink_pattern.finditer(body):
            pred, target, edge_meta_str = match.groups()
            target_str = target.strip()
            target_p = Path(target_str)

            if target_p.parent != Path("."):
                target_slug = slugify(f"{target_p.parent.as_posix()}-{target_p.stem}")
            else:
                target_slug = slugify(target_p.stem)

            predicate_name = pred.strip() if pred else "refersTo"

            edge_meta: dict[str, Any] = {}
            if edge_meta_str:
                try:
                    edge_meta = yaml.safe_load(edge_meta_str) or {}
                except Exception:
                    pass

            confidence = edge_meta.get("confidence", metadata.get("confidence", 0.95))
            created = edge_meta.get("created", created_date)

            semantic_links.append({
                "predicate": predicate_name,
                "target_slug": target_slug,
                "target_raw": target_str,
                "confidence": confidence,
                "created": created,
            })

        return {
            "file_path": str(filepath),
            "id": note_slug,
            "slug": note_slug,
            "title": title,
            "created": str(created_date),
            "author": author,
            "tags": tags,
            "body": body,
            "links": semantic_links,
            "metadata": metadata,
        }

    def parse_directory(self, input_dir: Path) -> list[dict[str, Any]]:
        """Parse all Markdown files in input_dir and return list of note dicts."""
        notes = []
        md_files = list(input_dir.glob("**/*.md"))
        for md_file in md_files:
            note_data = self.parse_markdown_file(md_file, input_dir=input_dir)
            notes.append(note_data)
        return notes
