---
type: Reference
title: "Research Studio"
description: "Argomenti: research, ricerca, consult, search, backlink, backlinks, related, correlate, trace, traccia, deep research, deep-research, fonti, citazioni…"
resource: docs/help/research-studio.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it, help]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-help-research-studio-md
    resource: docs/help/research-studio.md
    title: "Research Studio"
    author: human:alby69
---
## Cos'è

La **Research Studio** è un'unica finestra per interrogare la wiki. Riunisce in sei **schede orizzontali** i comandi della categoria 🔍 *Interrogazione e Ricerca*:

| Scheda | Comando | A cosa serve |
|---|---|---|
| **💬 Consult** | `/consult` | Fai una domanda in linguaggio naturale: la wiki viene cercata per parole chiave, le note pertinenti diventano il contesto e la risposta cita le fonti con `[[wikilink]]`. |
| **🔍 Ricerca** | `/search` | Ricerca full-text case-insensitive su titolo, id, tag e corpo, con numero di riga e contesto per ogni corrispondenza. |
| **↩ Backlink** | `/backlinks` | Elenca le note che citano quella selezionata tramite `[[wikilink]]`, con la riga della citazione. |
| **🧩 Correlate** | `/related` | Suggerisce note affini per tag e vocabolario **non ancora collegate**, in entrambe le direzioni. |
| **🕸️ Traccia** | `/trace` | Collega un'affermazione alle note che la contengono e alle fonti raw dichiarate, mostrando il passaggio citato. |
| **🔬 Deep Research** | `/deep-research` | Produce un report esteso e una nota di sintesi, salvati in `output/` e `wiki/synthesis/`. |

## Come aprirla

- Pulsante **🔎 Research** nella barra in alto.
- Pulsante **🔎 Ricerca** nell'header dell'editor.
- **Tasto destro** su una nota → voci **Backlink della nota** e **Correlazioni suggerite**.
- Scorciatoie: `Ctrl+Alt+Q` (Consult), `Ctrl+Alt+S` (Ricerca), `Ctrl+Alt+B` (Backlink), `Ctrl+Alt+L` (Correlate), `Ctrl+Alt+T` (Traccia), `Ctrl+Alt+H` (Deep Research).
- Dalla chat: scrivi un comando della categoria (es. `/search governance`) e la Research Studio si apre sulla scheda corrispondente, con la query già compilata.

## Cosa è deterministico e cosa usa il modello

- **Ricerca**, **Backlink**, **Correlate** e **Traccia** non chiamano mai il modello: funzionano anche offline e restituiscono sempre lo stesso risultato a parità di wiki.
- **Consult** e **Deep Research** usano il provider LLM configurato. Se il provider non risponde, la finestra resta utilizzabile con un **fallback deterministico** chiaramente etichettato (in ambra): Consult elenca le note più pertinenti trovate, Deep Research scrive comunque il report con la matrice delle fonti.

## Le schede in dettaglio

### Consult
Scrivi la domanda e premi **Chiedi alla wiki**. In alto nella risposta un badge indica se è arrivata dal modello (verde) o dal fallback (ambra). Sotto la risposta, **Note usate come contesto** elenca le note passate al modello; ogni voce apre la nota nell'editor. **Copia risposta** porta il Markdown negli appunti.

### Ricerca
La query viene confrontata con titolo, id, tag e corpo delle note. I risultati sono ordinati per rilevanza (un titolo che contiene la frase pesa più di una parola sparsa nel corpo) e mostrano:

- numero di righe corrispondenti e punteggio;
- fino a 4 estratti con il **numero di riga** e una riga di contesto prima e dopo.

Le statistiche riportano note trovate, righe totali, note scansionate e durata in millisecondi.

### Backlink
Scegli la nota di riferimento dal menu a tendina e premi **Carica backlink**. Per ogni nota che la cita viene mostrata la **prima** riga con un `[[wikilink]]` risolto verso la nota scelta (gli alias vengono risolti come nel resto dell'app). La nota stessa è esclusa.

### Correlate
Scegli la nota e premi **Suggerisci correlazioni**. Il punteggio combina **tag in comune** (peso maggiore) e **concetti condivisi** (termini frequenti e significativi, senza stopword). Sono escluse la nota stessa e tutte quelle già collegate in uscita o in entrata: l'elenco propone solo connessioni mancanti.

### Traccia
Inserisci un'affermazione o un concetto e premi **Traccia**. Per ogni nota corrispondente la scheda mostra:

- dove è avvenuto il match (`id`, `titolo`, `corpo`, `link`);
- i **link uscenti**;
- le **fonti raw** dichiarate nel frontmatter (`sources:`) o nella sezione `## Sources`, con il passaggio citato quando è disponibile un ancoraggio `#L10-L25` oppure quando la query viene trovata nel file raw (`Inferred`).

Una fonte mancante sul disco è segnalata come **file assente**, senza interrompere il tracciamento.

### Deep Research
Scrivi la domanda e premi **Avvia deep research**. Il backend:

1. seleziona le note che contengono almeno una parola della domanda;
2. costruisce il report con Executive Summary, Thematic Deep-Dive, **Source Attribution Matrix** e Knowledge Gaps;
3. salva il risultato in `output/research-<slug>-<data>.md` e una copia in `wiki/synthesis/<slug>.md`, con frontmatter `tags: [deep-research, synthesis, …]` e l'elenco delle note usate come `sources`;
4. se il modello è configurato, la sintesi LLM sostituisce il corpo del report; altrimenti resta il report deterministico.

La scheda mostra numero di articoli consultati, percorso del report e della sintesi, e il Markdown completo. **Copia report** copia il contenuto negli appunti.

## Comandi equivalenti in chat

Le sei schede sono il percorso grafico; gli stessi comandi restano disponibili in chat e vengono intercettati per aprire la scheda corrispondente:

- `/consult <domanda>`
- `/search <query>`
- `/backlinks <nota>`
- `/related <nota>`
- `/trace <affermazione>`
- `/deep-research <domanda>`

**Approfondisci:** `docs/TUTORIAL.md` §2/§5, `docs/USER_GUIDE.md` (Research Studio), `docs/TECHNICAL_ARCHITECTURE.md` §2.12 (API e determinismo).
