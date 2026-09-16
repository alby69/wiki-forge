@echo off
title Wiki-Forge Launcher
echo [1/3] Verifica di Docker in corso...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERRORE] Docker non e installato o non e in esecuzione.
    echo Per favore, installa Docker Desktop da: https://www.docker.com/products/docker-desktop
    echo Dopo l'installazione, avvialo e fai di nuovo doppio click su questo file.
    echo.
    pause
    exit /b 1
)
echo [2/3] Download degli aggiornamenti (se presenti)...
docker compose pull >nul 2>&1
echo [3/3] Avvio di Wiki-Forge in background...
docker compose up -d
echo.
echo Avvio del browser in corso...
start http://localhost:5173
echo.
echo Fatto! Wiki-Forge e ora in esecuzione.
echo Puoi chiudere questa finestra. L'app continuera a girare in background.
echo Per fermarla, usa il file "Stop_WikiForge.bat".
timeout /t 5 >nul
