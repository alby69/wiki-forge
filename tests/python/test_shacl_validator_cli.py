from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_shacl_cli_emits_json_and_fails_closed(tmp_path: Path) -> None:
    wiki = tmp_path / "wiki"
    wiki.mkdir()
    (wiki / "valid.md").write_text(
        "---\ntitle: Valid Note\ntype: Concept\nstatus: draft\nauthor: human:tester\n---\n\n"
        "# Valid Note\n\nBody.\n",
        encoding="utf-8",
    )

    command = [
        sys.executable,
        "-W",
        "ignore",
        "-m",
        "src.backend.wikiforge.semantics.shacl_validator",
        "--wiki-dir",
        str(wiki),
    ]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["conforms"] is True
    assert payload["violations"] == []

    missing = subprocess.run(
        [*command, "--shapes", str(tmp_path / "missing.ttl")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert missing.returncode == 1
    failed = json.loads(missing.stdout)
    assert failed["conforms"] is False
    assert "not found" in failed["error"]
