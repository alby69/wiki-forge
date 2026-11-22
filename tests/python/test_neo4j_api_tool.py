"""C4 — Neo4j gateway tool: declarative status, read-only query, vault sync.

Everything runs against fake drivers and in-memory files: no socket is opened
and no vault file is written.
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import types
from typing import Any

import pytest

from src.backend.wikiforge.semantics import neo4j_api_tool as tool
from src.backend.wikiforge.semantics.neo4j_client import Neo4jClient, Neo4jConfig
from src.backend.wikiforge.watcher import graph_watcher

READ_QUERY = "MATCH (n:PermanentNote) RETURN n.title AS title"


def run_cli(argv: list[str], stdin_text: str = "") -> tuple[int, dict[str, Any]]:
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = tool.main(argv) if not stdin_text else _run_with_stdin(argv, stdin_text)
    return code, json.loads(out.getvalue())


def _run_with_stdin(argv: list[str], stdin_text: str) -> int:
    original = sys.stdin
    sys.stdin = types.SimpleNamespace(read=lambda: stdin_text)  # type: ignore[assignment]
    try:
        return tool.main(argv)
    finally:
        sys.stdin = original


class FakeSession:
    def __init__(self, calls: list, rows: list[dict[str, Any]]) -> None:
        self.calls = calls
        self.rows = rows

    def __enter__(self) -> "FakeSession":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def run(self, query: str, params: dict | None = None, **kwargs: Any) -> list[dict[str, Any]]:
        self.calls.append(("run", query, dict(params or {}), kwargs))
        return self.rows


class FakeDriver:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = rows or [{"title": "SHACL"}]
        self.calls: list = []
        self.closed = False

    def session(self, database: str | None = None, **_kwargs: Any) -> FakeSession:
        self.calls.append(("session", database))
        return FakeSession(self.calls, self.rows)

    def verify_connectivity(self) -> None:
        self.calls.append(("verify", None))

    def close(self) -> None:
        self.closed = True


def live_client(driver: FakeDriver) -> Neo4jClient:
    return Neo4jClient(
        Neo4jConfig(enabled=True, password_env="WF_C4_TEST_PASSWORD", projects={"demo": "demo-db"}),
        driver_factory=lambda _cfg, _pwd: driver,
        environ={"WF_C4_TEST_PASSWORD": "secret"},
    )


def test_status_is_declarative_and_never_builds_a_client(monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("status must not create a Neo4j client")

    monkeypatch.setattr(tool, "Neo4jClient", forbidden)
    monkeypatch.setattr(tool, "driver_installed", lambda: False)

    code, body = run_cli(["status", "--project", "demo"])

    assert code == 0
    assert body == {
        "success": True,
        "enabled": False,
        "configured": False,
        "driverInstalled": False,
        "mode": "mock",
        "database": "neo4j",
        "projectId": "demo",
    }


def test_status_reports_live_when_config_and_driver_are_present(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tool, "config_for", lambda _p: live_client(FakeDriver()).config)
    monkeypatch.setattr(tool, "driver_installed", lambda: True)
    monkeypatch.setenv("WF_C4_TEST_PASSWORD", "secret")

    _code, body = run_cli(["status"])

    assert body["enabled"] is True
    assert body["configured"] is True
    assert body["driverInstalled"] is True
    assert body["mode"] == "live"
    assert body["projectId"] == "default"


def test_query_mock_validates_read_only_and_returns_no_rows() -> None:
    code, body = run_cli(["query"], json.dumps({"cypher": READ_QUERY, "params": {}}))

    assert code == 0
    assert body == {"success": True, "mode": "mock", "rows": [], "count": 0, "projectId": "default"}


def test_query_rejects_write_with_a_typed_error() -> None:
    code, body = run_cli(["query"], json.dumps({"cypher": "MATCH (n) DELETE n RETURN n"}))

    assert code == 0  # the HTTP status is decided by the gateway
    assert body["success"] is False
    assert body["errorType"] == "read_only_violation"
    assert body["mode"] == "mock"
    assert "DELETE" in body["error"]


@pytest.mark.parametrize(
    ("stdin_text", "expected"),
    [
        ("{not json", "invalid_request"),
        ('{"cypher": 42}', "validation_error"),
        ('{"cypher": "MATCH (n) RETURN n", "params": []}', "validation_error"),
    ],
)
def test_query_rejects_malformed_requests(stdin_text: str, expected: str) -> None:
    _code, body = run_cli(["query"], stdin_text)
    assert body["success"] is False
    assert body["errorType"] == expected


def test_query_live_passes_params_timeout_and_database(monkeypatch: pytest.MonkeyPatch) -> None:
    driver = FakeDriver([{"title": "SHACL"}, {"title": "Graph"}])
    client = live_client(driver)
    monkeypatch.setattr(tool, "config_for", lambda _p: client.config)
    monkeypatch.setattr(tool, "driver_installed", lambda: True)
    monkeypatch.setenv("WF_C4_TEST_PASSWORD", "secret")
    monkeypatch.setattr(tool, "Neo4jClient", lambda _config: client)

    code, body = run_cli(
        ["query", "--project", "demo"],
        json.dumps({"cypher": READ_QUERY, "params": {"title": "SHACL"}, "projectId": "demo"}),
    )

    assert code == 0
    assert body["success"] is True
    assert body["mode"] == "live"
    assert body["rows"] == [{"title": "SHACL"}, {"title": "Graph"}]
    assert body["projectId"] == "demo"
    runs = [entry for entry in driver.calls if entry[0] == "run"]
    assert len(runs) == 1
    assert runs[0][1].rstrip().endswith("LIMIT 100")
    assert runs[0][2] == {"title": "SHACL"}
    assert runs[0][3] == {"timeout": 5.0}
    assert ("session", "demo-db") in driver.calls
    assert driver.closed is True


def test_sync_scans_wiki_with_injected_driver_and_writes_no_vault_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    wiki = tmp_path / "wiki"
    (wiki / "sub").mkdir(parents=True)
    note_a = wiki / "a.md"
    note_b = wiki / "sub" / "b.md"
    note_a.write_text("# Note A", encoding="utf-8")
    note_b.write_text("# Note B", encoding="utf-8")
    (wiki / ".hidden.md").write_text("# hidden", encoding="utf-8")
    before = {path: path.read_bytes() for path in wiki.rglob("*.md")}

    driver = FakeDriver()
    client = live_client(driver)
    monkeypatch.setattr(tool, "config_for", lambda _p: client.config)
    monkeypatch.setattr(tool, "driver_installed", lambda: True)
    monkeypatch.setattr(tool, "Neo4jClient", lambda _config: client)
    monkeypatch.setattr(tool, "resolve_project_wiki", lambda _p: wiki)
    monkeypatch.setenv("WF_C4_TEST_PASSWORD", "secret")

    code, body = run_cli(["sync", "--project", "demo"])

    assert code == 0
    assert body["success"] is True
    assert body["notes"] == 2
    assert body["synced"] == 2
    assert body["mode"] == "live"
    assert body["wikiDir"] == str(wiki)
    merges = [entry for entry in driver.calls if entry[0] == "run"]
    assert len(merges) == 2
    assert {entry[2]["id"] for entry in merges} == {"a", "sub-b"}
    assert before == {path: path.read_bytes() for path in wiki.rglob("*.md")}
    assert driver.closed is True


def test_sync_is_idempotent_on_second_scan(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> None:
    wiki = tmp_path / "wiki"
    wiki.mkdir()
    (wiki / "a.md").write_text("# Note A", encoding="utf-8")

    driver = FakeDriver()
    client = live_client(driver)
    monkeypatch.setattr(tool, "config_for", lambda _p: client.config)
    monkeypatch.setattr(tool, "driver_installed", lambda: True)
    monkeypatch.setattr(tool, "Neo4jClient", lambda _config: client)
    monkeypatch.setattr(tool, "resolve_project_wiki", lambda _p: wiki)
    monkeypatch.setenv("WF_C4_TEST_PASSWORD", "secret")

    first = run_cli(["sync", "--project", "demo"])
    second = run_cli(["sync", "--project", "demo"])

    assert first[1]["synced"] == 1
    # Each tool invocation builds a fresh handler (and therefore fresh hashes).
    assert second[1]["synced"] == 1

    # Inside one handler the public wrapper stays idempotent: two calls for the
    # same unchanged note produce exactly one MERGE.
    handler = graph_watcher.GraphSyncHandler(wiki, neo4j_client=client, debounce_seconds=0.0)
    count_runs = lambda: len([entry for entry in driver.calls if entry[0] == "run"])
    before = count_runs()
    handler.sync_note(wiki / "a.md")
    after_first = count_runs()
    handler.sync_note(wiki / "a.md")
    assert after_first == before + 1
    assert count_runs() == after_first


def test_live_watcher_reports_missing_watchdog(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(graph_watcher, "Observer", None)
    with pytest.raises(RuntimeError, match="watchdog"):
        graph_watcher.LiveGraphWatcher(watch_dir="wiki")
