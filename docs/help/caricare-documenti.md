---
id: caricare-documenti
title: Caricare documenti
icon: 📥
order: 3
group: 🚀 Primi passi
mode: both
keywords: [carica, upload, importa, import, file, pdf, docx, drop, trascina, fonti, sorgenti, sources, web clipper, notebooklm]
context: [upload, import-md]
---

Hai tre modi per portare i tuoi documenti nella wiki.

## 1. Pill 📥 Carica (drag & drop)

1. In Focus Mode clicca **📥 Carica** nella barra in alto.
2. Trascina i file nella finestra: **PDF, EPUB, DOCX, MD, TXT**.
3. I file finiscono nella cartella `sources/` del progetto.
4. Chiudi la finestra e clicca **⚡ Compila** per trasformarli in note.

## 2. Pill 📝 Importa (un singolo Markdown)

1. Clicca **📝 Importa**.
2. Scegli il file `.md`, la **cartella di destinazione** della wiki (es. `fonti`, `concetti`, `sintesi`...) e conferma.
3. Il file viene ingerito e compilato subito: la nota compare nella barra sinistra.

## 3. Caricamento dalla barra laterale

Nell'albero dei file a sinistra puoi **caricare file dentro una cartella specifica**: tasto destro/azione upload sulla cartella → scegli i file. Utile per organizzare subito la struttura.

## Altre sorgenti (Developer Mode → 🛠️ Tools)

| Strumento | A cosa serve |
|---|---|
| **Web Clipper** | Incolla un URL: salva la pagina come Markdown pulito in `sources/web-clips/` |
| **Import NotebookLM Export** | Importa l'esportazione Markdown di NotebookLM con i metadati OKF |
| **Voice & Multimedia Ingest** | Trascrizioni audio/dictation → nota Markdown |
| **Convert Sources to Markdown** | Conversione batch di PDF/DOCX/EPUB in `raw/` (con OCR opzionale) |

## Cosa succede dopo

I file caricati sono solo *fonti*: diventano **note della wiki** con la **compilazione** (pulsante ⚡ Compila o `/compile`). Se non hai ancora configurato un modello LLM, i file restano in attesa in `raw/` e puoi compilarli in seguito.

**Approfondisci:** `docs/TUTORIAL.md` §3 (ingestione), `docs/SOURCES.md` (formati e pipeline delle fonti), `docs/STARTUP.md` (struttura delle cartelle).
