# Guida Operativa — Tesi Magistrale e Knowledge Base Dinamica

> **Metodologia guidata per la costruzione di una Tesi Magistrale come Knowledge Base dinamica consultabile e documento PDF finale per la stampa.**

Wiki-Forge trasforma la preparazione della tesi di laurea da un processo lineare e statico (lettura PDF → appunti sparsi → stesura capitoli) in un **sistema cognitivo dinamico ed evolutivo** gestito insieme agli agenti LLM.

La tesi risultante possiede una **doppia natura**:
1. **Versione Dinamica & Incrementale**: Una wiki interconnessa in formato Markdown consultabile tramite Web UI, interrogabile in tempo reale, continuamente aggiornabile con nuove fonti e quesiti di ricerca.
2. **Versione Statica & Stampabile**: Un documento unificato compilato in PDF ad alta qualità tipografica via Pandoc, pronto per la stampa e la consegna accademica.

---

## 1. Il Paradigma: Tesi come Sistema Cognitivo Evolutivo

Anziché limitarsi a interrogare i documenti originali tramite RAG passeggero (risposte temporanee in chat che vengono perse), **ogni nuova domanda di ricerca, ogni analisi comparativa e ogni sintesi generano nuove pagine Wiki persistenti**.

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

## 2. Flusso di Lavoro Cronologico dell'Operatore in 5 Fasi

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
1. **Compilazione iniziale**:
   Avvia la compilazione dei file convertiti in `raw/`:
   ```text
   /compile
   ```
   L'agente estrarrà i concetti, aggiungerà il frontmatter OKF v0.2, collegherà le pagine con `[[wikilink]]` e rinominerà le fonti in `_COMPILED.md`.

2. **Interrogazione e Navigazione Web UI**:
   Apri la Web UI (`npm run dev` o `make ui-docker`):
   - Esplora il grafi delle relazioni tra autori e concetti nella **Graph View**.
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

## 3. Schema Metadata e Frontmatter OKF v0.2 per Tesi

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

## 4. Risultato Finale: Doppia Fruibilità

Grazie a questo approccio, il tesista ottiene simultaneamente:
1. **Il Libro / PDF della Tesi**: Un elaborato strutturato, formalmente ineccepibile, formattato secondo i canoni accademici e pronto per la stampa.
2. **Il Secondo Cervello Digitale (Wiki)**: Un patrimonio di conoscenza permanente, navigabile a vita, che costituisce la base per futuri articoli scientifici, dottorati o progetti professionali.
