---
tags: [intelligenza-artificiale, karpathy, vibe-coding, llm-os]
data_creazione: 2026-08-26
data_aggiornamento: 2026-08-26
fonti:
  - raw/karpathy-vibe-coding-menugen_COMPILED.md
---

# Vibe Coding: MenuGen

MenuGen è la prima app "vibe coded" end-to-end di Andrej Karpathy: un'applicazione reale (foto del menù di un ristorante → immagini dei piatti) costruita senza scrivere codice manuale, solo descrivendo cosa si voleva a Cursor+Claude.

## Punti chiave

- Il **vibe coding** abbatte la barriera alla creazione di software: chiunque può costruire un'app descrivendola in linguaggio naturale.
- La prototipazione locale è rapidissima (sensazione di essere all'80% "fatto"), ma il **deploy reale** (auth, pagamenti, DNS, segreti) è il vero collo di bottiglia.
- Gli LLM hanno conoscenze delle API leggermente obsolete e commettono errori di design sottili ma critici (es. il bug Stripe/email in MenuGen, risolto solo con intervento umano).
- La frustrazione finale — *"how are we supposed to be automating society by 2027 like this?"* — evidenzia quanto l'infrastruttura non sia ancora pronta per gli agenti.

## Cos'è successo

Karpathy parte da un demo locale (React+Claude 3.7) e procede ad aggiungere: chiamate OpenAI (OCR), Replicate (generazione immagini), deploy Vercel, autenticazione Clerk, pagamenti Stripe, fino a database e code. Ogni servizio richiede account, chiavi API, doc e configurazione che l'LLM gestisce male (conoscenza deprecata, allucinazioni, rate-limit). Il "glue work" consuma la maggior parte del tempo, non l'editor di codice.

## Perché conta per la tesi

- Il vibe coding è il **pavimento** (floor) dell'automazione: un qualsiasi addetto HR potrebbe creare automazioni iper-specifiche senza sviluppo software. Collega a [[power-to-the-people]] e a [[stefano-gatti]] (democratizzazione del lavoro cognitivo).
- Il doloroso "glue work" di deploy anticipa il tema dell'**agent-native infrastructure** di [[sequoia-ascent-2026]]: finché i servizi non sono pensati per gli agenti, l'automazione reale resta faticosa e fragile.

## Articoli correlati

- [[andrej-karpathy]]
- [[power-to-the-people]]
- [[sequoia-ascent-2026]]
- [[stefano-gatti]]

## Fonti

- raw/karpathy-vibe-coding-menugen_COMPILED.md
