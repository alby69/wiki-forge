# Guida Operativa — Tesi Magistrale e Knowledge Base Dinamica

> **Metodologia guidata per la costruzione di una Tesi Magistrale come Knowledge Base dinamica consultabile e documento PDF finale per la stampa.**

Wiki-Forge trasforma la preparazione della tesi di laurea da un processo lineare e statico (lettura PDF → appunti sparsi → stesura capitoli) in un **sistema cognitivo dinamico ed evolutivo** gestito insieme agli agenti LLM.

Più che un "trucco" per scrivere più in fretta, questa architettura è un **framework di Knowledge Management (KM) aumentato**: si documenta e si struttura il *processo* di ricerca con lo stesso rigore riservato al contenuto. Il salto di paradigma è netto — si passa dall'**Information Retrieval** (cercare risposte dentro i documenti) al **Knowledge Engineering** (costruire attivamente una base di conoscenza strutturata, validata e durevole).

La tesi risultante possiede una **doppia natura**:
1. **Versione Dinamica & Incrementale**: Una wiki interconnessa in formato Markdown consultabile tramite Web UI, interrogabile in tempo reale, continuamente aggiornabile con nuove fonti e quesiti di ricerca.
2. **Versione Statica & Stampabile**: Un documento unificato compilato in PDF ad alta qualità tipografica via Pandoc, pronto per la stampa e la consegna accademica.

Questa doppia natura riprende, in chiave digitale, il **modello di creazione della conoscenza di Nonaka & Takeuchi (SECI)**: la conoscenza tacita delle fonti viene *socializzata* ed *esternalizzata* in note esplicite, poi *combinata* in una knowledge base strutturata e infine *internalizzata* come sapere personale.

---

## 1. Il Paradigma: da Information Retrieval a Knowledge Engineering

Anziché limitarsi a interrogare i documenti originali tramite RAG passeggero (risposte temporanee in chat che vengono perse), **ogni nuova domanda di ricerca, ogni analisi comparativa e ogni sintesi generano nuove pagine Wiki persistenti**. La conoscenza non viene ricalcolata da zero a ogni domanda (come nel RAG), ma viene **cristallizzata** ("Compiled Knowledge") in file Markdown interconnessi: ogni interazione migliora la base di conoscenza in modo incrementale.

