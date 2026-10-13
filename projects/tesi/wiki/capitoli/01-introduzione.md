---
type: Concept
title: 'Capitolo 1: Introduzione'
description: 'Panoramica, premesse e ipotesi di ricerca: l''impatto dell''AI sulle Risorse Umane e il limite del RAG tradizionale'
status: draft
tags:
  - thesis/chapter
  - topic/ai
  - topic/hr
  - status/draft
  - status/review
generated:
  by: process:jules-agent
  at: '2026-10-12T00:00:00Z'
verified:
  - by: human:autore
    at: '2026-10-12T00:00:00Z'
sources:
  - id: thesis-design-doc
    resource: raw/thesis-design-doc.md
    title: Documento di Progettazione della Tesi Magistrale
maturita: 90
copertura_fonti: 1
domande_risolte: 0
stato: draft
---

# Capitolo 1: Introduzione — Panoramica, Premesse e Ipotesi di Ricerca

## 1.1 Contestualizzazione
L'avvento dei modelli linguistici di grande scala (LLM) ha innescato una trasformazione profonda nell'organizzazione del lavoro e nella gestione del capitale umano. Nelle Risorse Umane, le soluzioni basate su AI generativa sono state inizialmente percepite come strumenti per l'automazione del recruiting, la redazione di job description e la risposta rapida a quesiti dei dipendenti.

## 1.2 Il RAG Tradizionale: Funzionamento e Limiti Strutturali
Per comprendere appieno le ragioni che spingono verso l'adozione di architetture avanzate di gestione della conoscenza, è indispensabile analizzare il funzionamento interno dei sistemi di *Retrieval-Augmented Generation* (RAG) tradizionali e identificare i vincoli strutturali che ne limitano l'efficacia in contesti complessi e aziendali. Il RAG nasce come architettura ibrida ideata per combinare la capacità generativa degli LLM con il recupero puntuale di informazioni da basi di conoscenza esterne, fornendo un contesto alla generazione. Tuttavia, la sua pipeline classica introduce progressive semplificazioni della conoscenza originale che ne compromettono il valore a lungo termine.

### 1.2.1 La Pipeline Classica del RAG
La pipeline convenzionale del RAG opera attraverso tre fasi sequenziali:

1. **Fase A — Indicizzazione (Preparazione della Base Conoscitiva)**:
   - **Chunking**: I documenti sorgente (PDF, policy aziendali, report) vengono suddivisi in porzioni di testo chiamate *chunk* (in genere compresi tra 256 e 1024 token). Tale frammentazione è resa necessaria dai limiti delle finestre di contesto degli LLM e dalla maggiore resa dei modelli di embedding su testi di breve estensione.
   - **Embedding**: Ciascun chunk viene convertito in un vettore ad alta dimensionalità (es. 1536 dimensioni) tramite un modello di embedding. Il vettore sintetizza la rilevanza semantica superficiale del frammento, ma ne perde la struttura logica e relazionale.
   - **Vector Store**: I vettori vengono archiviati in un database vettoriale (es. Pinecone, Milvus, Weaviate) ottimizzato per la ricerca rapida per similarità spaziale.

2. **Fase B — Retrieval (Recupero del Contesto)**:
   - Alla formulazione di un quesito da parte dell'utente, la query viene a sua volta vettorializzata.
   - Il sistema calcola la similarità coseno (o altra metrica di distanza) tra il vettore query e i vettori archiviati nel database.
   - Vengono estratti i *k* chunk più vicini nello spazio vettoriale (tipicamente tra 3 e 10 frammenti).

3. **Fase C — Generation (Produzione della Risposta)**:
   - I frammenti recuperati vengono inseriti nel prompt inoltrato all'LLM come contesto aggiuntivo.
   - L'LLM elabora una risposta basandosi unicamente su tali informazioni, riducendo l'incidenza di allucinazioni dirette ma rimanendo vincolato alla qualità e alla completezza dei chunk ricevuti.

