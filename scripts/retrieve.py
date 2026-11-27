#!/usr/bin/env python3
"""CLI adapter for the dependency-free hybrid retriever.

The Node backend talks to this script over stdin/stdout JSON; the evaluation
runner imports the same Python module directly. No new Python dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.backend.wikiforge.core.exceptions import RetrievalError  # noqa: E402
from src.backend.wikiforge.retrieval.retriever import (  # noqa: E402
    NoteDocument,
    build_hybrid_retriever,
)

_TITLE_RE = re.compile(r"^title:\s*[\"']?([^\"'\n]+)", re.MULTILINE)
_TAGS_RE = re.compile(r"^tags:\s*\[([^\]]*)\]", re.MULTILINE)
_WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")


def notes_from_wiki(wiki_dir: Path) -> list[NoteDocument]:
    if not wiki_dir.is_dir():
        raise RetrievalError(f"wiki directory not found: {wiki_dir}")
    notes: list[NoteDocument] = []
    for path in sorted(wiki_dir.rglob("*.md")):
        if path.name in ("index.md", "log.md") or "versions" in path.parts:
            continue
        content = path.read_text(encoding="utf-8")
        title_match = _TITLE_RE.search(content)
        tags_match = _TAGS_RE.search(content)
        tags = tuple(tag.strip() for tag in tags_match.group(1).split(",") if tag.strip()) if tags_match else ()
        notes.append(
            NoteDocument(
                id=path.stem.lower(),
                title=title_match.group(1).strip() if title_match else path.stem.replace("-", " "),
                content=content,
                path=str(path),
                tags=tags,
                links=tuple(link.strip() for link in _WIKILINK_RE.findall(content)),
            )
        )
    return notes


def notes_from_payload(payload: str) -> list[NoteDocument]:
    if not payload.strip():
        return []
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise RetrievalError(f"invalid retrieval payload: {exc}") from exc
    if isinstance(data, dict):
        raw_notes = data.get("notes", [])
    else:
        raw_notes = data
    if not isinstance(raw_notes, list):
        raise RetrievalError("retrieval payload must contain a notes list")
    return [NoteDocument.from_mapping(item) for item in raw_notes]


def _read_payload(args: argparse.Namespace) -> str:
    if args.notes_json:
        return Path(args.notes_json).read_text(encoding="utf-8")
    if args.wiki:
        return ""
    return sys.stdin.read()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(Path.cwd()), help="Repository root containing config/ and .wiki-forge/")
    parser.add_argument("--scope", default="default", help="Project id used to scope the persisted index")
    parser.add_argument("--config", default=None, help="Optional config.toml override")
    sub = parser.add_subparsers(dest="command", required=True)

    sync = sub.add_parser("sync", help="Rebuild the index from notes")
    sync.add_argument("--notes-json", default=None)
    sync.add_argument("--wiki", default=None)

    update = sub.add_parser("update", help="Incrementally upsert/remove notes")
    update.add_argument("--notes-json", default=None)
    update.add_argument("--wiki", default=None)
    update.add_argument("--delete-ids", nargs="*", default=[])

    query = sub.add_parser("query", help="Upsert notes then run hybrid retrieval")
    query.add_argument("--query", required=True)
    query.add_argument("--notes-json", default=None)
    query.add_argument("--wiki", default=None)
    query.add_argument("--limit", type=int, default=5)
    query.add_argument("--hops", type=int, default=1)
    query.add_argument("--query-vector", default=None, help="JSON array embedding (only used when enabled)")
    return parser


def run(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(args.root).resolve()
    config_path = Path(args.config).resolve() if args.config else None
    retriever = build_hybrid_retriever(root, args.scope, config_path=config_path)
    notes = notes_from_wiki(Path(args.wiki)) if args.wiki else notes_from_payload(_read_payload(args))

    if args.command == "sync":
        changed = retriever.sync(notes)
        retriever.save()
        return {"status": "success", "command": "sync", "changed": changed, "documents": len(retriever.index.docs)}
    if args.command == "update":
        changed = retriever.sync(notes, remove_missing=False)
        for note_id in args.delete_ids:
            changed += int(retriever.remove(note_id))
        retriever.save()
        return {"status": "success", "command": "update", "changed": changed, "documents": len(retriever.index.docs)}

    retriever.sync(notes, remove_missing=False)
    retriever.save()
    vector: list[float] | None = None
    if args.query_vector:
        try:
            vector = [float(value) for value in json.loads(args.query_vector)]
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            raise RetrievalError(f"invalid --query-vector: {exc}") from exc
    hits = retriever.retrieve(args.query, limit=args.limit, query_vector=vector)
    return {
        "status": "success",
        "command": "query",
        "engine": "hybrid",
        "scope": args.scope,
        "embeddings_enabled": retriever.embeddings.enabled,
        "results": [hit.to_dict() for hit in hits],
    }


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        payload = run(args)
    except (RetrievalError, OSError, ValueError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
