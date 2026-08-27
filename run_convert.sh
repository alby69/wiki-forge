#!/usr/bin/env bash
# run_convert.sh — Convert all source documents in `backup/` into Markdown in `raw/`.
#
# This is the non-technical "one command" entry point. It:
#   1. cd's into the project root (so relative paths in config.toml work),
#   2. makes sure pandoc is on the PATH (common on Windows via AppData),
#   3. runs conv2md.py using the active Python environment.
#
# Usage:
#   bash run_convert.sh               # normal run (reads config.toml)
#   bash run_convert.sh --ocr         # flag scanned PDFs
#
# Docker alternative (no Python/pandoc install needed on the host):
#   docker compose run --rm wiki convert
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Helpful on Windows: pandoc installed via the installer often lives here.
export PATH="$LOCALAPPDATA/Pandoc:$PATH"

# Prefer an active virtual environment if present, else system Python.
if [ -x "./venv/Scripts/python" ]; then
  PY="./venv/Scripts/python"
elif [ -x "./venv/bin/python" ]; then
  PY="./venv/bin/python"
else
  PY="python"
fi

"$PY" conv2md.py --input backup --output raw "$@"
