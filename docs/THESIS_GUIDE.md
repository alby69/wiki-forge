# Guida Operativa — Tesi Magistrale e Knowledge Base Dinamica

> **Metodologia guidata per la costruzione di una Tesi Magistrale come Knowledge Base dinamica consultabile ed elaborato PDF finale per la stampa tramite Interfaccia Grafica (Web UI).**

Wiki-Forge trasforma la preparazione della tesi di laurea da un processo lineare e statico (lettura PDF → appunti sparsi → stesura capitoli) in un **sistema cognitivo dinamico ed evolutivo** gestito tramite un'interfaccia visiva semplice ed intuitiva, concepita per operatori non tecnici.

Più che un mero automatismo per scrivere più in fretta, questa architettura è un **framework di Knowledge Management (KM) aumentato**: si documenta e si struttura il *processo* di ricerca con lo stesso rigore riservato al contenuto. Il salto di paradigma è netto — si passa dall'**Information Retrieval** (cercare risposte temporanee dentro i documenti) al **Knowledge Engineering** (costruire attivamente una base di conoscenza strutturata, validata e durevole).

La tesi risultante possiede una **doppia natura**:
1. **Versione Dinamica & Incrementale**: Una wiki interconnessa in formato Markdown consultabile tramite l'interfaccia grafica Web UI, interrogabile in tempo reale, continuamente aggiornabile con nuove fonti e quesiti di ricerca.
2. **Versione Statica & Stampabile**: Un documento unificato compilabile in PDF ad alta qualità tipografica con un solo clic, pronto per la stampa e la consegna accademica.

Questa doppia natura riprende, in chiave digitale, il **modello di creazione della conoscenza di Nonaka & Takeuchi (SECI)**: la conoscenza tacita delle fonti viene *socializzata* ed *esternalizzata* in note esplicite, poi *combinata* in una knowledge base strutturata e infine *internalizzata* come sapere personale.

---

## 1. Il Paradigma: da Information Retrieval a Knowledge Engineering

Anziché limitarsi a interrogare i documenti originali tramite RAG passeggero (risposte temporanee in chat che vengono perse), **ogni nuova domanda di ricerca, ogni analisi comparativa e ogni sintesi generano nuove pagine Wiki persistenti**. La conoscenza non viene ricalcolata da zero a ogni domanda (come nel RAG), ma viene **cristallizzata** ("Compiled Knowledge") in file Markdown interconnessi: ogni interazione migliora la base di conoscenza in modo incrementale.

```
    [ 📥 Fonti Primarie: PDF, Paper, Libri salvati ]
                           │
                           ▼ (Pulsante 📥 1. Carica nella Web UI)
    [ 📄 Testo Convertito ed Elaborabile ]
                           │
                           ▼ (Pulsante ⚡ 2. Compila nella Web UI)
    [ 🗂️ Knowledge Base Dinamica in wiki/ (OKF v0.2) ]
                           │
                           ▼ (Chat 💬 3. Chiedi: /consult, /deep-research, /trace)
    [ 💬 Risposte, Sintesi & Nuove Note in wiki/sintesi/ ]
                           │
                           ▼ (Pulsante "Calcola Maturità" o /maturity)
    [ 📊 Selezione Pagine Mature (maturità >= 50) ]
                           │
                           ▼ (Comando /thesis-chapter nella Chat)
    [ 📜 Bozza Unificata Tesi in output/thesis_compiled.md ]
                           │
                           ▼ (Pulsante "Esporta PDF Tesi" nel menu 🛠️ Strumenti)
    [ 🎓 PDF Finale Stampabile in output/thesis_final.pdf ]
```

---

## 2. Analisi Comparata: NotebookLM vs. Wiki-Forge

La scelta degli strumenti è essa stessa parte della metodologia. Wiki-Forge non sostituisce NotebookLM: i due coprono fasi diverse del ciclo SECI.

### 2.1 NotebookLM — Il paradigma RAG "classico" ed effimero

NotebookLM è eccellente per l'esplorazione iniziale, ma mostra limiti strutturali quando si scala verso la sintesi comparativa.

