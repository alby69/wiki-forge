"""FastAPI SSE endpoint for the local llama-cpp reasoning engine."""

from __future__ import annotations

from typing import Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.backend.wikiforge.api.stream_protocol import (
    format_sse_frame,
    reasoning_done_frame,
    reasoning_error_frame,
    reasoning_frame_schema,
    reasoning_token_frame,
)
from src.backend.wikiforge.core.config import get_project_config, get_repo_root
from src.backend.wikiforge.llm.local_engine import LocalReasoningEngine, LocalReasoningError

router = APIRouter(tags=["LLM"])


class ReasoningRequest(BaseModel):
    prompt: str
    context: str | None = None
    max_tokens: int = Field(default=512, ge=1, le=8192)


def _thinking_state(token: str, current: bool) -> tuple[bool, bool]:
    if "</think>" in token:
        return True, False
    if "<think>" in token:
        return True, True
    return current, current


def stream_reasoning(request: ReasoningRequest) -> Iterator[str]:
    config = get_project_config()
    local_config = config.get("llm", {}).get("local", {})
    engine = LocalReasoningEngine(local_config, repo_root=get_repo_root())

    thinking = False
    try:
        for token in engine.generate_stream(request.prompt, request.max_tokens, request.context):
            emitted_thinking, thinking = _thinking_state(token, thinking)
            yield format_sse_frame(reasoning_token_frame(token, emitted_thinking))
        yield format_sse_frame(reasoning_done_frame())
    except LocalReasoningError as exc:
        yield format_sse_frame(reasoning_error_frame(str(exc)))


@router.post(
    "/api/v1/llm/reasoning/stream",
    responses={
        200: {
            "description": "SSE token stream",
            "content": {"text/event-stream": {"schema": reasoning_frame_schema()}},
        }
    },
)
def reasoning_stream(request: ReasoningRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_reasoning(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
