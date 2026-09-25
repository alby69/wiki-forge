#!/usr/bin/env python3
"""Versioning incrementale KB — fase A: commit semantici automatici."""
import sys, subprocess, datetime, os

def commit_note(note_path, source_path=None):
    msg = f"version: auto-commit {os.path.basename(note_path)}"
    if source_path:
        msg += f" [source: {source_path}]"
    msg += f" @ {datetime.datetime.utcnow().isoformat()}"
    subprocess.run(["git", "add", note_path], check=True)
    subprocess.run(["git", "commit", "-m", msg], check=False)
    print("Committed:", msg)

if __name__ == "__main__":
    commit_note(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