**Punti di forza**
- **Multimodalità e facilità**: ingestione immediata di PDF, audio e siti web.
- **Audio Overview**: utile per "internalizzare" i concetti durante gli spostamenti.
- **Grounding**: citazioni precise all'interno del singolo silos (notebook).

**Punti di debolezza (il problema dei silos)**
- **Frammentazione**: NotebookLM non fa "dialogare" nativamente due notebook separati.
- **Il "collettore" è un RAG passivo**: esportare i riassunti in un terzo notebook crea un classico sistema Retrieval-Augmented Generation. Il modello "pesca" chunk di testo simili, ma non *comprende* la struttura logica del dibattito tra gli autori.
- **Mancanza di persistenza strutturale**: le chat sono effimere. Non si costruisce un "capitale strutturale", si hanno solo conversazioni.

### 2.2 Wiki-Forge e il paradigma "LLM Wiki" nell'Interfaccia Grafica

Wiki-Forge implementa il paradigma reso popolare da Andrej Karpathy (2026) noto come **"LLM Wiki"**: invece di trattare l'LLM come un oracolo a cui fare domande "usa e getta", lo si tratta come un **Knowledge Engineer** — un assistente di ricerca che mantiene una wiki persistente gestibile interamente tramite l'interfaccia grafica Web UI.

**Punti di forza**
- **Conoscenza compilata (Compiled Knowledge)**: la conoscenza viene *cristallizzata* in file Markdown interconnessi (`wiki/`) e cresce in modo incrementale.
- **Struttura OKF (Open Knowledge Format)**: standard che consentono un controllo rigoroso dei metadati senza complicare l'esperienza dell'utente.
- **Funzioni da Knowledge Engineer accessibili via UI e Chat**:
  - **Validazione Competency Questions (`/validate-cq` / KE Workbench 🧠)**: cruciale per le HR. In ingegneria ontologica le CQ validano se la base di conoscenza risponde ai requisiti; in ambito HR mappano i **Dizionari delle Competenze**.
  - **Validazione SHACL**: garantisce che le note rispettino vincoli formali (es. "Ogni autore deve avere una teoria associata"), simulando la *Data Governance* aziendale.
  - **GraphRAG & Navigazione Visuale nel Grafo**: non cerca solo parole chiave, ma naviga i concetti nella vista **🕸️ Graph** e nell'editor affiancato **◧ Split**.
- **Output accademico in un clic**: integrazione per compilare la wiki direttamente in un PDF formattato per la tesi dal menu **🛠️ Strumenti**.

---

### 2.3 La scelta progettuale: il sistema ibrido a due stadi

La soluzione migliore non è "o l'uno o l'altro", ma un **workflow ibrido a due stadi** che rispecchia il modello SECI:

1. **Stadio 1 — Esplorazione e Internalizzazione (NotebookLM)**
   Si usa NotebookLM per "bonificare" il materiale grezzo: si caricano i libri dei vari autori e si generano FAQ, timeline e riassunti. Ruolo: strumento di *Discovery* e sintesi rapida.
2. **Stadio 2 — Ingegnerizzazione e Combinazione (Wiki-Forge Web UI)**
   Si importano le note strutturate da NotebookLM nella finestra di caricamento **📥 1. Carica** o via "Importa NotebookLM" nel menu **🛠️ Strumenti**. L'agente della Web UI legge queste note e, invece di limitarsi a chattare, le *compila* nella wiki (`wiki/`): collega ipertestualmente, risolve le contraddizioni tra autori e tagga le competenze. Ruolo: *Consolidation* e creazione di Capitale Intellettuale.

---

## 3. Flusso di Lavoro Cronologico dell'Operatore in 5 Fasi nella Web UI

### Fase 1: Inizializzazione del Vault Tesi
1. **Configurazione del progetto**:
   Imposta il titolo e il contesto della tesi nella finestra **⚙️ Config** dell'interfaccia grafica Web UI.
2. **Wizard Accademico**:
   Attiva lo scenario dedicato alla tesi selezionando "Academic Thesis" dal menu oppure inviando il comando nella chat:
   ```text
   /wizard academic
   ```
