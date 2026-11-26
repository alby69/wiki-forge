#!/usr/bin/env python3
"""Build a single printable Markdown manual from the docs/ didactic path."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import sys
from pathlib import Path

from okf_common import repo_root

PATH_HEADING = "## Percorso didattico"
TABLE_ROW_RE = re.compile(r"^\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|")
FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
LINK_RE = re.compile(r"(!?)\[([^\]]*)\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})(\s+.*)$")
FENCE_RE = re.compile(r"^\s*(```+|~~~+)")
CODE_SPAN_RE = re.compile(r"`[^`]*`")

DEFAULT_OUTPUT = Path("output") / "manuale-wiki-forge.md"


def parse_path(docs_dir: Path) -> list[tuple[int, str, Path]]:
    text = (docs_dir / "README.md").read_text(encoding="utf-8")
    lines = text.splitlines()
    try:
        start = next(i for i, line in enumerate(lines) if line.strip() == PATH_HEADING)
    except StopIteration as exc:
        raise ValueError(f"{docs_dir / 'README.md'}: missing '{PATH_HEADING}'") from exc

    end = next(
        (i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")),
        len(lines),
    )
    entries: list[tuple[int, str, Path]] = []
    for line in lines[start + 1 : end]:
        match = TABLE_ROW_RE.match(line.strip())
        if not match:
            continue
        number, label, target = int(match.group(1)), match.group(2), match.group(3).split()[0]
        source = (docs_dir / target).resolve()
        if source.suffix.lower() != ".md":
            raise ValueError(f"row {number}: not a Markdown source: {target}")
        if not source.is_file():
            raise ValueError(f"row {number}: missing source: {source}")
        entries.append((number, label, source))

    if not entries:
        raise ValueError(f"{docs_dir / 'README.md'}: empty '{PATH_HEADING}' table")
    expected = list(range(1, len(entries) + 1))
    actual = [number for number, _, _ in entries]
    if actual != expected:
        raise ValueError(f"didactic path must be numbered {expected}, got {actual}")
    return entries


def _strip_frontmatter(content: str) -> str:
    text = content.lstrip("\ufeff\r\n\t ")
    match = FRONTMATTER_RE.match(text)
    return text[match.end() :] if match else text


def _without_first_heading(lines: list[str]) -> list[str]:
    for index, line in enumerate(lines):
        if line.startswith("# "):
            return lines[:index] + lines[index + 1 :]
    return lines


def _shift_headings(lines: list[str], amount: int) -> list[str]:
    out: list[str] = []
    fence: str | None = None
    for line in lines:
        match = FENCE_RE.match(line)
        if match:
            marker = match.group(1)[:3]
            if fence is None:
                fence = marker
            elif marker == fence:
                fence = None
            out.append(line)
            continue
        if fence is None:
            heading = HEADING_RE.match(line)
            if heading:
                level = min(6, len(heading.group(1)) + amount)
                line = "#" * level + heading.group(2)
        out.append(line)
    return out


def _link_replacer(
    root: Path,
    source_dir: str,
    anchors: dict[str, str],
) -> object:
    def replace(match: re.Match[str]) -> str:
        bang, label, raw_target = match.group(1), match.group(2), match.group(3).strip()
        target = raw_target.split()[0] if raw_target else ""
        if not target or target.startswith(("http://", "https://", "mailto:", "#")):
            return match.group(0)
        if target.startswith("<") and target.endswith(">"):
            target = target[1:]

        path_part, sep, anchor = target.partition("#")
        if not path_part:
            return match.group(0)
        resolved = posixpath.normpath(posixpath.join(source_dir, path_part))
        suffix = "#" + anchor if sep and anchor else ""

        if bang:
            if not (root / resolved).is_file():
                return match.group(0)
            return f"![{label}](../{resolved}{suffix})"

        mapped_anchor = anchors.get(resolved)
        if mapped_anchor:
            return f"[{label}](#{mapped_anchor})"
        if posixpath.splitext(resolved)[1].lower() == ".md":
            return f"{label} (`{resolved}`)"
        if (root / resolved).is_file():
            return f"[{label}](../{resolved}{suffix})"
        return label

    return replace


def _rewrite_line(
    line: str,
    root: Path,
    source_dir: str,
    anchors: dict[str, str],
) -> str:
    spans: list[str] = []

    def mask(match: re.Match[str]) -> str:
        spans.append(match.group(0))
        return f"\x00{len(spans) - 1}\x00"

    masked = CODE_SPAN_RE.sub(mask, line)
    masked = LINK_RE.sub(_link_replacer(root, source_dir, anchors), masked)
    for index, span in enumerate(spans):
        masked = masked.replace(f"\x00{index}\x00", span)
    return masked


def _document_lines(
    root: Path,
    source: Path,
    anchors: dict[str, str],
) -> list[str]:
    rel = source.relative_to(root).as_posix()
    body = _strip_frontmatter(source.read_text(encoding="utf-8"))
    lines = _without_first_heading(body.splitlines())
    lines = _shift_headings(lines, 1)
    source_dir = posixpath.dirname(rel)
    return [
        _rewrite_line(line, root, source_dir, anchors) if not FENCE_RE.match(line) else line
        for line in lines
    ]


def build_book(root: Path, docs_dir: Path) -> str:
    entries = parse_path(docs_dir)
    anchors = {
        source.relative_to(root).as_posix(): f"doc-{number}"
        for number, _, source in entries
    }

    version = "0.0.0"
    package_path = root / "package.json"
    if package_path.is_file():
        version = json.loads(package_path.read_text(encoding="utf-8")).get("version", version)

    out = [
        f"# Manuale Wiki-Forge v{version}",
        "",
        "> Generato da `scripts/docs_book.py` dal percorso didattico in `docs/README.md`. "
        "Non modificare a mano.",
        "",
        "## Indice",
        "",
    ]
    out += [f"{number}. [{label}](#doc-{number})" for number, label, _ in entries]
    out += ["", "---", ""]

    for number, label, source in entries:
        rel = source.relative_to(root).as_posix()
        out += [
            f'<a id="doc-{number}"></a>',
            "",
            f"## {number}. {label}",
            "",
            f"**Fonte**: `{rel}`",
            "",
        ]
        out += _document_lines(root, source, anchors)
        out += ["", "---", ""]

    return "\n".join(out).rstrip() + "\n"


def write_book(root: Path, docs_dir: Path, output: Path) -> str:
    content = build_book(root, docs_dir)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    return content


def check_book(root: Path, docs_dir: Path, output: Path) -> list[str]:
    if not output.is_file():
        return [f"missing: {output.relative_to(root)}"]
    if output.read_text(encoding="utf-8") != build_book(root, docs_dir):
        return [f"changed: {output.relative_to(root)}"]
    return []


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(repo_root()))
    parser.add_argument("--docs-dir", default=None)
    parser.add_argument("--output", default=None)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    docs_dir = Path(args.docs_dir).resolve() if args.docs_dir else root / "docs"
    output = Path(args.output).resolve() if args.output else root / DEFAULT_OUTPUT

    try:
        entries = parse_path(docs_dir)
        if args.check:
            errors = check_book(root, docs_dir, output)
        else:
            write_book(root, docs_dir, output)
            errors = check_book(root, docs_dir, output)
    except (OSError, ValueError) as exc:
        errors = [str(exc)]

    payload = {
        "status": "success" if not errors else "error",
        "docs": len(entries) if "entries" in locals() else 0,
        "output": str(output),
        "errors": errors,
    }
    if args.json:
        print(json.dumps(payload))
    elif errors:
        print("❌ docs_book verification failed:\n\n  - " + "\n  - ".join(errors))
    else:
        print(f"[OK] docs_book: {payload['docs']} docs -> {output.relative_to(root)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
