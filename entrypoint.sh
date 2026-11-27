#!/usr/bin/env sh
# entrypoint.sh — tiny command dispatcher for the Docker image.
#
# Usage (inside the container):
#   convert   run conv2md.py on the mounted project
#   shell     open an interactive shell
#   <cmd>     run any other command passed by the user
set -e

# Non-fatal warning: legacy state roots must be migrated to .wiki-forge/.
script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
status_json=$(python3 "$script_dir/scripts/migrate_state_roots.py" --status || true)
if printf '%s\n' "$status_json" | python3 -c 'import json, sys; sys.exit(0 if json.load(sys.stdin).get("legacy_exists") else 1)' 2>/dev/null; then
  echo "WARNING: legacy .wikiforge/ still exists; run: python3 scripts/migrate_state_roots.py --apply" >&2
fi

case "$1" in
  convert)
    exec python scripts/conv2md.py --input "${INPUT_DIR:-backup}" --output "${RAW_DIR:-raw}"
    ;;
  shell)
    exec sh
    ;;
  *)
    exec "$@"
    ;;
esac
