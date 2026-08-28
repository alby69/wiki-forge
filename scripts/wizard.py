#!/usr/bin/env python3
"""
wizard.py — Scenario-Driven Interactive Wizard System for wiki-forge.

Walks the user step-by-step through domain-specific wiki setup and management tasks,
verifying source files, running converters, and providing formatted instructions
for LLM coding agents.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Python 3.11+ tomllib support with fallback
try:
    import tomllib
except ImportError:
    tomllib = None  # type: ignore

from rich.console import Console
from rich.panel import Panel

console = Console()


def load_toml(path: Path) -> dict:
    """Load a TOML file if present."""
    if not path.is_file():
        return {}
    if "tomllib" in sys.modules and tomllib is not None:
        with path.open("rb") as f:
            return tomllib.load(f)
    return {}


def load_config() -> dict:
    """Load main config.toml or return default paths."""
    defaults = {
        "paths": {
            "sources": "backup",
            "raw": "raw",
            "wiki": "wiki",
            "output": "output",
        }
    }
    cfg = load_toml(Path("config.toml"))
    if "paths" in cfg:
        defaults["paths"].update(cfg["paths"])
    return defaults


def load_scenarios() -> dict:
    """Load scenarios from config/scenarios.toml."""
    scenarios_path = Path("config/scenarios.toml")
    cfg = load_toml(scenarios_path)
    return cfg.get("scenarios", {})


def run_conv2md(sources_dir: str, raw_dir: str) -> bool:
    """Execute conv2md.py transparently using Python subprocess."""
    import subprocess

    cmd = [sys.executable, "conv2md.py", "--input", sources_dir, "--output", raw_dir]
    try:
        console.print(f"[bold cyan][WIZARD ACTION][/bold cyan] Running 'conv2md.py' ({sources_dir} -> {raw_dir})...")
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        if res.stdout:
            console.print(f"[dim]{res.stdout.strip()}[/dim]")
        return True
    except subprocess.CalledProcessError as exc:
        console.print(f"[bold red]Error running conv2md.py:[/bold red] {exc.stderr}")
        return False
    except Exception as exc:
        console.print(f"[bold red]Unexpected error running conv2md.py:[/bold red] {exc}")
        return False


def run_wizard_scenario(preset_id: str, scenarios: dict, config: dict) -> None:
    if preset_id not in scenarios:
        console.print(f"[bold red]Unknown scenario preset:[/bold red] '{preset_id}'")
        sys.exit(1)

    scenario = scenarios[preset_id]
    sources_dir = config.get("paths", {}).get("sources", "backup")
    raw_dir = config.get("paths", {}).get("raw", "raw")

    console.print(Panel.fit(
        f"[bold green]{scenario['name']}[/bold green]\n{scenario['description']}",
        title="[bold blue]wiki-forge Wizard[/bold blue]"
    ))

    # Step 1: File Check in sources/
    sources_path = Path(sources_dir)
    source_files = list(sources_path.glob("*")) if sources_path.exists() else []
    # Filter out hidden or directory entries
    files_list = [f for f in source_files if f.is_file() and not f.name.startswith(".")]

    console.print(f"\n[bold yellow]Step 1/3:[/bold yellow] Checking sources inbox (`{sources_dir}/`)...")
    if files_list:
        console.print(f"  Found [green]{len(files_list)}[/green] file(s) in `{sources_dir}/`:")
        for f in files_list[:5]:
            console.print(f"   - {f.name}")
        if len(files_list) > 5:
            console.print(f"   ... and {len(files_list) - 5} more.")
    else:
        console.print(f"  [yellow]Notice:[/yellow] `{sources_dir}/` is currently empty.")
        console.print(f"  Please place your original documents (PDF, DOCX, EPUB, TXT, MD) into `{sources_dir}/`.")

    # Step 2: Conversion Pipeline
    console.print(f"\n[bold yellow]Step 2/3:[/bold yellow] Source Ingestion & Processing")
    if "conv2md.py" in scenario.get("actions", []):
        if files_list:
            success = run_conv2md(sources_dir, raw_dir)
            if success:
                console.print(Panel(
                    f"[bold green]✓ Conversion complete![/bold green]\nConverted sources from `{sources_dir}/` to clean Markdown in `{raw_dir}/`.",
                    title="[bold green]Conversion Status[/bold green]"
                ))
        else:
            console.print("  Skipping conv2md.py execution because no input files were found in sources/.")

    # Step 3: Prompt Hand-off for LLM Agent
    console.print(f"\n[bold yellow]Step 3/3:[/bold yellow] Agent Command Hand-off")
    prompt_text = scenario.get("prompt", "")
    actions_str = ", ".join(f"`{a}`" for a in scenario.get("actions", []))

    hand_off_content = (
        f"[bold blue][WIZARD ACTION][/bold blue] Target Workflow Actions: {actions_str}\n"
        f"──────────────────────────────────────────────────────────────────\n"
        f"[bold yellow][NEXT STEP FOR AGENT][/bold yellow] Copy & paste the following prompt to your LLM agent:\n\n"
        f"\"[WIZARD STEP 1/1: {scenario['name']}] {prompt_text}\""
    )
    console.print(Panel(hand_off_content, title="[bold magenta]Agent Execution Hand-off[/bold magenta]", expand=False))


def interactive_menu(scenarios: dict) -> str:
    import questionary

    choices = [
        questionary.Choice(
            title=f"{sc['name']} - {sc['description']}",
            value=key
        )
        for key, sc in scenarios.items()
    ]

    scenario_id = questionary.select(
        "Select a domain-specific scenario workflow:",
        choices=choices
    ).ask()

    return scenario_id


def main() -> None:
    parser = argparse.ArgumentParser(description="wiki-forge Scenario-Driven Interactive Wizard")
    parser.add_argument(
        "--preset",
        choices=["academic", "business", "research", "creative", "existing"],
        help="Bypass interactive menu and run a specific scenario preset directly."
    )
    args = parser.parse_args()

    config = load_config()
    scenarios = load_scenarios()

    if not scenarios:
        console.print("[bold red]Error:[/bold red] Could not load scenario presets from config/scenarios.toml.")
        sys.exit(1)

    if args.preset:
        preset_id = args.preset
    else:
        preset_id = interactive_menu(scenarios)
        if not preset_id:
            console.print("Wizard cancelled.")
            sys.exit(0)

    run_wizard_scenario(preset_id, scenarios, config)


if __name__ == "__main__":
    main()
