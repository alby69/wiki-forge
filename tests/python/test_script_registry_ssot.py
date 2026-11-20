"""A1/A6 — the script registry must have exactly one source of truth."""

import json
import subprocess
import sys
from pathlib import Path

from src.backend.wikiforge.core.script_schema import SCRIPT_SCHEMAS

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED_TS = REPO_ROOT / "src" / "backend" / "server" / "generated" / "scriptRegistry.generated.ts"
AGENT_SERVER_TS = REPO_ROOT / "src" / "backend" / "server" / "agentServer.ts"


def test_python_schema_has_all_29_scripts():
    assert len(SCRIPT_SCHEMAS) == 29
    for required in ("docs_wiki_drift", "wiki_program_change_propose", "wiki_program_change_apply"):
        assert required in SCRIPT_SCHEMAS


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
