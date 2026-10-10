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

## 6. 🎓 Tutorial per la Tesi Magistrale (esempio applicato: `projects/tesi`)

Questa sezione mostra come usare Wiki-Forge dall'inizio alla fine per una **Tesi Magistrale**, applicandolo concretamente alla knowledge base di esempio `projects/tesi/wiki`. Le domande proposte sono progettate per essere incollate direttamente nella chat dell'agente e per essere abbinate ai comandi specifici di Wiki-Forge.

### 6.1 Analisi Approfondita del Repository e della Wiki

#### Filosofia e Architettura del Progetto

Wiki-Forge non è un semplice archivio di documenti, ma un template "agent-agnostic" per costruire una base di conoscenza dinamica. Si basa sul pattern **"LLM Wiki"** (ispirato ad Andrej Karpathy) e sul formato **Open Knowledge Format (OKF v0.2)**.

A differenza del classico RAG (che risponde "al volo" pescando da documenti grezzi), qui l'LLM agisce come un **Knowledge Engineer attivo**: compila, valuta, collega e mantiene in modo incrementale una wiki persistente in Markdown, che può poi essere trasformata in capitoli di tesi pronti per la stampa (PDF via Pandoc).

#### Mappatura della directory `projects/tesi/wiki`

La cartella della tesi è già ben strutturata in aree semantiche — segno che l'agente ha già elaborato una base di conoscenza solida:

- `temi/`: I concetti fondanti. Include file come `competenze-e-hr.md`, `sostituzione-o-trasformazione.md`, `capacita-emergenti-llm.md`, `governance-controllo-responsabilita.md` e `concezioni-dell-ia.md`.
- `analisi/`: Approfondimenti contestuali e dati. Include `evidenza-mercato-del-lavoro.md`, `geopolitica-ia-poli-us-eu-cn.md` e `linee-guida-tesi-hr.md`.
- `Q&A/`: Sintesi argomentative pronte all'uso, come `sintesi-previsioni-lavoro-hr.md`, che affronta già il nucleo della tesi (il problema del "junior ladder", la biforcazione dei ruoli HR).
- `autori/`: Schede sui pensatori chiave citati (es. Andrew Ng, Geoffrey Hinton, David Graeber, Stefano Gatti, Andrej Karpathy).
- `strumenti/` e `tools/`: Definizioni dei comandi dell'agente, workflow di verifica (`/verify`) e script di manutenzione della conoscenza.

#### Tematiche Chiave già emerse nella Wiki

- **Ricomposizione dei task, non sostituzione di massa**: L'AI automatizza compiti specifici, non intere professioni (principio Human-in-the-Loop).
- **Biforcazione della funzione HR**: L'HR si dividerà tra "architetti di flussi agentici" (Prompt & Process Architect) e "garanti della sostenibilità/dignità" del lavoro.
- **Il paradosso del "Junior Ladder"**: I neolaureati sono i "canarini nella miniera". L'automazione dei task entry-level rischia di distruggere le fondamenta su cui si costruisce l'esperienza senior.
- **Sovranità dei dati**: La tensione tra l'adozione di modelli open-weights interni ("own your AI") e i rischi esistenziali o di compliance (UE vs USA/Cina).

### 6.2 Elenco di Domande da Porre all'Agente

Copia e incolla queste prompt nella chat dell'agente. Ogni blocco abbina le domande ai comandi più adatti.

#### A. Esplorazione Concettuale e Collegamenti (`/consult` + `/backlinks`)

Queste domande aiutano a far emergere connessioni non ovvie tra i file già presenti nella wiki.

1. "Analizza le relazioni tra il concetto di 'lavori di merda' (bullshit jobs) di David Graeber e la previsione secondo cui l'AI automatizzerà principalmente la 'routine igienica'. Quali nuove forme di 'lavoro di cura' o 'sostanza espressiva' potrebbero emergere nel settore HR come risposta?"
2. "Mappa le contraddizioni presenti nella wiki tra la visione di Geoffrey Hinton sui rischi degli open-weights e l'argomento di 'sovranità dei dati'. Come può un dipartimento HR bilanciare l'uso di strumenti AI potenti con la compliance e la sicurezza dei dati dei dipendenti?"
3. "Quali sono i collegamenti diretti (backlinks) tra il file `competenze-e-hr.md` e `geopolitica-ia-poli-us-eu-cn.md`? Esiste un impatto geopolitico specifico sulle competenze che le aziende europee richiedono rispetto a quelle USA o cinesi?"

#### B. Approfondimento Critico e Stress-Test (`/adversarial-review` + `/deep-research`)

