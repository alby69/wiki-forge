#!/usr/bin/env python3
"""
scripts/check_docs_sync.py
Automated documentation and Agent Skills consistency checker for wiki-forge.

Checks:
1. Parses `skills/*/SKILL.md` frontmatter `triggers.commands` lists to build canonical command set.
2. Verifies that every trigger command is mentioned at least once in `README.md` and `TUTORIAL.md`.
3. Verifies version parity between `package.json` ("version") and top-most version in `CHANGELOG.md`.
"""

import os
import re
import sys
import json
from pathlib import Path

def parse_skill_commands(repo_root: Path) -> set[str]:
    skills_dir = repo_root / "skills"
    commands = set()
    if not skills_dir.exists():
        print("ERROR: skills/ directory does not exist.", file=sys.stderr)
        return commands

    for skill_file in skills_dir.glob("*/SKILL.md"):
        content = skill_file.read_text(encoding="utf-8")
        # Match YAML frontmatter between --- and ---
        fm_match = re.search(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
        if not fm_match:
            continue
        frontmatter = fm_match.group(1)
        # Find triggers: commands: [...] or list items
        cmd_match = re.search(r"commands:\s*\[(.*?)\]", frontmatter)
        if cmd_match:
            cmds = [c.strip().strip("'\"") for c in cmd_match.group(1).split(",")]
            for cmd in cmds:
                if cmd:
                    # Strip leading slash if present for normalized matching
                    norm_cmd = cmd.lstrip("/")
                    commands.add(norm_cmd)
        else:
            # Check multiline list format under commands:
            lines = frontmatter.splitlines()
            in_commands = False
            for line in lines:
                if re.match(r"^\s*commands:\s*$", line):
                    in_commands = True
                    continue
                if in_commands:
                    if re.match(r"^\s*-\s*", line):
                        cmd = re.sub(r"^\s*-\s*", "", line).strip().strip("'\"")
                        if cmd:
                            commands.add(cmd.lstrip("/"))
                    elif not re.match(r"^\s+", line):
                        in_commands = False
    return commands

def check_doc_mentions(commands: set[str], doc_path: Path, doc_name: str) -> list[str]:
    errors = []
    if not doc_path.exists():
        errors.append(f"Document {doc_name} ({doc_path}) not found.")
        return errors

    content = doc_path.read_text(encoding="utf-8")
    for cmd in sorted(commands):
        # Search for command as exact word, or slash command, or quoted
        pattern = re.compile(rf"(\b{re.escape(cmd)}\b|/{re.escape(cmd)})", re.IGNORECASE)
        if not pattern.search(content):
            errors.append(f"Command '{cmd}' is defined in skills/ but missing from {doc_name}")
    return errors

def check_version_sync(repo_root: Path) -> list[str]:
    errors = []
    pkg_path = repo_root / "package.json"
    changelog_path = repo_root / "CHANGELOG.md"

    if not pkg_path.exists():
        errors.append("package.json missing")
        return errors
    if not changelog_path.exists():
        errors.append("CHANGELOG.md missing")
        return errors

    try:
        pkg_data = json.loads(pkg_path.read_text(encoding="utf-8"))
        pkg_version = pkg_data.get("version")
    except Exception as e:
        errors.append(f"Failed to parse package.json: {e}")
        return errors

    changelog_content = changelog_path.read_text(encoding="utf-8")
    cl_match = re.search(r"##\s*\[([0-9]+\.[0-9]+\.[0-9]+)\]", changelog_content)
    if not cl_match:
        errors.append("Could not find top version header in CHANGELOG.md")
        return errors

    cl_version = cl_match.group(1)
    if pkg_version != cl_version:
        errors.append(
            f"Version mismatch: package.json is '{pkg_version}' but top CHANGELOG.md entry is '{cl_version}'"
        )

    return errors

def main():
    repo_root = Path(__file__).resolve().parent.parent
    commands = parse_skill_commands(repo_root)
    if not commands:
        print("ERROR: No commands found in skills/*/SKILL.md frontmatter.", file=sys.stderr)
        sys.exit(1)

    all_errors = []

    # Check README.md
    readme_errors = check_doc_mentions(commands, repo_root / "README.md", "README.md")
    all_errors.extend(readme_errors)

    # Check TUTORIAL.md
    tutorial_errors = check_doc_mentions(commands, repo_root / "TUTORIAL.md", "TUTORIAL.md")
    all_errors.extend(tutorial_errors)

    # Check version parity
    version_errors = check_version_sync(repo_root)
    all_errors.extend(version_errors)

    if all_errors:
        print("❌ Doc & Skill Sync Verification Failed:\n", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"✅ Doc & Skill Sync Verification Passed ({len(commands)} commands checked across skills, README.md, TUTORIAL.md, and CHANGELOG.md).")
        sys.exit(0)

if __name__ == "__main__":
    main()
