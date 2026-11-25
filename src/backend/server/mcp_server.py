#!/usr/bin/env python3

import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    args = ["node", "--import", "tsx", "bin/wf.ts", "mcp", *sys.argv[1:]]
    return subprocess.call(args, cwd=REPO_ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
