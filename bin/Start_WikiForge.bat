@echo off
cd /d "%~dp0.."
title Wiki-Forge Launcher
set "UI_PORT=%WIKIFORGE_UI_PORT%"
if not defined UI_PORT set "UI_PORT=5173"
echo [1/3] Verifica di Docker in corso...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRORE] Docker non e installato o non e in esecuzione.
    echo Per favore, installa Docker Desktop da: https://www.docker.com/products/docker-desktop
    echo Dopo l'installazione, avvialo e fai di nuovo doppio click su questo file.
    echo.
    pause
    exit /b 1
)
echo [2/3] Download e build delle immagini (se necessario)...
docker compose build --pull
if errorlevel 1 (
    echo.
    echo [ERRORE] Build delle immagini fallito. Controlla l'output di Docker.
    pause
    exit /b 1
)
echo [3/3] Avvio di Wiki-Forge in background...
docker compose up -d
if errorlevel 1 (
    echo.
    echo [ERRORE] Avvio di Docker Compose fallito.
    docker compose ps -a
    pause
    exit /b 1
)
set "RUNNING_FILE=%TEMP%\wikiforge-running.txt"
docker compose ps --status=running --services > "%RUNNING_FILE%"
for %%S in (api ui kg-api worker mcp-server) do (
    findstr /x /c:"%%S" "%RUNNING_FILE%" >nul
    if errorlevel 1 (
        echo.
        echo [ERRORE] Servizio '%%S' non in esecuzione.
        docker compose logs --tail=40 %%S
        docker compose ps -a
        del "%RUNNING_FILE%" >nul 2>&1
        pause
        exit /b 1
    )
)
del "%RUNNING_FILE%" >nul 2>&1
echo.
echo Avvio del browser in corso...
start "" "http://localhost:%UI_PORT%"
echo.
echo Fatto! Wiki-Forge e ora in esecuzione.
echo Puoi chiudere questa finestra. L'app continuera a girare in background.
echo Per fermarla, usa il file "bin\Stop_WikiForge.bat".
timeout /t 5 >nul
