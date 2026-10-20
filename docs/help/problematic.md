---
id: problematic
title: Problemi frequenti
icon: 🛠️
order: 11
group: 📖 Uso quotidiano
mode: both
keywords: [problema, errore, error, non funziona, aiuto, bug, offline, lento, crash, debug, log]
context: []
---

## La chat risponde "offline" o dà errore

- Il **backend non è raggiungibile**: controlla che il server sia avviato (il footer in basso deve dire `Status: Connected`).
- Il **modello LLM non è configurato**: i comandi che non usano l'agente (`/help`, `/audit` a livello base...) funzionano comunque; per il resto serve un provider in `Config → LLM` (Developer Mode).

## La compilazione non produce note

1. Verifica che i file siano in **`sources/`** (pill 📥 Carica) o in **`raw/`**.
2. Servono un **modello LLM configurato** e raggiungibile.
3. Guarda l'**errore nella chat** (o la console di 🛠️ Tools): spesso indica il file che ha fallito.
4. Riprova con `/compile`; per un singolo file usa `/ingest <file>`.

## Il grafo è vuoto o non si aggiorna

- Devi essere in vista **🕸️ Graph** o **◧ Split**.
- Controlla i **filtri** in alto al grafo (cartelle/tag potrebbero nascondere tutto): usa ⌖ per zoom-fit.
- **`/reindex`** rigenera indici e collegamenti.

## L'upload non parte / il file non appare

- Formati accettati dalla conversione: **PDF, EPUB, DOCX, MD, TXT**.
- I file finiscono prima in `sources/`/`raw/`: le note arrivano dopo la **compilazione**.
- Guarda la console di **🛠️ Tools** (Developer Mode) per gli errori degli script Python.

## La web clipper fallisce

- Serve raggiungere l'URL dalla macchina (reti aziendali/VPN possono bloccare).
- Alcuni siti proteggono i contenuti: prova a salvare la pagina a mano e caricarla.

## Controlli rapidi diagnostici

| Comando / strumento | Cosa verifica |
|---|---|
| `/audit` | Link rotti, note orfane, problemi di frontmatter |
| `/stats` | Statistiche globali della wiki |
| **Lint OKF Bundle** (🛠️ Tools) | Validità del frontmatter OKF |
| **`/help`** | Funzionamento generale della guida (non usa il modello) |

## Ancora bloccato?

Apri la guida con **F1**, cerca l'argomento e usa **💬 Chiedi all'agente**: la domanda parte precompilata con il contesto giusto. Per segnalare bug: issue su GitHub (link del logo in alto).

**Approfondisci:** `docs/PROCEDURES.md` (procedure di ripristino), `docs/STARTUP.md` (avvio e struttura), `docs/ARCHITECTURE.md` (dove sta cosa).
