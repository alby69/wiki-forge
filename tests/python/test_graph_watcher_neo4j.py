"""C2 — vault → Neo4j sync: parametrized MERGE, idempotence, structured events.

``watchdog`` is stubbed when absent so these tests exercise the real watcher
module without adding a runtime dependency or touching a socket.
"""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import types
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


def _install_watchdog_stub() -> None:
    if importlib.util.find_spec("watchdog") is not None:
        return
    watchdog = types.ModuleType("watchdog")
    observers = types.ModuleType("watchdog.observers")
    events = types.ModuleType("watchdog.events")

    class Observer:  # pragma: no cover - only used by LiveGraphWatcher.start()
        def schedule(self, *_args: object, **_kwargs: object) -> None:
            pass

        def start(self) -> None:
            pass

        def stop(self) -> None:
            pass

        def join(self) -> None:
            pass

    class FileSystemEventHandler:
        pass

    class FileSystemEvent:
        pass

    observers.Observer = Observer
    events.FileSystemEventHandler = FileSystemEventHandler
    events.FileSystemEvent = FileSystemEvent
    sys.modules["watchdog"] = watchdog
    sys.modules["watchdog.observers"] = observers
    sys.modules["watchdog.events"] = events


_install_watchdog_stub()

from src.backend.wikiforge.semantics.neo4j_client import Neo4jClient, Neo4jConfig  # noqa: E402
from src.backend.wikiforge.watcher.graph_watcher import (  # noqa: E402
    GraphSyncHandler,
    LiveGraphWatcher,
    resolve_project_wiki,
)


class RecordingSession:
    def __init__(self, calls: list) -> None:
        self.calls = calls

    def __enter__(self) -> "RecordingSession":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def run(self, statement: str, params: dict | None = None) -> None:
        self.calls.append((statement, dict(params or {})))


class RecordingDriver:
    """In-memory driver: records every ``session.run`` with its parameters."""

    def __init__(self) -> None:
        self.calls: list = []
        self.closed = False

    def session(self, database: str | None = None, **_kwargs: object) -> RecordingSession:
        return RecordingSession(self.calls)

    def verify_connectivity(self) -> None:
        pass

    def close(self) -> None:
        self.closed = True


class MockEvent:
    def __init__(self, path: Path, dest: Path | None = None) -> None:
        self.src_path = str(path)
        self.dest_path = str(dest) if dest else ""
        self.is_directory = False


def enabled_client(driver: RecordingDriver) -> Neo4jClient:
    return Neo4jClient(
        Neo4jConfig(
            enabled=True,
            password_env="WF_C2_TEST_PASSWORD",
        ),
        driver_factory=lambda _cfg, _pwd: driver,
        environ={"WF_C2_TEST_PASSWORD": "secret"},
    )


def write_note(folder: Path, relative: str, text: str = "# Nota\n\n[[supports::altra]]\n") -> Path:
    path = folder / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def test_legacy_callback_contract_is_unchanged(tmp_path: Path) -> None:
    """Replica esatta di ``tests/test_graph_watcher.py:15-35`` (senza driver)."""
    events: list = []
    handler = GraphSyncHandler(watch_dir=tmp_path, on_change_callback=lambda kind, path: events.append((kind, path)))
    note = write_note(tmp_path, "note.md", "# Test Note\n[[supports::other-note]]")
    handler.on_created(MockEvent(note))
    assert len(events) == 1
    assert events[0][0] == "CREATED"


def test_structured_event_is_emitted_and_no_driver_is_a_noop(tmp_path: Path) -> None:
    events: list = []
    handler = GraphSyncHandler(watch_dir=tmp_path, on_event=events.append)
    note = write_note(tmp_path, "note.md")
    handler.on_created(MockEvent(note))

    assert len(events) == 1
    payload = events[0]
    assert payload["event"] == "graph.changed"
    assert payload["origin"] == "vault"
    assert payload["path"] == "note.md"
    assert payload["id"] == "note"
    assert payload["revision"] == 1
    assert payload["action"] == "CREATED"


def test_one_parametrized_merge_per_note(tmp_path: Path) -> None:
    driver = RecordingDriver()
    handler = GraphSyncHandler(watch_dir=tmp_path, neo4j_client=enabled_client(driver))
    note = write_note(tmp_path, "alpha.md", "# Alpha\n\nTesto.\n")

    handler.on_created(MockEvent(note))

    assert len(driver.calls) == 1
    statement, params = driver.calls[0]
    assert statement.startswith("MERGE (n:PermanentNote {id: $id})")
    for token in ("$id", "$title", "$content", "$hash", "$revision"):
        assert token in statement
    for key in ("wf:source", "wf:origin", "wf:contentHash", "wf:lastModified", "wf:revision"):
        assert key in statement
    assert params["id"] == "alpha"
    assert params["title"] == "Alpha"
    assert params["source"] == "wikiforge"
    assert params["origin"] == "vault"
    assert len(params["hash"]) == 64
    assert params["revision"] == 1
    assert "Testo." in params["content"]


