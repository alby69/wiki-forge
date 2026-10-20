---
id: compilare
title: Compilare le fonti
icon: ⚡
order: 4
group: 🚀 Primi passi
mode: both
keywords: [compila, compile, compilazione, ingesta, ingest, recompile, convert, pipeline, barra avanzamento]
context: [compile]
---

## Cos'è la compilazione

La **compilazione** trasforma i documenti caricati (`sources/` → `raw/`) in **note strutturate della wiki** (`wiki/`), creando wikilink, indici e collegamenti. È il cuore di Wiki-Forge.

## Dalla barra in alto (Focus Mode)

1. Clicca **⚡ Compila**.
2. Vedi la **barra avanzamento** con lo stato: *Inizio conversione... → Creazione wikilinks... → Completato*.
3. Al termine la busta si aggiorna: le nuove note compaiono nella barra sinistra.

> ⚠️ La compilazione usa il modello LLM configurato. Se il modello non è disponibile il passaggio fallisce, ma i file restano salvati in `raw/` e potrai ricompilarli quando vuoi.

## Dalla chat (tutte le modalità)

| Comando | Cosa fa |
|---|---|
| `/compile` | Pipeline completa: converte, ingerisce, arricchisce e rigenera gli indici |
| `/ingest <file>` | Ingerisce un singolo file sorgente nella wiki |
| `/recompile` | Ricompila le note già presenti |
| `/convert-only` | Converte le fonti in Markdown **senza** pubblicare nella wiki |

Esempio: scrivi `/compile` nella chat e premi Invio; la risposta arriva in streaming.

## Strumenti correlati (🛠️ Tools, Developer Mode)

- **Convert Sources to Markdown** — conversione batch (parametri: cartella input/output, OCR).
- **Two-Step CoT Enrichment** — arricchimento delle note in due fasi (Analisi → Generazione).
- **Regenerate OKF Indexes** — rigenera `index.md` e gli indici tematici dopo modifiche manuali.

## Consigli

- Carica **poco alla volta** la prima volta: è più facile controllare il risultato.
- Dopo una compilazione controlla la nota **Index** della wiki e usa `/audit` per trovare link rotti o note orfane.
- Se il risultato non ti piace, puoi **modificare le note a mano** — sono solo file Markdown.

**Approfondisci:** `docs/WORKFLOW.md` (flusso completo fonte→wiki), `docs/TUTORIAL.md` §3, `docs/PROCEDURES.md` (procedure di ingesta e ri-compilazione).