3. **Struttura visiva delle cartelle della tesi**:
   L'agente organizzerà la barra laterale (`wiki/`) nelle seguenti sottocartelle tematiche:
   - `wiki/fonti/`: Schede sintetiche dei libri e paper esaminati.
   - `wiki/concetti/`: Nodi concettuali e teorici del knowledge graph (es. `[[lavoro-alienato]]`, `[[llm-os]]`).
   - `wiki/sintesi/`: Risposte articolate e confronti generati dalle domande di ricerca.
   - `wiki/domande/`: Tracciamento delle domande aperte e dei quesiti del relatore.
   - `wiki/capitoli/`: Bozze dei capitoli veri e propri della tesi (`00` fino a `07`).

---

### Fase 2: Ingestione e Conversione della Letteratura

Questa fase corrisponde allo **Stadio 1 (Discovery)** del workflow ibrido: si raccoglie e si "bonifica" il materiale grezzo.

1. Deposita i file PDF/EPUB dei paper e libri della bibliografia cliccando sul pulsante **📥 1. Carica** nella barra in alto.
2. Avvia la conversione automatica ed estrazione dei concetti cliccando sul pulsante **⚡ 2. Compila**.
3. Se hai appunti o schede di studio generati su Google NotebookLM, importali selezionando "Importa NotebookLM" dal menu **🛠️ Strumenti** oppure incollandoli nella chat.

---

### Fase 3: Compilazione Incrementale e Consultazione Dinamica

Questa fase corrisponde allo **Stadio 2 (Consolidation)**: le note grezze diventano knowledge base strutturata.

1. **Compilazione iniziale**:
   Clicca **⚡ 2. Compila** (oppure invia `/compile` nella chat). L'agente estrarrà i concetti, aggiungerà l'intestazione OKF v0.2, collegherà le pagine con `[[wikilink]]` e renderà visibili i collegamenti nel grafo.

2. **Interrogazione e Navigazione Web UI**:
   - Esplora il grafo delle relazioni tra autori e concetti nella vista **🕸️ Graph** o nella vista affiancata **◧ Split**.
   - Usa `/consult "In che modo Amodei e Graeber analizzano l'evoluzione del lavoro?"` nella chat **💬 3. Chiedi** per generare confronti sintetici che si convertono in nuove pagine wiki tramite il tasto **📌 Salva nella Wiki**.
   - Verifica la precisione delle affermazioni con il comando `/trace "claim di ricerca"` ottenendo il tracciamento al paragrafo e riga sorgente (`#L10-L25`).

---

### Fase 4: Analisi di Maturità e Studio
1. **Calcolo dell'Indice di Maturità (`/maturity`)**:
   L'indice di maturità (da 0 a 100) misura la completezza di una pagina basandosi su:
   - Copertura delle fonti citate
   - Domande risolte
   - Densità dei collegamenti `[[wikilink]]`
   - Lunghezza e consistenza del testo

   Calcola la maturità scrivendo `/maturity` nella chat o cliccando "Calcola Maturità" nel menu **🛠️ Strumenti**.

2. **Sintesi e Revisione**:
   Usa i comandi `/study-guide`, `/quiz`, `/mindmap` e `/deep-research` nella chat per verificare la tenuta concettuale delle tue argomentazioni ed identificare eventuali lacune nella bibliografia.

---

### Fase 5: Compilazione e Generazione del PDF Stampabile
Quando la Knowledge Base ha raggiunto una soglia adeguata di maturità:

1. **Aggregazione del testo unificato della tesi**:
   Filtra e unisci i capitoli inviando nella chat il comando:
   ```text
   /thesis-chapter
   ```

2. **Generazione del PDF Finale dall'Interfaccia**:
   Apri il menu **🛠️ Strumenti** nella barra superiore e clicca sul pulsante **Esporta PDF Tesi**. Il sistema genererà automaticamente il documento `thesis_final.pdf` formattato per la tesi di laurea, pronto per il download e la stampa.

---

## 4. Schema Metadata e Frontmatter OKF v0.2 per Tesi

Ogni nota della tesi contiene un'intestazione strutturata conforme allo standard OKF v0.2 (gestita automaticamente dal sistema):

