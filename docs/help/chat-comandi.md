---
id: chat-comandi
title: La chat e i comandi
icon: 💬
order: 5
group: 📖 Uso quotidiano
mode: both
keywords: [chat, comandi, slash, comando, agente, assistente, help, consult, domande, comandi chat]
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
| `/verify <nota>` | Segna la nota come verificata da un umano |
| `/study-guide [argomento]` | Guida di studio (con `/quiz`, `/mindmap`) |
| `/wizard [scenario]` | Scenari guidati di onboarding |

L'elenco completo è nel pannello ⚡ Comandi dentro la chat.

## Suggerimento

Non sai da dove partire? Apri la **guida col tasto F1**: gli argomenti sono già scelti in base a cosa stai facendo, e dal pannello puoi passare la domanda all'agente col pulsante **💬 Chiedi all'agente**.

**Approfondisci:** `docs/AGENT.md` §5 (routing dei comandi), `docs/TUTORIAL.md` §5 (tabella comandi).
