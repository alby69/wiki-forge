"""C1 — injectable Neo4j client: no driver import, no socket, no regression."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from src.backend.wikiforge.semantics.neo4j_client import (
    Neo4jClient,
    Neo4jConfig,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


class FakeSession:
    def __init__(self, log: list, driver: "FakeDriver") -> None:
        self.log = log
        self.driver = driver

    def __enter__(self) -> "FakeSession":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def run(self, query: str, **_kwargs: object) -> None:
        self.log.append(("run", query))


class FakeDriver:
    """Minimal in-memory stand-in: every interaction is recorded, zero network."""

    def __init__(self, *, fail_verify: bool = False) -> None:
        self.log: list = []
        self.closed = False
        self.fail_verify = fail_verify

    def session(self, database: str | None = None, **_kwargs: object) -> FakeSession:
        self.log.append(("session", database))
        return FakeSession(self.log, self)

    def verify_connectivity(self) -> None:
        self.log.append(("verify", None))
        if self.fail_verify:
            raise RuntimeError("database unreachable")

    def close(self) -> None:
        self.closed = True
        self.log.append(("close", None))


def enabled_config(**overrides: object) -> Neo4jConfig:
    values = {
        "enabled": True,
        "uri": "bolt://db.internal:7687",
        "user": "neo4j",
        "password_env": "WF_TEST_NEO4J_PASSWORD",
        "database": "neo4j",
        "tls": True,
        "projects": {"default": "neo4j", "tesi": "tesi"},
    }
    values.update(overrides)
    return Neo4jConfig(**values)  # type: ignore[arg-type]


def test_import_never_imports_driver_or_opens_a_socket() -> None:
    code = """
import sys
from src.backend.wikiforge.semantics.neo4j_client import Neo4jClient, Neo4jConfig
assert 'neo4j' not in sys.modules, 'the driver was imported at module import time'
client = Neo4jClient(Neo4jConfig())
assert client.connect() is None
assert client.verify_connectivity() is False
assert client.session() is None
assert 'neo4j' not in sys.modules
print('OK')
"""
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"


def test_config_from_toml_mapping_and_project_resolution() -> None:
    cfg = Neo4jConfig.from_config({
        "neo4j": {
            "enabled": False,
            "uri": "bolt://localhost:7687",
            "user": "reader",
            "passwordEnv": "SECRET_VAR",
            "database": "neo4j",
            "tls": True,
            "projects": {"default": "wikiforge", "tesi": "tesi-db"},
        }
    })
    assert cfg.enabled is False
    assert cfg.user == "reader"
    assert cfg.password_env == "SECRET_VAR"
    assert cfg.effective_uri() == "bolt+s://localhost:7687"
    assert cfg.database_for("tesi") == "tesi-db"
    assert cfg.database_for("unknown") == "wikiforge"
    assert cfg.with_database("tesi").database == "tesi-db"
    assert cfg.database == "neo4j"  # original is untouched (frozen dataclass)


def test_config_from_env_is_opt_in_and_honours_env_names() -> None:
    cfg = Neo4jConfig.from_env({
        "NEO4J_ENABLED": "true",
        "NEO4J_URI": "neo4j://cluster:7687",
        "NEO4J_USER": "svc",
        "NEO4J_PASSWORD_ENV": "WF_PWD",
        "NEO4J_DATABASE": "graph",
        "NEO4J_TLS": "1",
    })
    assert cfg.enabled is True
    assert cfg.effective_uri() == "neo4j+s://cluster:7687"
    assert cfg.database == "graph"
    assert cfg.password({"WF_PWD": "s3cret"}) == "s3cret"
    assert Neo4jConfig.from_env({}).enabled is False


def test_missing_password_never_constructs_a_driver() -> None:
    calls: list = []

    def factory(config: Neo4jConfig, password: str) -> FakeDriver:
        calls.append((config, password))
        return FakeDriver()

    client = Neo4jClient(
        enabled_config(),
        driver_factory=factory,
        environ={},  # WF_TEST_NEO4J_PASSWORD is intentionally absent
    )
    assert client.connect() is None
    assert client.verify_connectivity() is False
    assert client.session() is None
    client.close()
    assert calls == []
    assert client.is_connected is False


def test_disabled_client_is_a_complete_noop() -> None:
    calls: list = []

    def factory(config: Neo4jConfig, password: str) -> FakeDriver:
        calls.append((config, password))  # pragma: no cover - must never run
        return FakeDriver()

    client = Neo4jClient(
        Neo4jConfig(enabled=False),
        driver_factory=factory,
        password="explicit-secret",
    )
    assert client.connect() is None
    assert client.verify_connectivity() is False
    assert client.session("tesi") is None
    with client as entered:
        assert entered is client
    client.close()
    client.close()
    assert calls == []


def test_fake_driver_connect_verify_and_close() -> None:
    driver = FakeDriver()
    factory_calls: list = []

    def factory(config: Neo4jConfig, password: str) -> FakeDriver:
        factory_calls.append((config.effective_uri(), config.user, password, config.database))
        return driver

    client = Neo4jClient(
        enabled_config(),
        driver_factory=factory,
        environ={"WF_TEST_NEO4J_PASSWORD": "s3cret"},
    )
    assert client.enabled is True
    assert client.connect() is driver
    assert client.connect() is driver  # idempotent, factory called once
    assert factory_calls == [("bolt+s://db.internal:7687", "neo4j", "s3cret", "neo4j")]
    assert client.is_connected is True
    assert client.verify_connectivity() is True

    session = client.session("tesi")
    assert session is not None
    with session as active:
        active.run("RETURN 1")

    client.close()
    assert driver.closed is True
    assert ("close", None) in driver.log
    client.close()  # idempotent: no second close
    assert driver.log.count(("close", None)) == 1


def test_verify_failure_is_swallowed_and_driver_remains_usable() -> None:
    driver = FakeDriver(fail_verify=True)
    client = Neo4jClient(
        enabled_config(),
        driver_factory=lambda _cfg, _pwd: driver,
        password="s3cret",
    )
    assert client.verify_connectivity() is False
    assert client.driver is driver
    assert [entry[0] for entry in driver.log] == ["verify"]


def test_legacy_watcher_and_rag_constructors_still_work_with_injected_client() -> None:
    code = """