```
    [ 📥 Fonti Primarie: PDF, Paper, Libri in sources/ ]
                           │
                           ▼ (conv2md / /convert-only)
    [ 📄 Testo Grezzo in raw/ ]
                           │
                           ▼ (/compile)
    [ 🗂️ Knowledge Base Dinamica in wiki/ (OKF v0.2) ]
                           │
                           ▼ (/consult, /deep-research, /trace)
    [ 💬 Risposte, Sintesi & Nuove Note in wiki/sintesi/ ]
                           │
                           ▼ (/maturity / calcolo maturità 0-100)
    [ 📊 Selezione Pagine Mature (maturità >= 50) ]
                           │
                           ▼ (/thesis-chapter / generate_thesis.py)
    [ 📜 Bozza Unificata Tesi in output/thesis_compiled.md ]
                           │
                           ▼ (export_thesis_pdf.py / make thesis-pdf)
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

### 2.2 Wiki-Forge e il paradigma "LLM Wiki"

Wiki-Forge implementa il paradigma reso popolare da Andrej Karpathy (2026) noto come **"LLM Wiki"**: invece di trattare l'LLM come un oracolo a cui fare domande "usa e getta", lo si tratta come un **Knowledge Engineer** — un assistente di ricerca che mantiene una wiki persistente.

**Punti di forza**
- **Conoscenza compilata (Compiled Knowledge)**: la conoscenza viene *cristallizzata* in file Markdown interconnessi (`wiki/`) e cresce in modo incrementale.
- **Struttura OKF (Open Knowledge Format)**: standard che consentono un controllo rigoroso dei metadati.
- **Funzioni da Knowledge Engineer**:
  - **`cq_runner.py` / `scripts/cq_validator.py` (Competency Questions)**: cruciale per le HR. In ingegneria ontologica le CQ validano se la base di conoscenza risponde ai requisiti; in ambito HR mappano i **Dizionari delle Competenze**.
  - **Validazione SHACL (`shapes.ttl`)**: garantisce che le note rispettino vincoli formali (es. "Ogni autore deve avere una teoria associata"), simulando la *Data Governance* aziendale.
  - **GraphRAG & Neo4j**: non cerca solo parole chiave, ma naviga i concetti (es. "Trova tutti gli autori che criticano la teoria X e mostrami i collegamenti 2-hop"), con retrieval ibrido vettoriale + sottografi k-hop (`src/wikiforge/semantics/graph_rag_pipeline.py`).
- **Output accademico**: script (`generate_thesis.py`, `export_thesis_pdf.py`) per compilare la wiki direttamente in un PDF formattato per la tesi tramite Pandoc.

**Punti di debolezza**
- **Curva di apprendimento**: richiede familiarità con CLI, Python, Git e concetti di ontologia.
- **Overhead di setup**: richiede configurazione iniziale (`config.toml`, LLM API).
- **Tempi di build**: il primo avvio/scaricamento delle immagini è lento (vedi `Start_WikiForge.bat` e `Update_WikiForge.bat`).

### 2.3 La scelta progettuale: il sistema ibrido a due stadi

La soluzione migliore non è "o l'uno o l'altro", ma un **workflow ibrido a due stadi** che rispecchia il modello SECI.

1. **Stadio 1 — Esplorazione e Internalizzazione (NotebookLM)**
   Si usa NotebookLM per "bonificare" il materiale grezzo: si caricano i libri dei vari autori e si generano FAQ, timeline e riassunti. Ruolo: strumento di *Discovery* e sintesi rapida.
2. **Stadio 2 — Ingegnerizzazione e Combinazione (Wiki-Forge)**
   Si importano le note strutturate da NotebookLM nella cartella `raw/` tramite **`notebooklm_import.py`**. L'agente LLM legge queste note e, invece di limitarsi a chattare, le *compila* nella wiki (`wiki/`): collega ipertestualmente, risolve le contraddizioni tra autori e tagga le competenze. Ruolo: *Consolidation* e creazione di Capitale Intellettuale.

---

## 3. Flusso di Lavoro Cronologico dell'Operatore in 5 Fasi

### Fase 1: Inizializzazione del Vault Tesi
1. **Configurazione del progetto**:
   Imposta il titolo e il contesto della tesi in `config.toml` oppure nell'interfaccia grafica **⚙️ Config** della Web UI.
2. **Wizard Accademico**:
   Avvia lo scenario dedicato alla tesi:
   ```bash
   python scripts/wizard.py --preset academic
   # Oppure comando agente: /wizard academic
   ```
3. **Struttura delle cartelle della tesi**:
   L'agente organizzerà `wiki/` nelle seguenti sottocartelle tematiche:
   - `wiki/fonti/`: Schede sintetiche dei libri e paper esaminati.
   - `wiki/concetti/`: Nodi concettuali e teorici del knowledge graph (es. `[[lavoro-alienato]]`, `[[llm-os]]`).
   - `wiki/sintesi/`: Risposte articolate e confronti generati dalle domande di ricerca.
   - `wiki/domande/`: Tracciamento delle domande aperte e dei quesiti del relatore.
   - `wiki/capitoli/`: Bozze dei capitoli veri e propri della tesi.

---

### Fase 2: Ingestione e Conversione della Letteratura

Questa fase corrisponde allo **Stadio 1 (Discovery)** del workflow ibrido: si raccoglie e si "bonifica" il materiale grezzo.

1. Deposita i file PDF/EPUB dei paper e libri della bibliografia nella cartella `sources/` (o `backup/`).
2. Esegui la conversione automatica in testo Markdown:
   ```bash
   bash run_convert.sh
   # Oppure comando agente: /convert-only
   ```
3. Se hai appunti o schede di studio generati su Google NotebookLM, importali direttamente con metadata OKF:
   ```bash
   python scripts/notebooklm_import.py appunti.md --source "NotebookLM Session"
   ```

---

### Fase 3: Compilazione Incrementale e Consultazione Dinamica

Questa fase corrisponde allo **Stadio 2 (Consolidation)**: le note grezze diventano knowledge base strutturata.

1. **Compilazione iniziale**:
   Avvia la compilazione dei file convertiti in `raw/`:
   ```text
   /compile
   ```
   L'agente estrarrà i concetti, aggiungerà il frontmatter OKF v0.2, collegherà le pagine con `[[wikilink]]` e rinominerà le fonti in `_COMPILED.md`.

2. **Interrogazione e Navigazione Web UI**:
   Apri la Web UI (`npm run dev` o `make ui-docker`):
   - Esplora il grafo delle relazioni tra autori e concetti nella **Graph View**.
   - Usa `/consult "In che modo Amodei e Graeber analizzano l'evoluzione del lavoro?"` per generare confronti sintetici che si convertono in nuove pagine wiki tramite il tasto **📌 Attach to Wiki**.
   - Verifica la precisione delle affermazioni con `/trace "claim di ricerca"` ottenendo il tracciamento al paragrafo e riga sorgente (`#L10-L25`).

---

### Fase 4: Analisi di Maturità e Studio
1. **Calcolo dell'Indice di Maturità (`/maturity`)**:
   L'indice di maturità (da 0 a 100) misura la completezza di una pagina basandosi su:
   - Copertura delle fonti citate (`copertura_fonti * 15`)
   - Domande risolte (`domande_risolte * 5`)
   - Densità dei collegamenti `[[wikilink]]` (`collegamenti * 3`)
   - Lunghezza e consistenza del testo (`parole / 50`, fino a 20 punti)

   Calcola la maturità dell'intero vault:
   ```bash
   python scripts/maturity_calculator.py wiki --write
   # Oppure comando chat: /maturity
   ```

