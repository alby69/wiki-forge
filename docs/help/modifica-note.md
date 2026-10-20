---
id: modifica-note
title: Modificare le note
icon: ✏️
order: 7
group: 📖 Uso quotidiano
mode: both
keywords: [modifica, edit, editor, salva, save, toolbar, wikilink, versioni, rollback, indietro, backlinks, metadata]
context: [versioni]
---

## Modificare una nota

1. Seleziona la nota nella barra sinistra.
2. Clicca **Modifica** (in alto nell'editor): il testo diventa modificabile.
3. Formatta con la **toolbar** (vedi sotto).
4. **💾 Salva** (Ctrl+S-like) per salvare, oppure **Annulla** per tornare alla versione precedente.

Le modifiche vengono salvate nel file Markdown della nota: nulla di nascosto, puoi anche modificare i file col tuo editor preferito.

## La toolbar

- **↶ / ↷** annulla/ripristina (Ctrl+Z / Ctrl+Y)
- **B / I / S / `code`** grassetto, corsivo, barrato, codice
- **Menu H** intestazioni H1–H4
- **Liste** puntate e numerate, **citazione** `>`
- ** colore testo ** e **allineamento**
- **Link**: inserisci rapidamente collegamenti

## I wikilink

Scrivi `[[nome-della-nota]]` per collegare due note:

- Nella lettura diventano link **cliccabili** che navigano alla nota.
- Se la nota non esiste ancora, l'**`/audit`** la segnala come *orfana*: puoi crearla (o farla creare all'agente con `/stub <concetto>`).
- Il **pannello in basso** mostra per la nota corrente: **Node Metadata** (tag, stato, versione), **Backlink** (chi punta a questa nota) e **Outbound** (dove punta questa nota).

## Versioni

- L'icona **cronologia** sulla nota ne mostra le **versioni** con data e riepilogo, e permette di **ripristinare** una versione precedente.
- Ogni nota ha anche una `version` nel suo frontmatter: è la versione "documentale" usata dai processi OKF.

> Nota: il ripristino versioni agisce sull'interfaccia della storia; per cambiamenti strutturati usa i flussi della **cronologia di progetto** (vedi `docs/PROCEDURES.md`).

## Appunti veloci (Scratchpad)

La vista **📒 Scratchpad** raccoglie appunti rapidi (`/note <testo>` dalla chat, o il campo apposito). Un appunto utile si **promuove a nota vera** con il pulsante dedicato (o `/promote-note <id>`).

**Approfondisci:** `docs/USER_GUIDE.md` (editor), `docs/OKF_SPEC.md` (frontmatter e versioni), `docs/PROCEDURES.md`.
