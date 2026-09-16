#!/bin/bash
cd "$(dirname "$0")"
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
echo "[2/3] Download degli aggiornamenti (se presenti)..."
docker compose pull > /dev/null 2>&1
echo "[3/3] Avvio di Wiki-Forge in background..."
docker compose up -d
echo ""
echo "Apertura del browser in corso..."
xdg-open http://localhost:5173 || echo "Impossibile aprire il browser automaticamente. Visita: http://localhost:5173"
echo ""
echo "Fatto! Wiki-Forge e ora in esecuzione in background."
echo "Per fermarlo, esegui 'Stop_WikiForge.sh'."
sleep 3
