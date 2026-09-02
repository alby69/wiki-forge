---
tags:
- intelligenza-artificiale
- karpathy
- automazione
- verificabilita
data_creazione: 2026-08-26
data_aggiornamento: 2026-08-26
type: Concept
title: 'Verifiability: cosa si automatizza con l''AI'
description: La **verificabilità** è la feature predittiva chiave di ciò che si automatizza
  con l'AI, parallela alla "specificabilità" che governava il S...
status: stable
generated:
  by: process:migrate-script
  at: '2026-09-02T10:42:12Z'
verified: []
sources:
- id: src-1
  resource: raw/karpathy-verifiability_COMPILED.md
  title: Karpathy Verifiability
  author: process:conv2md
  last_modified: '2026-09-02T10:53:19Z'
---
# Verifiability: cosa si automatizza con l'AI

La **verificabilità** è la feature predittiva chiave di ciò che si automatizza con l'AI, parallela alla "specificabilità" che governava il Software 1.0.

## Punti chiave

- **Software 1.0** automatizza ciò che si può *specificare*; **Software 2.0** automatizza ciò che si può *verificare*.
- Un task verificabile ha un ambiente: **resettable** (nuovi tentativi), **efficient** (molti tentativi), **rewardable** (segnale di successo automatico). L'AI può "praticarlo".
- Questo genera la **frontiera frastagliata** (jagged): matematica, codice, puzzle avanzano; creatività, strategia, senso comune arretrano.
- Politica per founder/ricercatori: cercare domini verificabili ma sottotrainati dai lab per fine-tuning/RL propri.

## La frontiera jagged

Dove c'è verifica, l'RL porta i modelli oltre gli esperti (matematica, codice, video-watching). Dove non c'è, resta il "magic" della generalizzazione o l'imitazione debole. È il meccanismo dietro i progressi disuguali degli LLM.

## Perché conta per la tesi

- In HR i task **verificabili** (validazione buste paga, check di compliance, classificazione, matching strutturato) si automatizzano per primi; quelli **non verificabili** (giudizio, cultura, gestione dei conflitti) restano umani: collegato a [[stefano-gatti]].
- La verifica è anche un tema epistemico: come si "capiscono" le macchine, richiama [[nello-cristianini]] (comprendere i modelli).
- La formula completa (verifiability × training attention × data coverage × economic value) è in [[sequoia-ascent-2026]].

## Articoli correlati

- [[andrej-karpathy]]
- [[nello-cristianini]]
- [[stefano-gatti]]
- [[sequoia-ascent-2026]]
- [[mappa-teorica-tesi]]

## Fonti

- raw/karpathy-verifiability_COMPILED.md
