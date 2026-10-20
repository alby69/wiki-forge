---
type: Concept
title: 'Capitolo 4: Studio delle Attività HR Storiche e Analisi del Grado di Automazione'
description: Analisi dei processi HR tradizionali, stima del grado di automazione,
  modello SECI e prevenzione della discriminazione algoritmica
status: draft
tags:
- thesis/chapter
- topic/hr
- topic/automation
- topic/ethics
- status/draft
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
  author: process:conv2md
  last_modified: '2026-10-20T06:04:34Z'
maturita: 90
copertura_fonti: 1
domande_risolte: 0
stato: draft
---
# Capitolo 4: Studio delle Attività HR Storiche e Analisi del Grado di Automazione

## 4.1 Decomposizione delle Funzioni HR Tradizionali
Analisi storica e funzionale dei processi chiave delle Risorse Umane:
- **Recruiting & Selection**: Screening CV, interviste preliminari, matching profilo-ruolo.
- **Onboarding & Training**: Accoglienza, formazione continua (L&D), skill mapping.
- **Performance Management**: Valutazione delle prestazioni, feedback continuo, piani di carriera.
- **HR Operations & Administration**: Gestione contrattuale, presenze, ticket amministrativi.

## 4.2 Stima Percentuale del Grado di Automazione
Il grado di penetrazione dell'automazione nei processi Risorse Umane varia sensibilmente in funzione della natura strutturata o discrezionale dei task. La tabella sottostante sintetizza la ripartizione del grado di automazione potenziale e il relativo impatto sull'efficienza operativa e sul ruolo delle [[competenze-e-hr|competenze umane]]:

| Categoria di Attività | Grado di Automazione | Tipologia di Task HR | Ruolo del Knowledge Curation Officer (KCO) |
| :--- | :--- | :--- | :--- |
| **Alta Automazione** | **70% - 90%** | Parsing CV, screening di primo livello, classificazione richieste amministrative, risposte a FAQ contrattuali | Configurazione iniziale dei vincoli di dominio ed audit periodico sui filtri automatici |
| **Media Automazione / Trasformazione** | **40% - 60%** | Estrazione e sintesi valutazioni periodiche, bozze di piani di onboarding/formazione, skill gap analysis | Valutazione qualitativa delle raccomandazioni dell'AI e contestualizzazione organizzativa |
| **Bassa Automazione** | **10% - 30%** | Gestione della negoziazione, mediazione dei conflitti, sviluppo della cultura aziendale, decisione finale di assunzione | Presidio etico insostituibile, giudizio discrezionale e relazione interpersonale diretta |

### Mini-Caso di Studio: Screening e Selezione di 500 Candidature
Per comprendere l'impatto empirico di tale ripartizione, si consideri un processo di selezione aziendale per posizioni tecniche e gestionali con un volume di **500 candidature (CV)** pervenute.

1. **Fase 1 — Screening di Primo Livello (Automazione 80%)**:
   L'infrastruttura di Knowledge Engineering esegue il parsing automatico dei documenti (un processo volto a scomporre un testo non strutturato in elementi strutturati e leggibili dalla macchina), di circa il **70% dei profili (350 CV)** palesemente privi dei requisiti minimi inderogabili (es. abilitazioni normative o anni di esperienza specifici).
2. **Fase 2 — Matching Semantico ed Analisi Multi-Prospettiva (Automazione 50%)**:
   Sui restanti **150 profili qualificati**, l'agente LLM sintetizza le esperienze salienti e propone una prima graduatoria basata sul matching con il framework di competenze aziendale. In questa fase, l'intervento del KCO (Knowledge Curation Officer) è fondamentale per analizzare il **30% dei casi ambigui (45 CV)** che presentano percorsi di carriera non lineari, potenziali "soft skill" trasversali o possibili segnali di discriminazione algoritmica indiretta.
