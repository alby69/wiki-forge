@echo off
title Wiki-Forge Updater
echo Download degli aggiornamenti di Wiki-Forge in corso...
echo (puo richiedere alcuni minuti: scarica le nuove immagini)
docker compose pull
echo.
echo Aggiornamento completato. Riavvia con "Start_WikiForge.bat".
timeout /t 5 >nul
