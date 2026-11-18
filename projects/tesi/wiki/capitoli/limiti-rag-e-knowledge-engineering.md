---
type: Concept
title: Limiti del RAG e Transizione verso il Knowledge Engineering
description: Analisi dei limiti strutturali del RAG tradizionale — effimerità e perdita
  delle relazioni via chunking — e del passaggio a un paradigma di Knowledge Engineering
  con GraphRAG, Trust Tiers e SHACL.
status: draft
tags:
- topic/ai
- topic/hr
- author/cristianini
- type/essay
- status/draft
generated:
  by: process:wiki-forge-compile
  at: '2026-11-18T13:33:13Z'
verified: []
sources:
- id: limiti-rag-knowledge-base
  resource: raw/1_ Limiti Cognitivi del RAG e la transizione verso una Knowledge Base_COMPILED.md
  title: 'Capitolo 1: Limiti Cognitivi del RAG e la transizione verso una Knowledge
    Base'
  author: human:autore
  last_modified: '2026-11-18'
maturita: 35
copertura_fonti: 1
domande_risolte: 0
stato: draft
---
# Limiti del RAG e Transizione verso il Knowledge Engineering

Il capitolo ricostruisce il percorso che dall'adozione entusiastica degli LLM nelle organizzazioni conduce alla scoperta dei limiti cognitivi del Retrieval-Augmented Generation (RAG) e, da lì, alla necessità di un'infrastruttura di conoscenza persistente. L'argomento centrale è che il RAG classico sia un ottimo recuperatore di informazioni puntuali ma un "ponte incompleto" per l'ingegneria e la governance della conoscenza. La transizione proposta sostituisce la metafora della catena di montaggio con quella del grafo: conoscenza coltivata, connessa e verificabile anziché consumata e dimenticata.

## Summary

- L'AI generativa è entrata nelle organizzazioni come strumento di automazione (recruiting, job description, risposte ai dipendenti), ma nelle Risorse Umane le sue fragilità diventano una questione etica e organizzativa.
- Il RAG è una pipeline lineare e unidirezionale ("catena di montaggio"): ogni stadio trasforma l'output del precedente senza memoria né ritorno, riducendo progressivamente la conoscenza originale.
- **Limite 1 — Effimerità**: ogni sessione RAG è un evento isolato; mancano archiviazione, riconnessione e internalizzazione organizzativa, quindi non si accumula capitale intellettuale.
- **Limite 2 — Chunking**: la frammentazione recide le relazioni logiche (regola/eccezione, condizione/conseguenza), esponendo l'LLM a perdita di contesto, allucinazioni relazionali e incapacità di ragionamento multi-hop.
- La similarity search misura la prossimità semantica, non la natura delle relazioni: due chunk possono essere vicini nello spazio vettoriale ed essere logicamente in opposizione.
- La sintesi comparativa qualifica il RAG come "ponte incompleto" e indica l'evoluzione verso **GraphRAG**, **Trust Tiers** (tracciabilità) e **SHACL** (validazione ontologica).
- Il **Knowledge Engineering** trasforma l'LLM da oracolo usa-e-getta a partner di ricerca che compila e aggiorna una knowledge base dinamica, accessibile anche a professionisti HR non tecnici.

**Confidenza: Media** — sintesi ancorata a un'unica fonte primaria (capitolo 1), con riferimenti puntuali; da triangolare con la letteratura su Cristianini e GraphRAG.

## Contesto: dall'AI generativa alle Risorse Umane

Negli ultimi anni l'IA ha smesso di essere una promessa di laboratorio per diventare una presenza concreta nelle giornate e nelle organizzazioni. Il punto di svolta sono i Large Language Model (LLM), capaci di leggere, riassumere, tradurre e generare testo con naturalezza, e sempre più capaci di ragionare in passaggi sequenziali, usare strumenti e agire come agenti. Il fenomeno riguarda molto più di un'evoluzione del software: impatta il modo in cui lavoriamo, decidiamo, impariamo e attribuiamo valore a ciò che facciamo.

