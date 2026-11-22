"""C4 — thin CLI adapter exposing Neo4j status/query/sync to the Node gateway.

The gateway never imports Python modules directly: it spawns this tool with a
subcommand and, for ``query``, a JSON request on stdin. Every reply is one JSON
object on stdout using the usual ``{"success": ...}`` envelope.

Nothing here opens a socket when Neo4j is not configured: ``status`` is purely
declarative, ``query`` validates the Cypher before deciding whether a driver is
needed, and ``sync`` uses the idempotent C2 handler with an injected C1 client
that is a no-op when disabled. No vault file is ever written.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path
from typing import Any, Mapping

# The gateway spawns this file with a project directory as cwd, so the repository
# root must be added explicitly before importing the backend package.
for _parent in Path(__file__).resolve().parents:
    if (_parent / "src").is_dir() and (_parent / "config").is_dir():
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break

from src.backend.wikiforge.semantics.neo4j_client import Neo4jClient, Neo4jConfig
from src.backend.wikiforge.semantics.neo4j_query import CypherQueryError, Neo4jQueryService
from src.backend.wikiforge.watcher.graph_watcher import GraphSyncHandler, resolve_project_wiki


def driver_installed() -> bool:
    """Check for the optional driver without importing it (no side effects)."""
    try:
        return importlib.util.find_spec("neo4j") is not None
    except (ImportError, ValueError):  # pragma: no cover - defensive
        return False


def config_for(project_id: str | None) -> Neo4jConfig:
    """Resolve the declarative config for a project (never stores a password)."""
    return Neo4jConfig.from_config(project=project_id)


def is_configured(config: Neo4jConfig) -> bool:
    """Enabled and with its password environment variable present."""
    return bool(config.enabled and config.password(os.environ))


def effective_mode(config: Neo4jConfig) -> str:
    return "live" if is_configured(config) and driver_installed() else "mock"


def emit(payload: Mapping[str, Any]) -> int:
    print(json.dumps(dict(payload), ensure_ascii=False))
    return 0


def fail(message: str, error_type: str, mode: str | None = None) -> int:
    payload: dict[str, Any] = {"success": False, "error": message, "errorType": error_type}
    if mode is not None:
        payload["mode"] = mode
    return emit(payload)


def command_status(project_id: str | None) -> int:
    """Report configuration only: no connect(), no socket, no secrets."""
    config = config_for(project_id)
    return emit({
        "success": True,
        "enabled": config.enabled,
        "configured": is_configured(config),
        "driverInstalled": driver_installed(),
        "mode": effective_mode(config),
        "database": config.database,
        "projectId": project_id or "default",
    })


def command_query(project_id: str | None) -> int:
    """Read ``{cypher, params, projectId}`` from stdin and run the C3 service."""
    try:
        request = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as exc:
        return fail(f"Invalid JSON request: {exc}", "invalid_request")
    if not isinstance(request, dict):
        return fail("Request must be a JSON object", "invalid_request")

    cypher = request.get("cypher")
    params = request.get("params")
    params = {} if params is None else params
    target = request.get("projectId") or project_id
    if target is not None and not isinstance(target, str):
        return fail("projectId must be a string", "validation_error")
    if not isinstance(cypher, str) or not cypher.strip():
        return fail("cypher must be a non-empty string", "validation_error")
    if not isinstance(params, dict):
        return fail("params must be a JSON object", "validation_error")

    mode = effective_mode(config_for(target))
    # In mock mode no client is injected: the service still validates the query
    # but cannot reach ``connect()`` even when a password happens to be set.
    client = Neo4jClient(config_for(target)) if mode == "live" else None
    service = Neo4jQueryService(client=client)
    try:
        rows = service.execute_read(cypher, params, project_id=target)
    except CypherQueryError as exc:
        return fail(str(exc), exc.code, mode)
    except Exception as exc:  # noqa: BLE001 - one typed failure for the gateway
        return fail(f"Neo4j query failed: {exc}", "query_execution_error", mode)
    finally:
        if client is not None:
            client.close()

    return emit({
        "success": True,
        "mode": mode,
        "rows": rows,
        "count": len(rows),
        "projectId": target or "default",
    })


def command_sync(project_id: str | None) -> int:
    """Scan ``projects/<id>/wiki`` with C2's handler; never write to the vault."""
    config = config_for(project_id)
    mode = effective_mode(config)
    client = Neo4jClient(config)
    wiki_dir = resolve_project_wiki(project_id)
    events: list[dict[str, Any]] = []
    handler = GraphSyncHandler(
        wiki_dir,
        neo4j_client=client,
        on_event=events.append,
        debounce_seconds=0.0,
    )

    notes = 0
    try:
        if wiki_dir.is_dir():
            for path in sorted(wiki_dir.rglob("*.md")):
                if path.name.startswith("."):
                    continue
                notes += 1
                handler.sync_note(path)
    finally:
        client.close()

    return emit({
        "success": True,
        "projectId": project_id or "default",
        "wikiDir": str(wiki_dir),
        "notes": notes,
        "synced": len(events),
        "mode": mode,
    })


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Wiki-Forge Neo4j gateway tool (C4)")
    parser.add_argument("command", choices=("status", "query", "sync"))
    parser.add_argument("--project", default=None, help="project id selecting wiki and database")
    args = parser.parse_args(argv)

    if args.command == "status":
        return command_status(args.project)
    if args.command == "query":
        return command_query(args.project)
    return command_sync(args.project)


if __name__ == "__main__":
    raise SystemExit(main())
