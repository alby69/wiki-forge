---
type: Reference
title: "Modificare le note"
description: "Argomenti: modifica, edit, editor, salva, save, toolbar, wikilink, versioni, rollback, indietro, backlinks, metadata, review, revisione, diff, snapshot…"
resource: docs/help/modifica-note.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it, help]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-help-modifica-note-md
    resource: docs/help/modifica-note.md
    title: "Modificare le note"
    author: human:alby69
---
## Modificare una nota

1. Seleziona la nota nella barra sinistra.
2. Clicca **✏️ Edit** (in alto nell'editor): si apre l'editor WYSIWYG.
3. Formatta con la **toolbar** (vedi sotto) e con i comandi di Milkdown/Crepe (slash command, tabelle, immagini, blocchi di codice).
4. **💾 Save & Close** oppure **💾 Save** per salvare, **✖ Cancel** per tornare alla versione precedente. Funziona anche **Ctrl/Cmd+S**.

Le modifiche vengono salvate nel file Markdown della nota: nulla di nascosto, puoi anche modificare i file col tuo editor preferito. Il frontmatter OKF viene conservato byte-per-byte: l'editor modifica solo il corpo della nota.

> L'editor usa Milkdown/Crepe nei browser normali. In ambienti senza DOM completo (per esempio i test automatici) resta disponibile il vecchio editor a sorgente CodeMirror, con le stesse funzioni della toolbar.

## La toolbar

- **↩️ Undo / ↪️ Redo** annulla/ripristina (Ctrl+Z / Ctrl+Y)
- **B / I / S / `</>`** grassetto, corsivo, barrato, codice inline
- **Header...** intestazioni H1–H3
- **• Lista / 1. Lista / ” Quote** elenco puntato, numerato e citazione
- **🎨 Colore...** e **📐 Align...** colore e allineamento del testo (markup HTML preservato nel Markdown)
- La toolbar di Crepe aggiunge tabelle, link, immagini, KaTeX e blocchi di codice con evidenziazione

## I wikilink

Scrivi `[[nome-della-nota]]` per collegare due note:

- Nella lettura diventano link **cliccabili** che navigano alla nota.
- Se la nota non esiste ancora, l'**`/audit`** la segnala come *orfana*: puoi crearla (o farla creare all'agente con `/stub <concetto>`).
- Il **pannello in basso** mostra per la nota corrente: **Node Metadata** (tag, stato, versione), **Backlink** (chi punta a questa nota) e **Outbound** (dove punta questa nota).

## Versioni

- L'icona **cronologia** sulla nota ne mostra le **versioni** con data e riepilogo, e permette di **ripristinare** una versione precedente.
- Ogni nota ha anche una `version` nel suo frontmatter: è la versione "documentale" usata dai processi OKF.

> Nota: il ripristino versioni agisce sull'interfaccia della storia; per cambiamenti strutturati usa i flussi della **cronologia di progetto** (vedi `docs/PROCEDURES.md`).

## Revisione e confronto versioni (Review Studio)

Dall'header dell'editor, col pulsante **🧐 Revisione**, oppure con **tasto destro** su una nota, apri la **Review Studio**:

- **✓ Verifica** — quality gate della nota, storico delle verifiche e modulo di revisione umana (`reviewer`, `stable`, commento).
- **⚡ Critica** — revisione avversariale con profondità e focus selezionabili.
- **◷ Digest** — attività recenti, statistiche di salute e prossime azioni.
- **⇄ Confronta versioni** — diff **unificato** con uno snapshot precedente (righe aggiunte/rimosse e numeri di riga) e ripristino in un clic.

Scorciatoie: `Ctrl+Alt+R` (Verifica), `Ctrl+Alt+C` (Critica), `Ctrl+Alt+D` (Digest), `Ctrl+Alt+F` (Confronta versioni). Gli snapshot sono locali (`.wiki-forge/snapshots/`, ultimi 25 per nota) e indipendenti da git.

## Interrogare e cercare (Research Studio)

Il pulsante **🔎 Ricerca** nell'header dell'editor (o **🔎 Research** nella barra in alto) apre la **Research Studio**, con sei schede:

- **💬 Consult** — domanda in linguaggio naturale, risposta con citazioni.
- **🔍 Ricerca** — full-text su titolo, id, tag e corpo, con numeri di riga e contesto.
- **↩ Backlink** — note che citano quella selezionata tramite `[[wikilink]]`.
- **🧩 Correlate** — note affini per tag e concetti non ancora collegate.
- **🕸️ Traccia** — note che contengono un'affermazione e fonti raw dichiarate, con il passaggio citato.
- **🔬 Deep Research** — report esteso in `output/` e nota di sintesi in `wiki/synthesis/`.

Scorciatoie: `Ctrl+Alt+Q` (Consult), `Ctrl+Alt+S` (Ricerca), `Ctrl+Alt+B` (Backlink), `Ctrl+Alt+L` (Correlate), `Ctrl+Alt+T` (Traccia), `Ctrl+Alt+H` (Deep Research). Dalla chat puoi scrivere gli stessi comandi (`/consult`, `/search`, `/backlinks`, `/related`, `/trace`, `/deep-research`): la scheda si apre con la query già compilata. Ricerca, Backlink, Correlate e Traccia funzionano offline; Consult e Deep Research usano il modello configurato e, in mancanza, un fallback deterministico.

## Studiare e sintetizzare (Study Studio)

Il pulsante **📚 Studio** nell'header dell'editor (o nella barra in alto) apre la **Study Studio**, con sette schede:

- **📝 Guida** — guida di studio con sezioni, glossario e domande di autovalutazione.
- **🧪 Quiz** — quiz a risposta multipla con un numero esatto di domande (1–25).
- **🧠 Mindmap** — albero dei titoli della nota e payload JSON per il grafo.
- **🎙️ Audio** — copione dialogo Host A / Host B in stile podcast.
- **📝 Note** — salvataggio rapido nello Scratchpad (`notes/quick-notes.md`).
- **🚀 Promuovi** — trasforma una voce dello scratchpad in un articolo della wiki.
- **🎓 Tesi** — aggrega capitoli e sintesi mature in una bozza (`output/thesis-<slug>.md` e `output/thesis_compiled.md`).

Scorciatoie: `Ctrl+Alt+G` (Guida), `Ctrl+Alt+K` (Quiz), `Ctrl+Alt+M` (Mindmap), `Ctrl+Alt+A` (Audio). Dalla chat restano disponibili gli stessi comandi (`/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`, `/promote-note`, `/thesis-chapter`), che usano gli stessi generatori deterministici.

## Appunti veloci (Scratchpad)

La vista **📒 Scratchpad** raccoglie appunti rapidi (`/note <testo>` dalla chat, o il campo apposito). Un appunto utile si **promuove a nota vera** con il pulsante dedicato, con `/promote-note <id>` oppure dalla scheda **🚀 Promuovi** della Study Studio.

**Approfondisci:** `docs/USER_GUIDE.md` (editor), `docs/OKF_SPEC.md` (frontmatter e versioni), `docs/PROCEDURES.md`.
