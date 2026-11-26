---
type: Reference
title: "Study Studio"
description: "Argomenti: study, studio, studio-studio, guida di studio, study-guide, quiz, autovalutazione, mindmap, mappa concettuale, audio, audio-overview, podcast, note…"
resource: docs/help/study-studio.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it, help]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-26T00:00:00Z"
sources:
  - id: source-docs-help-study-studio-md
    resource: docs/help/study-studio.md
    title: "Study Studio"
    author: human:alby69
---
## Cos'è

La **Study Studio** è l'unica finestra grafica per studiare e sintetizzare la wiki. Riunisce in sette **schede orizzontali** i comandi della categoria 📚 *Studio e Sintesi*:

| Scheda | Comando | A cosa serve |
|---|---|---|
| **📝 Guida** | `/study-guide [argomento]` | Guida di studio con riassunto, sezioni per nota, glossario e domande di autovalutazione. |
| **🧪 Quiz** | `/quiz [argomento] [n]` | Quiz a risposta multipla con spiegazione; il numero di domande è esatto (1–25). |
| **🧠 Mindmap** | `/mindmap [nota]` | Albero gerarchico dei titoli della nota più il payload JSON per il grafo. |
| **🎙️ Audio** | `/audio-overview [argomento]` | Copione dialogo **Host A / Host B** in stile podcast, pronto per la sintesi vocale. |
| **📝 Note** | `/note <testo>` | Salva un appunto nello **Scratchpad** (`notes/quick-notes.md`), fuori dall'indice della wiki. |
| **🚀 Promuovi** | `/promote-note <id> [cartella]` | Trasforma una voce dello scratchpad in un articolo vero, aggiornando gli indici. |
| **🎓 Tesi** | `/thesis-chapter [argomento]` | Aggrega capitoli e sintesi mature in una bozza di capitolo di tesi. |

## Come aprirla

- Pulsante **📚 Studio** nella barra in alto.
- Pulsante **📚 Studio** nell'header dell'editor.
- **Tasto destro** su una nota → sezione **Study Studio** con Guida, Quiz, Mindmap e Copione audio.
- Scorciatoie: `Ctrl+Alt+G` (Guida), `Ctrl+Alt+K` (Quiz), `Ctrl+Alt+M` (Mindmap), `Ctrl+Alt+A` (Audio).
- Se una nota è aperta, le schede generative propongono il suo titolo come argomento; la Mindmap lo usa come radice.

## Cosa è deterministico

Tutte e sette le schede lavorano sulle note già presenti nella wiki e **non chiamano il modello linguistico**: a parità di wiki producono sempre lo stesso risultato e funzionano anche offline. Gli artefatti vengono salvati nella cartella `output/` del progetto:

| Scheda | File prodotto |
|---|---|
| Guida | `output/study-guide-<slug>.md` |
| Quiz | `output/quiz-<slug>.md` |
| Mindmap | `output/mindmap-<slug>.md` |
| Audio | `output/audio-script-<slug>.md` |
| Tesi | `output/thesis-<slug>.md` + `output/thesis_compiled.md` |
| Promuovi | `wiki/<cartella>/<slug>.md` |
| Note | `notes/quick-notes.md` |

La scheda **Audio** genera solo il copione: la sintesi MP3 resta disabilitata finché non configuri un provider `[audio]` in `config.toml`.

## Le schede in dettaglio

### Guida
Scrivi l'argomento e premi **Genera guida**. La guida seleziona le note più pertinenti (titolo, id, cartella e parole chiave), ne cita i percorsi reali nel frontmatter `sources` e mostra:

- **Executive Summary** con il numero di articoli usati;
- **Section Breakdown**, una sezione per nota con folder e termini chiave;
- **Key Glossary** e **Self-Assessment Questions**.

In fondo, **Note usate come fonte** apre ogni articolo nell'editor. **Copia guida** porta il Markdown negli appunti.

### Quiz
Scegli l'argomento e quante domande generare (da 1 a 25), poi premi **Genera quiz**. Ogni domanda ha quattro opzioni, la risposta corretta e una spiegazione che rimanda alla nota di origine. Se l'argomento non trova note specifiche, il quiz usa comunque le note disponibili senza interrompersi.

### Mindmap
Scegli la nota dal menu a tendina oppure scrivi titolo o id, poi premi **Genera mindmap**. La scheda mostra:

- il numero di **sezioni** (titoli `##` e `###`) e di **wikilink** uscenti;
- l'albero gerarchico in Markdown;
- il payload JSON con nodi e collegamenti, importabile nel grafo.

Se il testo non corrisponde a nessuna nota, viene usata la prima nota della wiki; l'errore compare solo quando la wiki è vuota.

### Audio
Scrivi l'argomento e premi **Genera copione**. Il dialogo alterna **Host A** e **Host B**, cita le note coperte e include il frontmatter con le fonti. È utile per riascoltare un argomento con un lettore TTS esterno.

### Note
Scrivi il testo e premi **Salva nello scratchpad**. La nota riceve un id basato sul timestamp (`AAAA-MM-GG-HH-mm-ss`) e compare subito nell'elenco in basso, ordinato dalla più recente. Gli appunti restano in `notes/quick-notes.md` e **non entrano** in `wiki/index.md` finché non vengono promossi.

### Promuovi
Scegli una voce dello scratchpad, indica la **cartella wiki** di destinazione (default `general`) e premi **Promuovi**. Il backend:

1. crea l'articolo `wiki/<cartella>/<slug>.md` usando il testo della voce selezionata;
2. aggiunge il frontmatter `tags: [promoted-note, <cartella>]` e la fonte `notes/quick-notes.md`;
3. aggiorna l'indice tematico della cartella e l'indice principale.

Al termine la scheda mostra titolo e percorso dell'articolo creato; la wiki si ricarica automaticamente.

### Tesi
Imposta **argomento**, **maturità minima** (0–100) ed eventualmente il **titolo della bozza**, poi premi **Compila capitolo**. La bozza contiene:

- **Parte I — Capitoli Strutturati**: note con `tipo: capitolo_tesi`, ordinate per `capitolo_numero`;
- **Parte II — Sintesi e Modelli Concettuali**: note con `tipo: sintesi` e `maturita` pari o superiore alla soglia.

La scheda elenca capitoli e sintesi con percorso e punteggio di maturità. Ogni esecuzione aggiorna anche la bozza canonica `output/thesis_compiled.md`, così **Export Thesis to PDF** in Developer Mode → 🛠️ Tools trova subito il testo da convertire.

## Comandi equivalenti in chat

Le sette schede sono il percorso grafico; gli stessi comandi restano disponibili in chat e passano dagli stessi generatori deterministici:

- `/study-guide <argomento>`
- `/quiz <argomento> [numero]`
- `/mindmap <nota>`
- `/audio-overview <argomento>`
- `/note <testo>`
- `/promote-note <id> [cartella]`
- `/thesis-chapter [argomento] [title=<titolo>] [maturity=<soglia>]`

**Approfondisci:** `docs/guida/TUTORIAL.md` §4 (studio e sintesi), `docs/guida/USER_GUIDE.md` (Study Studio), `docs/architettura/ARCHITECTURE.md` §3.4 (API e determinismo), `docs/guida/THESIS_GUIDE.md` (flusso tesi completo).
