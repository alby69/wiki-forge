---
type: Reference
title: Wiki di wiki-forge
description: 'Argomenti: wiki, docs, documentazione, architettura, consult, projectid,
  self-documentation, sintesi'
resource: docs/help/wiki-di-wiki-forge.md
tags:
- scope/docs
- layer/generated
- area/riferimenti
- lang/it
- help
status: stable
generated:
  by: process:docs-to-wiki
  at: '2026-11-19T00:00:00Z'
sources:
- id: source-docs-help-wiki-di-wiki-forge-md
  resource: docs/help/wiki-di-wiki-forge.md
  title: Wiki di wiki-forge
  author: human:alby69
  last_modified: '2026-11-20T09:35:27Z'
verified: []
---
## Che cos'è

La **Wiki Docs** è la documentazione di wiki-forge proiettata in formato OKF v0.2 nel progetto dedicato `wikiforge`. Ti permette di fare domande sull'architettura, sulle procedure e sull'uso del programma direttamente dall'interfaccia, senza dover cercare tra i file di `docs/`.

## Come si apre

In Developer Mode clicca **📚 Wiki Docs** nella barra in alto, oppure premi **Ctrl+Alt+D**. Si apre il Research Studio con il badge `Wiki Docs · wiki-forge` e la scheda **Consult** già pronta con una domanda di esempio.

Le interrogazioni usano il progetto `wikiforge` anche se il vault attivo è un altro: **non cambia la wiki su cui stai lavorando**. Puoi passare dalle risposte alla nota sorgente cliccando le citazioni: in quel caso il progetto viene attivato e la nota si apre nell'editor.

## Cosa puoi chiedere

- Quali moduli compongono il backend e come dialogano con la UI?
- Come funziona il flusso Plan → Review → Apply per una modifica proposta dall'agente?
- Quali sono i comandi del KE Workbench e i criteri del Policy Agent?
- Dove è descritto il formato OKF v0.2 e come si valida?

## Fonti e sintesi

Ogni risposta cita le note consultate; quando il provider LLM non è disponibile viene usato un report deterministico con le fonti. Le risposte che vuoi conservare possono essere promosse a note in `sintesi/` con `scripts/promote_doc_answer.py`: richiedono un `reviewer` umano e non modificano mai `docs/`.

## Aggiornamento

Il bundle generato è commitato in git. Dopo una modifica a `docs/` esegui:

```bash
python scripts/docs_to_wiki.py
python scripts/check_docs_sync.py
```

Un job schedulato consultivo (`weekly-docs-wiki-drift`) segnala eventuali disallineamenti senza scrivere nulla.

## Dalla risposta al codice (Fase 76)

Se una risposta approvata suggerisce una modifica a `docs/` o al codice, il ponte Fase 76 la trasforma in una proposta verificabile, **senza applicarla in automatico**:

1. `scripts/wiki_program_change_propose.py` convalida la proposta (blocchi `wiki-edit` o JSON), verifica che il file sia nell'elenco ammesso e che il testo da sostituire compaia una sola volta, e accoda la proposta in `output/program-changes/` insieme a motivazione e fonti.
2. Il Policy Agent F5 sottrae lo step mutante all'esecuzione automatica e lo mette in coda tra le approvazioni.
3. Solo cliccando **✅ Approva** nel pannello **Policy & Approvazioni** (o con `POST /api/ke/schedule/approvals/:id/approve`) lo step viene eseguito: viene richiesto un revisore umano, viene fatto uno snapshot del file e viene scritta una voce di audit.

Nessun job pianificato modifica `docs/`, la wiki o il codice: la proposta resta in attesa finché una persona non la approva.