```yaml
---
type: Concept                            # Concept | Paper | Book | StudyGuide | Process
title: "Confronto Graeber vs Cristianini su intelligenza e lavoro"
description: "Analisi comparativa tra la sociologia del lavoro di Graeber e le reti neurali di Cristianini"
status: stable                           # draft | review | stable
maturita: 85                             # Indice di maturità calcolato (0-100)
copertura_fonti: 3
domande_risolte: 2
generated:
  by: wiki-forge-agent/v2.9
  at: 2026-09-16T10:00:00Z
verified:
  - by: human:studente
    at: 2026-09-16T11:00:00Z
sources:
  - id: graeber-bullshit-jobs
    resource: raw/graeber-bullshit-jobs_COMPILED.md
    title: "Bullshit Jobs"
  - id: cristianini-machina-sapiens
    resource: raw/cristianini-machina-sapiens_COMPILED.md
    title: "Machina Sapiens"
---
```

---

## 5. Difendere la Tesi in Commissione (Sapienza — HR)

In sede di laurea occorre elevare la discussione tecnica a riflessione strategica sulle Risorse Umane. Tre sono i pilastri argomentativi.

### A. Dal "Prompt Engineering" al "Knowledge Engineering"
> "L'uso standard dell'AI nelle HR oggi si limita al *Prompt Engineering*: fare domande a un chatbot. Io ho adottato il paradigma dell'*LLM Wiki* per trasformare l'AI in un **Knowledge Engineer**. Non ho usato l'AI solo per *rispondere* alle mie domande, ma per *costruire* l'infrastruttura che contiene le risposte. Questo simula come un dipartimento HR moderno dovrebbe gestire il Knowledge Management: non con chatbot effimeri, ma con Knowledge Graph strutturati e validati."

### B. L'analogia Ontologia HR ↔ SHACL e Competency Framework
> "Wiki-Forge utilizza standard del W3C come SHACL per validare la *forma* della conoscenza. Ho applicato lo stesso rigore tecnico alla letteratura HR. Le *Competency Questions* dell'ingegneria ontologica riflettono esattamente la struttura di un *Competency Framework* usato dagli HR Manager per verificare se un profilo copre tutti i requisiti di ruolo. La tecnologia non è solo un tool: è una metafora operativa del mio oggetto di studio."

### C. Superamento dei silos informativi (il problema del RAG)
> "Ho sperimentalmente verificato che sistemi RAG puri (come il collettore di NotebookLM) falliscono nel confronto sinottico tra autori complessi, soffrendo di allucinazioni o perdita di contesto. Adottando un approccio ibrido con *GraphRAG*, la tesi non è un documento statico, ma il dump di un **Sistema Esperto** che ha mappato le relazioni semantiche tra le teorie studiate."

---

## 6. Roadmap Operativa Consigliata

1. **Setup**: Apri la Web UI di Wiki-Forge, configura il progetto nel menu **⚙️ Config** ed inserisci la tua API Key.
2. **Importazione**: Copia i riassunti da NotebookLM ed importali tramite il pulsante **📥 1. Carica** o il menu **🛠️ Strumenti**.
3. **Compilazione**: Clicca il pulsante **⚡ 2. Compila** per elaborare i testi e collegarli nel grafo della conoscenza.
4. **Validazione HR**: Invia `/validate-cq` nella chat per assicurarti che la wiki risponda alle domande fondamentali della tesi (es. *"Quali autori supportano lo smart working come leva di retention?"*).
5. **Export**: Invia `/thesis-chapter` nella chat per assemblare i capitoli e clicca **Esporta PDF Tesi** nel menu **🛠️ Strumenti** per ottenere il documento finale da portare in commissione.

---

## 7. Risultato Finale: Doppia Fruibilità

Grazie a questo approccio, il tesista ottiene simultaneamente:
1. **Il Libro / PDF della Tesi**: Un elaborato strutturato, formalmente ineccepibile, formattato secondo i canoni accademici e pronto per la stampa.
2. **Il Secondo Cervello Digitale (Wiki)**: Un patrimonio di conoscenza permanente, navigabile a vita nell'interfaccia visiva, che costituisce la base per futuri articoli scientifici, dottorati o progetti professionali.