Usa queste domande per sfidare le ipotesi della tesi e trovare punti deboli da rafforzare.

4. "Esegui una `/adversarial-review` della seguente affermazione presente nella wiki: 'L'IA non sostituisce figure professionali in blocco, ma ricompone i task'. Fornisci i 3 controargomenti più forti basati su dati recenti o teorie economiche contrarie, e poi confutali usando le fonti già presenti nel progetto."
5. "Approfondisci con `/deep-research` il concetto di 'Junior Ladder'. Se i task entry-level (sintesi, primo filtraggio CV, coding base) sono automatizzati, quali meccanismi concreti di 'reskilling preventivo' o 'apprendimento aumentato' possono essere implementati dalle aziende per formare la prossima generazione di senior HR o manager?"
6. "La wiki menziona un aumento del 13% delle performance con l'AI (citando Lazazzara). Quali sono le condizioni al contorno (contesto, tipo di task, livello di formazione) necessarie affinché questo dato si realizzi? Quando l'AI ha invece un effetto negativo o nullo sulla performance?"

#### C. Tracciabilità e Validazione delle Fonti (`/trace` + `/verify`)

Fondamentale per una tesi di laurea: assicurarsi che ogni affermazione sia radicata nelle fonti originali (`raw/`).

7. "Usa `/trace` sull'affermazione: 'Solo il 2,5% dei compiti lavorativi reali è completato con successo in autonomia dai sistemi più avanzati (Remote Labor Index)'. Mostrami il passaggio esatto nel documento sorgente `raw/` e il contesto in cui è stato affermato."
8. "Quali fonti nel database `raw/` supportano l'idea dei '5 nuovi ruoli HR' (architetti del cambiamento, manager aumentati, ecc.)? C'è una fonte primaria o è una sintesi deduttiva dell'agente? Se è deduttiva, `/promote-note` questa sintesi in un nuovo articolo verificabile."

#### D. Generazione di Scenari e Output Pratici (`/mindmap` + `/thesis-chapter`)

Per trasformare la conoscenza in materiale strutturato per la tesi.

9. "Genera una `/mindmap` testuale che mostri l'evoluzione del 'Ciclo di vita del collaboratore' (recruiting, onboarding, performance, retention) prima e dopo l'integrazione di agenti AI autonomi, evidenziando per ogni fase il ruolo umano residuo (HITL)."
10. "Scrivi una bozza di sottocapitolo (usando `/thesis-chapter`) intitolato 'La biforcazione della funzione HR: tra Prompt Engineering e Garanzia Etica'. Integra i concetti di `competenze-e-hr.md` e `governance-controllo-responsabilita.md`, mantenendo un tono accademico e citando le fonti nel formato OKF."
11. "Crea un `/study-guide` o un `/quiz` di 10 domande a risposta multipla basate sui file nella cartella `temi/`, focalizzandomi sulle differenze tra 'automazione di task' e 'sostituzione di professioni', utile per preparare la discussione di tesi."

### 6.3 Come Lanciare i Comandi: Prompt Combinato vs Sequenziale

I comandi con la slash (`/`) sono istruzioni modulari. Non devi digitarli uno dopo l'altro in modo meccanico (es. `/consult`, invio, poi `/backlinks`, invio) — anche se puoi farlo. Il modo più efficace è **combinare l'intento in un'unica prompt ben strutturata**.

#### Metodo 1: il Prompt Combinato (consigliato per efficienza)

Chiedi all'agente di consultare la knowledge base e di includere nella stessa risposta collegamenti e fonti:

```
/consult e /backlinks
Approfondisci la tensione tra la visione di David Graeber sui "bullshit jobs" e l'automazione della "routine igienica" da parte dell'IA.
Quali nuove forme di "lavoro di cura" o "sostanza espressiva" potrebbero emergere specificamente nel settore HR?
Elenca i backlink e i file della wiki (es. dalla cartella temi/ o autori/) che supportano o contraddicono questa tesi.
Usa il comando /trace per indicarmi esattamente in quale file della cartella raw/ si trova il riferimento originale a Graeber.
```

L'agente eseguirà una ricerca semantica nella wiki, sintetizzerà una risposta argomentata, fornirà un elenco puntato dei file `.md` collegati al concetto e citerà la riga o il paragrafo esatto del documento sorgente grezzo.

#### Metodo 2: l'Approccio Sequenziale (consigliato per l'esplorazione profonda)

Usa questo metodo se la prima risposta è molto ricca e vuoi "navigare" nella wiki come un ipertesto.

