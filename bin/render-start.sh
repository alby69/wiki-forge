#!/usr/bin/env bash
set -euo pipefail

: "${PORT:=10000}"
: "${API_PORT:=3001}"
: "${VITE_PROXY_TARGET:=http://127.0.0.1:${API_PORT}}"

export API_PORT VITE_PROXY_TARGET

cd /app

PORT="$API_PORT" node --import tsx src/backend/server/httpServer.ts &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  if [[ -n "${ui_pid:-}" ]]; then
    kill "$ui_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

ready=0
for _ in $(seq 1 60); do
  if HEALTH_URL="http://127.0.0.1:${API_PORT}/api/help" node -e "fetch(process.env.HEALTH_URL).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "[render] API exited before becoming ready" >&2
    exit 1
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "[render] API did not become ready on port ${API_PORT}" >&2
  exit 1
fi

npx vite preview --host 0.0.0.0 --port "$PORT" --strictPort &
ui_pid=$!

wait -n "$api_pid" "$ui_pid"
status=$?
exit "$status"
