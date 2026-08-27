#!/usr/bin/env sh
# entrypoint.sh — tiny command dispatcher for the Docker image.
#
# Usage (inside the container):
#   convert   run conv2md.py on the mounted project
#   shell     open an interactive shell
#   <cmd>     run any other command passed by the user
set -e

case "$1" in
  convert)
    exec python conv2md.py --input "${INPUT_DIR:-backup}" --output "${RAW_DIR:-raw}"
    ;;
  shell)
    exec sh
    ;;
  *)
    exec "$@"
    ;;
esac
