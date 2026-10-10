# TUTORIAL — Guida Operativa all'Uso di Wiki-Forge

> **Guida semplice per utenti ed operatori non tecnici.**
> Spiega passo dopo passo come costruire, consultare ed evolvere la propria base di conoscenza dinamica ("LLM Wiki") e come esportarla in formato PDF pronto per la stampa o la consegna.

---

## 1. Cos'è Wiki-Forge e Quale Problema Risolve

Quando affronti un progetto complesso — come una **Tesi Magistrale**, una ricerca di mercato o un manuale operativo — accumuli decine di PDF, articoli e appunti. Con i metodi tradizionali incontri due limiti principali:

1. **Memoria frammentata**: Dopo qualche mese ricordi di aver letto un concetto fondamentale, ma non ricordi più in quale dei tuoi 50 PDF si trovi.
2. **Chatbot tradizionali inefficienti**: Incollare centinaia di documenti ad ogni domanda è lento, costoso e costringe l'IA a ripartire da zero ogni volta.

Wiki-Forge risolve questo problema strutturando e separando chiaramente i ruoli utente in due modalità operative:
- **Operatore Semplice (Focus Mode 🌱)**: Utente non tecnico che deve caricare documenti, compilarli ed interrogare l'agente per alimentare la Wiki.
- **Ingegnere della Conoscenza / Knowledge Engineer (Developer Mode 👑 / KE Workbench 🧠)**: Profilo tecnico/specialista di dominio che gestisce la modellazione concettuale, le regole ontologiche, la validazione delle Competency Questions, gli Ontology Design Patterns (ODP), l'inferenza neuro-simbolica e l'esportazione semantica RDF/W3C.

> **L'Analogia del Bibliotecario e dell'Ingegnere:** L'operatore semplice consegna i libri al bibliotecario (inbox `sources/` e `raw/`) e consulta gli scaffali. L'Ingegnere della Conoscenza progetta la tassonomia della biblioteca, definisce le regole di classificazione ontologica e ne garantisce la coerenza formale.

---

## 2. 🌟 Guida Rapida per l'Operatore Semplice (Modalità Focus 🌱)

In **Modalità Semplice**, utilizzare Wiki-Forge richiede solo 3 semplici passaggi senza bisogno di comandi tecnici o di usare il terminale.

I tre pulsanti sono **nella barra in alto, al centro** (Modalità Semplice), sempre visibili:

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ ⚒️ Wiki-Forge   🌱 Focus Mode   [Project: …]                     │
  │              📥 1. Carica   ⚡ 2. Compila   💬 3. Chiedi          │
  │                              Documenti  Converti&Link  Alla Wiki  │
  └──────────────────────────────────────────────────────────────────┘
