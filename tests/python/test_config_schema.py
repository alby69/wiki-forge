"""A8 — config.toml must be validated against one declarative schema."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from src.backend.wikiforge.core.config import ConfigError, get_project_config
from src.backend.wikiforge.core.config_schema import (
    CONFIG_SCHEMA,
    validate_config_file,
    validate_config_shape,
)

REPO_CONFIG = Path(__file__).resolve().parents[2] / "config" / "config.toml"
FIXTURE_CONFIG = Path(__file__).resolve().parents[1] / "fixtures" / "ke_wiki" / "config.toml"


def test_schema_is_a_single_declarative_source():
    for section in ("project", "paths", "conversion", "audio", "agent", "okf"):
        assert section in CONFIG_SCHEMA


def test_real_and_fixture_configs_are_valid():
    assert validate_config_file(REPO_CONFIG) == []
    assert validate_config_file(FIXTURE_CONFIG) == []


def test_unknown_sections_are_tolerated():
    problems = validate_config_shape({"project": {"name": "x"}, "future": {"a": 1}})
    assert problems == []


def test_wrong_scalar_type_is_reported_with_path():
    data = {"project": {"name": 123}}
    problems = validate_config_shape(data, source="custom.toml")
    assert len(problems) == 1
    assert "custom.toml.project.name" in problems[0]
    assert "expected str, got int" in problems[0]


def test_table_expected_but_scalar_given():
    problems = validate_config_shape({"paths": "wiki"})
    assert any("paths: expected table, got str" in p for p in problems)


def test_all_path_values_must_be_strings():
    problems = validate_config_shape({"paths": {"wiki": "wiki", "output": 5}})
    assert any("paths.output: expected str, got int" in p for p in problems)


def test_bool_is_not_accepted_as_int():
    problems = validate_config_shape(
        {"agent": {"llm": {"max_tokens": True}}}
    )
    assert any("max_tokens: expected int, got bool" in p for p in problems)


def test_list_item_types_are_validated():
    problems = validate_config_shape(
        {"agent": {"llm": {"opencode_args": ["run", 7]}}}
    )
    assert any("opencode_args[1]: expected str, got int" in p for p in problems)


def test_nested_table_items_are_validated():
    problems = validate_config_shape(
        {
            "okf": {
                "migration": {
                    "folder_type_map": [{"folder": "papers", "type": 1}]
                }
            }
        }
    )
    assert any("folder_type_map[0].type: expected str, got int" in p for p in problems)


def test_root_must_be_a_table():
    assert validate_config_shape(["not", "a", "table"])[0].endswith(
        "root must be a TOML table, got list"
    )


def test_get_project_config_raises_on_invalid_shape(tmp_path):
    cfg_dir = tmp_path / "config"
    cfg_dir.mkdir()
    (cfg_dir / "config.toml").write_text(
        '[project]\nname = 42\n[paths]\nwiki = "wiki"\n', encoding="utf-8"
    )
    with pytest.raises(ConfigError, match="Invalid configuration"):
        get_project_config(tmp_path)


def test_cli_contract_is_reusable_from_node(tmp_path):
    bad = tmp_path / "bad.toml"
    bad.write_text('[project]\nname = 7\n', encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, "-m", "src.backend.wikiforge.core.config_schema", str(bad)],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).resolve().parents[2]),
    )
    assert proc.returncode == 1
    payload = json.loads(proc.stdout)
    assert payload["file"] == str(bad)
    assert payload["valid"] is False
    assert any("project.name" in p for p in payload["problems"])