La tesi muove da un interrogativo duplice. Da un lato l'AI generativa è uno strumento formidabile per automatizzare le attività ripetitive e liberare tempo per ciò che conta. Dall'altro mostra un lato fragile quando cade in allucinazioni, dimenticanze e semplificazioni della realtà in frammenti scollegati. Richiamando **Nello Cristianini**, il testo ricorda che l'AI tende a scambiare una regolarità statistica per una comprensione del mondo: nelle Risorse Umane, dove le decisioni riguardano le persone, questa fragilità non è un dettaglio tecnico ma una questione etica e organizzativa.

L'adozione iniziale in ambito HR ha riguardato l'automazione del recruiting, la redazione di job description e il riscontro rapido alle domande dei dipendenti. Il capitolo si propone di seguire l'AI nel suo funzionamento più intimo — dal recupero di informazioni in un sistema RAG ai suoi limiti strutturali — fino alla costruzione di una vera knowledge base, in cui la conoscenza non viene consumata e dimenticata ma coltivata, connessa e resa affidabile.

## Il RAG tradizionale: pipeline e funzionamento

Il Retrieval-Augmented Generation nasce per combinare la capacità generativa degli LLM con il recupero puntuale di informazioni da basi di conoscenza esterne, fornendo un contesto più ampio alla generazione. La sua pipeline classica, tuttavia, introduce progressive semplificazioni della conoscenza originale che ne compromettono il valore a lungo termine.

La pipeline è descritta come una **catena di montaggio dell'informazione**: un flusso sequenziale e unidirezionale in cui i documenti di un'organizzazione vengono trasformati attraverso stadi successivi e nettamente distinti, fino alla risposta finale. Ogni stadio riceve l'output del precedente, lo rielabora secondo una funzione propria e lo consegna a quello seguente, senza mai tornare sui propri passi né conservare traccia di quanto prodotto a monte. La conoscenza è trattata come materia prima su un nastro: lineare, cumulativa nei passaggi, ma priva di memoria e di struttura propria.

Una query attraversa cinque fasi:

1. **Domanda (Input)** — l'utente pone una domanda in linguaggio naturale, ad esempio sulla procedura per richiedere il congedo parentale secondo le policy aziendali.
2. **Traduzione (Embedding)** — la domanda è convertita in un vettore numerico, un'"impronta digitale" matematica che cattura il significato e non solo le parole.
3. **Ricerca (Retrieval)** — il vettore della domanda è confrontato con quelli dei documenti (manuali HR, wiki aziendali); vengono recuperati i frammenti semanticamente più vicini.
4. **Arricchimento (Augmentation)** — le informazioni recuperate sono aggiunte alla domanda, creando un prompt contestualizzato che chiede al modello di rispondere basandosi esclusivamente sul testo fornito.
5. **Risposta (Generation)** — l'LLM genera una risposta chiara e coerente che, grazie al contesto specifico, dovrebbe ridurre le allucinazioni e poter citare la fonte.

La linearità impone che ogni stadio adatti il proprio output alle specifiche dello stadio successivo. In questo processo la materia conoscitiva è ridotta, tradotta e semplificata al punto da non permettere, a valle, il recupero di concetti presenti nelle fasi iniziali. Il RAG è quindi un processo di progressiva trasformazione del sapere governato da regole interne: sono queste regole a definirne potenzialità e limiti.

## Limite strutturale 1: effimerità e mancato accumulo di capitale intellettuale

Il primo grande limite risiede nella natura effimera di ogni sessione di interazione. Ogni conversazione RAG è un evento isolato: la risposta viene presentata all'utente e poi dimenticata dal sistema alla chiusura della sessione. Manca qualsiasi meccanismo nativo per:

- archiviare la risposta prodotta come nuova conoscenza permanente;
- riconnettere l'informazione generata con i concetti preesistenti nella base di conoscenza;
- arricchire l'infrastruttura informativa organizzativa in modo progressivo.

Il RAG tradizionale mostra così un fallimento nelle fasi cruciali della spirale della conoscenza. Manca la **Combinazione**: le sintesi e le soluzioni elaborate dall'LLM non vengono integrate né formalizzate in nuova conoscenza esplicita strutturata. Manca l'**Internalizzazione Organizzativa**: l'apprendimento maturato dall'utente resta una conquista individuale e non diventa patrimonio condiviso.