3. **Fase 3 — Valutazione Finale e Colloquio (Automazione 10%)**:
   I **20 candidati finalisti** vengono sottoposti a colloquio individuale gestito esclusivamente dall'HR Manager. Il residuo margine di automazione (≈10%) non attiene alla valutazione sostanziale, ma unicamente ai compiti amministrativi di contorno (logistica, agenda dei colloqui, redazione di bozze di sintesi). La titolarità umana della decisione finale non è una limitazione tecnica contingente, ma il riflesso di una precisa scelta metodologica ed etica, riconducibile a quattro ordini di ragioni:
   - **Natura tacita e discrezionale del giudizio (SECI)**: La valutazione finale mobilita conoscenza prevalentemente *tacita* — intuizione pratica, lettura del contesto, decodifica del linguaggio non verbale, della motivazione autentica e della coerenza valoriale del candidato. Questa forma di conoscenza, per definizione, sfugge alla codificazione in regole esplicite e mal si presta alla formalizzazione ontologica richiesta da una pipeline automatizzata. L'LLM eccelle nella *Combinazione* di dati espliciti, ma non dispone della comprensione situata necessaria a sostenere un colloquio umano.
   - **Presidio etico e tutela della dignità del lavoro**: Come argomentato nel [[capitoli/05-considerazioni-personali|Capitolo 5]], la transizione dal livello `machine-confirmed` a `human-reviewed` dei Trust Tiers esprime la scelta per cui le decisioni che incidono sulle persone restano saldamente in capo all'uomo (*human-in-the-loop*). L'assunzione configura una decisione ad alta densità etica e giuridica: mantenerne la titolarità umana sottrae la scelta finale all'opacità algoritmica e alla cristallizzazione dei bias storici (variabili proxy e feedback loop) di cui alla sezione 4.4. Dunque, è per questo che il presidio umano si posiziona un gradino sopra le decisioni algoritmiche secondo il principio che l'IA propone e l'uomo valida.
   - **L'intreccio tra verifica e "momenti che contano"**: Il colloquio non è una mera verifica di competenze già estratte dal grafo, ma un *momento che conta* in cui empatia, negoziazione, fiducia e relazione interpersonale diretta sono determinanti. Coerentemente con la concezione dell'IA come "specchio cognitivo" ([[temi/concezioni-dell-ia|Concezioni dell'IA]]) e con la critica di Graeber alla *routine igienica*, l'infrastruttura è legittimata ad automatizzare il carico igienico (screening, parsing, prima catalogazione) liberando così tempo per il lavoro di cura delle relazioni umane.
   - **Accountability e responsabilità legale**: La decisione finale di assunzione comporta responsabilità contrattuali e di compliance (pari opportunità, GDPR, tutela antidiscriminatoria) che esigono un soggetto giuridicamente responsabile. L'HR Manager, in veste di KCO [[capitoli/05-considerazioni-personali|Knowledge Curation Officer (KCO)]], assume su di sé la validazione di merito, mentre l'agente resta confinato al ruolo secondario di supporto informato.
   -  L'integrazione dell'infrastruttura riduce il tempo di lavorazione amministrativa della pratica del **45%**, eliminando il carico di routine igienica, ma garantisce un presidio umano al **100%** sulle decisioni di scarto nei casi dubbi e sulla scelta finale di assunzione.

## 4.3 Il Modello SECI ed il Competency Framework
- **Applicazione del Modello SECI**: Come la conoscenza tacita degli HR specialist viene *esternalizzata* ed *ingegnerizzata* nell'infrastruttura.
- **Analogia Operativa**: Le *Competency Questions* (CQ) dell'ingegneria ontologica rispecchiano la struttura formale dei *Competency Framework* usati dalle HR per mappare le mansioni. Nell'interfaccia grafica di Wiki-Forge, l'operatore non tecnico può verificare la copertura delle competenze inviando il comando `/validate-cq` nell'interfaccia di chat o aprendo la finestra **🧠 KE Workbench**, secondo il flusso descritto nel [[capitoli/03-progettazione-della-piattaforma|Capitolo 3]].

## 4.4 Rischi d'Integrazione: La Discriminazione Algoritmica (Algorithmic Bias) nei Processi HR
L'introduzione dell'intelligenza artificiale nei processi Risorse Umane comporta rischi etici e giuridici di primaria grandezza. Tra questi, la **discriminazione algoritmica** (*algorithmic bias*) rappresenta la produzione sistematica ed ingiusta di risultati pregiudizievoli nei confronti di specifici individui o gruppi sensibili, basandosi su caratteristiche protette (genere, età, etnia, disabilità, estrazione socioeconomica).

È importante sottolineare che la discriminazione algoritmica raramente scaturisce da un'intenzione esplicita: i modelli di machine learning e gli LLM si limitano a ottimizzare funzioni matematiche sui dati storici messi a loro disposizione. Tuttavia, poiché i dati storici riflettono i pregiudizi e le disuguaglianze della società, l'algoritmo tende a cristallizzare e amplificare tali distorsioni.

### 4.4.1 Le Tre Radici della Discriminazione Algoritmica
1. **Bias Storico nei Dati di Addestramento (Historical Bias)**: Se un'azienda ha storicamente assunto in prevalenza uomini per ruoli apicali, un modello addestrato su tali dati identificherà le caratteristiche associate a quel campione (es. certe università, stili di scrittura o percorsi lineari) come predittive di successo, penalizzando i profili diversi (un caso emblematico è costituito dal noto tool di screening di Amazon, dismesso nel 2018 per aver penalizzato i CV contenenti il termine *"women's"*).
2. **Variabili Proxy (Surrogati Statistici)**: Anche quando le variabili sensibili vengono escluse dai dati di input, l'algoritmo individua correlazioni indirette (proxy) che agiscono da surrogati. Ad esempio, il codice di avviamento postale (CAP), gli hobby o le università frequentate possono diventare marcatori impliciti di estrazione sociale o appartenenza etnica.
3. **Feedback Loop (Cicli di Rinforzo)**: Quando una decisione automatizzata (es. lo scarto di un CV) viene confermata dall'azione umana senza verifica critica, il risultato viene reimmesso nella pipeline di addestramento, rinforzando e consolidando il pregiudizio nel tempo.

### 4.4.2 Impatto Transversale sulle Funzioni HR
La discriminazione algoritmica non minaccia unicamente il recruiting, ma si estende a tutto il ciclo di vita del dipendente:
* **Performance Management**: I modelli NLP applicati alle valutazioni periodiche rischiano di penalizzare un linguaggio collaborativo o empatico rispetto a stili assertivi o competitivi, replicando bias di genere.
* **Predizione dell'Abbandono (Predictive Attrition)**: Algoritmi predittivi possono classificare erroneamente dipendenti in specifiche fasce di età o genere come *"ad alto rischio di dimissioni"*, portando ad un'esclusione preventiva da opportunità di carriera o progetti strategici.
* **Revisioni Salariali**: Sistemi che raccomandano aumenti retributivi basandosi sullo storico retributivo ereditano ed amplificano il *gender pay gap* pregresso.

### 4.4.3 La Soluzione Infrastrutturale: Wiki-Forge Web UI, GraphRAG e SHACL come Presidio Etico
In un sistema RAG tradizionale, l'algoritmo recupera chunk di testo estratti da documenti storici senza contestualizzazione critica, col rischio che un giudizio storico viziato da bias venga riproposto dall'LLM come un fatto oggettivo.

L'architettura **Wiki-Forge + GraphRAG + SHACL** gestita tramite la Web UI fornisce un presidio strutturale contro la discriminazione algoritmica:
* **Firewall Etico con Vincoli SHACL**: I vincoli W3C escludono o segnalano alla revisione umana obbligatoria (visibile nella finestra **📥 Review Queue**) qualsiasi scheda o decisione di promozione priva di evidenze trasparenti ed adeguate.
* **Tracciabilità e Ponderazione via Trust Tiers**: I giudizi informali o non verificati ricevono un *Trust Tier* basso (`unverified`), impedendo che opinioni soggettive storiche influenzino le sintesi del sistema.
* **Ispezionabilità del Grafo (Auditability)**: A differenza delle "black box" dei modelli predittivi chiusi, il Knowledge Graph è pienamente navigabile sia visivamente nella vista **🕸️ Graph** sia tramite i comandi della chat, consentendo agli HR Manager di tracciare e neutralizzare nodi o correlazioni discriminatorie.

## Collegamenti Correlati
- [[competenze-e-hr]]
- [[sintesi-previsioni-lavoro-hr]]
- [[evidenza-mercato-del-lavoro]]
- [[sostituzione-o-trasformazione]]
- [[capitoli/03-progettazione-della-piattaforma|Capitolo 3: Progettazione della Piattaforma]]
- [[capitoli/05-considerazioni-personali|Capitolo 5: Considerazioni Personali]]
