---
type: Concept
title: 'Capitolo 5: Considerazioni Personali'
description: 'Riflessioni critiche: dal Prompt Engineering al Knowledge Engineering, data governance ed etica dello human-in-the-loop gestiti via Web UI'
status: draft
tags:
  - thesis/chapter
  - topic/ethics
  - topic/hr-manager
  - status/draft
  - topic/hr
  - topic/ai
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

# Capitolo 5: Considerazioni Personali — Riflessioni Critiche: dal Prompt Engineering al Knowledge Engineering

## 5.1 Metariflessione sull'Esperienza Operativa
L'utilizzo di Wiki-Forge e NotebookLM nella stesura di questo elaborato ha costituito una validazione diretta sul campo. Sperimentare in prima persona il passaggio da utente di chatbot (prompting effimero) ad architetto di un Knowledge Graph tramite l'interfaccia grafica Web UI ha evidenziato come il reale valore risieda nella modellazione del dominio e nel rigore della formalizzazione. L'interfaccia visiva permette di gestire compiti complessi (tramite il flusso operativo a tre fasi dettagliato nel [[capitoli/03-progettazione-della-piattaforma|Capitolo 3]]) senza richiedere competenze di programmazione o da linea di comando.

### Una Sfida Operativa Reale: Il Derivare delle Note Atomiche e la Soluzione SHACL
Durante le prime fasi di sperimentazione sulla base di conoscenza della tesi, è emersa una criticità metodologica significativa: la tendenza spontanea dell'agente LLM a generare "note atomiche" eccessivamente estese e discorsive (superiori ai 1000-1500 token), di fatto ricreando il medesimo problema di frammentazione opaca e decontestualizzata tipico del *chunking* RAG tradizionale. L'agente tendeva a riassumere interi sotto-capitoli all'interno di una singola nota, compromettendo la granularità concettuale e la precisione dei collegamenti a grafo.

Un approccio basato sulla sola modifica del prompt (prompt engineering) si è rivelato insufficiente a garantire la costanza dei risultati nel tempo. La svolta metodologica si è avuta vincolando il comportamento dell'agente non solo tramite istruzioni testuali, ma attraverso la formalizzazione di una regola ontologica deterministica in W3C SHACL. In particolare, è stato introdotto nel file di governance ontologica un vincolo formale di lunghezza massima per la proprietà `tesi:contenutoNota`:

```turtle
# Vincolo SHACL di contenimento della lunghezza del testo per preservare l'atomicità
tesi:AtomicNoteLengthShape
    a sh:NodeShape ;
    sh:targetClass tesi:NotaAtomica ;
    sh:property [
        sh:path tesi:contenutoNota ;
        sh:maxLength 1200 ; # Limite stringente sui caratteri del corpo nota
        sh:message "La nota supera la soglia massima per essere considerata atomica. Decostruire in più sub-nodi interconnessi." ;
    ] .
```

Grazie a questa regola, ogni qual volta la fase di compilazione agentica produce una nota troppo estesa, il motore di validazione SHACL rileva la violazione e blocca la promozione automatica, inoltrando la nota alla **📥 Review Queue**. L'agente viene così costretto a rieseguire una vera decostruzione logica del testo, suddividendo l'argomento in più nodi distinti legati da wikilink. Questa esperienza ha dimostrato concretamente come il Knowledge Engineering basato su vincoli ontologici rappresenti un presidio di governance indispensabile per imbrigliare la variabilità degli LLM.

## 5.2 Il Ruolo del Futuro HR Manager: La Trasformazione in "Knowledge Curation Officer" (KCO)
L'evoluzione descritta in questa tesi delinea una trasformazione profonda della figura del professionista delle Risorse Umane. L'HR Manager cessa di essere un mero utente finale di software gestionali o un consumatore passivo di strumenti AI, per evolvere in una figura di sintesi strategica: il **Knowledge Curation Officer (KCO)**.

Il KCO opera all'intersezione tra le discipline umanistico-organizzative (psicologia del lavoro, diritto del lavoro, sviluppo della cultura aziendale) e l'ingegneria della conoscenza (data governance, modellazione ontologica, etica dei sistemi algoritmici). La metafora della *"curatela"* è centrale: così come un curatore museale non si limita ad accumulare opere, ma le seleziona, autentica, contestualizza e le dispone in un percorso dotato di senso, il KCO svolge la medesima funzione nei confronti del capitale intellettuale organizzativo.

Il KCO esercita la propria responsabilità nell'interfaccia grafica attraverso due pilastri operativi:

