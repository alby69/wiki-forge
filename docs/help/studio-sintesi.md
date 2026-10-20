---
id: studio-sintesi
title: Studio, quiz e sintesi
icon: 🎓
order: 9
group: 📖 Uso quotidiano
mode: both
keywords: [studio, study, quiz, mindmap, mappa, sintesi, consult, approfondimento, riassunto, audio, capitolo, tesi]
context: []
---

## Studiare la tua wiki

Tutti questi comandi si usano **dalla chat** e lavorano sulle note già compilate:

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
