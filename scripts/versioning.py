#!/usr/bin/env python3
"""
scripts/versioning.py
Versioning incrementale KB — commit semantici automatici.
"""

import sys
import subprocess
import datetime
import os
import argparse
import json

def commit_note(note_path: str, source_path: str | None = None) -> str:
    msg = f"version: auto-commit {os.path.basename(note_path)}"
    if source_path:
        msg += f" [source: {source_path}]"
    msg += f" @ {datetime.datetime.utcnow().isoformat()}"
    subprocess.run(["git", "add", note_path], check=True)
    subprocess.run(["git", "commit", "-m", msg], check=False)
    print("Committed:", msg)
    return msg

def main():
    parser = argparse.ArgumentParser(description="KB Incremental Versioning - Auto-commit note")
    parser.add_argument("note_path", nargs="?", default="", help="Path to the note to commit")
    parser.add_argument("--note-path", dest="opt_note_path", default="", help="Path to the note to commit")
    parser.add_argument("--source-path", default=None, help="Optional source file path")
    parser.add_argument("--json", action="store_true", help="Output result as JSON object on stdout.")
    args = parser.parse_args()

    note_path = args.opt_note_path or args.note_path
    if not note_path:
        msg = "Error: note_path is required."
        if args.json:
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    try:
        commit_msg = commit_note(note_path, args.source_path)
        if args.json:
            print(json.dumps({
                "status": "success",
                "note_path": note_path,
                "source_path": args.source_path,
                "commit_message": commit_msg
            }))
    except Exception as e:
        if args.json:
            print(json.dumps({"status": "error", "message": str(e)}))
        else:
            print(f"Error committing note: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