### 5.2.1 Data Governance e Definizione degli Standard Ontologici nell'Interfaccia
In ambito HR, i dati sorgente sono frequentemente eterogenei, destrutturati e affetti da ambiguità semantiche (es. declaratorie di ruolo difformi, valutazioni qualitative soggettive, acronimi informali). Il KCO non delega la bonifica e l'ordinamento dei dati alla funzione IT o agli automatismi dei modelli linguistici, ma stabilisce ex-ante le regole di governance del dominio tramite le viste della Web UI:
* **Mappatura Ontologica e Tassonomie Standard**: Definisce il vocabolario controllato dell'organizzazione (es. ancorando le competenze aziendali al framework europeo ESCO) e gestisce i tag tramite la finestra **🏷️ Tag Manager**.
* **Traduzione Operativa in Vincoli W3C SHACL**: Insieme agli ingegneri del software, traduce i requisiti di business e di compliance in regole formali (`shapes.ttl`), verificate automaticamente dal sistema durante la compilazione.
* **Gerarchizzazione della Tracciabilità (Trust Tiers)**: Assegna la gerarchia delle fonti. Una direttiva organizzativa firmata dalla direzione riceve la classificazione `human-reviewed` con alto grado di affidabilità (contrassegnata dal bollino verde 🟢 nell'editor), mentre un commento estemporaneo viene confinato al livello `unverified`.

### 5.2.2 Supervisione delle Pipeline di Ingestione e Prevenzione delle Distorsioni Strutturali
I modelli generative AI apprendono dai dati storici dell'azienda, ereditando e rischiando di amplificare pregiudizi passati. Il KCO interviene come filtro etico e strutturale lungo le pipeline di ingestione gestite dall'interfaccia di Wiki-Forge:
* **Neutralizzazione attiva dei bias durante la compilazione agentica**: Durante la fase di trasformazione guidata (da Discovery a Consolidation), il KCO istruisce gli agenti LLM a neutralizzare termini viziati da bias di genere, separare i requisiti di ruolo essenziali da assunzioni storiche accidentali e verificare l'aderenza alle politiche di Diversity & Inclusion.
* **Audit della Pipeline prima della Promozione nel Grafo**: Attraverso la finestra **📥 Review Queue** e le funzioni del pannello **🧠 KE Workbench** (accessibili nella Developer Mode 👑), il KCO audita la fase di decostruzione in note atomiche, assicurando che la conoscenza esplicita incorporata nel Knowledge Graph non introduca distorsioni.

### 5.2.3 Il KCO come "Human-in-the-Loop" nel Ciclo SECI
Posizionato all'interno del modello SECI, il Knowledge Curation Officer costituisce l'elemento umano insostituibile che assicura la sostenibilità della spirale della conoscenza:
1. **Facilitazione dell'Esternalizzazione**: Guida le persone a codificare la propria conoscenza tacita in note atomiche chiare, strutturate ed esenti da ambiguità.
2. **Governance della Combinazione**: Presidia il modo in cui l'agente LLM collega e sintetizza le note atomiche nel Knowledge Graph, garantendo la correttezza logica (via SHACL) e la validità etica.
3. **Abilitazione dell'Internalizzazione**: Grazie all'opera di curatela, i dipendenti che interrogano la piattaforma tramite GraphRAG ricevono risposte affidabili, contestualizzate e trasparenti, potendo assimilarle in nuova competenza individuale con pieno grado di fiducia.

In sintesi, il valore aggiunto dell'HR Manager come KCO non risiede nell'esecuzione meccanica di compiti che l'AI può automatizzare, ma nella **progettazione, governance e validazione dell'ecosistema di conoscenza** entro cui l'AI opera. Si compie così il passaggio strategico dalla pura gestione del personale alla governance dell'intelligenza organizzativa.

## 5.3 L'Insostituibilità del Giudizio Umano
La transizione dal livello `machine-confirmed` al livello `human-reviewed` nei Trust Tiers (effettuata con il comando `/verify` o approvando le note nella Review Queue) esprime una precisa scelta etica e metodologica: la responsabilità finale delle decisioni relative alle persone deve rimanere saldamente presidiata dalla valutazione umana (*human-in-the-loop*).

## Collegamenti Correlati
- [[governance-controllo-responsabilita]]
- [[competenze-e-hr]]
- [[capitoli/03-progettazione-della-piattaforma|Capitolo 3: Progettazione della Piattaforma]]
- [[capitoli/04-mappatura-e-automazione-hr|Capitolo 4: Mappatura e Automazione HR]]
- [[capitoli/06-conclusioni|Capitolo 6: Conclusioni]]
