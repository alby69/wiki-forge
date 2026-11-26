---
type: Reference
title: "Iniziare con Wiki-Forge"
description: "Argomenti: inizio, benvenuto, primo passo, come funziona, cosa è, quickstart, aiuto, guida, intro, research, ricerca, study, studio"
resource: docs/help/inizio.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it, help]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-26T00:00:00Z"
sources:
  - id: source-docs-help-inizio-md
    resource: docs/help/inizio.md
    title: "Iniziare con Wiki-Forge"
    author: human:alby69
---
## Cos'è Wiki-Forge

Wiki-Forge è la tua **wiki personale potenziata da un agente IA**, al 100% locale.

- **Carichi documenti** (PDF, DOCX, MD, pagine web...) nella tua busta dati (*vault*).
- **L'agente li compila** trasformandoli in note strutturate collegate tra loro.
- **Navighi** le note nell'editor, nella scratchpad e nel Knowledge Graph.
- Tutto resta sul tuo computer: nessun dato inviato in cloud.

## I 4 passi (Focus Mode)

In Focus Mode in alto trovi 4 pulsanti — segui l'ordine:

1. **📥 Carica** — trascina i tuoi documenti nella finestra che si apre.
2. **📝 Importa** — oppure importa un singolo file Markdown già pronto.
3. **⚡ Compila** — l'agente converte le fonti in note collegate (serve un modello LLM configurato).
4. **💬 Chiedi** — fai domande all'agente sulla tua wiki.

## Focus Mode o Developer Mode?

Il badge accanto al logo mostra la modalità attiva:

- **🌱 Focus Mode** — interfaccia semplificata con i 4 pulsanti: pensata per usare la wiki senza pensare alla tecnica.
- **👑 Developer Mode** — strumenti completi: KE Workbench, Tools (script), Config, comandi avanzati.

Clicca il badge (o premi **Ctrl+Shift+D**) per cambiare modalità in qualsiasi momento.

## Dove trovare aiuto

- **Pulsante `?`** in alto a destra, oppure tasto **F1**: apre la guida in-app, con gli argomenti **già selezionati in base a ciò che stai facendo**.
- **`/help`** nella chat: stessi contenuti, in forma testuale (es. `/help caricare-documenti`).
- **Cartella `docs/`** del progetto: documentazione completa (TUTORIAL.md, USER_GUIDE.md, ecc.).

## Glossario minimo

| Termine | Significato |
|---|---|
| **Vault** | La tua raccolta di note (cartella `wiki/` del progetto) |
| **Nota** | Un singolo articolo Markdown della wiki |
| **Fonte / raw** | Documenti originali e loro conversione intermedia (`sources/`, `raw/`) |
| **Compilazione** | Processo che trasforma le fonti in note collegate (`/compile`) |
| **Wikilink** | Collegamento `[[nome-nota]]` tra due note |
| **Trust tier** | Livello di fiducia di una nota (verificata, confermata, non verificata) |
| **Review Studio** | Finestra di revisione con quattro schede: Verifica, Critica, Digest, Confronta versioni |
| **Research Studio** | Finestra di ricerca con sei schede: Consult, Ricerca, Backlink, Correlate, Traccia, Deep Research |
| **Study Studio** | Finestra di studio con sette schede: Guida, Quiz, Mindmap, Audio, Note, Promuovi, Tesi |

**Approfondisci:** `docs/guida/TUTORIAL.md` (guida passo-passo completa), `docs/guida/USER_GUIDE.md` (funzionalità dell'interfaccia), `docs/guida/THESIS_GUIDE.md` (flusso di lavoro consigliato).
