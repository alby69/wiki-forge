---
id: viste-grafo
title: Viste: Editor, Scratchpad, Graph, Split
icon: 🕸️
order: 6
group: 📖 Uso quotidiano
mode: both
keywords: [viste, vista, editor, scratchpad, graph, grafo, split, affiancata, visualizzazione, nodi, spazio]
context: [viste-grafo]
---

## Le 4 viste

In alto a destra trovi il selettore a 4 bottoni:

| Vista | Cosa mostra |
|---|---|
| **📝 Editor** | Solo il testo della nota (massimo spazio per scrivere) |
| **📒 Scratchpad** | Appunti veloci sopra l'area editor (fai click due volte per richiuderla) |
| **🕸️ Graph** | Solo il Knowledge Graph: tutti i collegamenti tra le note |
| **◧ Split** | Editor e Graph affiancati — la vista migliore per navigare mentre scrivi |

Cliccando due volte su un bottone si chiude la vista (compare la schermata *Vista chiusa*).

## Il Knowledge Graph

- **Click su un nodo** → la nota si apre e la vista passa a *Split*.
- I **controlli in alto** (sopra il grafo) permettono di:
  - **filtrare per cartella** e per **tag** (note mostrate/nascoste);
  - **ingrandire/rimpicciolire** (🔍 +/−) e **riportare a schermo intero** (⌖).
- I nodi colorati seguono la cartella di appartenenza; le etichette mostrano il titolo delle note.

## La barra laterale e lo spazio dell'editor

- La colonna sinistra (**file manager + tag cloud**) si può **chiudere col pulsante `◀`** sul suo bordo, per dare più spazio all'editor (in particolare in vista *Editor* e *Split*). Il pulsante `▶` la riapre: la scelta resta valida al prossimo avvio.
- Trascinando il bordo si regola la larghezza (200–500 px).
- Anche il **pannello inferiore** (Node Metadata/Backlinks) si ridimensiona trascinandone il bordo superiore, e si nasconde col pulsante dedicato nella toolbar dell'editor.

## Tag cloud

In basso nella barra sinistra c'è la **tag cloud**: clicca un tag per filtrare sia la lista note sia il grafo (clicca di nuovo per annullare). Selezionando un namespace (es. `topic`) vengono incluse anche le sue sotto-categorie (`topic/ai`, `topic/llm`...).

**Approfondisci:** `docs/TUTORIAL.md` §2 (viste), `docs/GRAPH_RAG.md` (come funziona il grafo), `docs/USER_GUIDE.md`.
