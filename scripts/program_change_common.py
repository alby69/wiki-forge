#!/usr/bin/env python3
"""
scripts/program_change_common.py

Shared helpers for the Fase 76 "wiki -> program change" bridge.

A program change is a set of deterministic find/replace edits targeting
repository files (docs/, src/, scripts/, config/, tests/ and a few root
Markdown files).  Edits are staged by a read-only proposal script and applied
only by a human-approved, mutating script.  Nothing here schedules or executes
an apply: the F5 Policy Agent withholds the mutating step and only an explicit
F6 approval reaches the apply script.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from actor_provenance import HUMAN_ACTOR_RE, PROCESS_ACTOR_RE

# Repo-relative prefixes that the bridge may touch. Everything else
# (.git/, .wiki-forge/, output/, projects/, node_modules/, ...) is forbidden.
ALLOWED_PREFIXES = (
    "docs/",
    "src/",
    "scripts/",
    "config/",
    "tests/",
)
ALLOWED_ROOT_FILES = ("AGENT.md", "README.md", "ROADMAP.md")

# B5: human reviewer is the default for every apply; the process variant is
# accepted only by the F6-only flag on wiki_program_change_apply.py.
REVIEWER_RE = HUMAN_ACTOR_RE
PROCESS_REVIEWER_RE = PROCESS_ACTOR_RE
DEFAULT_STAGE_DIR = "output/program-changes"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_rel(rel: str) -> str:
    """Normalise a repo-relative path; reject absolute paths and traversal."""
    if not isinstance(rel, str) or not rel.strip():
        raise ValueError("edit 'file' must be a non-empty path")
    value = rel.strip().replace("\\", "/")
    if value.startswith("/") or re.match(r"^[A-Za-z]:", value):
        raise ValueError(f"absolute paths are not allowed: {rel}")
    parts: list[str] = []
    for part in value.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise ValueError(f"path traversal is not allowed: {rel}")
        parts.append(part)
    if not parts:
        raise ValueError(f"invalid path: {rel}")
    return "/".join(parts)


def is_allowed(rel: str) -> bool:
    normalised = normalize_rel(rel)
    return normalised in ALLOWED_ROOT_FILES or any(
        normalised.startswith(prefix) for prefix in ALLOWED_PREFIXES
    )


def resolve_target(root: Path, rel: str) -> Path:
    """Return the existing target file, after allowlist and containment checks."""
    normalised = normalize_rel(rel)
    if not is_allowed(normalised):
        raise ValueError(f"path is outside the program-change allowlist: {normalised}")
    target = (root / normalised).resolve()
    root_resolved = root.resolve()
    if target == root_resolved or root_resolved not in target.parents:
        raise ValueError(f"path escapes repository root: {normalised}")
    if not target.is_file():
        raise ValueError(f"target file does not exist: {normalised}")
    return target


def _normalize_text(value: str) -> str:
    return value.replace("\r\n", "\n")


def _rtrim_lines(value: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in value.split("\n"))


def validate_edit(root: Path, edit: dict) -> dict:
    """Validate one edit and return a normalised copy with a unique match."""
    if not isinstance(edit, dict):
        raise ValueError("each edit must be an object")
    rel = normalize_rel(edit.get("file", ""))
    find = edit.get("find")
    replace = edit.get("replace")
    if not isinstance(find, str) or not find:
        raise ValueError(f"edit for {rel} has an empty 'find' block")
    if not isinstance(replace, str):
        raise ValueError(f"edit for {rel} has no 'replace' block")

    target = resolve_target(root, rel)
    haystack = _normalize_text(target.read_text(encoding="utf-8"))
    needle = _normalize_text(find).rstrip("\n")
    replacement = _normalize_text(replace)

    occurrences = haystack.count(needle)
    if occurrences == 0:
        trimmed_haystack = _rtrim_lines(haystack)
        trimmed_needle = _rtrim_lines(needle)
        if trimmed_haystack.count(trimmed_needle) == 1:
            haystack, needle = trimmed_haystack, trimmed_needle
            replacement = _rtrim_lines(replacement)
            occurrences = 1
    if occurrences == 0:
        raise ValueError(f"edit for {rel}: 'find' block not found (no exact match)")
    if occurrences > 1:
        raise ValueError(f"edit for {rel}: 'find' block is ambiguous ({occurrences} matches)")

    return {"file": rel, "find": needle, "replace": replacement}


def parse_wiki_edits(text: str) -> list[dict]:
    """Parse fenced ```wiki-edit blocks (the chat edit protocol) into edits."""
    if not text:
        return []
    edits: list[dict] = []
    for block in re.findall(r"```wiki-edit[^\n]*\r?\n([\s\S]*?)```", text):
        fields: dict[str, str] = {}
        lines = block.replace("\r\n", "\n").split("\n")
        index = 0
        while index < len(lines):
            match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$", lines[index])
            if not match:
                index += 1
                continue
            key, rest = match.group(1).lower(), match.group(2)
            if rest in ("|", "|-", "|+"):
                collected: list[str] = []
                index += 1
                while index < len(lines):
                    line = lines[index]
                    if line.strip() == "" or re.match(r"^[ \t]", line):
                        collected.append(line)
                        index += 1
                        continue
                    break
                non_empty = [line for line in collected if line.strip()]
                indent = min(
                    (len(re.match(r"^[ \t]*", line).group(0)) for line in non_empty),
                    default=0,
                )
                fields[key] = "\n".join(line[indent:] for line in collected).rstrip("\n")
            else:
                fields[key] = rest
                index += 1
        if fields.get("file", "").strip() and fields.get("find"):
            edits.append({
                "file": fields["file"].strip(),
                "find": fields["find"],
                "replace": fields.get("replace", ""),
            })
    return edits


def build_payload(root: Path, proposal: dict) -> dict:
    """Validate a proposal object and return its normalised payload.

    Raises ValueError for a malformed proposal, an out-of-scope path or an
    ambiguous/missing ``find`` block. Both the propose and apply steps use this
    exact function so the staged id is reproducible.
    """
    if not isinstance(proposal, dict):
        raise ValueError("proposal must be a JSON object")
    edits = proposal.get("edits")
    if not isinstance(edits, list) or not edits:
        raise ValueError("proposal must contain a non-empty 'edits' array")
    validated = [validate_edit(root, edit) for edit in edits]

    rationale = str(proposal.get("rationale") or "").strip()
    raw_sources = proposal.get("sources")
    sources = [str(item).strip() for item in raw_sources if str(item).strip()] if isinstance(raw_sources, list) else []
    if not rationale:
        raise ValueError("a rationale is required")
    if not sources:
        raise ValueError("at least one source is required")

    return {
        "title": str(proposal.get("title") or "Modifica al programma"),
        "rationale": rationale,
        "sources": sources,
        "project": str(proposal.get("project") or "wikiforge"),
        "edits": validated,
    }


def proposal_id(proposal: dict) -> str:
    """Stable id from the raw proposal, independent of the current file state.

    The id must stay computable after the edits have been applied (when the
    ``find`` blocks no longer match), so replay protection can check the staged
    record's status instead of failing validation first.
    """
    if not isinstance(proposal, dict):
        raise ValueError("proposal must be a JSON object")
    edits = proposal.get("edits")
    if not isinstance(edits, list):
        raise ValueError("proposal must contain an 'edits' array")
    canonical_edits: list[dict] = []
    for edit in edits:
        if not isinstance(edit, dict):
            raise ValueError("each edit must be an object")
        canonical_edits.append({
            "file": normalize_rel(edit.get("file", "")),
            "find": _normalize_text(str(edit.get("find") or "")),
            "replace": _normalize_text(str(edit.get("replace") or "")),
        })
    raw_sources = proposal.get("sources")
    canonical = {
        "title": str(proposal.get("title") or "Modifica al programma"),
        "rationale": str(proposal.get("rationale") or "").strip(),
        "sources": [str(item).strip() for item in raw_sources if str(item).strip()] if isinstance(raw_sources, list) else [],
        "project": str(proposal.get("project") or "wikiforge"),
        "edits": canonical_edits,
    }
    digest = hashlib.sha256(
        json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:12]
    return "pc-" + digest


def load_proposal(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("proposal file must contain a JSON object")
    return data


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    temp.replace(path)


def snapshot_file(root: Path, rel: str, at: str) -> str:
    """Copy the current file to .wikiforge/ before mutating it."""
    target = resolve_target(root, rel)
    stamp = at.replace(":", "-")
    snapshot = root / ".wikiforge" / "program-change-snapshots" / rel.replace("/", "__") / f"{stamp}.bak"
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_bytes(target.read_bytes())
    return snapshot.relative_to(root).as_posix()


def append_audit(root: Path, entry: dict) -> Path:
    audit = root / "output" / "program-changes" / "audit.jsonl"
    audit.parent.mkdir(parents=True, exist_ok=True)
    with audit.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return audit
