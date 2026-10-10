---
type: Reference
title: Comandi per iniziare a studiare la wiki
description: Percorso guidato dei comandi chat dell'agente per orientarsi, interrogare, studiare e gestire la knowledge base.
status: draft
tags: ["topic/ai", "status/draft"]
generated:
  by: process:wiki-forge
  at: "2026-10-10T00:00:00Z"
---

# Comandi per iniziare a studiare la wiki

I comandi si danno in chat all'agente (prefisso `/`). Percorso consigliato:

**1. Orientati**
- `/stats` — metriche della KB (articoli, link, orfani, gap)
- `/wizard academic` — scenario preset per tesi accademica
- `consult` legge prima `wiki/index.md`: se la wiki è vuota, prima va popolata con `/compile` (vedi sotto)

**2. Interroga e comprendi**
- `/consult "<domanda>"` — risposta sintetizzata con citazioni `[[wikilink]]` e livelli di confidenza
- `/search <termine>` — ricerca full-text con snippet di contesto
- `/trace <claim>` — risale dall'affermazione fino a `raw/file.md#L<start>-L<end>-L<end>`
- `/backlinks <articolo>` e `/related <articolo>` — esplora connessioni e concetti affini

**3. Studia attivamente** (generano file in `output/`)
- `/study-guide <wiki|articolo>` — guida con sommario, glossario e domande di autovalutazione
- `/quiz <argomento> [n]` — quiz a scelta multipla con spiegazioni e fonti
- `/mindmap <articolo>` — mappa concettuale ad albero
- `/audio-overview <argomento>` — script podcast a due voci (TTS disattivato: `[audio] provider="none"`)
- `/deep-research <domanda>` — report multi-fonte con matrice di attribuzione e gap

**4. Gestisci appunti**
- `/note "<testo>"` → `notes/`; `/promote-note <id>` → articolo wiki ufficiale

Nota importante: sul filesystem la cartella `wiki/` è **vuota** (solo `prova/` e `test-empty-folder/`) e `raw/` è assente. Per studiare serve prima contenuto compilato: metti le fonti in `sources/` (config: `backup/`) → `make convert` → `/compile`. Se invece intendi le note già presenti nel contesto, posso generarti subito uno `/study-guide` o un `/quiz` su Graeber, Cristianini, Sanfilippo e le linee guida HR: dimmi da quale autore/tema partire.