---
id: wiki-di-wiki-forge
title: Wiki di wiki-forge
icon: 📚
order: 18
group: ⚙️ Progetti e Dev Mode
mode: dev
keywords: [wiki, docs, documentazione, architettura, consult, projectid, self-documentation, sintesi]
context: [wiki-di-wiki-forge, research-studio, progetti-config]
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
