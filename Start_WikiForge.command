#!/bin/bash
cd "$(dirname "$0")"
echo "[1/3] Verifica di Docker in corso..."
if ! docker info > /dev/null 2>&1; then
    echo ""
    echo "[ERRORE] Docker non e installato o non e in esecuzione."
    echo "Per favore, installa Docker Desktop da: https://www.docker.com/products/docker-desktop"
    echo "Dopo l'installazione, avvialo e fai di nuovo doppio click su questo file."
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
open http://localhost:5173
echo ""
echo "Fatto! Wiki-Forge e ora in esecuzione."
echo "Puoi chiudere questa finestra. L'app continuera a girare in background."
echo "Per fermarla, usa il file 'Stop_WikiForge.command'."
sleep 5
