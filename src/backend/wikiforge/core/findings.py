"""A1 — unified, read-only ``Finding`` model for all Wiki-Forge detectors.

A ``Finding`` is advisory data: it never edits a note, stages a changeset or
starts a job. Detectors convert their existing structured output into this one
shape and emit the same JSON envelope via ``--findings``. That flag is strictly
read-only; the legacy ``--json`` output (and the CQ report it still writes) is
left byte-for-byte unchanged.

IDs are deterministic: ``<kind>-<slug>-<hash>``, where the hash covers the
canonical evidence payload (target and proposed action included). The same
input always yields the same id, across runs and across detectors.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

FINDINGS_SCHEMA = "wikiforge.finding/v1"

VALID_KINDS = (
    "knowledge_gap",
    "orphan_node",
    "inconsistency",
    "odp_suggestion",
)


@dataclass(frozen=True)
class Finding:
    """One advisory observation, transport-only and immutable."""

    findingId: str
    kind: str
    confidence: float
    evidence: tuple[str, ...]
    targetPath: str
    proposedAction: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "findingId": self.findingId,
            "kind": self.kind,
            "confidence": self.confidence,
            "evidence": list(self.evidence),
            "targetPath": self.targetPath,
            "proposedAction": self.proposedAction,
        }


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (slug[:48] or "unknown").rstrip("-")


def _canonical_evidence(
    evidence: Sequence[str],
    target_path: str,
    proposed_action: str,
) -> tuple[str, ...]:
    # Sorting and de-duplicating makes the hash independent of detector
    # iteration order (filesystem walks, set(), networkx edges, ...).
    items = {str(item).strip() for item in evidence if str(item).strip()}
    items.add(f"target={target_path}")
    items.add(f"action={proposed_action}")
    return tuple(sorted(items))


def make_finding(
    kind: str,
    *,
    confidence: float,
    evidence: Sequence[str],
    targetPath: str,
    proposedAction: str,
    slug_source: str | None = None,
) -> Finding:
    """Build a validated finding with a deterministic, unique id."""

    if kind not in VALID_KINDS:
        raise ValueError(f"Unsupported finding kind: {kind!r}")
    if not 0.0 <= float(confidence) <= 1.0:
        raise ValueError(f"confidence must be between 0 and 1, got {confidence!r}")
    target = str(targetPath).strip() or "unknown"
    action = str(proposedAction).strip()
    if not action:
        raise ValueError("proposedAction must not be empty")
    if not [item for item in evidence if str(item).strip()]:
        raise ValueError("evidence must not be empty")

    canonical = _canonical_evidence(evidence, target, action)

    digest = hashlib.sha256(
        json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:12]
    slug = _slugify(str(slug_source or target))
    return Finding(
        findingId=f"{kind}-{slug}-{digest}",
        kind=kind,
        confidence=float(confidence),
        evidence=canonical,
        targetPath=target,
        proposedAction=action,
    )


def findings_envelope(findings: Iterable[Finding]) -> dict[str, Any]:
    """The single JSON shape emitted by every detector's ``--findings`` flag."""

    items = [finding.to_dict() for finding in findings]
    return {
        "schema": FINDINGS_SCHEMA,
        "count": len(items),
        "findings": items,
    }


def print_findings(findings: Iterable[Finding]) -> None:
    """Print the envelope on stdout. No file is opened for writing."""

    print(json.dumps(findings_envelope(findings), indent=2, sort_keys=True))