L'esempio è un dipartimento HR o Legale che interroga un RAG per valutare clausole contrattuali o policy di smart working. Ogni consultazione produce una risposta estemporanea: utile nell'immediato, ma dopo centinaia di sessioni l'organizzazione non possiede una mappa strutturata dei rischi emersi o delle best practice consolidate, solo log di chat disarticolati. Il RAG agisce da mero consultore "usa-e-getta", non da sistema di ingegneria della conoscenza capace di far crescere il capitale intellettuale.

## Limite strutturale 2: chunking, perdita di struttura e allucinazioni relazionali

Il secondo limite nasce da una scelta architetturale tanto semplice quanto radicale: il **chunking**. Per essere indicizzato e trasformato in embedding, un documento deve essere suddiviso in porzioni di testo autonome. È in questa frammentazione che si consuma una perdita silenziosa ma decisiva: un testo non è una somma di frasi indipendenti, ma un tessuto in cui ogni affermazione acquista senso per la sua posizione, le premesse che la precedono e i confronti che la circondano. Riducendolo a micro-frammenti, il RAG recide i fili che tengono insieme il tessuto e conserva i nodi senza le relazioni che li uniscono.

Il testo propone un caso concreto: un regolamento aziendale sui bonus di performance suddiviso in tre chunk.

- **Chunk 1 (Livello Eccellente)** — "Valutazione 'Eccellente': diritto a un bonus del 10% sullo stipendio base."
- **Chunk 2 (Livello Medio)** — "Valutazione 'Nella media': diritto a un bonus del 5% sullo stipendio base."
- **Chunk 3 (Clausola trasversale)** — "Il bonus non viene erogato in caso di sanzioni disciplinari nell'anno in corso, indipendentemente dal livello di valutazione raggiunto."

Ciascun frammento, letto isolatamente, è corretto. Ma il chunking recide il legame logico di dipendenza tra la regola generale (Chunk 1 e 2) e la sua eccezione (Chunk 3). Se un dipendente chiede se spetti il bonus pur avendo ricevuto un richiamo disciplinare, il RAG tradizionale sbaglia in due modi:

1. **Recupero sbilanciato (bias semantico)** — la query contiene le parole forti "valutazione Eccellente" e "bonus", quindi il motore recupera con altissima priorità il Chunk 1; il Chunk 3 rischia di non essere recuperato perché "richiamo disciplinare" e "non erogato" sono semanticamente distanti dalle parole chiave dominanti.
2. **Fallimento del ragionamento condizionale** — il sistema individua i frammenti che assomigliano superficialmente alla domanda ma non comprende la logica (SE eccellente ALLORA 10%, A MENO CHE sanzione).

Poiché i frammenti recuperati sono decontestualizzati, l'LLM è esposto a tre tipologie di errore:

- **Perdita del contesto globale** — leggendo solo il Chunk 1, il modello non sa dell'esistenza della clausola trasversale e risponde in modo parziale o fuorviante ("Sì, ti spetta il 10%").
- **Allucinazioni relazionali** — nel tentativo di essere utile, il modello inventa una giustificazione plausibile ma inesistente ("Il richiamo verbale non inficia il bonus, che rimane del 10%"), presentandola come un fatto estratto dal documento.
- **Incapacità di ragionamento multi-hop** — la risposta corretta richiede di collegare due informazioni distanti (valutazione → Chunk 1; sanzione → Chunk 3); nessun singolo chunk contiene la risposta completa e il sistema non ha un meccanismo nativo per applicare un filtro logico tra frammenti separati.

La radice comune è concettuale: il RAG tratta la conoscenza come un insieme di frammenti isolati, mentre la conoscenza reale è un **grafo di entità e relazioni**. La similarity search misura solo la prossimità semantica nello spazio vettoriale, ma resta cieca di fronte alla natura delle relazioni logiche (regola-eccezione, condizione-conseguenza). Due chunk possono essere vettorialmente vicini pur essendo logicamente in opposizione, e lontani pur essendo complementari. È questa cecità strutturale a rendere il chunking un limite che nessun aumento della dimensione del modello o della qualità dei dati può da solo colmare.

