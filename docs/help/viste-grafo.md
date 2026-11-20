---
id: viste-grafo
title: Viste: File, Editor, Scratchpad, Graph, Split
icon: 🕸️
order: 6
group: 📖 Uso quotidiano
mode: both
keywords: [viste, vista, file, editor, scratchpad, graph, grafo, split, affiancata, visualizzazione, nodi, spazio]
context: [viste-grafo]
---

## Le viste in un unico riquadro

In alto trovi un **unico riquadro segmentato** con cinque pulsanti, nell'ordine **🗂️ File · 📝 Editor · 📒 Note rapide · 🕸️ Grafo · ◧ Divisione**:

| Vista | Cosa mostra |
|---|---|
| **🗂️ File** | Mostra/nasconde il file manager a sinistra (toggle indipendente, come le viste) |
| **📝 Editor** | Solo il testo della nota (massimo spazio per scrivere) |
| **📒 Scratchpad** | Appunti veloci sopra l'area editor (fai click due volte per richiuderla) |
| **🕸️ Graph** | Solo il Knowledge Graph: tutti i collegamenti tra le note |
| **◧ Split** | **Tre pannelli: File · Editor · Grafo** — la vista migliore per navigare mentre scrivi |

Cliccando due volte sullo stesso bottone si chiude la vista (compare la schermata *Vista chiusa*). **Split** fa eccezione: al secondo click torna all'ultima vista singola (Editor, Scratchpad o Graph) a tutto spazio. Dalla vista Split, un click su Editor, Scratchpad o Graph mostra subito quel pannello a larghezza intera. Entrare in Split **apre automaticamente il pannello File**; il pulsante **🗂️ File** può comunque chiuderlo e riaprirlo anche mentre sei in Split.

## Il Knowledge Graph

- **Click su un nodo** → la nota si apre nella vista **Editor** (se eri in Graph) oppure resta nella vista corrente; lo Split si attiva solo dal pulsante **◧ Split**.
- I **controlli in alto** (sopra il grafo) permettono di:
  - **filtrare per cartella** e per **tag** (note mostrate/nascoste);
  - **ingrandire/rimpicciolire** (🔍 +/−) e **riportare a schermo intero** (⌖).
- I nodi colorati seguono la cartella di appartenenza; le etichette mostrano il titolo delle note.

## La barra laterale e lo spazio dell'editor

- La colonna sinistra (**file manager + tag cloud**) si può **chiudere col pulsante 🗂️ File** nella barra in alto (o con il vecchio `◀` sul suo bordo), per dare più spazio all'editor. Il pulsante `▶` sul bordo la riapre: i due controlli sono sincronizzati e la scelta resta valida al prossimo avvio.
- Trascinando il bordo si regola la larghezza (200–500 px).
- In vista **Split** la colonna diventa il primo dei tre pannelli affiancati (File · Editor · Grafo).
- Anche il **pannello inferiore** (Node Metadata/Backlinks) si ridimensiona trascinandone il bordo superiore, e si nasconde col pulsante dedicato nella toolbar dell'editor.

## Tag cloud

In basso nella barra sinistra c'è la **tag cloud**: clicca un tag per filtrare sia la lista note sia il grafo (clicca di nuovo per annullare). Selezionando un namespace (es. `topic`) vengono incluse anche le sue sotto-categorie (`topic/ai`, `topic/llm`...).

**Approfondisci:** `docs/TUTORIAL.md` §2 (viste), `docs/GRAPH_RAG.md` (come funziona il grafo), `docs/USER_GUIDE.md`.
