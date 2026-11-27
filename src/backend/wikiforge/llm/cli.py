"""JSON-lines bridge from the Node LlmClient to the local reasoning engine."""

from __future__ import annotations

import json
import sys
from typing import Any

from src.backend.wikiforge.api.stream_protocol import (
    format_llama_frame,
    llama_delta_frame,
    llama_error_frame,
)
from src.backend.wikiforge.core.config import get_project_config, get_repo_root
from src.backend.wikiforge.llm.local_engine import LocalReasoningEngine, LocalReasoningError


def _context_text(notes: list[dict[str, Any]]) -> str:
    blocks = []
    for note in notes:
        title = note.get("title") or note.get("id") or "nota"
        path = note.get("path") or ""
        content = note.get("content") or ""
        header = f"[[{title}]]" + (f" ({path})" if path else "")
        blocks.append(f"{header}\n{content}".strip())
    return "\n\n".join(blocks)


def main() -> int:
    try:
        line = sys.stdin.readline()
        if not line.strip():
            return 0
        payload = json.loads(line)
        config = get_project_config()
        local_config = config.get("llm", {}).get("local", {})
        max_tokens = int(payload.get("maxTokens") or config.get("agent", {}).get("llm", {}).get("max_tokens") or 512)
        engine = LocalReasoningEngine(local_config, repo_root=get_repo_root())

        system_prompt = str(payload.get("systemPrompt") or "").strip()
        user_message = str(payload.get("userMessage") or "").strip()
        prompt = f"{system_prompt}\n\n{user_message}" if system_prompt else user_message
        context = _context_text(list(payload.get("contextNotes") or []))

        for token in engine.generate_stream(prompt, max_tokens=max_tokens, context=context):
            frame = llama_delta_frame(token)
            sys.stdout.write(format_llama_frame(frame))
            sys.stdout.flush()
        return 0
    except (OSError, ValueError, LocalReasoningError) as exc:
        frame = llama_error_frame(str(exc))
        sys.stdout.write(format_llama_frame(frame))
        sys.stdout.flush()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
