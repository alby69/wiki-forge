"""Tests for the lazy CPU-only local reasoning engine and SSE router."""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.backend.wikiforge.api import reasoning_router
from src.backend.wikiforge.llm.local_engine import LocalReasoningError, LocalReasoningEngine


def test_engine_is_lazy_and_disabled_by_default(tmp_path: Path) -> None:
    engine = LocalReasoningEngine({}, repo_root=tmp_path)

    assert engine._llm is None
    with pytest.raises(LocalReasoningError, match="non è abilitato"):
        next(engine.generate_stream("prompt"))


def test_engine_reports_missing_gguf_model(tmp_path: Path) -> None:
    engine = LocalReasoningEngine({"enabled": True, "model_path": "models/missing.gguf"}, repo_root=tmp_path)

    with pytest.raises(LocalReasoningError, match="File GGUF"):
        next(engine.generate_stream("prompt"))


def test_engine_streams_tokens_and_forces_cpu(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    model = tmp_path / "model.gguf"
    model.write_bytes(b"gguf")
    captured: dict[str, object] = {}

    module = types.ModuleType("llama_cpp")

    class FakeLlama:
        def __init__(self, **kwargs: object) -> None:
            captured.update(kwargs)

        def create_chat_completion(self, **kwargs: object):
            captured["messages"] = kwargs.get("messages")
            captured["temperature"] = kwargs.get("temperature")
            for token in ("<think>", "check", "</think>", "finale"):
                yield {"choices": [{"delta": {"content": token}}]}

    module.Llama = FakeLlama
    monkeypatch.setitem(sys.modules, "llama_cpp", module)

    engine = LocalReasoningEngine(
        {"enabled": True, "model_path": str(model), "n_gpu_layers": 99, "temperature": 0.2},
        repo_root=tmp_path,
    )

    assert list(engine.generate_stream("Analizza la nota", 32)) == [
        "<think>", "check", "</think>", "finale"
    ]
    assert captured["n_gpu_layers"] == 0
    assert captured["temperature"] == 0.2
    messages = captured["messages"]
    assert isinstance(messages, list)
    assert "<think>" in messages[0]["content"]


def test_reasoning_router_emits_sse_frames(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeEngine:
        def __init__(self, config: dict, repo_root: Path) -> None:
            self.config = config

        def generate_stream(self, prompt: str, max_tokens: int, context: str | None = None):
            assert prompt == "Analizza"
            assert max_tokens == 16
            assert context == "contesto"
            yield "<think>"
            yield "valutazione"
            yield "</think>"
            yield "critica"

    monkeypatch.setattr(reasoning_router, "LocalReasoningEngine", FakeEngine)
    client = TestClient(_app_with_router())

    response = client.post(
        "/api/v1/llm/reasoning/stream",
        json={"prompt": "Analizza", "context": "contesto", "max_tokens": 16},
    )

    assert response.status_code == 200
    frames = [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")]
    assert frames[0] == {"token": "<think>", "is_thinking": True}
    assert frames[1] == {"token": "valutazione", "is_thinking": True}
    assert frames[2] == {"token": "</think>", "is_thinking": True}
    assert frames[3] == {"token": "critica", "is_thinking": False}
    assert frames[4] == {"done": True}


def _app_with_router():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(reasoning_router.router)
    return app
