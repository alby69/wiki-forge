# TUTORIAL — Guida Operativa all'Uso di Wiki-Forge

> **Guida semplice per utenti ed operatori non tecnici.**
> Spiega passo dopo passo come costruire, consultare ed evolvere la propria base di conoscenza dinamica ("LLM Wiki") e come esportarla in formato PDF pronto per la stampa o la consegna.

---

## 1. Cos'è Wiki-Forge e Quale Problema Risolve

Quando affronti un progetto complesso — come una **Tesi Magistrale**, una ricerca di mercato o un manuale operativo — accumuli decine di PDF, articoli e appunti. Con i metodi tradizionali incontri due limiti principali:

1. **Memoria frammentata**: Dopo qualche mese ricordi di aver letto un concetto fondamentale, ma non ricordi più in quale dei tuoi 50 PDF si trovi.
2. **Chatbot tradizionali (RAG classico) inefficienti**: Incollare centinaia di documenti ad ogni domanda è lento, costoso e costringe l'IA a ripartire da zero ogni volta.

Wiki-Forge risolve questo problema trasformando l'IA in un **Knowledge Engineer (Ingegnere della Conoscenza)**. L'IA non si limita a rispondere a una domanda passeggera: **costruisce, aggiorna e organizza nel tempo una Wiki interconnessa in formato Markdown**, che rimane salvata sul tuo computer.

> **L'Analogia del Bibliotecario:** Anziché portare uno scatolone di fogli sfusi al tuo assistente ogni volta che hai un dubbio, assumi un bibliotecario permanente. Ogni volta che porti un nuovo libro, il bibliotecario lo legge, crea schede sintetiche, le organizza per argomento e crea collegamenti incrociati (`[[wikilink]]`). Quando fai una domanda, il bibliotecario va dritto al punto.

---

## 2. Le 5 Fasi Cronologiche per Costruire una Knowledge Base Dinamica

Per guidare un operatore dalla prima bozza fino al documento finale (es. una Tesi Magistrale stampabile e consultabile), Wiki-Forge segue un flusso logico in **5 Fasi Cronologiche**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 1: Configurazione & Inizializzazione                   │
 │ Setup progetto, config.toml, Scenari Wizard (es. Academic)  │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 2: Ingestione & Conversione Fonti                      │
 │ Caricamento PDF/EPUB in sources/, conv2md, web-clips,       │
 │ importazione da NotebookLM                                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 3: Costruzione Incrementale & Consultazione KB        │
 │ /compile, /ingest, Web UI, CodeMirror 6, Graph View,        │
 │ /consult, OKF v0.2, versioning incrementale e /rollback     │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 4: Sintesi, Studio & Calcolo Maturità                  │
 │ /study-guide, /quiz, /mindmap, /audio-overview,             │
 │ /deep-research, /note, /promote-note, /maturity, /tag-suggest│
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 5: Proiezione Statica & Compilazione PDF               │
 │ /thesis-chapter, generate_thesis, export_thesis_pdf         │
 └─────────────────────────────────────────────────────────────┘
