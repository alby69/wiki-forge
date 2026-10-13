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

Negli ultimi anni l'intelligenza artificiale ha smesso di essere una promessa di laboratorio per diventare una presenza concreta nelle nostre giornate e nelle nostre organizzazioni. Il punto di svolta è arrivato con i modelli linguistici di grande scala (LLM): sistemi capaci di leggere, riassumere, tradurre e generare testo con una naturalezza che fino a poco prima sembrava appannaggio esclusivo dell'essere umano. Da quella soglia la corsa non si è più fermata: modelli sempre più grandi, poi sempre più capaci di ragionare in passaggi sequenziali, poi in grado di usare strumenti e di agire con una certa autonomia come agenti. È un percorso che affascina e insieme inquieta, perché tocca molto più del software — tocca il modo in cui lavoriamo, decidiamo, impariamo e, in definitiva, attribuiamo valore a ciò che facciamo.

Ed è proprio qui che nasce l'interrogativo di questa tesi. Se da un lato l'AI generativa si presenta come uno strumento formidabile per automatizzare le attività ripetitive e liberare tempo da dedicare a ciò che conta davvero, dall'altro mostra il suo lato fragile appena la si spinge fuori dalla superficie: allucina, dimentica, semplifica la realtà in frammenti scollegati e, come osserva Cristianini, tende a scambiare una regolarità statistica per una comprensione del mondo. Nel lavoro quotidiano — e in particolare nelle Risorse Umane, dove le decisioni riguardano persone — queste fragilità non sono un dettaglio tecnico, ma una questione etica e organizzativa.

Le pagine che seguono vogliono essere la porta d'ingresso a questo mondo. Non ci si limiterà a osservare l'AI dall'esterno: la si seguirà nel suo funzionamento più intimo, dal recupero di informazioni in un sistema RAG fino ai suoi limiti strutturali, e da lì alla costruzione di una vera e propria knowledge base — un'infrastruttura in cui la conoscenza non viene consumata e dimenticata, ma coltivata, connessa e resa affidabile. È il racconto di un passaggio: dall'AI come strumento usa-e-getta all'AI come partner di ricerca, in un dialogo continuo tra tecnologia, lavoro e responsabilità umana.

## 1.1 Contestualizzazione
L'avvento dei modelli linguistici di grande scala (LLM) ha innescato una trasformazione profonda nell'organizzazione del lavoro e nella gestione del capitale umano. Nelle Risorse Umane, le soluzioni basate su AI generativa sono state inizialmente percepite come strumenti per l'automazione del recruiting, la redazione di job description e la risposta rapida a quesiti dei dipendenti.

## 1.2 Il RAG Tradizionale: Funzionamento e Limiti Strutturali
Per comprendere appieno le ragioni che spingono verso l'adozione di architetture avanzate di gestione della conoscenza, è indispensabile analizzare il funzionamento interno dei sistemi di *Retrieval-Augmented Generation* (RAG) tradizionali e identificare i vincoli strutturali che ne limitano l'efficacia in contesti complessi e aziendali. Il RAG nasce come architettura ibrida ideata per combinare la capacità generativa degli LLM con il recupero puntuale di informazioni da basi di conoscenza esterne, fornendo un contesto alla generazione. Tuttavia, la sua pipeline classica introduce progressive semplificazioni della conoscenza originale che ne compromettono il valore a lungo termine.

Prima di addentrarci nel dettaglio delle sue componenti, conviene soffermarsi su che cosa significhi, concettualmente, descrivere il RAG come una *pipeline*. L'immagine sottesa è quella di una catena di montaggio dell'informazione: un flusso sequenziale e unidirezionale in cui il materiale di partenza — i documenti di un'organizzazione — viene progressivamente trasformato attraverso stadi successivi e nettamente distinti, fino al risultato finale, ossia la risposta fornita all'utente. Ogni stadio riceve l'output del precedente, lo rielabora secondo una funzione propria e lo consegna a quello seguente, senza mai tornare sui propri passi né conservare traccia di quanto prodotto negli stadi a monte. La conoscenza viene così trattata come una materia prima che scorre su un nastro: lineare, cumulativa nei passaggi, ma priva di memoria e di struttura propria.

