#!/usr/bin/env python3
"""
gen_script_registry.py — generate the TypeScript script registry from Python.

WHY
---
`src/backend/wikiforge/core/script_schema.py::SCRIPT_SCHEMAS` is the single
source of truth for script metadata (id, path, CLI parameters).  The backend
used to keep a second, hand-written copy in `agentServer.ts`, which drifted
(29 TS entries vs 26 Python entries) and forced a 29-subprocess `--json-schema`
probe on every first registry request.

This generator emits `src/backend/server/generated/scriptRegistry.generated.ts`
and `docs/SCRIPT_AUTOMATION_REFERENCE.md` so code and docs share ONE definition:

    Python SSOT  ->  generated TS  ->  AgentServer API / UI forms / CLI builder
                  ->  generated MD ->  safety catalog / scheduler / approvals

USAGE
-----
    python scripts/gen_script_registry.py            # write the generated file
    python scripts/gen_script_registry.py --check    # fail if it is stale
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.backend.wikiforge.core.script_schema import SCRIPT_SCHEMAS  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT = REPO_ROOT / "src" / "backend" / "server" / "generated" / "scriptRegistry.generated.ts"
DOCS_OUTPUT = REPO_ROOT / "docs" / "SCRIPT_AUTOMATION_REFERENCE.md"

# Ordered tuple: the generated catalog must be byte-identical across Python
# processes (a set would randomise the category order under hash seeding).
VALID_CATEGORIES = (
    "Wizard",
    "Ingestion",
    "OKF Maintenance",
    "Analysis & Metrics",
    "Taxonomy",
    "Thesis & Study",
    "Knowledge Engineering",
)
VALID_PARAM_TYPES = {"text", "number", "boolean", "select"}
VALID_SAFETIES = {"read-only", "report", "workspace", "wiki-write", "blocked"}
CRON_OR_INTERVAL = re.compile(r"^(?:\S+\s+){4}\S+$|^every=\d+[mhd]$")


def validate_schemas(schemas: dict[str, dict[str, Any]]) -> list[str]:
    """Fail fast on a broken schema instead of emitting invalid TypeScript."""
    problems: list[str] = []
    for script_id, schema in schemas.items():
        prefix = f"SCRIPT_SCHEMAS[{script_id!r}]"
        if schema.get("id") != script_id:
            problems.append(f"{prefix}: id must equal the registry key")
        if not isinstance(schema.get("path"), str) or not schema["path"].endswith(".py"):
            problems.append(f"{prefix}: path must point to a .py script")
        if schema.get("category") not in VALID_CATEGORIES:
            problems.append(f"{prefix}: unsupported category {schema.get('category')!r}")
        params = schema.get("parameters")
        if not isinstance(params, list):
            problems.append(f"{prefix}: parameters must be a list")
            continue
        for index, param in enumerate(params):
            pprefix = f"{prefix}.parameters[{index}]"
            if param.get("type") not in VALID_PARAM_TYPES:
                problems.append(f"{pprefix}: unsupported type {param.get('type')!r}")
            if not isinstance(param.get("name"), str) or not param["name"]:
                problems.append(f"{pprefix}: name is required")

        automation = schema.get("automation")
        if not isinstance(automation, dict):
            problems.append(f"{prefix}: automation metadata is required")
            continue
        aprefix = f"{prefix}.automation"
        safety = automation.get("safety")
        if safety not in VALID_SAFETIES:
            problems.append(f"{aprefix}: unsupported safety {safety!r}")
        for key in ("schedulable", "enabledDefault"):
            if not isinstance(automation.get(key), bool):
                problems.append(f"{aprefix}.{key}: boolean required")
        schedule = automation.get("defaultSchedule", "")
        if not isinstance(schedule, str) or (schedule and not CRON_OR_INTERVAL.match(schedule)):
            problems.append(f"{aprefix}.defaultSchedule: invalid cron/interval {schedule!r}")
        if safety == "blocked" and automation.get("schedulable"):
            problems.append(f"{aprefix}: blocked scripts cannot be schedulable")
        if safety != "blocked" and not schedule:
            problems.append(f"{aprefix}.defaultSchedule: required for schedulable scripts")
        default_args = automation.get("defaultArgs")
        if not isinstance(default_args, dict):
            problems.append(f"{aprefix}.defaultArgs: table required")
        else:
            known_params = {param.get("name") for param in params if isinstance(param, dict)}
            for name in default_args:
                if name not in known_params:
                    problems.append(f"{aprefix}.defaultArgs.{name}: unknown script parameter")
        if not isinstance(automation.get("requires"), list):
            problems.append(f"{aprefix}.requires: list required")
        if not isinstance(automation.get("notes"), str) or not automation["notes"].strip():
            problems.append(f"{aprefix}.notes: non-empty string required")
    return problems


def render(schemas: dict[str, dict[str, Any]]) -> str:
    body = json.dumps(schemas, indent=2, ensure_ascii=False)
    # json.dumps uses double quotes, which is valid TypeScript object-literal
    # syntax. Contextual typing from `Record<string, ScriptDef>` narrows the
    # string literals to the union members declared in ScriptDef.
    indented = "\n".join("  " + line for line in body.splitlines())
    return (
        "/**\n"
        " * AUTO-GENERATED by scripts/gen_script_registry.py — DO NOT EDIT.\n"
        " * Source of truth: src/backend/wikiforge/core/script_schema.py\n"
        " * Regenerate with: python scripts/gen_script_registry.py\n"
        " */\n"
        "import type { ScriptDef } from '../agentServer';\n\n"
        "export const GENERATED_SCRIPT_REGISTRY: Record<string, ScriptDef> = "
        + indented.lstrip()
        + ";\n"
    )


SAFETY_LABELS = {
    "read-only": "🟢 read-only — nessuna scrittura rilevante",
    "report": "🔵 report — scrive solo in `output/`",
    "workspace": "🟡 workspace — scrive in `raw/`, `sources/` o `docs/`",
    "wiki-write": "🟠 wiki-write — scrive nella wiki",
    "blocked": "🔴 blocked — mai automatico",
}


def render_docs(schemas: dict[str, dict[str, Any]]) -> str:
    """Generate the human catalog from the same SSOT as the TS registry."""
    rows: list[str] = []
    for category in VALID_CATEGORIES:
        entries = [
            (script_id, schema)
            for script_id, schema in schemas.items()
            if schema.get("category") == category
        ]
        if not entries:
            continue
        rows.append(f"### {category}\n")
        rows.append("| Script | Safety | Schedulabile | Default | Orario suggerito | Requisiti | Note |")
        rows.append("|---|---|---|---|---|---|---|")
        for script_id, schema in sorted(entries, key=lambda item: item[0]):
            auto = schema["automation"]
            schedule = auto["defaultSchedule"] or "—"
            enabled = "sì" if auto["enabledDefault"] else ("no (F6)" if auto["schedulable"] else "no")
            requires = ", ".join(auto["requires"]) or "—"
            default_args = json.dumps(auto["defaultArgs"], ensure_ascii=False, sort_keys=True)
            default_cell = f"`{default_args}`" if default_args != "{}" else "—"
            note = auto["notes"]
            if default_cell != "—":
                note = f"{note} Args: {default_cell}"
            rows.append(
                f"| `{script_id}` | {SAFETY_LABELS[auto['safety']]} "
                f"| {'sì' if auto['schedulable'] else 'no'} | {enabled} "
                f"| `{schedule}` | {requires} | {note} |"
            )
        rows.append("")

    return (
        "# Catalogo sicurezza e automazione degli script\n\n"
        "> **AUTO-GENERATO** da `python scripts/gen_script_registry.py`. "
        "Fonte: `src/backend/wikiforge/core/script_schema.py`. Non modificare a mano.\n\n"
        "Questo è il catalogo unico usato dal Policy Agent F5, dalla coda F6, dal "
        "pannello Script Control Panel e dalla tab **🤖 Agenti & Schedule**. "
        "Le classi `workspace`, `wiki-write` e `blocked` non vengono mai eseguite "
        "automaticamente: i job corrispondenti restano disabilitati finché una "
        "persona non li approva esplicitamente.\n\n"
        "<!-- DOC_BLOCK:script-automation -->\n"
        + "\n".join(rows).rstrip()
        + "\n<!-- /DOC_BLOCK:script-automation -->\n\n"
        "## Convenzioni\n\n"
        "- **Schedulabile = no**: script interattivi o irreversibili, eseguibili solo dal pannello.\n"
        "- **Default = no (F6)**: il job può essere creato, ma nasce disabilitato e ogni "
        "esecuzione mutante passa dalla coda di approvazione.\n"
        "- `requires` indica dipendenze esterne (`llm`, `network`, `pandoc`, `tty`).\n"
        "- `Args` sono gli argomenti precompilati dal catalogo; il parser dei job li valida "
        "contro i parametri dichiarati nello schema.\n"
    )


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv[1:])
    problems = validate_schemas(SCRIPT_SCHEMAS)
    if problems:
        print("Invalid script schemas:\n  - " + "\n  - ".join(problems), file=sys.stderr)
        return 1

    content = render(SCRIPT_SCHEMAS)
    docs_content = render_docs(SCRIPT_SCHEMAS)
    if "--check" in args:
        stale: list[str] = []
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
        if current != content:
            stale.append(str(OUTPUT.relative_to(REPO_ROOT)))
        current_docs = DOCS_OUTPUT.read_text(encoding="utf-8") if DOCS_OUTPUT.exists() else ""
        if current_docs != docs_content:
            stale.append(str(DOCS_OUTPUT.relative_to(REPO_ROOT)))
        if stale:
            print("STALE: " + ", ".join(stale) + " do not match SCRIPT_SCHEMAS", file=sys.stderr)
            return 1
        print(f"OK: registry and safety catalog are in sync ({len(SCRIPT_SCHEMAS)} scripts)")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(content, encoding="utf-8")
    DOCS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    DOCS_OUTPUT.write_text(docs_content, encoding="utf-8")
    print(f"Wrote registry + safety catalog ({len(SCRIPT_SCHEMAS)} scripts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
