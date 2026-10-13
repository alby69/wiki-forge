---
type: Concept
title: Documento di Progettazione della Tesi Magistrale
description: Mappatura e automazione delle funzioni HR: analisi percentuale, modello
status: draft
maturita: 49
tags:
  - thesis/chapter
  - topic/hr
  - topic/automation
  - status/draft
  - status/review
generated: []
by: process:jules-agent
at: 2026-10-12T00:00:00Z
verified:
  - by: human:autore
sources:
  - id: thesis-design-doc
resource: raw/thesis-design-doc.md
author: process:conv2md
last_modified: 2026-10-13T07:59:28Z
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
- **Attività ad Alta Automazione (70-90%)**: Task ripetitivi, screening di primo livello, risposte a FAQ amministrative.
- **Attività a Media Automazione / Trasformazione (40-60%)**: Sintesi delle valutazioni, bozze di piani formativi, analisi predittiva del turnover.
- **Attività a Bassa Automazione (10-30%)**: Mediazione dei conflitti, negoziazione strategica, sviluppo della cultura organizzativa e giudizio etico finale.

## 4.3 Il Modello SECI ed il Competency Framework
- **Applicazione del Modello SECI**: Come la conoscenza tacita degli HR specialist viene *esternalizzata* ed *ingegnerizzata* nell'infrastruttura.
- **Analogia Operativa**: Le *Competency Questions* (CQ) dell'ingegneria ontologica rispecchiano la struttura formale dei *Competency Framework* usati dalle HR per mappare le mansioni. Nell'interfaccia grafica di Wiki-Forge, l'operatore non tecnico può verificare la copertura delle competenze inviando il comando `/validate-cq` nella chat **💬 3. Chiedi** oppure aprendo la finestra **🧠 KE Workbench**.

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
* **Ispezionabilità del Grafo (Auditability)**: A differenza delle "black box" dei modelli predittivi chiusi, il Knowledge Graph è pienamente navigabile sia visivamente nella vista **🕸️ Graph** sia tramite la chat **💬 3. Chiedi**, consentendo agli HR Manager di tracciare e neutralizzare nodi o correlazioni discriminatorie.

## Collegamenti Correlati
- [[competenze-e-hr]]
- [[sintesi-previsioni-lavoro-hr]]
- [[evidenza-mercato-del-lavoro]]
- [[sostituzione-o-trasformazione]]
- [[capitoli/03-progettazione-della-piattaforma|Capitolo 3: Progettazione della Piattaforma]]
- [[capitoli/05-considerazioni-personali|Capitolo 5: Considerazioni Personali]]