import sys, types

# Stub watchdog: the real package is optional for this constructor-only check.
watchdog = types.ModuleType('watchdog')
observers = types.ModuleType('watchdog.observers')
events = types.ModuleType('watchdog.events')
class Observer:
    def schedule(self, *a, **k): pass
    def start(self): pass
    def stop(self): pass
    def join(self): pass
class FileSystemEventHandler: pass
class FileSystemEvent: pass
observers.Observer = Observer
events.FileSystemEventHandler = FileSystemEventHandler
events.FileSystemEvent = FileSystemEvent
sys.modules['watchdog'] = watchdog
sys.modules['watchdog.observers'] = observers
sys.modules['watchdog.events'] = events

from src.backend.wikiforge.watcher.graph_watcher import GraphSyncHandler, LiveGraphWatcher
from src.backend.wikiforge.semantics.graph_rag_pipeline import WikiForgeGraphRAG
from src.backend.wikiforge.semantics.neo4j_client import Neo4jClient, Neo4jConfig

client = Neo4jClient(Neo4jConfig(enabled=False))
# Legacy signatures, unchanged.
assert GraphSyncHandler('wiki').neo4j_client is None
assert LiveGraphWatcher('wiki').handler.neo4j_client is None
assert WikiForgeGraphRAG().neo4j_client is None
# Additive injection.
assert GraphSyncHandler('wiki', None, None, client).neo4j_client is client
assert LiveGraphWatcher('wiki', None, client).handler.neo4j_client is client
assert WikiForgeGraphRAG(None, None, None, client).neo4j_client is client
assert WikiForgeGraphRAG(None, None, None, client).neo4j_driver is None
print('OK')
"""
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"


def test_client_can_be_built_from_the_real_inert_config() -> None:
    """The repository config is disabled: the client must stay a no-op."""
    client = Neo4jClient()
    assert client.config.enabled is False
    assert client.connect() is None
    assert client.is_connected is False
