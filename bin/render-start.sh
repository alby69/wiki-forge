#!/usr/bin/env bash
set -euo pipefail

: "${PORT:=10000}"
export PORT

cd /app

mkdir -p /app/.wiki-forge/state /app/output/scheduler

exec node --import tsx src/backend/server/httpServer.ts