Proprio questa linearità, tuttavia, ne rivela anche la fragilità. Poiché ogni stadio deve adattare il proprio input al formato richiesto dal successivo, la materia conoscitiva viene di passaggio in passaggio ridotta, tradotta e semplificata; e ciò che in questa riduzione progressiva va perduto non è più recuperabile a valle. Definire la pipeline del RAG non significa dunque soltanto elencarne le tappe, ma riconoscere che essa è un processo di progressiva trasformazione del sapere, governato da regole interne: sono queste regole, più della quantità di dati archiviati, a fissarne i limiti.

### 1.2.1 La Pipeline Classica del RAG
La pipeline convenzionale del RAG opera attraverso tre fasi sequenziali:

1. **Fase A — Indicizzazione (Preparazione della Base Conoscitiva)**:
   - **Chunking**: I documenti sorgente (PDF, policy aziendali, report) vengono suddivisi in porzioni di testo chiamate *chunk* (in genere compresi tra 256 e 1024 token). Tale frammentazione è resa necessaria dai limiti delle finestre di contesto degli LLM e dalla maggiore resa dei modelli di embedding su testi di breve estensione.
   - **Embedding**: Ciascun chunk viene convertito in un vettore ad alta dimensionalità (es. 1536 dimensioni) tramite un modello di embedding. Il vettore sintetizza la rilevanza semantica superficiale del frammento, ma ne perde la struttura logica e relazionale.
   - **Vector Store**: I vettori vengono archiviati in un database vettoriale (es. Pinecone, Milvus, Weaviate) ottimizzato per la ricerca rapida per similarità spaziale.

2. **Fase B — Retrieval (Recupero del Contesto)**:
   - **Vettorializzazione della query**: Il quesito dell'utente non viene confrontato come testo, ma tradotto nello stesso linguaggio numerico dei chunk. La query è convertita in un vettore tramite il medesimo modello di embedding usato in indicizzazione: solo così domanda e frammenti risultano collocati nella stessa "mappa" semantica e la loro vicinanza diventa confrontabile.
   - **Misura della vicinanza (similarità coseno)**: Il sistema valuta quanto ogni vettore-chunk "punta nella stessa direzione" del vettore-query calcolando la similarità coseno, cioè il coseno dell'angolo tra i due vettori (1 = stessa direzione, 0 = estranei, -1 = opposti). Misurare l'angolo e non la lunghezza rende il confronto indipendente dall'estensione del frammento. Altre metriche possibili sono il prodotto scalare e la distanza euclidea.
   - **Selezione dei k migliori (top-k)**: I chunk vengono ordinati per similarità decrescente e si conservano solo i k più vicini (tipicamente 3-10). Il parametro k è un compromesso: un valore troppo basso rischia di omettere contesto necessario, uno troppo alto introduce frammenti marginali che diluiscono la pertinenza e consumano inutilmente la finestra di contesto dell'LLM. Essendo una ricerca "piatta", essa individua ciò che assomiglia alla domanda ma resta cieca alle relazioni tra i concetti — il presupposto dei limiti discussi in §1.2.3.

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
Il secondo limite strutturale non nasce da un errore di implementazione né da una carenza di potenza computazionale, ma da una scelta architetturale tanto semplice quanto radicale: il *chunking*. Per poter essere indicizzato e trasformato in embedding, un documento deve essere suddiviso in porzioni di testo autonome; ed è proprio in questa frammentazione che si consuma una perdita silenziosa ma decisiva. Un testo, infatti, non è una somma di frasi indipendenti: è un tessuto in cui ogni affermazione acquista senso in virtù della sua posizione, delle premesse che la precedono e dei confronti che la circondano. Riducendolo a micro-frammenti, il RAG recide i fili che tengono insieme quel tessuto e ne conserva i nodi, ma non le relazioni che li uniscono. La **struttura relazionale** e la gerarchia logica delle informazioni, che l'occhio umano ricostruisce senza sforzo, svaniscono nel momento stesso in cui il documento smette di essere un testo unitario per diventare una collezione di ritagli.

Per rendere tangibile questo fenomeno, si immagini un documento in cui vengono confrontati tre profili di competenze o tre strumenti alternativi (per semplicità, *Prodotto A*, *Prodotto B* e *Prodotto C*). Il senso dell'intero passaggio risiede precisamente nella comparazione: i tre elementi sono presentati insieme proprio perché devono essere messi a confronto l'uno con l'altro. Al momento dell'indicizzazione, però, il documento viene suddiviso in tre chunk distinti:

