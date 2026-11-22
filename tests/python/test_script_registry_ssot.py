"""A1/A6 — the script registry must have exactly one source of truth."""

import json
import subprocess
import sys
from pathlib import Path

from src.backend.wikiforge.core.script_schema import SCRIPT_AUTOMATION, SCRIPT_SCHEMAS

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED_TS = REPO_ROOT / "src" / "backend" / "server" / "generated" / "scriptRegistry.generated.ts"
AGENT_SERVER_TS = REPO_ROOT / "src" / "backend" / "server" / "agentServer.ts"


def test_python_schema_has_all_29_scripts():
    assert len(SCRIPT_SCHEMAS) == 29
    for required in ("docs_wiki_drift", "wiki_program_change_propose", "wiki_program_change_apply"):
        assert required in SCRIPT_SCHEMAS


def test_every_script_has_automation_metadata():
    assert set(SCRIPT_AUTOMATION) == set(SCRIPT_SCHEMAS)
    valid_safety = {"read-only", "report", "workspace", "wiki-write", "blocked"}
    for script_id, schema in SCRIPT_SCHEMAS.items():
        auto = schema["automation"]
        assert auto["safety"] in valid_safety
        assert isinstance(auto["schedulable"], bool)
        assert isinstance(auto["enabledDefault"], bool)
        assert isinstance(auto["defaultArgs"], dict)
        assert isinstance(auto["requires"], list)
        assert auto["notes"].strip()
        known_params = {param["name"] for param in schema["parameters"]}
        assert set(auto["defaultArgs"]).issubset(known_params)
        for rule in auto.get("argSafety", []):
            assert rule["safety"] in valid_safety
            assert rule["when"], "argSafety rules need at least one arg"
            assert set(rule["when"]).issubset(known_params)
            assert auto["safety"] != "blocked", "blocked scripts need no override"
        if auto["safety"] == "blocked":
            assert auto["schedulable"] is False
        else:
            assert auto["defaultSchedule"]


def test_arg_safety_overrides_are_in_the_ssot():
    """Arg-aware classification stays derived from SCRIPT_SCHEMAS (S1)."""
    assert SCRIPT_AUTOMATION["docs_wiki_drift"]["argSafety"] == [
        {"when": {"check": True}, "safety": "read-only"}
    ]
    assert SCRIPT_AUTOMATION["check_docs_sync"]["argSafety"] == [
        {"when": {"fix": True}, "safety": "workspace"}
    ]
    assert SCRIPT_AUTOMATION["wiki_program_change_apply"].get("argSafety", []) == []


def test_safety_catalog_doc_is_generated():
    doc = REPO_ROOT / "docs" / "SCRIPT_AUTOMATION_REFERENCE.md"
    assert doc.is_file()
    content = doc.read_text(encoding="utf-8")
    assert "<!-- DOC_BLOCK:script-automation -->" in content
    for script_id in SCRIPT_SCHEMAS:
        assert f"`{script_id}`" in content


def test_generated_registry_is_in_sync():
    proc = subprocess.run(
        [sys.executable, "scripts/gen_script_registry.py", "--check"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr


def test_generated_ts_contains_every_schema_id():
    content = GENERATED_TS.read_text(encoding="utf-8")
    for script_id in SCRIPT_SCHEMAS:
        assert f'"{script_id}":' in content


def test_agent_server_no_longer_duplicates_the_registry_literal():
    source = AGENT_SERVER_TS.read_text(encoding="utf-8")
    assert "export const SCRIPT_REGISTRY: Record<string, ScriptDef> = {" not in source
    assert "GENERATED_SCRIPT_REGISTRY" in source


def test_each_script_file_referenced_by_a_schema_exists():
    for script_id, schema in SCRIPT_SCHEMAS.items():
        path = REPO_ROOT / schema["path"]
        assert path.is_file(), f"{script_id}: missing {path}"
        assert schema["id"] == script_id


def test_per_script_json_schema_contract_still_works():
    """The generated registry is the API source, but scripts can still answer --json-schema."""
    proc = subprocess.run(
        [sys.executable, "scripts/conv2md.py", "--json-schema"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload == SCRIPT_SCHEMAS["conv2md"]
