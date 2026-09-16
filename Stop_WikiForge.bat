@echo off
title Wiki-Forge Stopper
echo Arresto di Wiki-Forge in corso...
docker compose down
echo Fatto! Wiki-Forge e stato arrestato.
timeout /t 3 >nul
