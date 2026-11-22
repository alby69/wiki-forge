"""C5 — Neo4j → vault reconciliation as reviewable Markdown patches.

The reconciler only **reads** the graph through the C3 read-only service and
emits JSON proposals. It never writes a vault file: the Node bridge stages the
patches in `ChangesetStore` with `process:neo4j-reconciler` provenance (B5) and
a human must still call `changesets.apply`.

Conflict rule: C2 stores the last known vault hash in ``wf:baseHash``. A DB edit
changes ``content``/``wf:contentHash``/``wf:revision`` but leaves `wf:baseHash`
untouched, so a local file whose hash differs from the base is reported and
skipped instead of overwritten.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Mapping, Optional

import yaml

from src.backend.wikiforge.semantics.neo4j_query import CypherQueryError, Neo4jQueryService

RECONCILE_SCHEMA = "wikiforge.neo4j-reconcile/v1"
RECONCILER_ACTOR = "process:neo4j-reconciler"

# One bounded, read-only statement. All values are bound parameters; the C3
# service adds LIMIT and validates the whitelist before any driver is obtained.
RECONCILE_QUERY = """MATCH (n:PermanentNote)
WHERE n.`wf:revision` > $checkpoint
RETURN coalesce(n.id, '') AS id,
       coalesce(n.`wf:path`, '') AS path,
       coalesce(n.title, '') AS title,
       coalesce(n.content, '') AS content,
       coalesce(n.`wf:contentHash`, '') AS contentHash,
       coalesce(n.`wf:baseHash`, n.`wf:contentHash`, '') AS baseHash,
       coalesce(n.`wf:origin`, '') AS origin,
       n.`wf:revision` AS revision
ORDER BY n.`wf:revision` ASC, n.id ASC"""

_FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)
_SLUG = re.compile(r"[^a-zA-Z0-9_-]+")


def sha256_text(text: str) -> str:
    """Hash exactly the bytes a vault write would produce."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _as_text(value: Any) -> str:
    return value if isinstance(value, str) else ("" if value is None else str(value))


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_relative_path(raw: Any, note_id: str) -> str:
    """Normalize a DB path to a safe vault-relative Markdown path."""
    value = _as_text(raw).replace("\\", "/").strip().lstrip("/")
    split = value.split("/")
    parts = [part for part in split if part not in {"", "."}]
    if ".." in split or not parts:
        fallback = _SLUG.sub("-", note_id).strip("-") or "neo4j-note"
        parts = [fallback]
    relative = "/".join(parts)
    if not relative.lower().endswith(".md"):
        relative += ".md"
    return relative


def finding_id(note_id: str, revision: int) -> str:
    """Stable dedupe key reused by the Node stage bridge."""
    slug = _SLUG.sub("-", note_id).strip("-")[:48] or "note"
    return f"neo4j-{slug}-r{revision}"


def render_note(row: Mapping[str, Any]) -> str:
    """Return the proposed Markdown bytes, with OKF-compatible frontmatter."""
    content = _as_text(row.get("content"))
    metadata: dict[str, Any] = {}
    match = _FRONTMATTER.match(content)
    if match:
        try:
            loaded = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError:
            loaded = {}
        if isinstance(loaded, dict):
            metadata = dict(loaded)
        content = match.group(2)

    metadata["title"] = _as_text(row.get("title")) or _as_text(row.get("id")) or "Neo4j note"
    if not isinstance(metadata.get("type"), str) or not metadata["type"].strip():
        metadata["type"] = "PermanentNote"
    tags = metadata.get("tags")
    tags = [tag for tag in tags if isinstance(tag, str)] if isinstance(tags, list) else []
    for tag in ("neo4j", "reverse-sync"):
        if tag not in tags:
            tags.append(tag)
    metadata["tags"] = tags

    wf = metadata.get("wf")
    wf = dict(wf) if isinstance(wf, dict) else {}
    wf.update({
        "id": _as_text(row.get("id")),
        "origin": "neo4j",
        "revision": _as_int(row.get("revision")),
        "baseHash": _as_text(row.get("baseHash")),
        "contentHash": _as_text(row.get("contentHash")),
    })
    metadata["wf"] = wf

    frontmatter = yaml.safe_dump(
        metadata,
        allow_unicode=True,
        sort_keys=True,
        default_flow_style=False,
    ).strip()
    return f"---\n{frontmatter}\n---\n{content}"


def reconcile(
    *,
    client: Optional[Any] = None,
    project_id: Optional[str] = None,
    checkpoint: int = 0,
    wiki_dir: Optional[Path | str] = None,
    confirm_destructive: bool = True,
    max_rows: int = 100,
) -> dict[str, Any]:
    """Read changed nodes and return a JSON envelope of proposals/conflicts.

    ``client`` is the C1 injectable client. Passing ``None`` is a safe no-op:
    the C3 service validates the query but never obtains a driver. No file is
    written, including on conflicts.
    """
    base: dict[str, Any] = {
        "schema": RECONCILE_SCHEMA,
        "projectId": project_id or "default",
        "checkpoint": _as_int(checkpoint),
        "requiresConfirmation": bool(confirm_destructive),
    }
    root = Path(wiki_dir) if wiki_dir is not None else Path.cwd()
    service = Neo4jQueryService(client=client, max_rows=max_rows)
    try:
        rows = service.execute_read(
            RECONCILE_QUERY,
            {"checkpoint": _as_int(checkpoint)},
            project_id=project_id,
        )
    except CypherQueryError as exc:
        return {
            **base,
            "success": False,
            "error": str(exc),
            "errorType": exc.code,
            "mode": "mock" if not service.is_live else "live",
        }

    proposals: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    max_revision = _as_int(checkpoint)
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        note_id = _as_text(row.get("id")) or "neo4j-note"
        revision = _as_int(row.get("revision"))
        max_revision = max(max_revision, revision)
        relative = safe_relative_path(row.get("path"), note_id)
        local_path = root / relative
        try:
            local = local_path.read_text(encoding="utf-8") if local_path.is_file() else None
        except OSError:
            local = None
        local_hash = sha256_text(local) if local is not None else ""
        base_hash = _as_text(row.get("baseHash"))
        db_hash = _as_text(row.get("contentHash"))

        if local is not None and (not base_hash or local_hash != base_hash):
            conflicts.append({
                "id": note_id,
                "path": relative,
                "revision": revision,
                "findingId": finding_id(note_id, revision),
                "localHash": local_hash,
                "baseHash": base_hash,
                "dbHash": db_hash,
                "reason": "local_hash_mismatch",
            })
            continue

        proposed = render_note(row)
        if proposed == local:
            continue
        proposals.append({
            "id": note_id,
            "findingId": finding_id(note_id, revision),
            "path": relative,
            "title": _as_text(row.get("title")) or note_id,
            "action": "modify" if local is not None else "create",
            "revision": revision,
            "origin": _as_text(row.get("origin")) or "neo4j",
            "baseHash": base_hash,
            "contentHash": db_hash,
            "localHash": local_hash,
            "content": proposed,
            "requiresConfirmation": bool(confirm_destructive),
        })

    return {
        **base,
        "success": True,
        "mode": "live" if service.is_live else "mock",
        "wikiDir": str(root),
        "proposals": proposals,
        "conflicts": conflicts,
        "count": len(proposals),
        "nextCheckpoint": max_revision,
    }


__all__ = [
    "RECONCILE_QUERY",
    "RECONCILE_SCHEMA",
    "RECONCILER_ACTOR",
    "finding_id",
    "reconcile",
    "render_note",
    "safe_relative_path",
    "sha256_text",
]