### 1.2.2 Limite Strutturale #1: Effimerità e Mancato Accumulo di Capitale Intellettuale
Il primo grande limite risiede nella natura **effimera** di ogni sessione di interazione. Ogni conversazione RAG costituisce un evento isolato: la risposta elaborata dall'LLM viene presentata all'utente per poi essere *dimenticata* dal sistema alla chiusura della sessione. Manca qualsiasi meccanismo nativo per:
- Archiviare la risposta o l'inferenza prodotta come nuovo asset conoscitivo permanente.
- Riconnettere l'informazione generata con i concetti preesistenti nella base di conoscenza.
- Arricchire l'infrastruttura informativa organizzativa in modo progressivo.

Rileggendo questo limite alla luce del modello SECI di Nonaka & Takeuchi (approfondito nel [[capitoli/03-progettazione-della-piattaforma|Capitolo 3]]), il RAG tradizionale mostra un chiaro fallimento nelle fasi cruciali della spirale della conoscenza:
- **Assenza di Combinazione**: Le sintesi e le soluzioni elaborate dall'LLM non vengono integrate né formalizzate in nuova conoscenza esplicita strutturata.
- **Assenza di Internalizzazione Organizzativa**: L'apprendimento maturato dall'utente durante l'interazione rimane una conquista individuale e non si trasforma in patrimonio condiviso per l'organizzazione.

Ad esempio, in un dipartimento Risorse Umane o Legale in cui si interroga un RAG per valutare clausole contrattuali o policy di *smart working*, ogni consultazione produce una risposta estemporanea. Sebbene utile nell'immediato, dopo centinaia di sessioni l'organizzazione non possiede una mappa strutturata dei rischi emersi o delle *best practice* consolidate, disponendo unicamente di log di chat disarticolati. Il RAG agisce così da mero consultore "usa-e-getta", anziché da sistema d'ingegneria della conoscenza in grado di far crescere il capitale intellettuale.

### 1.2.3 Limite Strutturale #2: Perdita di Struttura Logica e Allucinazioni sui Confronti
Il secondo limite fondamentale scaturisce direttamente dal processo di *chunking*. Spezzettare un documento continuo in micro-frammenti distrugge la **struttura relazionale** e la gerarchia logica delle informazioni.

Si consideri un testo in cui vengono confrontati tre profili di competenze o strumenti (es. *Prodotto A*, *Prodotto B* e *Prodotto C*). Quando il documento viene suddiviso in tre chunk distinti:
- Chunk 1: "Il Prodotto A costa 100€ ed è adatto a professionisti."
- Chunk 2: "Il Prodotto B costa 50€ ed è pensato per principianti."
- Chunk 3: "Il Prodotto C costa 150€ ed è la scelta premium."

Qualora l'utente ponga una domanda comparativa o sintetica ("Qual è la soluzione ideale per un principiante con budget ridotto?"), la ricerca per similarità semantica (piatta) recupererà con alta probabilità il Chunk 2 e marginalmente il Chunk 1. Poiché i frammenti sono decontestualizzati e scollegati, l'LLM si trova costretto a *ricostruire* arbitrariamente le relazioni mancanti, incorrendo in tre tipologie di errore:
1. **Perdita del contesto globale**: Mancata comprensione del fatto che A, B e C costituiscono alternative comparabili appartenenti alla medesima categoria.
2. **Allucinazioni relazionali**: Generazione di inferenze non supportate o errate sulle relazioni reciproche.
3. **Incapacità di ragionamento multi-hop e aggregativo**: Impossibilità di rispondere con accuratezza a quesiti che richiedono l'aggregazione di dati distribuiti su più sezioni (es. conteggi, filtraggi condizionali o analisi di dipendenza).

La radice del problema risiede nel fatto che il RAG tradizionale tratta il sapere come un insieme discreto di **frammenti isolati**, anziché come un **grafo di entità e relazioni**. La *similarity search* si limita ad individuare la prossimità semantica nello spazio vettoriale, ma rimane "cieca" di fronte alla natura delle relazioni (es. *is-a*, *costa*, *dipende-da*, *adatto-a*).

