"""
src/wikiforge/semantics/markdown_parser.py

Markdown Zettelkasten parser for Wiki-Forge Semantic Knowledge Graphs.
Extracts frontmatter metadata, body text, line offsets, and typed semantic wikilinks.
Generates persistent 303/hash W3ID URIs for entities, classes, and properties.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, List, Optional
from pydantic import BaseModel, Field

try:
    import yaml
except ImportError:
    yaml = None

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None


DEFAULT_BASE_IRI = "https://w3id.org/wikiforge/"


class SemanticLink(BaseModel):
    predicate: str = "refersTo"
    target_id: str
    label: Optional[str] = None
    line_number: int = 1
    raw_match: str = ""
    line_anchor: Optional[str] = None


class ParsedNote(BaseModel):
    note_id: str
    file_path: Optional[str] = None
    title: str
    note_type: str = "Article"
    frontmatter: dict[str, Any] = Field(default_factory=dict)
    body: str = ""
    links: List[SemanticLink] = Field(default_factory=list)
    aliases: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    status: str = "draft"
    author: str = "unknown"
    entity_uri: str = ""


def mint_uri(identifier: str, uri_type: str = "id", base_iri: str = DEFAULT_BASE_IRI) -> str:
    """
    Generates persistent W3ID 303/hash URIs for knowledge graph elements.
    uri_type: 'id' (entity), 'ontology' (property/predicate), or 'class' (concept/type)
    """
    base = base_iri.rstrip("/") + "/"
    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", identifier.strip()).strip("_")
    if not clean_id:
        clean_id = "resource"

    if uri_type == "ontology" or uri_type == "property":
        # camelCase predicate name clean
        pred_clean = re.sub(r"[^a-zA-Z0-9]", "", identifier) or "refersTo"
        return f"{base}ontology/{pred_clean}"
    elif uri_type == "class":
        class_clean = clean_id.capitalize()
        return f"{base}class/{class_clean}"
    else:
        return f"{base}id/{clean_id}"


def parse_markdown_content(
    content: str,
    file_path: Optional[str | Path] = None,
    note_id: Optional[str] = None,
    base_iri: str = DEFAULT_BASE_IRI,
) -> ParsedNote:
    """
    Parses Markdown content into a ParsedNote structure.
    Extracts YAML/TOML frontmatter, typed wikilinks [[predicate::target|label]],
    aliases, and computes line numbers for provenance.
    """
    path_obj = Path(file_path) if file_path else None
    if not note_id:
        if path_obj:
            note_id = path_obj.stem
            if note_id == "index" and path_obj.parent.name and path_obj.parent.name != "wiki":
                note_id = f"{path_obj.parent.name}-index"
        else:
            note_id = "untitled"

    frontmatter: dict[str, Any] = {}
    body = content

    # YAML Frontmatter parsing
    if content.startswith("---"):
        parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
        if len(parts) >= 3:
            fm_raw = parts[1]
            body = parts[2]
            if yaml:
                try:
                    fm_parsed = yaml.safe_load(fm_raw)
                    if isinstance(fm_parsed, dict):
                        frontmatter = fm_parsed
                except Exception:
                    pass

    # Extract title, type, tags, aliases, status, author
    title = frontmatter.get("title") or frontmatter.get("prefLabel")
    if not title:
        # Fallback to H1 header if present
        h1_match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        title = h1_match.group(1).strip() if h1_match else note_id.replace("-", " ").title()

    note_type = str(frontmatter.get("type") or "Article")
    status = str(frontmatter.get("status") or "draft")
    author = str(frontmatter.get("author") or "unknown")

    tags = frontmatter.get("tags") or frontmatter.get("keywords") or []
    if isinstance(tags, str):
        tags = [tags]

    aliases = frontmatter.get("aliases") or frontmatter.get("altLabel") or []
    if isinstance(aliases, str):
        aliases = [aliases]

    links: List[SemanticLink] = []
    lines = body.splitlines()

    # Pattern for [[predicate::target|label]] or [[target|label]] or [[target]]
    # Match [[ ... ]]
    wikilink_pattern = re.compile(r"\[\[([^\]]+)\]\]")

    for line_idx, line in enumerate(lines, start=1):
        for match in wikilink_pattern.finditer(line):
            raw_inner = match.group(1).strip()
            # Check for line anchor #L...
            line_anchor = None
            if "#" in raw_inner:
                raw_inner, line_anchor = raw_inner.split("#", 1)

            # Check for display label
            display_label = None
            if "|" in raw_inner:
                raw_inner, display_label = raw_inner.split("|", 1)
                display_label = display_label.strip()

            # Check for typed predicate::target
            predicate = "refersTo"
            target_id = raw_inner.strip()
            if "::" in raw_inner:
                pred_part, target_part = raw_inner.split("::", 1)
                predicate = pred_part.strip() or "refersTo"
                target_id = target_part.strip()

            if target_id:
                # Clean target_id stem
                clean_target = Path(target_id).stem if target_id.endswith(".md") else target_id
                links.append(
                    SemanticLink(
                        predicate=predicate,
                        target_id=clean_target,
                        label=display_label,
                        line_number=line_idx,
                        raw_match=match.group(0),
                        line_anchor=line_anchor,
                    )
                )

    entity_uri = mint_uri(note_id, "id", base_iri)

    return ParsedNote(
        note_id=note_id,
        file_path=str(file_path) if file_path else None,
        title=str(title),
        note_type=note_type,
        frontmatter=frontmatter,
        body=body,
        links=links,
        aliases=[str(a) for a in aliases],
        tags=[str(t) for t in tags],
        status=status,
        author=author,
        entity_uri=entity_uri,
    )


def parse_markdown_file(file_path: str | Path, base_iri: str = DEFAULT_BASE_IRI) -> ParsedNote:
    path = Path(file_path)
    content = path.read_text(encoding="utf-8", errors="ignore")
    return parse_markdown_content(content, file_path=path, base_iri=base_iri)
