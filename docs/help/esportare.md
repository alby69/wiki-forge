---
id: esportare
title: Esportare: PDF, slide, RDF
icon: 📄
order: 10
group: 📖 Uso quotidiano
mode: both
keywords: [esporta, export, pdf, slide, presentazione, rdf, json-ld, turtle, tesi, pandoc, scarica]
context: []
---

## Da dove si esporta

- **Developer Mode → 🛠️ Tools**: gli script di esportazione con i loro parametri (i file finiscono nella cartella `output/`).
- **Chat**: comandi rapidi senza aprire Tools.

## La tesi in PDF (percorso completo)

1. **Compile Thesis Draft** (🛠️ Tools) o chat `/thesis-chapter` — aggrega le note mature in `output/thesis_compiled.md` (parametri: cartella wiki, punteggio minimo di maturità, titolo).
2. **Export Thesis to PDF** (🛠️ Tools) — converte il Markdown in PDF con **Pandoc** (motore `xelatex` di default; supportati anche `pdflatex`, `wkhtmltopdf`, `weasyprint`; opzione senza indice dei contenuti).

> Prerequisito: Pandoc (+ un motore PDF) installati sulla macchina. Se mancano, lo script riporta l'errore nella **console di Tools**.

## Slide

Dalla chat:

```
/slides [argomento]
```

genera una presentazione **reveal.js** (alias: `/generate-slides`).

## Esportazione semantica (RDF)

- Script **Semantic RDF Exporter (JSON-LD/TTL)** in 🛠️ Tools → crea `output/*.jsonld` e `output/*.ttl` da tutta la wiki.
- In chat: `/export-semantic` (stessa pipeline, flusso OKF v0.2).

## Esportazione generica

- Chat: `/export [formato]` — esporta la wiki nel formato indicato.
- Per un backup "da umani": la wiki **è già Markdown**: copia la cartella `wiki/` dove vuoi.

**Approfondisci:** `docs/THESIS_GUIDE.md` (dalla tesi al PDF), `docs/TUTORIAL.md` §6 (export), `docs/OKF_SPEC.md` §interoperabilità (JSON-LD/Turtle).