### 1.2.4 Sintesi Comparativa: Il RAG come "Ponte Incompleto"
I limiti descritti mostrano come il RAG classico rappresenti un ottimo strumento di recupero informativo puntuale, ma un'infrastruttura del tutto inadeguata per l'ingegneria e la governance della conoscenza organizzativa.

| Dimensioni | RAG Tradizionale | Conseguenza Operativa |
| :--- | :--- | :--- |
| **Persistenza** | Risposte effimere confinate alla sessione chat | Mancato accumulo di capitale intellettuale |
| **Struttura** | Chunking rigido e decontestualizzato | Perdita delle relazioni logiche gerarchiche |
| **Recupero** | Similarità semantica vettoriale "piatta" | Fallimento su confronti complessi e query multi-hop |
| **Validazione** | Assenza di vincoli e verifiche ontologiche | Rischio di allucinazioni relazionali non rilevate |

Per superare questa condizione di "ponte incompleto", si rende necessario l'avanzamento verso un'architettura **GraphRAG**, supportata da meccanismi di tracciabilità (*Trust Tiers*) e validazione ontologica (*SHACL*), in grado di preservare la rete relazionale della conoscenza e di trasformare ogni interazione in un tassello di arricchimento permanente della Knowledge Base aziendale (tematiche sviluppate nel [[capitoli/03-progettazione-della-piattaforma|Capitolo 3]]).

## 1.3 Il Paradigma del Knowledge Engineering e la Democratizzazione dell'Interfaccia
Il passaggio fondamentale consiste nel passare da un approccio passivo di retrieval a una pratica attiva di **Knowledge Engineering**. In questo modello, l'LLM non è un oracolo usa-e-getta, ma un partner di ricerca che compila e aggiorna una Knowledge Base dinamica interconnessa.

Affinché questo paradigma sia concretamente applicabile nell'ambito delle Risorse Umane — dove gli operatori e i manager possiedono competenze prevalentemente organizzative e giuridico-sociali piuttosto che informatiche —, la piattaforma elimina ogni barriera d'ingresso tecnica. L'infrastruttura di Knowledge Engineering viene messa a disposizione attraverso un'interfaccia visiva (Web UI) suddivisa in due livelli:
* **Modalità Semplice (Focus Mode 🌱)**: Progetta l'interazione attorno ad un'interfaccia semplificata basata sul flusso operativo a tre fasi dettagliato nel [[capitoli/03-progettazione-della-piattaforma|Capitolo 3]], consentendo all'HR Specialist di alimentare il sistema, avviare l'estrazione dei concetti e consultare il Knowledge Graph senza dover scrivere codice o righe di comando.
* **Modalità Sviluppatore / Governance (Developer Mode 👑)**: Offre al Knowledge Engineer o al referente di Data Governance strumenti di audit, gestione delle tassonomie (**🏷️ Tag Manager**), validazione delle domande di competenza (**🧠 KE Workbench**) e revisione della coda di approvazione (**📥 Review Queue**).

In questo modo, la complessità tecnologica del Knowledge Engineering viene totalmente "astratta" e resa usabile, permettendo al professionista HR di concentrarsi sulla qualità dei contenuti e sul valore organizzativo della conoscenza.

## 1.4 Ipotesi di Ricerca
1. L'AI generativa nelle HR non sostituisce il fattore umano, ma richiede nuove competenze di *Knowledge Curation* e *Data Governance*.
2. Un'architettura ibrida (Discovery via NotebookLM + Consolidation via Wiki-Forge Web UI) permette di costruire una Knowledge Base aziendale accademica ed enterprise priva dei limiti del RAG classico e pienamente usabile da operatori non tecnici.

## Collegamenti Correlati
- [[capitoli/00-frontespizio-e-sinossi|Frontespizio e Sinossi]]
- [[capitoli/02-studio-degli-attori-principali|Capitolo 2: Studio degli Attori Principali]]
- [[capitoli/03-progettazione-della-piattaforma|Capitolo 3: Progettazione della Piattaforma]]
- [[sostituzione-o-trasformazione]]
- [[concezioni-dell-ia]]
- [[competenze-e-hr]]
