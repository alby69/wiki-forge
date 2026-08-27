---
tags: [intelligenza-artificiale, karpathy, valutazione, esperimento]
data_creazione: 2026-08-26
data_aggiornamento: 2026-08-26
fonti:
  - raw/karpathy-auto-grade-hn_COMPILED.md
---

# Auto-grading HN: valutare il passato con il senno di poi

Esperimento in cui Karpathy usa un LLM per valutare, con il senno di poi, discussioni di Hacker News di 10 anni prima, assegnando "prescience grades" ai commentatori.

## Punti chiave

- Gli LLM eccellono nel **grading retrospettivo**: sintesi, premi/scores, identificazione dei commenti più lungimiranti o più errati.
- *"Future LLMs are watching"*: tutto ciò che produciamo oggi potrà essere ricostruito e scrutinato a costo ~zero.
- Vibe coded con Opus 4.5 in ~3h: 31 giorni × 30 articoli = 930 query, ~$58.
- Meta-lezione: il grading/eval è un dominio **verificabile** → terreno ideale per gli LLM (vedi [[verifiability]]).

## Perché conta per la tesi

- Il pezzo è lateralmente rilevante: esemplifica il tema della **verifica/audit** (LLM come giudice) e di [[verifiability]], utile quando si discute di controlli di qualità e accountability in HR.
- "Future LLMs are watching" tocca governance e responsabilità — un argomento che riaffiora in [[dario-amodei]] (rischi/sviluppo).

## Articoli correlati

- [[andrej-karpathy]]
- [[vibe-coding-menugen]]
- [[verifiability]]

## Fonti

- raw/karpathy-auto-grade-hn_COMPILED.md