```

| # | Pulsante | Cosa fa |
|---|----------|---------|
| 1 | **📥 1. Carica** | Apre la finestra di caricamento: PDF, EPUB, DOCX, TXT. I file finiscono in `sources/`. |
| 2 | **⚡ 2. Compila** | Converte i documenti, estrae i concetti chiave e crea i collegamenti `[[wikilink]]` tra le note. Mostra una barra di avanzamento. |
| 3 | **💬 3. Chiedi** | Apre l'assistente in chat per interrogare la wiki (sintesi, mappe concettuali, citazioni). |

1. **Carica**: clicca **📥 1. Carica** e trascina i tuoi documenti PDF, DOCX, EPUB o TXT (oppure incollali direttamente nella cartella `sources/`).
2. **Elabora**: clicca **⚡ 2. Compila**. Il sistema converte automaticamente i file, estrae i concetti principali e crea i collegamenti tra le note.
3. **Esplora**: clicca **💬 3. Chiedi** e fai le tue domande alla chat, oppure esplora il grafo della conoscenza.

> I pulsanti 1–3 sono visibili solo in **Focus Mode** (Modalità Semplice). In **Developer Mode** spariscono e accedi agli strumenti avanzati. Il toggle **Dev Mode** è in alto a destra; scorciatoia: `Ctrl+Shift+D`.

### 🖥️ Viste dell'area di lavoro

I tre pulsanti in alto a destra (**📝 Editor**, **🕸️ Graph**, **◧ Split**) scelgono come disporre l'area di lavoro:

- **📝 Editor** — solo editor di testo a tutto schermo.
- **🕸️ Graph** — solo grafo della conoscenza (i controlli del grafo compaiono in alto).
- **◧ Split** — editor e grafo affiancati, separati da un trascinatore. È la vista predefinita.

La scelta viene ricordata tra un riavvio e l'altra. Passando alla sola vista **Graph**, il pannello **Node Metadata** sotto l'editor resta visibile; cliccando una nota dalla barra laterale si torna automaticamente a **Split** per leggerne il testo.

---

### 🎯 Scenari di Utilizzo Pratici

#### Scenario A: Lo Studente Universitario (Tesi di Laurea)
- **Obiettivo**: Gestire 50+ paper accademici e produrre una tesi di laurea formattata.
- **Flusso**:
  1. Carica i PDF dei paper con **📥 1. Carica**.
  2. Clicca su **⚡ 2. Compila**.
  3. Fai domande alla chat con **💬 3. Chiedi**: *"Crea una mappa concettuale che colleghi le teorie di Graeber e Cristianini presenti nei paper"*.
  4. Per generare la tesi finale, usa il comando `/thesis-chapter` per unire le note e scarica il PDF finale pronto per la stampa.

#### Scenario B: Il Professionista (Gestione Riunioni e Progetti)
- **Obiettivo**: Non perdere le decisioni prese durante le riunioni e organizzare i progetti aziendali.
- **Flusso**:
  1. Incolla il trascritto di una riunione nella chat con il comando `/note Riunione 28/09: decidiamo di usare Wiki-Forge`.
  2. A fine settimana, usa `/promote-note` per trasformare gli appunti in una pagina wiki strutturata.
  3. Cerca istantaneamente le decisioni passate chiedendo alla chat: *"Quali scadenze abbiamo fissato per il progetto X?"*.

#### Scenario C: L'Appassionato (Ricette, Manuali, Hobby)
- **Obiettivo**: Creare un archivio personale di conoscenze consultabile in mobilità.
- **Flusso**:
  1. Usa lo strumento **Web Clipper** nella UI per salvare articoli e ricette da siti web.
  2. Il sistema converte la pagina in testo pulito, suggerisce automaticamente i tag (es. `#cucina/italiana`) e la salva nella wiki.
  3. Chiedi alla chat: *"Mostrami tutte le ricette con i funghi salvate il mese scorso"*.

---

## 3. 🧠 Workflow e Use Case per l'Ingegnere della Conoscenza (KE Workbench 👑)

Per la figura professionale del **Knowledge Engineer**, `wiki-forge` offre la modalità **Developer Mode (👑)** ed il pannello guidato **KE Workbench (🧠)**, con 6 Use Case standardizzati per la governance semantica:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ KNOWLEDGE ENGINEER WORKFLOW & GUIDED USE CASES                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ UC1: Schema & Taxonomy Modeling    ──► schema_infer, schema_lint, suggest_tags │
│ UC2: Ontological Integrity         ──► ontology_rules, okf_lint                 │
│ UC3: Competency Questions (CQ)     ──► cq_validator, wiki_stats                 │
│ UC4: Neuro-Symbolic & ODP          ──► odp_suggester, neuro_symbolic_check      │
│ UC5: Enterprise Semantic Export    ──► export_semantic (RDF/TTL), okf_reindex   │
│ UC6: Platform Maturity Evaluation  ──► maturity_calculator, ke_maturity         │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. **Use Case 1: Schema & Taxonomy Modeling (`ke_schema_modeling`)**:
   Inferenzia ed estrae i predicati ricorrenti dal vault (`schema_infer`), ne valida i vincoli sintattici (`schema_lint`) e normalizza i tag della tassonomia (`suggest_tags`).
2. **Use Case 2: Ontological Integrity & Validation (`ke_ontological_validation`)**:
   Rileva dipendenze circolari dirette (es. A -> B -> A), verifica la revisione umana per le note `stable` (`ontology_rules`) ed esegue il linting dei metadati OKF v0.2 (`okf_lint`).
3. **Use Case 3: Competency Questions (CQ) & Coverage (`ke_cq_assessment`)**:
   Valuta la copertura delle domande di competenza definite in `wiki/competency_questions.md` (`cq_validator`) ed aggiorna il report generale delle metriche `METRICS.md` (`wiki_stats`).
4. **Use Case 4: Neuro-Symbolic Reasoning & ODP (`ke_neuro_symbolic`)**:
   Raccomanda Ontology Design Patterns formali (`odp_suggester`) ed applica l'inferenza neuro-simbolica per rilevare contraddizioni o suggerire wikilink mancanti (`neuro_symbolic_check`).
