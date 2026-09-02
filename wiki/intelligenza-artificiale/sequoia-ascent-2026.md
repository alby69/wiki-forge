---
tags:
- intelligenza-artificiale
- karpathy
- software-3.0
- llm-os
- agentic-engineering
data_creazione: 2026-08-26
data_aggiornamento: 2026-08-26
type: Concept
title: 'Sequoia Ascent 2026: Software 3.0 e Agentic Engineering'
description: Fireside chat a Sequoia Ascent 2026. Karpathy espone **Software 3.0**,
  l'**agentic engineering** e l'AI come nuovo layer programmabile per i...
status: stable
generated:
  by: process:migrate-script
  at: '2026-09-02T10:42:12Z'
verified: []
sources:
- id: src-1
  resource: raw/karpathy-sequoia-ascent-2026_COMPILED.md
  title: Karpathy Sequoia Ascent 2026
  author: process:conv2md
  last_modified: '2026-09-02T10:53:19Z'
---
# Sequoia Ascent 2026: Software 3.0 e Agentic Engineering

Fireside chat a Sequoia Ascent 2026. Karpathy espone **Software 3.0**, l'**agentic engineering** e l'AI come nuovo layer programmabile per il lavoro digitale. È il saggio più centrale per l'architettura dell'LLM-OS HR.

## Punti chiave

- **Software 3.0**: si programma tramite prompt/context/tools/memory/istruzioni; il *context window* è il nuovo programma, l'LLM l'interprete.
- **Dicembre 2025 = inflection point agentico**: si delegano "macro-azioni" (implementa feature, refactoring, test, ricerca).
- **Vibe coding** (alza il pavimento) vs **Agentic engineering** (alza il soffitto): disciplina professionale di coordinare agenti fallibili preservando correttezza/sicurezza/taste.
- **Verificabilità × training attention** spiega dove l'AI vola: *capability spike ≈ verifiability × training attention × data coverage × economic value*.
- **Agent-native infrastructure**: sensori e attuatori, doc Markdown/CLI/API/MCP per l'agente (non per l'umano), azioni auditable.
- *"You can outsource your thinking, but you can't outsource your understanding"* → il giudizio umano resta nel loop.

## L'infrastruttura agent-native

Il mondo va riscritto per agenti: superfici leggibili da LLM (Markdown, CLI, API, MCP, log strutturati, permessi sicuri). MenuGen mostra che il codice era facile; difficile era cablare Vercel/auth/pagamenti/DNS — in un mondo maturo si dice "build MenuGen" e l'agente deploya tutto.

## Perché conta per la tesi (core)

- **Software 3.0 = fondamento dell'LLM-OS HR**: l'HR diventa un sistema operativo cognitivo programmabile sul lavoro.
- **Agent-native infra** (sensors/actuators, MCP, auditable) = l'architettura dell'**HR Operating Layer** descritta in [[mappa-teorica-tesi]].
- **Agentic engineering** = la nuova competenza professionale HR: non "usare ChatGPT", ma orchestrare agenti con evals e guardrail (collega [[stefano-gatti]] sulla trasformazione del lavoro).
- *"Outsource thinking not understanding"* = il ruolo HR si sposta da esecuzione a **direzione/giudizio**, tema che risuona con [[nello-cristianini]] (l'AI come strumento da comprendere, non da delegare ciecamente).

## Articoli correlati

- [[andrej-karpathy]]
- [[verifiability]]
- [[vibe-coding-menugen]]
- [[animals-vs-ghosts]]
- [[nello-cristianini]]
- [[stefano-gatti]]
- [[mappa-teorica-tesi]]
- [[2025-llm-year-in-review]]

## Fonti

- raw/karpathy-sequoia-ascent-2026_COMPILED.md
