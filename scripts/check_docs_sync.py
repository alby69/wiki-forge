#!/usr/bin/env python3
"""
scripts/check_docs_sync.py
Automated documentation and Agent Skills consistency checker for wiki-forge.

Checks:
1. Parses `skills/*/SKILL.md` frontmatter `triggers.commands` lists to build canonical command set.
2. Verifies that every trigger command is mentioned at least once in `README.md` and `docs/TUTORIAL.md`.
3. Verifies version parity between `package.json` ("version") and top-most version in `docs/CHANGELOG.md`.
4. Validates `docs/help/*.md` in-app guide topics: mandatory frontmatter, `id == filename`,
   slugged id, numeric order, non-empty body, and coverage in `docs/README.md`.
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
    changelog_path = repo_root / "docs" / "CHANGELOG.md"

    if not pkg_path.exists():
        errors.append("package.json missing")
        return errors
    if not changelog_path.exists():
        errors.append("docs/CHANGELOG.md missing")
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

HELP_REQUIRED_KEYS = ("id", "title", "icon", "order", "group", "mode", "keywords", "context")

def check_help_topics(repo_root: Path) -> list[str]:
    errors = []
    help_dir = repo_root / "docs" / "help"
    if not help_dir.exists():
        errors.append("docs/help/ directory does not exist.")
        return errors

    topic_files = sorted(help_dir.glob("*.md"))
    if not topic_files:
        errors.append("docs/help/ contains no .md topics.")
        return errors

    docs_index = repo_root / "docs" / "README.md"
    index_content = docs_index.read_text(encoding="utf-8") if docs_index.exists() else ""

    ids = []
    for topic_file in topic_files:
        content = topic_file.read_text(encoding="utf-8")
        fm_match = re.search(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        if not fm_match:
            errors.append(f"docs/help/{topic_file.name}: missing YAML frontmatter.")
            continue
        frontmatter = fm_match.group(1)
        body = content[fm_match.end():]

        fm_keys = dict(
            (m.group(1), m.group(2).strip())
            for m in re.finditer(r"^([a-z_]+):\s*(.*)$", frontmatter, re.MULTILINE)
        )
        for key in HELP_REQUIRED_KEYS:
            if key not in fm_keys or not fm_keys[key]:
                errors.append(f"docs/help/{topic_file.name}: missing frontmatter key '{key}'.")

        topic_id = fm_keys.get("id", "")
        if topic_id:
            ids.append(topic_id)
            if topic_id != topic_file.stem:
                errors.append(
                    f"docs/help/{topic_file.name}: id '{topic_id}' does not match filename stem '{topic_file.stem}'."
                )
            if not re.fullmatch(r"[a-z0-9-]+", topic_id):
                errors.append(f"docs/help/{topic_file.name}: id '{topic_id}' must match ^[a-z0-9-]+$.")

        order = fm_keys.get("order", "")
        if order and not re.fullmatch(r"\d+", order):
            errors.append(f"docs/help/{topic_file.name}: order '{order}' must be an integer.")

        if not body.strip():
            errors.append(f"docs/help/{topic_file.name}: body is empty.")

        if index_content and topic_id and topic_id not in index_content:
            errors.append(f"docs/help/{topic_file.name}: topic id '{topic_id}' not listed in docs/README.md.")

    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    for dup in duplicates:
        errors.append(f"docs/help: duplicate topic id '{dup}'.")

    return errors

def main():
    import argparse
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="Check documentation and skills synchronization")
    parser.add_argument("--json", action="store_true", help="Output result as JSON object on stdout.")

    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    commands = parse_skill_commands(repo_root)
    if not commands:
        msg = "ERROR: No commands found in skills/*/SKILL.md frontmatter."
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    all_errors = []

    # Check README.md
    readme_errors = check_doc_mentions(commands, repo_root / "README.md", "README.md")
    all_errors.extend(readme_errors)

    # Check docs/TUTORIAL.md
    tutorial_errors = check_doc_mentions(commands, repo_root / "docs" / "TUTORIAL.md", "docs/TUTORIAL.md")
    all_errors.extend(tutorial_errors)

    # Check version parity
    version_errors = check_version_sync(repo_root)
    all_errors.extend(version_errors)

    # Check in-app help topics (docs/help/*.md)
    help_errors = check_help_topics(repo_root)
    all_errors.extend(help_errors)

    if args.json:
        import json
        print(json.dumps({
            "status": "error" if all_errors else "success",
            "commands_checked": len(commands),
            "errors": all_errors
        }))
        sys.exit(1 if all_errors else 0)

    if all_errors:
        print("❌ Doc & Skill Sync Verification Failed:\n", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"✅ Doc & Skill Sync Verification Passed ({len(commands)} commands checked across skills, README.md, TUTORIAL.md, CHANGELOG.md, and docs/help/ topics).")
        sys.exit(0)

if __name__ == "__main__":
    main()