```

---

### FASE 1: Configurazione & Inizializzazione Vault

All'avvio di un nuovo progetto, la prima operazione consiste nel configurare le informazioni generali e scegliere lo scenario operativo.

1. **Configurazione principale (`config.toml`)**:
   Puoi modificare direttamente il file `config.toml` oppure usare l'interfaccia grafica **⚙️ Config** nella Web UI per impostare titolo, lingua e percorsi:
   ```toml
   [project]
   name = "tesi-magistrale"
   title = "Tesi Magistrale - AI e Trasformazione del Lavoro"
   language = "it"

   [paths]
   sources = "sources"  # o backup/ (i tuoi file originali)
   raw = "raw"          # i file convertiti in testo Markdown
   wiki = "wiki"        # la base di conoscenza dinamica
   output = "output"    # le risposte e i report temporanei
   notes = "notes"      # appunti veloci
   ```

2. **Wizard di Scenario (`wizard` / `/wizard`)**:
   Attiva il wizard guidato per impostare la struttura ideale al tuo dominio. Per una Tesi Magistrale, avvia il preset accademico:
   ```bash
   python scripts/wizard.py --preset academic
   ```
   Oppure scrivi `/wizard academic` direttamente nella chat dell'agente.

3. **Gestione Multi-Progetto**:
   Se lavori a più progetti contemporaneamente, puoi isolare ciascuna base di conoscenza nella cartella `projects/` (es. `projects/tesi/` e `projects/lavoro/`) e passare da un progetto all'altro dall'interfaccia grafica tramite il dropdown **Project Switcher**.

---

### FASE 2: Ingestione & Conversione Fonti

Nessun file originale viene mai modificato o cancellato. La Fase 2 converte i tuoi documenti sorgente in testo Markdown pulito collocato nella cartella `raw/`.

1. **Aggiunta file sorgente**:
   Inserisci PDF, EPUB, DOCX o TXT nella cartella `sources/` (o `backup/`).
2. **Conversione automatica (`convert-only` / `/convert-only`)**:
   Esegui lo script di conversione:
   ```bash
   bash run_convert.sh
   # oppure via comando agente: /convert-only
   ```
   I file convertiti appariranno in `raw/` pronti per l'elaborazione.

3. **Cattura da Web (`clip2md.py`)**:
   Per salvare articoli da siti web direttamente in Markdown, usa lo script di web clipping:
   ```bash
   python scripts/clip2md.py "https://example.com/articolo"
   ```

4. **Importazione da Google NotebookLM (`notebooklm_import.py`)**:
   Se utilizzi Google NotebookLM per riassumere studio e FAQ, importa le tue note pulite e dotate di metadata OKF v0.2:
   ```bash
   python scripts/notebooklm_import.py appunti_notebooklm.md --source "Sessione NotebookLM"
   ```

---

### FASE 3: Costruzione Incrementale & Consultazione della KB Dinamica

Questa è la fase centrale in cui la conoscenza prende vita. L'agente legge i file grezzi in `raw/`, crea articoli sintetici interconnessi in `wiki/` conformi allo standard **OKF v0.2**, ed etichetta i sorgenti elaborati col suffisso `_COMPILED.md`.

1. **Compilazione iniziale (`compile` / `/compile` e `ingest` / `/ingest`)**:
   Per elaborare tutti i file in `raw/`, esegui:
   ```text
   /compile
   ```
   Per elaborare un singolo file specifico:
   ```text
   /ingest raw/articolo.md
   ```
   Se desideri riesaminare un sorgente già compilato:
   ```text
   /recompile raw/articolo_COMPILED.md
   ```

2. **Esplorazione e Modifica tramite Web UI**:
   Avvia la Web UI con `npm run dev` o `make ui-docker` (http://localhost:5173):
   - **Vault Explorer**: Naviga nella cartella `wiki/`, crea nuove cartelle (`📁+`) o nuovi file (`📄+`), rinomina (`✏️`), sposta o elimina (`🗑️`).
   - **Editor CodeMirror 6**: Formatta il testo in Markdown, usa l'autocompletamento automatico dei `[[wikilink]]` digitando `[[`, e salva con **💾 Save & Close** o scorciatoia `Ctrl+S`.
   - **Graph View**: Visualizza la mappa interattiva dei concetti e clicca sui nodi per aprire la nota corrispondente.

3. **Interrogazione Dinamica & Tracciabilità (`consult`, `search`, `backlinks`, `related`, `trace`)**:
   Poni domande complesse all'agente nella chat:
   - `/consult "Quali sono le principali teorie sul lavoro di Graeber?"`: L'agente risponde citando le fonti con `[[wikilink]]`.
   - `/search "intelligenza artificiale"`: Cerca concetti chiave nella wiki.
   - `/backlinks ai-tools/claude-code`: Mostra le note che collegano l'articolo selezionato.
   - `/related ai-tools/claude-code`: Identifica gli articoli correlati.
   - `/trace "claim di ricerca"`: Verifica e traccia le affermazioni fino alle righe esatte del sorgente originale (`#L10-L25`).

4. **Creazione Articoli & Gestione Versioni (`new-article`, `rollback`)**:
   Crea un nuovo articolo da modello con `/new-article <nome>`. Ogni modifica sostanziale genera uno snapshot di versione in `wiki/versions/`. Se desideri ripristinare uno stato precedente, usa:
   ```text
   /rollback note=nome-nota to=v1
   ```

---

### FASE 4: Sintesi, Studio & Calcolo Maturità

Mentre la wiki cresce, puoi utilizzare la Suite di Studio e Sintesi per generare materiali didattici, approfondimenti e monitorare il completamento delle note.

1. **Strumenti di Sintesi e Didattica (`study-guide`, `quiz`, `mindmap`, `audio-overview`, `deep-research`)**:
   - `/study-guide <argomento>`: Genera una guida di studio strutturata in `output/`.
   - `/quiz <argomento> [n]`: Genera un quiz di autovalutazione a scelte multiple.
   - `/mindmap <articolo>`: Estrae la mappa concettuale ad albero e JSON.
   - `/audio-overview <argomento>`: Crea uno script di dialogo a due voci (Host A / Host B) per un podcast audio.
   - `/deep-research <domanda>`: Esegue una ricerca approfondita multi-fonte con matrice di attribuzione delle affermazioni.

2. **Scratchpad Note Veloci & Suggerimento Tag (`note`, `promote-note`, `tag-suggest`)**:
   - `/note "idea per il Capitolo 2 sulla dequalificazione del lavoro"`: Salva una nota rapida in `notes/`.
   - `/promote-note <id> <categoria>`: Promuove la nota rapida ad articolo wiki ufficiale.
   - `/tag-suggest wiki/articolo.md`: Suggerisce tag coerenti con la tassonomia controllata.

3. **Calcolo dell'Indice di Maturità (`maturity` / `/maturity`)**:
   Valuta lo stato di avanzamento delle note (punteggio da 0 a 100 basato su fonti, link e completezza):
   ```bash
   python scripts/maturity_calculator.py wiki --write
   # Oppure comando chat: /maturity
   ```

---

### FASE 5: Proiezione Statica & Compilazione PDF Stampabile

Quando la conoscenza accumulata nella wiki ha raggiunto un livello di maturità elevato, è il momento di estrarre e compilare il documento finale per la stampa o la consegna formale.

1. **Aggregazione Capitoli Tesi (`thesis-chapter` / `/thesis-chapter`)**:
   Aggrega tutte le sintesi e i capitoli maturi in un unico documento unificato:
   ```bash
   python scripts/generate_thesis.py --wiki-dir wiki --output output/thesis_compiled.md --min-maturity 50
   # Oppure via comando agente: /thesis-chapter
   ```

2. **Esportazione PDF via Pandoc (`export_thesis_pdf.py` / `make thesis-pdf`)**:
   Compila il documento unificato Markdown in un PDF finale formattato:
   ```bash
   python scripts/export_thesis_pdf.py --input output/thesis_compiled.md --output output/thesis_final.pdf
   # Oppure via shortcut: make thesis-pdf
   ```

3. **Utility di Manutenzione & Esportazione Struttura (`export`, `diff`, `template`, `sources`, `help`)**:
   - `/export` (o `export json`): Esporta la struttura completa della wiki.
   - `/diff <articolo>`: Mostra le differenze Git di un articolo.
   - `/template show`: Visualizza il modello standard delle note.
   - `/sources` (o `sources regenerate`): Rigenera il registro bibliografico in `docs/SOURCES.md`.
   - `/help`: Mostra la guida di riferimento rapido dei comandi.

---

## 3. Comandi di Manutenzione Periodica della Wiki

Per mantenere la wiki pulita, priva di link rotti e conforme allo standard OKF v0.2:

| Comando | Scopo / Azione |
|---------|----------------|
| `audit` / `/audit` | Controllo generale di salute (link rotti, orfani, sovrapposizioni) |
| `reindex` / `/reindex` | Rigenerazione automatica degli indici master e tematici |
| `prune` / `/prune` | Pulizia di note vuote o bozze abbandonate |
| `lint-frontmatter` / `/lint-frontmatter` | Validazione della sintassi YAML frontmatter OKF v0.2 |
| `stats` / `/stats` | Calcolo delle metriche di crescita e generazione di `docs/METRICS.md` |
| `merge <a> <b>` / `/merge` | Unione di due articoli duplicati |
| `split <art> <sezione>` / `/split` | Divisione di un articolo lungo in sotto-articoli |
| `stub <concetto>` / `/stub` | Creazione di una nota segnaposto per sviluppi futuri |
| `retag <art> [+tag]` / `/retag` | Aggiornamento dei tag di un articolo |

---

## 4. Guida alla Risoluzione Problemi (Troubleshooting)

### "L'agente non trova i file grezzi in raw/"
- Verifica che `config.toml` contenga `raw = "raw"`.
- Assicurati di aver eseguito `bash run_convert.sh` o `python scripts/conv2md.py` dopo aver aggiunto i file in `sources/`.

### "I wikilink risultano interrotti dopo aver rinominato un articolo"
- Esegui il comando `/audit` per rilevare i link rotti.
- Esegui il comando `/reindex` per aggiornare tutti gli indici della wiki.

### "Due articoli trattano lo stesso argomento"
- Esegui `/merge articolo-1 articolo-2` per unire i contenuti mantenendo la tracciabilità delle fonti.
