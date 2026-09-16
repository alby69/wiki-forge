#!/bin/bash
cd "$(dirname "$0")"
echo "Arresto di Wiki-Forge in corso..."
docker compose down
echo "Fatto! Wiki-Forge e stato arrestato."
sleep 3