2. **Sintesi e Revisione**:
   Usa `/study-guide`, `/quiz`, `/mindmap` e `/deep-research` per verificare la tenuta concettuale delle tue argomentazioni e identificare lacune nella bibliografia.

---

### Fase 5: Compilazione e Generazione del PDF Stampabile
Quando la Knowledge Base ha raggiunto una soglia adeguata di maturità:

1. **Aggregazione del testo unificato della tesi**:
   Filtra e unisci tutte le note mature (es. maturità >= 50) in un unico file Markdown:
   ```bash
   python scripts/generate_thesis.py --wiki-dir wiki --output output/thesis_compiled.md --min-maturity 50
   # Oppure via shortcut Makefile:
   make thesis-compile
   # Oppure comando agente: /thesis-chapter
   ```

2. **Compilazione PDF via Pandoc**:
   Converti la bozza unificata in un PDF stampabile pronto per il relatore:
   ```bash
   python scripts/export_thesis_pdf.py --input output/thesis_compiled.md --output output/thesis_final.pdf
   # Oppure via shortcut Makefile:
   make thesis-pdf
   ```

---

## 4. Schema Metadata e Frontmatter OKF v0.2 per Tesi

Ogni nota della tesi contiene YAML frontmatter conforme allo standard OKF v0.2:

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
> "L'uso standard dell'AI nelle HR oggi si limita al *Prompt Engineering*: fare domande a un chatbot. Io ho adottato il paradigma dell'*LLM Wiki* per trasformare l'AI in un **Knowledge Engineer**. Non ho usato l'AI per *rispondere* alle mie domande, ma per *costruire* l'infrastruttura che contiene le risposte. Questo simula come un dipartimento HR moderno dovrebbe gestire il Knowledge Management: non con chatbot effimeri, ma con Knowledge Graph strutturati e validati."

### B. L'analogia Ontologia HR ↔ SHACL
> "Wiki-Forge utilizza standard del W3C come SHACL per validare la *forma* della conoscenza. Ho applicato lo stesso rigore tecnico alla letteratura HR. Lo script `cq_runner.py` verifica le *Competency Questions* della mia tesi esattamente come un HR Manager usa un *Competency Framework* per validare se un profilo copre tutti i requisiti di una job description. La tecnologia non è solo un tool: è una metafora operativa del mio oggetto di studio."

### C. Superamento dei silos informativi (il problema del RAG)
> "Ho sperimentalmente verificato che sistemi RAG puri (come il collettore di NotebookLM) falliscono nel confronto sinottico tra autori complessi, soffrendo di allucinazioni o perdita di contesto. Adottando un approccio ibrido con *GraphRAG*, la tesi non è un documento statico, ma il dump di un **Sistema Esperto** che ha mappato le relazioni semantiche tra le teorie studiate."

---

## 6. Roadmap Operativa Consigliata

1. **Setup**: clona `wiki-forge`, configura `config.toml` con la tua API key e imposta i path.
2. **Importazione**: esporta le note da NotebookLM in Markdown e importale con `python scripts/notebooklm_import.py`.
3. **Compilazione**: esegui l'agente sulla cartella `raw/` e chiedigli esplicitamente:
   > "Agisci come un Knowledge Engineer. Analizza le note in `raw/`, identifica le teorie HR contrastanti e crea nuove voci nella `wiki/` collegandole tra loro. Usa il formato OKF v0.2."
4. **Validazione HR**: usa `make validate-cq` per assicurarti che la wiki risponda alle domande fondamentali della tesi (es. "Quali autori supportano lo smart working come leva di retention?").
5. **Export**: usa `make thesis-compile` per impaginare i capitoli e `make thesis-pdf` per ottenere il documento finale da portare in commissione.

---

## 7. Risultato Finale: Doppia Fruibilità

Grazie a questo approccio, il tesista ottiene simultaneamente:
1. **Il Libro / PDF della Tesi**: Un elaborato strutturato, formalmente ineccepibile, formattato secondo i canoni accademici e pronto per la stampa.
2. **Il Secondo Cervello Digitale (Wiki)**: Un patrimonio di conoscenza permanente, navigabile a vita, che costituisce la base per futuri articoli scientifici, dottorati o progetti professionali.

**Conclusione.** NotebookLM è un ottimo *microscopio* per analizzare il singolo autore; Wiki-Forge è il *laboratorio* dove la scienza (la tesi) prende forma. La scelta va difesa non come preferenza software, ma come adozione di un **modello maturativo della conoscenza** che le HR del futuro dovranno necessariamente padroneggiare.