- Chunk 1: "Il Prodotto A costa 100€ ed è adatto a professionisti."
- Chunk 2: "Il Prodotto B costa 50€ ed è pensato per principianti."
- Chunk 3: "Il Prodotto C costa 150€ ed è la scelta premium."

Ciascun frammento, letto isolatamente, è corretto; ma da nessuno di essi emerge più l'informazione che prima li teneva insieme, ossia che A, B e C sono alternative confrontabili, appartenenti alla medesima categoria e ordinate secondo un criterio di prezzo e di pubblico di riferimento. Il contesto — cioè ciò che dava significato all'elenco — è stato sacrificato sull'altare della granularità.

Supponiamo ora che l'utente ponga una domanda che richieda proprio quel confronto d'insieme: "Qual è la soluzione ideale per un principiante con budget ridotto?". La ricerca per similarità semantica, essendo una ricerca "piatta" fondata sulla vicinanza dei vettori, si orienterà verso i frammenti che più assomigliano superficialmente alla domanda: recupererà con alta probabilità il Chunk 2, che menziona esplicitamente i principianti, e soltanto marginalmente il Chunk 1. Il Chunk 3, che pure contiene il dato sul prezzo più alto e quindi un'informazione potenzialmente rilevante per escludere un'opzione, potrebbe non essere recuperato affatto, poiché la parola "premium" non risuona con "budget ridotto". Il sistema ha individuato i frammenti più simili alla frase, ma non ha compreso la domanda.

È qui che si manifesta il vero danno. Poiché i frammenti recuperati sono decontestualizzati e scollegati tra loro, l'LLM si trova nella condizione di dover *ricostruire arbitrariamente* le relazioni andate perdute; e nel farlo — privo di qualsiasi vincolo che gli imponga l'aderenza al testo originale — è esposto a tre tipologie di errore, che vale la pena distinguere con chiarezza:

1. **Perdita del contesto globale**: l'LLM non ha modo di sapere che A, B e C appartengono alla medesima categoria e che erano presentati come alternative comparabili. Ciascuno di essi gli appare come un'entità isolata, e una raccomandazione formulata senza la consapevolezza del quadro d'insieme è destinata a risultare parziale o fuorviante.
2. **Allucinazioni relazionali**: quando le relazioni non sono fornite, il modello non si limita a tacerle, ma tende a inventarle. Genera cioè inferenze sulle connessioni reciproche (chi è più conveniente di chi, quale opzione dipende da quale requisito) che non trovano alcun fondamento nel materiale recuperato, presentandole però con la stessa sicurezza di un fatto accertato.
3. **Incapacità di ragionamento multi-hop e aggregativo**: i quesiti che richiedono di combinare informazioni distribuite su più sezioni — un conteggio, un filtraggio condizionale, un'analisi di dipendenza tra criteri — restano fuori portata, perché nessun singolo chunk contiene la risposta e il sistema non possiede alcun meccanismo per mettere in relazione, in modo strutturato, frammenti diversi.

La radice comune di questi tre errori è concettuale e riguarda il modo in cui il RAG tradizionale concepisce la conoscenza. Esso tratta il sapere come un insieme discreto di **frammenti isolati**, mentre la conoscenza reale è un **grafo di entità e relazioni**. La *similarity search* si limita a misurare la prossimità semantica nello spazio vettoriale, ossia quanto due testi "si somigliano"; ma resta del tutto "cieca" di fronte alla *natura* delle relazioni che li legano — che si tratti di una relazione di tipo *is-a* (una categoria che ne contiene un'altra), *costa* (un'entità e il suo prezzo), *dipende-da* (una condizione e la sua conseguenza) o *adatto-a* (un prodotto e il suo pubblico di riferimento). Due frammenti possono risultare vicinissimi nello spazio vettoriale pur essendo legati da un rapporto di opposizione, e lontanissimi pur essendo complementari: la geometria della similarità non distingue il significato della relazione, perché non lo rappresenta affatto. È proprio questa cecità strutturale a rendere il chunking, di per sé innocuo come tecnica di indicizzazione, la causa profonda di un limite che nessun aumento di dimensione del modello o di qualità dei dati potrà da solo colmare.

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