5. **Use Case 5: Enterprise Semantic Graph & RDF Export (`ke_semantic_export`)**:
   Mappa il vault Zettelkasten in triple RDF W3C esportando `output/wiki_export.ttl` e `.jsonld` (`export_semantic`) e rigenerando la mappa MOC (`okf_reindex`).
6. **Use Case 6: KE Platform Maturity Evaluation (`ke_maturity_eval`)**:
   Calcola l'Indice di Maturità delle note (`maturity_calculator`) e valuta il livello L1-L4 di maturità dell'intera piattaforma su 6 dimensioni (`ke_maturity`).

---

## 4. 🚀 Workflow Avanzato in 5 Fasi Cronologiche

Per gli utenti avanzati che desiderano il controllo totale sui processi di ingestion, linting, metadati OKF v0.2 e compilazione, Wiki-Forge offre un flusso strutturato in **5 Fasi Cronologiche**:

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
 └──────────────────────────────┘
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

## 5. Comandi di Manutenzione Periodica della Wiki

Per mantenere la wiki pulita, priva di link rotti e conforme allo standard OKF v0.2:

| Comando | Scopo / Azione |
|---------|----------------|
| `adversarial-review` / `/adversarial-review` | Stress-test e revisione avversaria di note/tesi per contraddizioni e citazioni mancano |
| `digest` / `/digest` | Riassunto in linguaggio naturale dei cambiamenti recenti e della salute della wiki |
| `verify` / `/verify` (alias `human-review` / `/human-review`) | Registra la revisione umana OKF di una nota (`verified: - by: human:<id>`), unica azione che la porta al tier `human-reviewed` 🟢 |
| `slides` / `/slides` (`/generate-slides`) | Generazione di una presentazione reveal.js da note mature o capitoli |
| `audit` / `/audit` | Controllo generale di salute (link rotti, orfani, sovrapposizioni) |
| `reindex` / `/reindex` | Rigenerazione automatica degli indici master e tematici |
| `prune` / `/prune` | Pulizia di note vuote o bozze abbandonate |
| `schema-lint` / `/schema-lint` | Validazione delle note rispetto allo schema tipizzato `[schema]` |
| `schema-infer` / `/schema-infer` | Proposta automatica di una configurazione `[schema]` TOML dalla wiki |
| `lint-frontmatter` / `/lint-frontmatter` | Validazione della sintassi YAML frontmatter OKF v0.2 |
| `validate-cq` / `/validate-cq` | Validazione della copertura della wiki rispetto alle Competency Questions (CQ) |
| `suggest-odp` / `/suggest-odp` | Suggerimento di Ontology Design Patterns formali (Employment, Time-Indexed) |
| `neuro-check` / `/neuro-check` | Controllo di coerenza neuro-simbolica e inferenza di collegamenti |
| `ke-maturity` / `/ke-maturity` | Valutazione della maturità del sistema su 6 dimensioni (L1-L4) |
| `ontology-check` / `/ontology-check` | Validazione logica delle regole ontologiche (concetti isolati, cicli, verif. umana) |
| `stats` / `/stats` | Calcolo delle metriche di crescita e generazione di `docs/METRICS.md` |
| `merge <a> <b>` / `/merge` | Unione di two articoli duplicati |
| `split <art> <sezione>` / `/split` | Divisione di un articolo lungo in sotto-articoli |
| `stub <concetto>` / `/stub` | Creazione di una nota segnaposto per sviluppi futuri |
| `retag <art> [+tag]` / `/retag` | Aggiornamento dei tag di un articolo |
| `export-semantic` / `/export-semantic` | Esportazione semantica della KB nei formati standard W3C (JSON-LD e Turtle) |

---

## 6. Guida alla Risoluzione Problemi (Troubleshooting)

### "L'agente non trova i file grezzi in raw/"
- Verifica che `config.toml` contenga `raw = "raw"`.
- Assicurati di aver eseguito `bash run_convert.sh` o `python scripts/conv2md.py` dopo aver aggiunto i file in `sources/`.

### "I wikilink risultano interrotti dopo aver rinominato un articolo"
- Esegui il comando `/audit` per rilevare i link rotti.
- Esegui il comando `/reindex` per aggiornare tutti gli indici della wiki.

### "Due articoli trattano lo stesso argomento"
- Esegui `/merge articolo-1 articolo-2` per unire i contenuti mantenendo la tracciabilità delle fonti.
