#!/bin/bash
cd "$(dirname "$0")/.."
UI_PORT="${WIKIFORGE_UI_PORT:-5173}"
echo "[1/3] Verifica di Docker in corso..."
if ! docker info > /dev/null 2>&1; then
    echo ""
    echo "[ERRORE] Docker non e installato o non e in esecuzione."
    echo "Per favore, installa Docker Engine o Docker Desktop."
    echo "Dopo l'installazione, assicurati che il servizio sia attivo e riesegui questo script."
    echo ""
    read -p "Premi Invio per uscire..."
    exit 1
fi
echo "[2/3] Download e build delle immagini (se necessario)..."
if ! docker compose build --pull; then
    echo ""
    echo "[ERRORE] Build delle immagini fallito. Controlla l'output di Docker."
    exit 1
fi
echo "[3/3] Avvio di Wiki-Forge in background..."
if ! docker compose up -d; then
    echo ""
    echo "[ERRORE] Avvio di Docker Compose fallito."
    docker compose ps -a
    exit 1
fi
running="$(docker compose ps --status=running --services)"
for svc in api ui kg-api worker mcp-server; do
    if ! printf '%s\n' "$running" | grep -qx "$svc"; then
        echo ""
        echo "[ERRORE] Servizio '$svc' non in esecuzione."
        docker compose logs --tail=40 "$svc"
        docker compose ps -a
        exit 1
    fi
done
echo ""
echo "Apertura del browser in corso..."
xdg-open "http://localhost:${UI_PORT}" || echo "Impossibile aprire il browser automaticamente. Visita: http://localhost:${UI_PORT}"
echo ""
echo "Fatto! Wiki-Forge e ora in esecuzione in background."
echo "Per fermarlo, esegui 'bin/Stop_WikiForge.sh'."
sleep 3
