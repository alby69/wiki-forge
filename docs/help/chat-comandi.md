---
id: chat-comandi
title: La chat e i comandi
icon: 💬
order: 5
group: 📖 Uso quotidiano
mode: both
keywords: [chat, comandi, slash, comando, agente, assistente, help, consult, domande, comandi chat, review, revisione, digest, diff, search, backlinks, related, trace, deep-research, research, study, studio, quiz, mindmap, audio, note, tesi, template, new-article]
context: []
---

## Aprire la chat

- **💬 Agent Chat** nella barra in alto (entrambe le modalità), oppure
- il pulsante **💬 Chiedi** dei 4 passi in Focus Mode.

La chat mostra lo **storico delle conversazioni** (salvato localmente) e i pulsanti in alto per ingrandirla (⛶) o cancellare lo storico (🗑️).

## Fare una domanda

Scrivi in naturale e premi Invio:

> *«Quali note parlano di ontologie?»*
> *«Riassumi la nota X»*

La risposta dell'agente arriva in **streaming** e può proporre modifiche: se include un blocco di modifica, compare il pulsante **Applica modifica** (o rispondi *«sì, procedi»* / usa `/apply`).

## I comandi slash

Digitando `/` si apre il pannello **⚡ Comandi**: il catalogo completo, diviso per categoria (Ingestione, Curatela, Audit, Ricerca, Studio, Knowledge Engineering, Slide, Utility). I più usati:

| Comando | Cosa fa |
|---|---|
| `/help [argomento]` | **Guida in-app** (stessi contenuti di F1, in testo) |
| `/consult <argomento>` | Sintesi multi-fonte con citazioni |
| `/compile` | Compila fonti → wiki |
| `/audit` | Controlla link rotti, orfani, frontmatter |
| `/trace <argomento>` | Traccia le connessioni di un concetto |
| `/search <query>` | Ricerca full-text nella wiki |
| `/backlinks <nota>` | Note che citano quella indicata |
| `/related <nota>` | Correlazioni suggerite (note non ancora collegate) |
| `/deep-research <domanda>` | Report esteso con matrice delle fonti |
| `/verify <nota>` | Segna la nota come verificata da un umano |
| `/digest` | Riassunto delle attività e della salute della wiki |
| `/adversarial-review [nota]` | Revisione critica: contraddizioni e citazioni mancanti |
| `/study-guide [argomento]` | Guida di studio (con `/quiz`, `/mindmap`) |
| `/wizard [scenario]` | Scenari guidati di onboarding |

L'elenco completo è nel pannello ⚡ Comandi dentro la chat.

> **Equivalente grafico**: `/verify`, `/digest`, `/adversarial-review` e `/diff` hanno una controparte nella **Review Studio** (tasto destro sulla nota, pulsante **🧐 Revisione** o `Ctrl+Alt+R/C/D/F`), che è il percorso consigliato per controllare qualità, storico e diff della nota aperta.
>
> I sei comandi di ricerca (`/consult`, `/search`, `/backlinks`, `/related`, `/trace`, `/deep-research`) hanno una controparte nella **Research Studio** (pulsanti **🔎 Research** / **🔎 Ricerca**, tasto destro sulla nota o `Ctrl+Alt+Q/S/B/L/T/H`). Scrivendo uno di questi comandi nella chat, la scheda corrispondente si apre con la query già compilata.
>
> I comandi di studio (`/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`, `/promote-note`, `/thesis-chapter`) hanno una controparte nella **Study Studio** (pulsanti **📚 Studio** o `Ctrl+Alt+G/K/M/A`). La finestra usa gli stessi generatori deterministici dei comandi e salva i risultati in `output/`; gli appunti restano in `notes/quick-notes.md` finché non li promuovi.
>
> **Attenzione ai template**: `/template show` e `/new-article <nome>` sono elencati nel pannello ⚡ Comandi e negli skill, ma il router della chat non li gestisce (cadono nella risposta LLM libera). Per creare una nota da template usa **📐 Template** nel menu `⋯` e **➕ Nuovo file** nella colonna sinistra: la finestra grafica chiede nome, percorso wiki e template, con anteprima. Vedi *Modificare le note* → *Creare un documento da un template*.

## Suggerimento

Non sai da dove partire? Apri la **guida col tasto F1**: gli argomenti sono già scelti in base a cosa stai facendo, e dal pannello puoi passare la domanda all'agente col pulsante **💬 Chiedi all'agente**.

**Approfondisci:** `docs/AGENT.md` §5 (routing dei comandi), `docs/TUTORIAL.md` §5 (tabella comandi).
