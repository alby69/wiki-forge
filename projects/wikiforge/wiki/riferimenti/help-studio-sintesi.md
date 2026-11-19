---
type: Reference
title: "Studio, quiz e sintesi"
description: "Argomenti: studio, study, quiz, mindmap, mappa, sintesi, consult, approfondimento, riassunto, audio, capitolo, tesi"
resource: docs/help/studio-sintesi.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it, help]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-help-studio-sintesi-md
    resource: docs/help/studio-sintesi.md
    title: "Studio, quiz e sintesi"
    author: human:alby69
---
## Studiare la tua wiki

Tutti questi comandi si usano **dalla chat** e lavorano sulle note già compilate. Lo stesso flusso è disponibile in forma grafica nella **Study Studio** (pulsante **📚 Studio**, `Ctrl+Alt+G/K/M/A`): ogni scheda corrisponde a un comando e mostra subito risultato, fonti e percorso del file salvato.

I comandi principali:

| Comando | Cosa ottieni |
|---|---|
| `/study-guide [argomento]` | Una **guida di studio** strutturata (concetti, definizioni, punti chiave) |
| `/quiz [argomento]` | Un **quiz di autovalutazione** a risposta multipla |
| `/mindmap [argomento]` | Una **mappa concettuale** in Markdown |
| `/consult <argomento>` | Una **sintesi multi-fonte** con citazioni ai wikilink delle note |
| `/deep-research <domanda>` | Ricerca approfondita multi-fonte su una domanda |
| `/audio-overview [argomento]` | Un **copione audio** tipo podcast per riascoltare l'argomento |
| `/thesis-chapter [argomento]` | Aggrega le note mature in un **capitolo di tesi** |

Senza argomento lavorano sull'intera wiki; con l'argomento restringono il campo (es. `/quiz ontologie`).

## Appunti e promozioni

- `/note <testo>` — salva subito un appunto nello **Scratchpad**.
- `/promote-note <id>` — trasforma un appunto in **nota vera** della wiki (nella vista 📒 Scratchpad c'è il pulsante equivalente).

## Come chiedere bene

- Più l'argomento è **specifico**, migliore è la sintesi: *«/quiz tipi di trust tier»* funziona meglio di *«/quiz»*.
- Per domande libere usa la chat senza slash: l'agente usa le note come contesto.
- Se la risposta è troppo generica, prova a **compilare prima** le note sull'argomento (`/compile`) o a indicare il nome di una nota.

**Approfondisci:** `docs/TUTORIAL.md` §4 (studio e sintesi), `docs/THESIS_GUIDE.md` (flusso tesi completo), `docs/KNOWLEDGE_ENGINEERING.md`.