## Sintesi comparativa: il RAG come "ponte incompleto"

I limiti descritti mostrano come il RAG classico sia un ottimo strumento di recupero informativo puntuale, ma un'infrastruttura inadeguata per l'ingegneria e la governance della conoscenza organizzativa.

| Dimensione | RAG tradizionale | Conseguenza operativa |
|---|---|---|
| Persistenza | Risposte effimere confinate alla sessione chat | Mancato accumulo di capitale intellettuale |
| Struttura | Chunking rigido e decontestualizzato | Perdita delle relazioni logiche gerarchiche |
| Recupero | Similarità semantica vettoriale "piatta" | Fallimento su confronti complessi e query multi-hop |
| Validazione | Assenza di vincoli e verifiche ontologiche | Rischio di allucinazioni relazionali non rilevate |

Per superare questa condizione di "ponte incompleto" il capitolo indica l'avanzamento verso un'architettura **GraphRAG**, supportata da meccanismi di tracciabilità (**Trust Tiers**) e di validazione ontologica (**SHACL**), capace di preservare la rete relazionale della conoscenza e di trasformare ogni interazione in un tassello di arricchimento permanente della knowledge base aziendale.

## Il paradigma del Knowledge Engineering

Il passaggio fondamentale consiste nel transitare da un approccio passivo di retrieval a una pratica attiva di **Knowledge Engineering**. In questo modello l'LLM non è un oracolo usa-e-getta ma un partner di ricerca che compila e aggiorna una knowledge base dinamica e interconnessa. La conoscenza diventa un artefatto persistente, le cui relazioni sono esplicite e verificabili.

Per essere applicabile in ambito Risorse Umane — dove operatori e manager possiedono competenze prevalentemente organizzative e giuridico-sociali, non informatiche — la piattaforma elimina ogni barriera d'ingresso tecnica. La complessità tecnologica del Knowledge Engineering viene "astratta" e resa usabile, così che il professionista HR possa concentrarsi sulla qualità dei contenuti e sul valore organizzativo della conoscenza.

## Related

- [[capacita-emergenti-llm]]
- [[architetture-multi-agente]]
- [[governance-controllo-responsabilita]]
- [[concezioni-dell-ia]]
- [[competenze-e-hr]]
- [[nello-cristianini]]
- [[wiki-forge-script-panel]]

## Sources

- [Capitolo 1 — Contesto e domanda di ricerca](<raw/1_ Limiti Cognitivi del RAG e la transizione verso una Knowledge Base_COMPILED.md#L3-L44>) — Dall'AI generativa alle Risorse Umane; fragilità come questione etica e organizzativa.
- [Capitolo 1 — Il RAG tradizionale](<raw/1_ Limiti Cognitivi del RAG e la transizione verso una Knowledge Base_COMPILED.md#L48-L123>) — Definizione, pipeline come "catena di montaggio" e cinque fasi della query.
- [Capitolo 1 — Limite Strutturale 1](<raw/1_ Limiti Cognitivi del RAG e la transizione verso una Knowledge Base_COMPILED.md#L125-L161>) — Effimerità, assenza di combinazione e internalizzazione organizzativa.
- [Capitolo 1 — Limite Strutturale 2](<raw/1_ Limiti Cognitivi del RAG e la transizione verso una Knowledge Base_COMPILED.md#L165-L254>) — Chunking, perdita delle relazioni logiche, allucinazioni relazionali e multi-hop.
- [Capitolo 1 — Sintesi comparativa](<raw/1_ Limiti Cognitivi del RAG e la transizione verso una Knowledge Base_COMPILED.md#L258-L286>) — Tabella dei limiti e transizione a GraphRAG, Trust Tiers e SHACL.
- [Capitolo 1 — Knowledge Engineering](<raw/1_ Limiti Cognitivi del RAG e la transizione verso una Knowledge Base_COMPILED.md#L295-L311>) — Da retrieval passivo a partner di ricerca; accessibilità per il professionista HR.
