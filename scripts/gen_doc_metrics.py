#!/usr/bin/env python3
"""Generate and check manifest-derived metric blocks in canonical documents.

The generated command manifest is the single source of truth for the counts
quoted in README.md and docs/architettura/ARCHITECTURE.md. Run without flags
to refresh the marked blocks, with --check to verify them.
"""

import argparse
import json
import re
import sys
from pathlib import Path

MANIFEST_REL = "src/shared/api/generated/commandManifest.generated.ts"
MANIFEST_PREFIX = "export const COMMAND_MANIFEST: CommandManifest = "
METRICS_START = "<!-- metrics:start -->"
METRICS_END = "<!-- metrics:end -->"
METRIC_DOCS = ("README.md", "docs/architettura/ARCHITECTURE.md")
ACTIVE_DOCS = (
    "README.md",
    "ROADMAP.md",
    "docs/architettura/ARCHITECTURE.md",
    "docs/architettura/OPENAPI.md",
    "docs/processi/AGENT.md",
    "docs/processi/KNOWLEDGE_ENGINEERING.md",
)
COUNT_FIELDS = {
    "routes": "routes",
    "bus_handlers": "busCommands",
    "slash_commands": "slashCommands",
    "slash_implemented": "implementedSlashCommands",
    "mcp_tools": "mcpTools",
    "gaps": "gaps",
}
METRIC_LABELS = {
    "routes": "Route HTTP",
    "bus_handlers": "Handler bus",
    "slash_commands": "Comandi slash catalogati",
    "slash_implemented": "Comandi slash con case dedicato",
    "mcp_tools": "Tool MCP",
    "gaps": "Gap noti",
}
CLAIM_PATTERNS = (
    ("routes", re.compile(r"(\d+)\s+(?:HTTP\s+routes?|route\s+HTTP)", re.IGNORECASE)),
    ("routes", re.compile(r"(\d+)\s+operazioni\*\*|(\d+)\s+id, assertion compile-time|(\d+)\s+endpoint\*\* del catalogo", re.IGNORECASE)),
    ("bus_handlers", re.compile(r"(\d+)\s+handler(?:\s+bus|\s+su\s+bus|\s+su\s+MessageBus)?", re.IGNORECASE)),
    ("slash_commands", re.compile(r"(\d+)\s+(?:comandi\s+slash|catalogued\s+slash\s+commands|slash\s+commands?\s+catalogate)", re.IGNORECASE)),
    ("slash_implemented", re.compile(r"(\d+)\s+(?:con\s+case\s+dedicato|with\s+a\s+dedicated\s+case)", re.IGNORECASE)),
    ("mcp_tools", re.compile(r"(\d+)\s+(?:tool\s+MCP|MCP\s+tools|tools\s+from)", re.IGNORECASE)),
    ("gaps", re.compile(r"(\d+)\s+(?:gap\s+noti|non-blocking\s+gaps)", re.IGNORECASE)),
)


def load_counts(repo_root: Path) -> dict[str, int]:
    manifest_path = repo_root / MANIFEST_REL
    if not manifest_path.exists():
        raise FileNotFoundError(f"Generated manifest is missing: {MANIFEST_REL}")
    source = manifest_path.read_text(encoding="utf-8")
    if MANIFEST_PREFIX not in source:
        raise ValueError(f"Generated manifest has no COMMAND_MANIFEST assignment: {MANIFEST_REL}")
    start = source.index(MANIFEST_PREFIX) + len(MANIFEST_PREFIX)
    manifest, end = json.JSONDecoder().raw_decode(source[start:])
    if not source[start + end:].lstrip().startswith(";"):
        raise ValueError(f"COMMAND_MANIFEST is not a JSON literal: {MANIFEST_REL}")
    return {key: len(manifest[field]) for key, field in COUNT_FIELDS.items()}


