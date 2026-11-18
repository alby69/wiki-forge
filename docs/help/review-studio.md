---
id: review-studio
title: Review Studio
icon: 🧐
order: 8
group: 📖 Uso quotidiano
mode: both
keywords: [review, revisione, verifica, critica, digest, confronta, diff, snapshot, versioni, qualità, qa, approvazione]
context: []
---

## Cos'è

La **Review Studio** è un'unica finestra per controllare la qualità della nota aperta. Si apre con quattro **schede orizzontali** in alto:

| Scheda | A cosa serve |
|---|---|
| **✓ Verifica** | Mostra il *quality gate* (link interni, frontmatter OKF, tag, fonti, scadenza `stale_after`), lo storico delle verifiche e il modulo per registrare una revisione umana. |
| **⚡ Critica** | Avvia una revisione critica avversariale con profondità (`Veloce`, `Standard`, `Approfondita`), focus selezionabili e istruzioni aggiuntive; elenca contraddizioni, citazioni mancanti, contro-argomenti e azioni consigliate. |
| **◷ Digest** | Riassume le ultime attività della wiki (modifiche e verifiche da `wiki/log.md`, note toccate sul disco) con statistiche di salute e prossime azioni. |
| **⇄ Confronta versioni** | Confronta la nota con uno snapshot precedente in vista **unificata** (righe aggiunte e rimosse, con i numeri di riga di snapshot e versione attuale) e permette di ripristinarlo. |

## Come aprirla

- **Tasto destro** su una nota nell'albero dei file → scegli la scheda desiderata.
- Pulsante **🧐 Revisione** nell'header dell'editor.
- Scorciatoie: `Ctrl+Alt+R` (Verifica), `Ctrl+Alt+C` (Critica), `Ctrl+Alt+D` (Digest), `Ctrl+Alt+F` (Confronta versioni).

La scheda si apre sulla nota selezionata; se nessuna nota è aperta, selezionala prima dall'albero dei file o dall'editor.

## Verifica umana

Nella scheda **Verifica**:

1. Controlla il quality gate: i punti rossi indicano cosa sistemare prima di approvare.
2. Indica il **revisore**: il campo ricorda l'ultimo valore usato (in memoria locale) e propone l'ultimo revisore umano della nota, oppure `local`.
3. Spunta **stable** se la nota deve passare anche a `status: stable`.
4. Aggiungi un **commento** facoltativo e premi **Registra verifica**.

La nota passa a 🟢 **Human-Reviewed** e la verifica viene registrata nella frontmatter (`verified`) e in `wiki/log.md`, esattamente come con il comando `/verify`.

## Confronta versioni

Prima di ogni salvataggio, verifica o ripristino il contenuto precedente viene copiato in `.wiki-forge/snapshots/<percorso-nota>/<timestamp>.md`, con un file `.json` che indica data e motivo. Per ogni nota vengono conservati gli ultimi **25** snapshot; la cartella è esclusa da git.

- **Unificata**: un'unica colonna con righe aggiunte (`+`) e rimosse (`−`), affiancate dai numeri di riga dello snapshot (sinistra) e della versione attuale (destra).
- **Ripristina questa versione**: riporta la nota allo snapshot scelto (lo stato corrente viene prima salvato in un nuovo snapshot).

> La cronologia della Review Studio è **locale e indipendente da git**. Per lo storico documentale delle versioni resta disponibile anche il pulsante **🕐 Cronologia**.

## Comandi equivalenti in chat

La Review Studio è il percorso grafico. Le schede **Verifica**, **Digest** e **Confronta versioni** usano endpoint deterministici (funzionano offline); la scheda **Critica** usa il modello configurato e, in mancanza, produce un report deterministico. Gli stessi controlli restano disponibili in chat:

- `/verify <nota> [reviewer=<id>] [stable]` (alias `/human-review`) — stesso identico percorso della scheda Verifica
- `/digest` — riassunto delle attività (il comando chat è interpretato dall'agente)
- `/adversarial-review <nota>` — revisione critica (comando agente)
- `/diff` — confronto versioni (comando agente)

**Approfondisci:** `docs/TUTORIAL.md` §5.1 (trust tier), `docs/AGENT.md` §5 (comandi), `docs/TECHNICAL_ARCHITECTURE.md` §2.11 (API e snapshot).
