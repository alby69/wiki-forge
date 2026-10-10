#!/usr/bin/env python3
"""
scripts/okf_log.py
OKF v0.2 Log Appender for wiki-forge (§9 OKF).

Usage:
    python3 scripts/okf_log.py wiki/ "Message describing the change" [--type Update|Creation|Deprecation|Initialization] [--date YYYY-MM-DD]
"""

import sys
import re
import argparse
from pathlib import Path
from datetime import datetime, timezone
from okf_common import resolve_dir

def append_to_log(log_path: Path, message: str, entry_type: str = "Update", date_str: str = None):
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if not log_path.exists():
        content = "# Wiki Update Log\n\n"
    else:
        content = log_path.read_text(encoding="utf-8")

    heading = f"## {date_str}"
    entry_line = f"* **{entry_type}**: {message}"

    if heading in content:
        # Insert entry right under the existing heading
        parts = content.split(heading, 1)
        new_content = parts[0] + heading + "\n" + entry_line + "\n" + parts[1].lstrip("\n")
    else:
        # Insert new date heading after the main title
        if content.startswith("# Wiki Update Log"):
            title_parts = content.split("\n\n", 1)
            rest = title_parts[1] if len(title_parts) > 1 else ""
            new_content = title_parts[0] + f"\n\n{heading}\n{entry_line}\n\n" + rest
        else:
            new_content = f"{heading}\n{entry_line}\n\n" + content

    log_path.write_text(new_content, encoding="utf-8")
    print(f"Appended entry to {log_path}: [{date_str}] **{entry_type}**: {message}")

def main():
    parser = argparse.ArgumentParser(description="Append entry to OKF log.md")
    parser.add_argument("wiki_dir", nargs="?", default="wiki", help="Path to wiki directory")
    parser.add_argument("message", nargs="?", default="", help="Log message describing the update")
    parser.add_argument("--message", dest="opt_message", help="Log message describing the update")
    parser.add_argument("--type", default="Update", choices=["Update", "Creation", "Deprecation", "Initialization"], help="Log entry keyword type")
    parser.add_argument("--date", default=None, help="Date in YYYY-MM-DD format (default: today UTC)")
    parser.add_argument("--json", action="store_true", help="Output result as JSON object on stdout.")

    args = parser.parse_args()
    wiki_root = resolve_dir(args.wiki_dir)

    target_msg = args.opt_message or args.message
    if not target_msg:
        msg = "Error: message is required."
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    if not wiki_root.exists():
        msg = f"Error: Directory '{wiki_root}' does not exist."
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    log_path = wiki_root / "log.md"
    append_to_log(log_path, target_msg, args.type, args.date)
    if args.json:
        import json
        print(json.dumps({
            "status": "success",
            "log_path": str(log_path),
            "message": target_msg,
            "type": args.type
        }))

if __name__ == "__main__":
    main()

# Estensione C: log incrementale per versioning
# Ogni commit versione aggiunge riga al log con timestamp, nota, azione
