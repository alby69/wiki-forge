from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Iterable

import yaml

from ..core.findings import Finding, findings_envelope, make_finding, print_findings
from .base_parser import slugify

LINK_RE = re.compile(r"\[\[(?:([^\]:]+)::)?([^\]|]+)(?:\|[^\]]*)?\]\]")
RESERVED = {"index.md"}


def parse_frontmatter(content: str) -> dict:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?", content, re.DOTALL)
    if not match:
        return {}
    try:
        return yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        return {}


def _candidate_slugs(relative: Path) -> set[str]:
    without_suffix = relative.with_suffix("").as_posix()
    return {slugify(without_suffix), slugify(relative.stem)}


def _iter_notes(wiki_root: Path) -> list[Path]:
    return sorted(
        (path for path in wiki_root.rglob("*.md") if path.name not in RESERVED),
        key=lambda path: path.as_posix(),
    )


def _link_targets(content: str) -> Iterable[str]:
    for match in LINK_RE.finditer(content):
        target = match.group(2).strip()
        if not target or target.startswith(("http://", "https://", "mailto:")):
            continue
        yield target.split("#", 1)[0].removesuffix(".md")


def find_orphan_findings(wiki_root: Path, wiki_rel: str = "wiki") -> list[Finding]:
    notes = _iter_notes(wiki_root)
    existing: set[str] = set()
    for note in notes:
        existing.update(_candidate_slugs(note.relative_to(wiki_root)))

    missing: dict[str, list[str]] = defaultdict(list)
    for note in notes:
        relative = note.relative_to(wiki_root).as_posix()
        content = note.read_text(encoding="utf-8")
        for raw_target in _link_targets(content):
            slug = slugify(raw_target)
            if slug and slug not in existing:
                missing[slug].append(relative)

    findings: list[Finding] = []
    for slug in sorted(missing):
        sources = sorted(set(missing[slug]))
        findings.append(
            make_finding(
                kind="orphan_node",
                confidence=0.92,
                evidence=[f"source={wiki_rel}/{source}" for source in sources] + [f"target={slug}"],
                targetPath=f"{wiki_rel}/{slug}.md",
                proposedAction="repair-orphan",
                slug_source=slug,
            )
        )
    return findings


def find_inconsistency_findings(wiki_root: Path, wiki_rel: str = "wiki") -> list[Finding]:
    findings: list[Finding] = []
    for note in _iter_notes(wiki_root):
        content = note.read_text(encoding="utf-8")
        frontmatter = parse_frontmatter(content)
        relative = note.relative_to(wiki_root).as_posix()
        if not frontmatter.get("type"):
            findings.append(
                make_finding(
                    kind="inconsistency",
                    confidence=1.0,
                    evidence=[f"{relative}: Missing or empty REQUIRED 'type' field in frontmatter."],
                    targetPath=f"{wiki_rel}/{relative}",
                    proposedAction="fix-okf-frontmatter",
                )
            )
        status = frontmatter.get("status", "stable")
        if status not in ("draft", "stable", "deprecated"):
            findings.append(
                make_finding(
                    kind="inconsistency",
                    confidence=1.0,
                    evidence=[f"{relative}: Invalid 'status': '{status}'."],
                    targetPath=f"{wiki_rel}/{relative}",
                    proposedAction="fix-okf-frontmatter",
                )
            )
    return findings


def collect_findings(wiki_root: Path, wiki_rel: str = "wiki") -> list[Finding]:
    findings = find_orphan_findings(wiki_root, wiki_rel)
    findings.extend(find_inconsistency_findings(wiki_root, wiki_rel))
    return sorted(findings, key=lambda finding: finding.findingId)


def main() -> None:
    parser = argparse.ArgumentParser(description="Deterministic A5 repair planner (read-only)")
    parser.add_argument("--wiki-dir", default="wiki")
    parser.add_argument("--wiki-rel", default="wiki")
    parser.add_argument("--findings", action="store_true")
    args = parser.parse_args()
    findings = collect_findings(Path(args.wiki_dir), args.wiki_rel)
    if args.findings:
        print_findings(findings)
        return
    print(json.dumps(findings_envelope(findings), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
