"""Contract tests for the frames shared with src/shared/api/pythonStream.ts."""

from __future__ import annotations

import io
import json
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.backend.wikiforge.api import reasoning_router, stream_protocol
from src.backend.wikiforge.llm import cli

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "python_stream_frames.json"
SPEC = REPO_ROOT / "src" / "shared" / "api" / "generated" / "python.openapi.json"


def fixture() -> dict[str, object]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_fixture_frames_are_valid_and_formatted_identically() -> None:
    data = fixture()
    reasoning = list(data["reasoning_frames"])
    llama = list(data["llama_frames"])
    assert all(stream_protocol.is_reasoning_frame(frame) for frame in reasoning)
    assert all(stream_protocol.is_llama_frame(frame) for frame in llama)
    assert stream_protocol.is_reasoning_frame(data["reasoning_error"])
    assert [stream_protocol.format_sse_frame(frame) for frame in reasoning] == data["reasoning_sse"]
    assert [stream_protocol.format_llama_frame(frame) for frame in llama] == data["llama_jsonl"]
    assert stream_protocol.SAMPLE_REASONING_FRAMES == tuple(reasoning)
    assert stream_protocol.SAMPLE_LLAMA_FRAMES == tuple(llama)


def test_protocol_rejects_wire_frames_changed_by_the_other_side() -> None:
    assert not stream_protocol.is_reasoning_frame({"token": "x"})
    assert not stream_protocol.is_reasoning_frame({"content": "x", "is_thinking": True})
    assert not stream_protocol.is_reasoning_frame({"token": "x", "is_thinking": "yes"})
    assert not stream_protocol.is_reasoning_frame({"done": 1})
    assert not stream_protocol.is_reasoning_frame({"error": 1})
    assert not stream_protocol.is_reasoning_frame({"token": "x", "is_thinking": True, "extra": 1})
    assert not stream_protocol.is_llama_frame({"delta": 1})
    assert not stream_protocol.is_llama_frame({"delta": "x", "error": "stop"})
    assert not stream_protocol.is_llama_frame("ciao")


def test_reasoning_router_emits_protocol_frames(monkeypatch: pytest.MonkeyPatch) -> None:
    data = fixture()
    tokens = [frame["token"] for frame in data["reasoning_frames"][:4]]

    class FakeEngine:
        def __init__(self, config: dict, repo_root: Path) -> None:
            self.config = config

        def generate_stream(self, prompt: str, max_tokens: int, context: str | None = None):
            yield from tokens

    monkeypatch.setattr(reasoning_router, "LocalReasoningEngine", FakeEngine)
    app = FastAPI()
    app.include_router(reasoning_router.router)
    response = TestClient(app).post("/api/v1/llm/reasoning/stream", json={"prompt": "Analizza"})

    assert response.status_code == 200
    assert response.text == "".join(list(data["reasoning_sse"]))


def test_llama_cli_emits_protocol_json_lines(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    data = fixture()

    class FakeEngine:
        def __init__(self, config: dict, repo_root: Path) -> None:
            self.config = config

        def generate_stream(self, prompt: str, max_tokens: int, context: str | None = None):
            yield "ciao"
            yield " mondo"

    monkeypatch.setattr(cli, "LocalReasoningEngine", FakeEngine)
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps({
        "systemPrompt": "sistema",
        "userMessage": "ciao",
        "contextNotes": [],
        "maxTokens": 16,
    })))

    assert cli.main() == 0
    assert capsys.readouterr().out == "".join(list(data["llama_jsonl"])[:2])


def test_renamed_exported_response_field_fails_contract_check(tmp_path: Path) -> None:
    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    properties = spec["components"]["schemas"]["SyncResponse"]["properties"]
    properties["processed_notes_count"] = properties.pop("processed_notes")
    target = tmp_path / "python.openapi.json"
    target.write_text(json.dumps(spec, indent=2, sort_keys=True), encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "scripts/export_python_openapi.py", "--check", "--output", str(target)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "does not match the FastAPI app" in result.stderr