def render_metrics(counts: dict[str, int]) -> str:
    lines = [
        METRICS_START,
        "> Metriche generate da `scripts/gen_doc_metrics.py` a partire dal manifest generato; non modificare a mano.",
        "",
        "| Metrica | Valore |",
        "|---|---:|",
    ]
    lines.extend(f"| {METRIC_LABELS[key]} | {counts[key]} |" for key in COUNT_FIELDS)
    lines.append("")
    lines.append(METRICS_END)
    return "\n".join(lines)


def _replace_block(content: str, block: str) -> str | None:
    if content.count(METRICS_START) != 1 or content.count(METRICS_END) != 1:
        return None
    start = content.index(METRICS_START)
    end = content.index(METRICS_END) + len(METRICS_END)
    if start > end:
        return None
    return content[:start] + block + content[end:]


def apply_docs(repo_root: Path) -> list[str]:
    counts = load_counts(repo_root)
    block = render_metrics(counts)
    errors: list[str] = []
    for rel in METRIC_DOCS:
        path = repo_root / rel
        if not path.exists():
            errors.append(f"Metric document '{rel}' is missing.")
            continue
        content = path.read_text(encoding="utf-8")
        updated = _replace_block(content, block)
        if updated is None:
            errors.append(f"Metric document '{rel}' must contain one '{METRICS_START}' / '{METRICS_END}' pair.")
            continue
        if updated != content:
            path.write_text(updated, encoding="utf-8")
    return errors


def check_prose(repo_root: Path) -> list[str]:
    counts = load_counts(repo_root)
    errors: list[str] = []
    for rel in ACTIVE_DOCS:
        path = repo_root / rel
        if not path.exists():
            errors.append(f"Metric document '{rel}' is missing.")
            continue
        content = path.read_text(encoding="utf-8")
        if METRICS_START in content and METRICS_END in content:
            start = content.index(METRICS_START)
            end = content.index(METRICS_END) + len(METRICS_END)
            content = content[:start] + "\n" * content[start:end].count("\n") + content[end:]
        for number, line in enumerate(content.splitlines(), start=1):
            for key, pattern in CLAIM_PATTERNS:
                for match in pattern.finditer(line):
                    value = next((int(part) for part in match.groups() if part is not None), None)
                    if value is None or value == counts[key]:
                        continue
                    errors.append(
                        f"{rel}:{number}: {METRIC_LABELS[key]} is {value}, "
                        f"generated manifest says {counts[key]}."
                    )
    return errors


def check_docs(repo_root: Path) -> list[str]:
    errors: list[str] = []
    counts = load_counts(repo_root)
    block = render_metrics(counts)
    for rel in METRIC_DOCS:
        path = repo_root / rel
        if not path.exists():
            errors.append(f"Metric document '{rel}' is missing.")
            continue
        content = path.read_text(encoding="utf-8")
        if content.count(METRICS_START) != 1 or content.count(METRICS_END) != 1:
            errors.append(f"Metric document '{rel}' must contain one '{METRICS_START}' / '{METRICS_END}' pair.")
            continue
        start = content.index(METRICS_START)
        end = content.index(METRICS_END) + len(METRICS_END)
        if content[start:end] != block:
            errors.append(f"Metric block in '{rel}' is stale; run 'python3 scripts/gen_doc_metrics.py'.")
    errors.extend(check_prose(repo_root))
    return errors


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser(description="Generate or check manifest-derived documentation metrics")
    parser.add_argument("--check", action="store_true", help="Only verify the metric blocks and prose counts.")
    parser.add_argument("--json", action="store_true", help="Emit the check result as JSON.")
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent

    try:
        errors = check_docs(repo_root) if args.check else apply_docs(repo_root)
    except (FileNotFoundError, ValueError, KeyError) as exc:
        errors = [str(exc)]

    if args.json:
        print(json.dumps({"status": "error" if errors else "success", "errors": errors}))
        sys.exit(1 if errors else 0)

    if errors:
        print("Metric synchronization failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        sys.exit(1)
    print("Metric synchronization passed." if args.check else f"Metrics updated in {', '.join(METRIC_DOCS)}.")
    sys.exit(0)


if __name__ == "__main__":
    main()
