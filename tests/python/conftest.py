import importlib.machinery
import importlib.util
import os
import sys
import tempfile
import types

import pytest
from pathlib import Path


def _install_optional_watchdog_stub() -> None:
    """Make optional `watchdog` imports deterministic during test collection.

    Several modules import `graph_watcher` at module scope. Stubbing at conftest
    time avoids an import-order-dependent `Observer is None` state when only a
    subset of files is selected.
    """
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
    watchdog.__spec__ = importlib.machinery.ModuleSpec("watchdog", None)  # type: ignore[assignment]
    observers.__spec__ = importlib.machinery.ModuleSpec("watchdog.observers", None)  # type: ignore[assignment]
    events.__spec__ = importlib.machinery.ModuleSpec("watchdog.events", None)  # type: ignore[assignment]
    sys.modules["watchdog"] = watchdog
    sys.modules["watchdog.observers"] = observers
    sys.modules["watchdog.events"] = events


_install_optional_watchdog_stub()


@pytest.fixture
def temp_wiki_dir(tmp_path):
    """Creates a temporary mock wiki directory with standard OKF v0.2 files."""
    wiki_dir = tmp_path / "wiki"
    wiki_dir.mkdir(parents=True, exist_ok=True)

    # Root index.md
    index_md = wiki_dir / "index.md"
    index_md.write_text("""---
okf_version: "0.2"
---
# Wiki Index
""", encoding="utf-8")

    # Root log.md
    log_md = wiki_dir / "log.md"
    log_md.write_text("""# OKF Log
## 2026-03-30
- Initialized OKF log.
""", encoding="utf-8")

    # Valid concept note
    concept_md = wiki_dir / "valid_concept.md"
    concept_md.write_text("""---
title: Valid Concept Note
type: Concept
status: stable
generated:
  by: human:jules
  at: "2026-03-30T10:00:00Z"
verified:
  - by: human:jules
    at: "2026-03-30T11:00:00Z"
sources:
  - resource: raw/paper.md
    author: human:researcher
---
# Valid Concept Note

This is a valid note referencing [[another_concept]].
""", encoding="utf-8")

    return wiki_dir

@pytest.fixture
def temp_config_toml(tmp_path):
    """Creates a temporary config.toml file."""
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_file = config_dir / "config.toml"
    content = """[project]
name = "test-project"
title = "Test Knowledge Base"
language = "en"

[paths]
sources = "sources"
raw = "raw"
wiki = "wiki"
output = "output"
notes = "notes"
"""
    config_file.write_text(content, encoding="utf-8")
    (tmp_path / "config.toml").write_text(content, encoding="utf-8")
    return config_file
