"""C5 — reverse sync: fake-driver reads, JSON proposals, zero vault writes."""

from __future__ import annotations

import contextlib
import io
import json
import re
import sys
import types
from pathlib import Path
from typing import Any

import pytest
import yaml

from src.backend.wikiforge.semantics import neo4j_api_tool as api_tool
from src.backend.wikiforge.semantics.neo4j_client import Neo4jClient, Neo4jConfig
from src.backend.wikiforge.semantics.neo4j_reconciler import (
    RECONCILE_SCHEMA,
    reconcile,
    sha256_text,
)


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
        self.rows = rows or []
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
        Neo4jConfig(enabled=True, password_env="WF_C5_TEST_PASSWORD", projects={"demo": "demo-db"}),
        driver_factory=lambda _cfg, _pwd: driver,
        environ={"WF_C5_TEST_PASSWORD": "secret"},
    )


def note_row(body: str = "# Alpha\n\nTesto DB.\n", *, revision: int = 7, base_hash: str = "base") -> dict[str, Any]:
    return {
        "id": "alpha",
        "path": "alpha.md",
        "title": "Alpha",
        "content": body,
        "contentHash": "db-hash",
        "baseHash": base_hash,
        "origin": "neo4j",
        "revision": revision,
    }


def write_note(folder: Path, text: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "alpha.md"
    path.write_text(text, encoding="utf-8")
    return path


def frontmatter(markdown: str) -> dict[str, Any]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", markdown, re.DOTALL)
    assert match, "proposal must start with YAML frontmatter"
    parsed = yaml.safe_load(match.group(1))
    assert isinstance(parsed, dict)
    return parsed


def test_one_changed_node_becomes_one_proposal_with_correct_frontmatter(tmp_path: Path) -> None:
    local = "# Alpha\n\nTesto locale.\n"
    path = write_note(tmp_path, local)
    driver = FakeDriver([note_row(base_hash=sha256_text(local))])

    result = reconcile(
        client=live_client(driver),
        project_id="demo",
        checkpoint=4,
        wiki_dir=tmp_path,
        confirm_destructive=True,
    )

    assert result["success"] is True
    assert result["schema"] == RECONCILE_SCHEMA
    assert result["mode"] == "live"
    assert result["count"] == 1
    assert result["conflicts"] == []
    assert result["nextCheckpoint"] == 7
    assert result["requiresConfirmation"] is True

    proposal = result["proposals"][0]
    assert proposal["id"] == "alpha"
    assert proposal["findingId"] == "neo4j-alpha-r7"
    assert proposal["path"] == "alpha.md"
    assert proposal["action"] == "modify"
    assert proposal["origin"] == "neo4j"
    assert proposal["requiresConfirmation"] is True

    meta = frontmatter(proposal["content"])
    assert meta["title"] == "Alpha"
    assert meta["type"] == "PermanentNote"
    assert meta["tags"] == ["neo4j", "reverse-sync"]
    assert meta["wf"]["id"] == "alpha"
    assert meta["wf"]["origin"] == "neo4j"
    assert meta["wf"]["revision"] == 7
    assert proposal["content"].endswith("# Alpha\n\nTesto DB.\n")

    # The Python side never touches the vault, even in live mode.
    assert path.read_text(encoding="utf-8") == local

    run = [call for call in driver.calls if call[0] == "run"]
    assert len(run) == 1
    assert run[0][2] == {"checkpoint": 4}
    assert "wf:revision" in run[0][1]
    assert "LIMIT" in run[0][1]
    assert "timeout" in run[0][3]
    assert ("session", "demo-db") in driver.calls


def test_local_hash_mismatch_reports_conflict_and_no_proposal(tmp_path: Path) -> None:
    local = "# Alpha\n\nModifica umana successiva.\n"
    path = write_note(tmp_path, local)
    driver = FakeDriver([note_row(base_hash="hash-di-un-altro-stato")])

    result = reconcile(
        client=live_client(driver),
        project_id="demo",
        checkpoint=4,
        wiki_dir=tmp_path,
    )

    assert result["success"] is True
    assert result["count"] == 0
    assert result["proposals"] == []
    assert len(result["conflicts"]) == 1
    conflict = result["conflicts"][0]
    assert conflict["reason"] == "local_hash_mismatch"
    assert conflict["path"] == "alpha.md"
    assert conflict["localHash"] == sha256_text(local)
    assert path.read_text(encoding="utf-8") == local


def test_missing_note_is_staged_as_create(tmp_path: Path) -> None:
    driver = FakeDriver([note_row(base_hash="")])

    result = reconcile(client=live_client(driver), checkpoint=0, wiki_dir=tmp_path)

    assert result["count"] == 1
    assert result["proposals"][0]["action"] == "create"
    assert not (tmp_path / "alpha.md").exists()


def test_no_driver_is_a_safe_mock_noop(tmp_path: Path) -> None:
    result = reconcile(checkpoint=0, wiki_dir=tmp_path)

    assert result["success"] is True
    assert result["mode"] == "mock"
    assert result["proposals"] == []
    assert result["conflicts"] == []
    assert result["count"] == 0


def test_unsafe_db_path_falls_back_to_the_note_id(tmp_path: Path) -> None:
    row = note_row()
    row["path"] = "../../escape.md"
    driver = FakeDriver([row])

    result = reconcile(client=live_client(driver), checkpoint=0, wiki_dir=tmp_path)

    assert result["count"] == 1
    assert result["proposals"][0]["path"] == "alpha.md"
    assert not (tmp_path.parent / "escape.md").exists()


def test_cli_reconcile_reads_checkpoint_in_mock_mode(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    original = sys.stdin
    sys.stdin = types.SimpleNamespace(read=lambda: json.dumps({"checkpoint": 9}))  # type: ignore[assignment]
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            code = api_tool.main(["reconcile", "--project", "demo"])
    finally:
        sys.stdin = original

    body = json.loads(out.getvalue())
    assert code == 0
    assert body["success"] is True
    assert body["schema"] == RECONCILE_SCHEMA
    assert body["checkpoint"] == 9
    assert body["mode"] == "mock"
    assert body["proposals"] == []


def test_cli_reconcile_rejects_invalid_request() -> None:
    original = sys.stdin
    sys.stdin = types.SimpleNamespace(read=lambda: json.dumps({"checkpoint": "nope"}))  # type: ignore[assignment]
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            code = api_tool.main(["reconcile"])
    finally:
        sys.stdin = original

    body = json.loads(out.getvalue())
    assert code == 0
    assert body["success"] is False
    assert body["errorType"] == "validation_error"
