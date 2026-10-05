import os
import tempfile
import pytest
from pathlib import Path

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
    config_file = tmp_path / "config.toml"
    config_file.write_text("""[project]
name = "test-project"
title = "Test Knowledge Base"
language = "en"

[paths]
sources = "sources"
raw = "raw"
wiki = "wiki"
output = "output"
notes = "notes"
""", encoding="utf-8")
    return config_file
