"""Wire protocol shared by the FastAPI SSE stream and the Node JSON-lines bridge."""

from __future__ import annotations

import json
from typing import Any, Literal, TypedDict, Union


class ReasoningTokenFrame(TypedDict):
    token: str
    is_thinking: bool


class ReasoningDoneFrame(TypedDict):
    done: Literal[True]


class ReasoningErrorFrame(TypedDict):
    error: str


class LlamaDeltaFrame(TypedDict):
    delta: str


class LlamaErrorFrame(TypedDict):
    error: str


ReasoningFrame = Union[ReasoningTokenFrame, ReasoningDoneFrame, ReasoningErrorFrame]
LlamaFrame = Union[LlamaDeltaFrame, LlamaErrorFrame]

SAMPLE_REASONING_FRAMES: tuple[ReasoningFrame, ...] = (
    {"token": "<think>", "is_thinking": True},
    {"token": "analisi", "is_thinking": True},
    {"token": "</think>", "is_thinking": True},
    {"token": "finale", "is_thinking": False},
    {"done": True},
)
SAMPLE_LLAMA_FRAMES: tuple[LlamaFrame, ...] = (
    {"delta": "ciao"},
    {"delta": " mondo"},
    {"error": "stop"},
)


def reasoning_frame_schema() -> dict[str, Any]:
    """JSON Schema published in the OpenAPI document for the SSE endpoint."""
    return {
        "title": "ReasoningStreamFrame",
        "oneOf": [
            {
                "title": "ReasoningTokenFrame",
                "type": "object",
                "required": ["token", "is_thinking"],
                "properties": {"token": {"type": "string"}, "is_thinking": {"type": "boolean"}},
            },
            {
                "title": "ReasoningDoneFrame",
                "type": "object",
                "required": ["done"],
                "properties": {"done": {"const": True, "type": "boolean"}},
            },
            {
                "title": "ReasoningErrorFrame",
                "type": "object",
                "required": ["error"],
                "properties": {"error": {"type": "string"}},
            },
        ],
    }


def is_reasoning_frame(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    keys = set(value)
    if keys == {"token", "is_thinking"}:
        return isinstance(value["token"], str) and isinstance(value["is_thinking"], bool)
    if keys == {"done"}:
        return value["done"] is True
    if keys == {"error"}:
        return isinstance(value["error"], str)
    return False


def is_llama_frame(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    keys = set(value)
    if keys == {"delta"}:
        return isinstance(value["delta"], str)
    if keys == {"error"}:
        return isinstance(value["error"], str)
    return False


def _json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def format_sse_frame(frame: ReasoningFrame) -> str:
    return f"data: {_json(dict(frame))}\n\n"


def reasoning_token_frame(token: str, is_thinking: bool) -> ReasoningTokenFrame:
    return {"token": token, "is_thinking": is_thinking}


def reasoning_done_frame() -> ReasoningDoneFrame:
    return {"done": True}


def reasoning_error_frame(message: str) -> ReasoningErrorFrame:
    return {"error": message}


def format_llama_frame(frame: LlamaFrame) -> str:
    return _json(dict(frame)) + "\n"


def llama_delta_frame(delta: str) -> LlamaDeltaFrame:
    return {"delta": delta}


def llama_error_frame(message: str) -> LlamaErrorFrame:
    return {"error": message}