- **Passo 1 — Consultazione iniziale**:
  ```
  /consult
  Analizza il concetto di "Junior Ladder" nella wiki. Se i task entry-level (come il primo filtraggio CV o la sintesi di base) sono automatizzati, quali meccanismi concreti di "reskilling preventivo" possono essere implementati dalle aziende per formare la prossima generazione di senior HR?
  ```
  (L'agente risponderà con una sintesi basata sui file `competenze-e-hr.md` e `sintesi-previsioni-lavoro-hr.md`.)

- **Passo 2 — Scavo su un concetto emerso**:
  Supponiamo che la risposta menzioni il concetto di "Manager Aumentati" o citi un autore specifico. A quel punto lancia:
  ```
  /backlinks e /related
  Mostrami tutti i collegamenti entranti e uscenti rispetto al concetto di "Manager Aumentati" nella wiki. Quali altri temi (es. governance, etica) sono collegati a questo ruolo?
  ```

#### Metodo 3: Trasformare la risposta in nuova conoscenza (il vero potere di Wiki-Forge)

Se l'agente dà una risposta particolarmente brillante, non limitarti a leggerla: chiedigli di salvarla nella wiki.

```
/adversarial-review
Metti alla prova questa affermazione presente nella wiki: "L'IA non sostituisce figure professionali in blocco, ma ricompone i task".
Fornisci i 3 controargomenti più forti basati su dati recenti, e poi confutali usando le fonti già presenti nel progetto.
```

Azione successiva: se la sintesi è valida, usa `/promote-note` per trasformare questa analisi in un nuovo file markdown nella cartella `temi/` dal titolo `limiti-teoria-ricomposizione-task.md`, assicurandoti di includere il frontmatter OKF v0.2 corretto e i tag appropriati.

### 6.4 Consigli per Interagire con l'Agente

- **Sfrutta il contesto locale**: L'agente conosce già la struttura OKF. Inizia le tue prompt con "Basandoti sui file `competenze-e-hr.md` e `sostituzione-o-trasformazione.md`..." per ancorare la risposta al materiale esistente.
- **Chiedi esplicitamente le fonti**: Aggiungi sempre "Cita i file sorgente nella cartella `raw/` o i link specifici alle sezioni" per evitare allucinazioni e costruire una bibliografia solida.
- **Itera con la wiki**: Se l'agente fornisce una risposta brillante, chiedigli: "Promuovi questa risposta a una nuova nota nella cartella `temi/` con titolo `Nuove-dinamiche-junior-ladder.md`, applicando il frontmatter OKF v0.2". Questo è il vero potere di Wiki-Forge: la conoscenza si auto-costruisce.
- **Usa `/verify`**: Per le affermazioni critiche (es. dati sul mercato del lavoro), chiedi all'agente di segnare la voce come "in attesa di verifica umana" (`/verify`) così puoi controllarla tu stesso prima della compilazione finale del PDF.

#### 💡 Suggerimento Pro: forzare un aggiornamento incrociato dei file

Quando noti che l'agente ha fatto un'ottima connessione tra due file (es. tra `geopolitica-ia-poli-us-eu-cn.md` e `competenze-e-hr.md`), puoi **forzare l'aggiornamento della wiki** con una richiesta diretta (non è un comando dedicato da catalogo):

```
Ho notato una forte connessione tra il tema della sovranità dei dati (UE vs USA) e le nuove competenze richieste agli specialisti HR.
Aggiorna il file competenze-e-hr.md per includere un paragrafo su questo aspetto e aggiungi il collegamento incrociato nella sezione ## Related di entrambi i file.
```

In questo modo non stai solo facendo domande all'agente, ma lo stai usando attivamente per scrivere e strutturare la tesi in tempo reale. Dopo l'aggiornamento manuale dei link incrociati, esegui `/audit` (per rilevare eventuali link rotti) e `/reindex` (per rigenerare gli indici).

---

## 7. Guida alla Risoluzione Problemi (Troubleshooting)

### "L'agente non trova i file grezzi in raw/"
- Verifica che `config.toml` contenga `raw = "raw"`.
- Assicurati di aver eseguito `bash run_convert.sh` o `python scripts/conv2md.py` dopo aver aggiunto i file in `sources/`.

### "I wikilink risultano interrotti dopo aver rinominato un articolo"
- Esegui il comando `/audit` per rilevare i link rotti.
- Esegui il comando `/reindex` per aggiornare tutti gli indici della wiki.

### "Due articoli trattano lo stesso argomento"
- Esegui `/merge articolo-1 articolo-2` per unire i contenuti mantenendo la tracciabilità delle fonti.