def test_unchanged_hash_never_writes_twice(tmp_path: Path) -> None:
    driver = RecordingDriver()
    events: list = []
    handler = GraphSyncHandler(
        watch_dir=tmp_path,
        neo4j_driver=driver,  # legacy raw-driver path still works
        on_event=events.append,
        debounce_seconds=0,
    )
    note = write_note(tmp_path, "stable.md")

    handler.on_created(MockEvent(note))
    handler.on_modified(MockEvent(note))
    handler.on_modified(MockEvent(note))

    assert len(driver.calls) == 1
    assert [event["action"] for event in events] == ["CREATED"]
    assert driver.calls[0][1]["revision"] == 1


def test_changed_content_bumps_revision(tmp_path: Path) -> None:
    driver = RecordingDriver()
    events: list = []
    handler = GraphSyncHandler(watch_dir=tmp_path, neo4j_client=enabled_client(driver), on_event=events.append)
    note = write_note(tmp_path, "evolving.md", "# v1\n")

    handler.on_created(MockEvent(note))
    note.write_text("# v2\n", encoding="utf-8")
    handler.on_modified(MockEvent(note))

    assert len(driver.calls) == 2
    assert [event["revision"] for event in events] == [1, 2]
    assert [event["action"] for event in events] == ["CREATED", "MODIFIED"]
    assert driver.calls[0][1]["hash"] != driver.calls[1][1]["hash"]


def test_delete_uses_nested_slugify_and_parametrized_delete(tmp_path: Path) -> None:
    driver = RecordingDriver()
    events: list = []
    handler = GraphSyncHandler(watch_dir=tmp_path, neo4j_client=enabled_client(driver), on_event=events.append)
    note = write_note(tmp_path, "folder/sub/nested.md", "# Nested\n")

    handler.on_created(MockEvent(note))
    note.unlink()
    handler.on_deleted(MockEvent(note))

    assert len(driver.calls) == 2
    merge_statement, merge_params = driver.calls[0]
    delete_statement, delete_params = driver.calls[1]
    assert merge_params["id"] == "folder-sub-nested"
    assert delete_params["id"] == merge_params["id"]
    assert delete_statement.startswith("MATCH (n:PermanentNote {id: $id}) DETACH DELETE n")
    assert "'" not in delete_statement  # no interpolated value
    assert events[-1]["action"] == "DELETED"
    assert events[-1]["path"] == "folder/sub/nested.md"


def test_on_moved_deletes_and_resyncs_with_single_event_pair(tmp_path: Path) -> None:
    driver = RecordingDriver()
    events: list = []
    handler = GraphSyncHandler(
        watch_dir=tmp_path,
        neo4j_client=enabled_client(driver),
        on_event=events.append,
        debounce_seconds=0,
    )
    source = write_note(tmp_path, "old.md", "# Same\n")
    dest = write_note(tmp_path, "new.md", "# Same\n")

    handler.on_moved(MockEvent(source, dest))

    assert len(driver.calls) == 2
    assert driver.calls[0][0].startswith("MATCH (n:PermanentNote")
    assert driver.calls[1][0].startswith("MERGE (n:PermanentNote")
    assert [event["action"] for event in events] == ["MOVED", "MOVED"]
    assert [event["path"] for event in events] == ["old.md", "new.md"]


def test_live_watcher_forwards_callbacks_and_resolves_projects(tmp_path: Path) -> None:
    legacy: list = []
    structured: list = []
    watcher = LiveGraphWatcher(
        tmp_path,
        on_change_callback=lambda kind, path: legacy.append(kind),
        on_event=structured.append,
    )
    assert watcher.handler.on_change_callback is not None
    assert watcher.handler.on_event is not None

    note = write_note(tmp_path, "live.md")
    watcher.handler.on_created(MockEvent(note))
    assert legacy == ["CREATED"]
    assert structured[0]["event"] == "graph.changed"

    assert resolve_project_wiki("tesi", REPO_ROOT) == REPO_ROOT / "projects" / "tesi" / "wiki"
    assert resolve_project_wiki(None, REPO_ROOT) == REPO_ROOT / "wiki"


def test_driver_exception_is_swallowed(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    class BrokenDriver(RecordingDriver):
        def session(self, database: str | None = None, **_kwargs: object) -> RecordingSession:
            raise RuntimeError("connection lost")

    events: list = []
    handler = GraphSyncHandler(watch_dir=tmp_path, neo4j_driver=BrokenDriver(), on_event=events.append)
    note = write_note(tmp_path, "broken.md")
    handler.on_created(MockEvent(note))

    assert "Neo4j sync error" in capsys.readouterr().out
    assert len(events) == 1  # legacy consumers still notified
