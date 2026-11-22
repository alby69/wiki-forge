#!/usr/bin/env python3
"""
scripts/actor_provenance.py

B5 — canonical provenance actor shared by the Python write paths.

Python mirror of `src/backend/server/auth/actor.ts`. The accepted syntax is the
OKF v0.2 convention also enforced by `okf_lint.py`: `human:<id>`,
`process:<id>` or `<producer>/<version>`. Scripts that require a *human*
reviewer use HUMAN_ACTOR_RE; scripts reached from a server-trusted F6 approval
may additionally accept a canonical `process:<id>` when explicitly enabled.
"""

from __future__ import annotations

import re

ACTOR_RE = re.compile(
    r"^(human:[a-zA-Z0-9_-]+|process:[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)$"
)
HUMAN_ACTOR_RE = re.compile(r"^human:[a-zA-Z0-9_-]+$")
PROCESS_ACTOR_RE = re.compile(r"^process:[a-zA-Z0-9_-]+$")
PROCESS_FALLBACK_ACTOR = "process:api-token"


def is_canonical_actor(value: object) -> bool:
    return isinstance(value, str) and bool(ACTOR_RE.match(value.strip()))


def actor_kind(actor: str) -> str:
    """Return 'human', 'process' or 'producer' for a canonical actor."""
    if HUMAN_ACTOR_RE.match(actor):
        return "human"
    if PROCESS_ACTOR_RE.match(actor):
        return "process"
    return "producer"


def canonical_actor(value: object, fallback: str = PROCESS_FALLBACK_ACTOR) -> str:
    """Normalise a server-derived actor; invalid values fail closed."""
    safe_fallback = fallback.strip() if is_canonical_actor(fallback) else PROCESS_FALLBACK_ACTOR
    if not isinstance(value, str):
        return safe_fallback
    raw = value.strip()
    if is_canonical_actor(raw):
        return raw
    prefix = re.match(r"^(human|process):", raw, re.IGNORECASE)
    if not prefix:
        return safe_fallback
    actor_id = re.sub(r"[^a-zA-Z0-9_-]", "-", raw[len(prefix.group(0)):])
    actor_id = re.sub(r"-+", "-", actor_id).strip("-")
    return f"{prefix.group(1).lower()}:{actor_id}" if actor_id else safe_fallback
