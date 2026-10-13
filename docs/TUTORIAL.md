# TUTORIAL — Guida Operativa all'Uso di Wiki-Forge

> **Guida semplice per utenti ed operatori non tecnici.**
> Spiega passo dopo passo come costruire, consultare ed evolvere la propria base di conoscenza dinamica ("LLM Wiki") e come esportarla in formato PDF pronto per la stampa o la consegna, senza bisogno di usare il terminale.

---

## 1. Cos'è Wiki-Forge e Quale Problema Risolve

Quando affronti un progetto complesso — come una **Tesi Magistrale**, una ricerca di mercato o un manuale operativo — accumuli decine di PDF, articoli e appunti. Con i metodi tradizionali incontri due limiti principali:

1. **Memoria frammentata**: Dopo qualche mese ricordi di aver letto un concetto fondamentale, ma non ricordi più in quale dei tuoi 50 PDF si trovi.
2. **Chatbot tradizionali inefficienti**: Incollare centinaia di documenti ad ogni domanda è lento, costoso e costringe l'IA a ripartire da zero ogni volta.

Wiki-Forge risolve questo problema mettendo a disposizione un'interfaccia grafica intuitiva (Web UI) e separando chiaramente i ruoli utente in due modalità operative:
- **Operatore Semplice (Focus Mode 🌱)**: Utente non tecnico che deve caricare documenti, compilarli ed interrogare l'agente per alimentare la Wiki.
- **Ingegnere della Conoscenza / Knowledge Engineer (Developer Mode 👑 / KE Workbench 🧠)**: Profilo tecnico/specialista di dominio che gestisce la modellazione concettuale, le regole ontologiche, la validazione delle Competency Questions, gli Ontology Design Patterns (ODP), l'inferenza neuro-simbolica e l'esportazione semantica RDF/W3C.

> **L'Analogia del Bibliotecario e dell'Ingegnere:** L'operatore semplice consegna i libri al bibliotecario (pulsanti **📥 1. Carica** e **⚡ 2. Compila**) e consulta gli scaffali. L'Ingegnere della Conoscenza progetta la tassonomia della biblioteca, definisce le regole di classificazione ontologica e ne garantisce la coerenza formale.

---

## 2. 🌟 Guida Rapida per l'Operatore Semplice (Modalità Focus 🌱)

In **Modalità Semplice**, utilizzare Wiki-Forge richiede solo 3 semplici passaggi dall'interfaccia grafica, senza bisogno di comandi da terminale.

I tre pulsanti principali sono **nella barra in alto, al centro** (Modalità Semplice), sempre visibili:

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ ⚒️ Wiki-Forge   🌱 Focus Mode   [Project: …]                     │
  │              📥 1. Carica   ⚡ 2. Compila   💬 3. Chiedi          │
  │                              Documenti  Converti&Link  Alla Wiki  │
  └──────────────────────────────────────────────────────────────────┘
```

| # | Pulsante | Cosa fa nell'Interfaccia Grafica UI |
|---|----------|-------------------------------------|
| 1 | **📥 1. Carica** | Apre la finestra di caricamento: trascina i file PDF, EPUB, DOCX, TXT o appunti. |
| 2 | **⚡ 2. Compila** | Converte i documenti, estrae i concetti chiave e crea i collegamenti `[[wikilink]]` tra le note. Mostra una barra di avanzamento in tempo reale. |
| 3 | **💬 3. Chiedi** | Apre il pannello di chat con l'assistente per interrogare la wiki (sintesi, mappe concettuali, citazioni, stesura capitoli). |

1. **Carica**: Clicca **📥 1. Carica** e trascina i tuoi documenti PDF, DOCX, EPUB o TXT nella finestra di caricamento.
2. **Elabora**: Clicca **⚡ 2. Compila**. Il sistema converte automaticamente i file, estrae i concetti principali e crea i collegamenti tra le note.
3. **Esplora**: Clicca **💬 3. Chiedi** e fai le tue domande alla chat, oppure esplora il grafo interattivo della conoscenza.

> I pulsanti 1–3 sono visibili solo in **Focus Mode** (Modalità Semplice). In **Developer Mode** spariscono e accedi agli strumenti avanzati. Il toggle **Dev Mode** è in alto a destra; scorciatoia da tastiera: `Ctrl+Shift+D`.

### 🖥️ Viste dell'area di lavoro nell'Interfaccia Grafica

I tre pulsanti in alto a destra (**📝 Editor**, **🕸️ Graph**, **◧ Split**) scelgono come disporre l'area di lavoro:

- **📝 Editor** — solo editor di testo a tutto schermo.
- **🕸️ Graph** — solo grafo della conoscenza interattivo (i controlli del grafo compaiono in alto).
- **◧ Split** — editor e grafo affiancati, separati da un trascinatore. È la vista predefinita.

La scelta viene ricordata automaticamente. Passando alla sola vista **Graph**, il pannello **Node Metadata** sotto l'editor resta visibile; cliccando una nota dalla barra laterale si torna automaticamente a **Split** per leggerne il testo.

---

### 🎯 Scenari di Utilizzo Pratici

#### Scenario A: Lo Studente Universitario (Tesi di Laurea)
- **Obiettivo**: Gestire 50+ paper accademici e produrre una tesi di laurea formattata.
- **Flusso nell'Interfaccia UI**:
  1. Carica i PDF dei paper cliccando **📥 1. Carica**.
  2. Clicca sul pulsante **⚡ 2. Compila**.
  3. Fai domande alla chat cliccando **💬 3. Chiedi**: *"Crea una mappa concettuale che colleghi le teorie di Graeber e Cristianini presenti nei paper"*.
  4. Per generare la tesi finale, scrivi il comando `/thesis-chapter` nella chat per unire le note e poi usa il pulsante **Esporta PDF Tesi** nel menu **🛠️ Strumenti** per scaricare il PDF pronto per la stampa.

#### Scenario B: Il Professionista HR (Gestione Riunioni e Progetti)
- **Obiettivo**: Non perdere le decisioni prese durante le riunioni ed organizzare le competenze aziendali.
- **Flusso nell'Interfaccia UI**:
  1. Incolla il trascritto di una riunione nella chat con il comando `/note Riunione 28/09: decidiamo di adottare il nuovo framework competenze`.
  2. A fine settimana, usa il pulsante **📌 Salva nella Wiki** o il comando `/promote-note` per trasformare gli appunti in una pagina wiki strutturata.
  3. Cerca istantaneamente le decisioni passate chiedendo alla chat: *"Quali scadenze e ruoli abbiamo fissato per la formazione HR?"*.

#### Scenario C: L'Appassionato (Ricette, Manuali, Hobby)
- **Obiettivo**: Creare un archivio personale di conoscenze consultabile in mobilità.
- **Flusso nell'Interfaccia UI**:
  1. Usa l'estensione **Web Clipper** o la finestra **📥 1. Carica** per salvare articoli dal web.
  2. Il sistema converte la pagina in testo pulito, suggerisce automaticamente i tag e la salva nella wiki.
  3. Chiedi alla chat: *"Mostrami tutti gli articoli salvati il mese scorso"*.

---

## 3. 🧠 Workflow e Use Case per l'Ingegnere della Conoscenza (KE Workbench 🧠)

Per la figura professionale del **Knowledge Engineer** o per chi desidera gestire la governance semantica, `wiki-forge` offre la modalità **Developer Mode (👑)** e il pannello guidato **KE Workbench (🧠)** (accessibile dal menu strumenti in alto), con 6 Use Case standardizzati:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ KNOWLEDGE ENGINEER WORKFLOW & GUIDED USE CASES IN WEB UI                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ UC1: Schema & Taxonomy Modeling    ──► /schema-infer, /schema-lint, /retag   │
│ UC2: Ontological Integrity         ──► /ontology-check, /lint-frontmatter    │
│ UC3: Competency Questions (CQ)     ──► /validate-cq, /stats                  │
│ UC4: Neuro-Symbolic & ODP          ──► /suggest-odp, /neuro-check            │
│ UC5: Enterprise Semantic Export    ──► /export-semantic (RDF/TTL), /reindex  │
│ UC6: Platform Maturity Evaluation  ──► /maturity, /ke-maturity               │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. **Use Case 1: Schema & Taxonomy Modeling (`ke_schema_modeling`)**:
   Inferenzia ed estrae i predicati dal vault tramite il pulsante nel KE Workbench o comando `/schema-infer`, ne valida i vincoli sintattici (`/schema-lint`) e normalizza i tag della tassonomia tramite la finestra **🏷️ Tag Manager**.
2. **Use Case 2: Ontological Integrity & Validation (`ke_ontological_validation`)**:
   Rileva dipendenze circolari dirette (`/ontology-check`), verifica la revisione umana per le note `stable` ed esegue la validazione dei metadati OKF v0.2 (`/lint-frontmatter`).
3. **Use Case 3: Competency Questions (CQ) & Coverage (`ke_cq_assessment`)**:
   Valuta la copertura delle domande di competenza definite nella wiki tramite il pulsante o comando `/validate-cq` ed aggiorna il report generale delle metriche con `/stats`.
4. **Use Case 4: Neuro-Symbolic Reasoning & ODP (`ke_neuro_symbolic`)**:
   Raccomanda Ontology Design Patterns formali con il comando `/suggest-odp` ed applica l'inferenza neuro-simbolica per rilevare contraddizioni o suggerire collegamenti mancanti con `/neuro-check`.
5. **Use Case 5: Enterprise Semantic Graph & RDF Export (`ke_semantic_export`)**:
   Mappa il vault Zettelkasten in triple RDF W3C esportando i file in `output/` tramite il pulsante "Esporta Semantica RDF" o comando `/export-semantic` e rigenerando la mappa MOC con `/reindex`.
6. **Use Case 6: KE Platform Maturity Evaluation (`ke_maturity_eval`)**:
   Calcola l'Indice di Maturità delle note con `/maturity` e valuta il livello L1-L4 di maturità dell'intera piattaforma su 6 dimensioni tramite il pulsante o comando `/ke-maturity`.

---

## 4. 🚀 Workflow Avanzato in 5 Fasi Cronologiche nell'Interfaccia Grafica

Per chi desidera il controllo totale sui processi di caricamento, metadati OKF v0.2 e compilazione, Wiki-Forge offre un flusso integrato nell'interfaccia UI in **5 Fasi Cronologiche**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 1: Configurazione & Inizializzazione (UI Config)       │
 │ Setup progetto, modal ⚙️ Config, Wizard Scenari (es. /wizard)│
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 2: Ingestione & Conversione Fonti (UI Ingest)          │
 │ Caricamento PDF/EPUB via 📥 1. Carica, Web Clipper,         │
 │ Importazione da NotebookLM via pannello 🛠️ Strumenti        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 3: Costruzione Incrementale & Consultazione KB        │
 │ Pulsante ⚡ 2. Compila, /ingest, CodeMirror 6, Graph View,   │
 │ /consult, /recompile, OKF v0.2, versioning e /rollback      │
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
 │ /thesis-chapter, Pannello 🛠️ Strumenti -> "Esporta PDF Tesi" │
 └──────────────────────────────┘
```

---

### FASE 1: Configurazione & Inizializzazione Vault nell'Interfaccia Grafica

All'avvio di un nuovo progetto, la prima operazione consiste nel configurare le informazioni generali nell'interfaccia visiva.

1. **Configurazione visiva (Finestra ⚙️ Config)**:
   Clicca sul pulsante **⚙️ Config** nella barra in alto per impostare nome del progetto, titolo della tesi, lingua e percorsi:
   - **Project Name**: `tesi-magistrale`
   - **Title**: `Tesi Magistrale - AI e Trasformazione del Lavoro`
   - **Language**: `it`

2. **Wizard di Scenario (`wizard` / `/wizard`)**:
   Attiva il wizard guidato per impostare la struttura ideale. Per una Tesi Magistrale, puoi selezionare la voce "Academic Thesis" nel menu di configurazione oppure scrivere `/wizard academic` direttamente nella chat **💬 3. Chiedi**.

3. **Gestione Multi-Progetto (Project Switcher)**:
   Se lavori a più progetti contemporaneamente, passa da un progetto all'altro in un secondo selezionando il nome dal menu a discesa **Project Switcher** visibile nell'intestazione dell'applicazione.

---

### FASE 2: Ingestione & Conversione Fonti nell'Interfaccia Grafica

I tuoi documenti sorgente originali non vengono mai modificati o cancellati. La Fase 2 li converte in testo pulito ed elaborabile.

1. **Aggiunta file sorgente**:
   Clicca sul pulsante **📥 1. Carica** e trascina i tuoi file PDF, EPUB, DOCX o TXT nella finestra di caricamento.
2. **Conversione ed elaborazione automatica (`convert-only` / `/convert-only`)**:
   Clicca sul pulsante **⚡ 2. Compila** oppure invia il comando `/convert-only` nella chat. Il sistema converte i file in testo visibile nel Vault Explorer.

3. **Cattura da Web con Web Clipper**:
   Per salvare articoli da siti web, attiva l'estensione browser **Web Clipper** o usa la funzione "Salva da URL" nel menu caricamento per trasformare la pagina web in una nota pulita.

4. **Importazione da Google NotebookLM (`notebooklm_import.py` via UI)**:
   Se usi Google NotebookLM per studiare i testi, copia i riassunti prodotti e seleziona "Importa NotebookLM" dal menu **🛠️ Strumenti** oppure incollali direttamente nella chat con il comando `/ingest`. I testi verranno arricchiti con i metadati OKF v0.2.

---

### FASE 3: Costruzione Incrementale & Consultazione della KB Dinamica

Questa è la fase centrale in cui la conoscenza prende vita nell'interfaccia UI. L'agente legge i file convertiti, crea note atomiche interconnesse conformi allo standard **OKF v0.2** ed evidenzia i collegamenti nel grafo.

1. **Compilazione iniziale (`compile` / `/compile` e `ingest` / `/ingest`)**:
   Clicca sul pulsante **⚡ 2. Compila** (o invia `/compile` nella chat) per elaborare l'intero archivio. Per elaborare una singola scheda specifica invia `/ingest nome-file.md`. Se desideri riesaminare un documento invia `/recompile nome-file.md`.

2. **Esplorazione e Modifica nell'Interfaccia Grafica**:
   - **Vault Explorer (Barra Laterale)**: Naviga tra le cartelle della tesi, crea nuove cartelle (`📁+`) o nuove pagine (`📄+`), rinomina (`✏️`), sposta o elimina (`🗑️`).
   - **Editor CodeMirror 6**: Formatta il testo in Markdown, usa l'autocompletamento automatico dei `[[wikilink]]` digitando `[[`, e salva cliccando il pulsante **💾 Salva** o con la scorciatoia `Ctrl+S`.
   - **Graph View**: Visualizza la mappa interattiva dei concetti e clicca su un nodo per aprire e leggere la nota corrispondente.

3. **Interrogazione Dinamica & Tracciabilità (`consult`, `search`, `backlinks`, `related`, `trace`)**:
   Fai le tue domande nella chat **💬 3. Chiedi**:
   - `/consult "In che modo Amodei e Graeber analizzano l'evoluzione del lavoro?"`: L'agente risponde citando le fonti con `[[wikilink]]`.
   - `/search "intelligenza artificiale"`: Cerca concetti chiave nell'archivio.
   - `/backlinks concetti/lavoro`: Mostra le note che collegano l'articolo selezionato.
   - `/related concetti/lavoro`: Identifica gli articoli correlati.
   - `/trace "claim di ricerca"`: Verifica e traccia le affermazioni fino alle righe esatte del sorgente originale (`#L10-L25`).

4. **Creazione Articoli & Gestione Versioni (`new-article`, `rollback`)**:
   Crea un nuovo articolo da modello con `/new-article <nome>`. Ogni modifica sostanziale viene salvata nello storico delle versioni. Se desideri ripristinare uno stato precedente, seleziona la versione nel pannello **Cronologia Versioni** oppure invia:
   ```text
   /rollback note=nome-nota to=v1
   ```

---

### FASE 4: Sintesi, Studio & Calcolo Maturità nell'Interfaccia UI

Mentre la wiki cresce, puoi utilizzare la Suite di Studio e Sintesi accessibile sia dalla chat **💬 3. Chiedi** sia dal menu **🛠️ Strumenti**:

1. **Strumenti di Sintesi e Didattica (`study-guide`, `quiz`, `mindmap`, `audio-overview`, `deep-research`)**:
   - `/study-guide <argomento>`: Genera una guida di studio strutturata.
   - `/quiz <argomento> [n]`: Genera un quiz di autovalutazione a scelte multiple.
   - `/mindmap <articolo>`: Estrae la mappa concettuale ad albero e la mostra visivamente.
   - `/audio-overview <argomento>`: Crea uno script di dialogo a due voci (Host A / Host B) per un podcast audio.
   - `/deep-research <domanda>`: Esegue una ricerca approfondita multi-fonte con matrice di attribuzione delle affermazioni.

2. **Appunti Veloci & Suggerimento Tag (`note`, `promote-note`, `tag-suggest`)**:
   - `/note "idea per il Capitolo 2 sulla dequalificazione del lavoro"`: Salva un appunto rapido.
   - `/promote-note <id> <categoria>` o pulsante **📌 Salva nella Wiki**: Trasforma gli appunti della chat in un articolo ufficiale.
   - `/tag-suggest nome-nota.md` o finestra **🏷️ Tag Manager**: Suggerisce e organizza i tag.

3. **Calcolo dell'Indice di Maturità (`maturity` / `/maturity`)**:
   Valuta lo stato di avanzamento delle note (punteggio da 0 a 100 basato su fonti, link e completezza) inviando il comando `/maturity` nella chat o cliccando su "Calcola Maturità" nel menu strumenti.

---

### FASE 5: Proiezione Statica & Compilazione PDF Stampabile nell'Interfaccia UI

Quando la conoscenza accumulata nella wiki ha raggiunto un livello di maturità elevato, è il momento di estrarre e compilare il documento finale per la stampa o la consegna.

1. **Aggregazione Capitoli Tesi (`thesis-chapter` / `/thesis-chapter`)**:
   Aggrega tutte le sintesi e i capitoli maturi in un unico documento unificato inviando nella chat il comando:
   ```text
   /thesis-chapter
   ```

2. **Esportazione PDF dall'Interfaccia Grafica (`export_thesis_pdf.py` / `make thesis-pdf` via UI)**:
   Per generare il PDF finale formattato per la tesi di laurea, apri il menu **🛠️ Strumenti** nella barra in alto e clicca sul pulsante **Esporta PDF Tesi**. Il sistema elaborerà il documento e renderà disponibile il file `thesis_final.pdf` pronto per il download e la stampa.

3. **Utility di Manutenzione & Esportazione Struttura (`export`, `diff`, `template`, `sources`, `help`)**:
   - `/export` (o `export json`): Esporta la struttura della wiki.
   - `/diff <articolo>`: Mostra le differenze tra le versioni di un articolo.
   - `/template show`: Visualizza il modello standard delle note.
   - `/sources` (o `sources regenerate`): Rigenera il registro bibliografico.
   - `/help`: Apre la guida rapida di riferimento nell'interfaccia.

---

## 5. Comandi di Manutenzione Periodica della Wiki nella Chat UI

Per mantenere la wiki pulita, priva di link rotti e conforme allo standard OKF v0.2, puoi richiamare questi comandi direttamente dalla chat dell'interfaccia grafica:

| Comando Chat | Scopo / Azione nell'Interfaccia Grafica UI |
|--------------|--------------------------------------------|
| `adversarial-review` / `/adversarial-review` | Stress-test e revisione avversaria della tesi per identificare contraddizioni e citazioni mancanti |
| `digest` / `/digest` | Riassunto in linguaggio naturale delle ultime modifiche e della salute della wiki |
| `verify` / `/verify` (alias `human-review` / `/human-review`) | Registra la revisione umana di una nota, promovendola al livello di massima fiducia `human-reviewed` 🟢 |
| `slides` / `/slides` (`/generate-slides`) | Generazione di una presentazione a diapositive (reveal.js) dai capitoli della tesi |
| `audit` / `/audit` | Controllo generale dell'archivio (link rotti, note isolate, sovrapposizioni) |
| `reindex` / `/reindex` | Rigenerazione automatica degli indici generali e tematici |
| `prune` / `/prune` | Pulizia automatica delle note vuote o bozze abbandonate |
| `schema-lint` / `/schema-lint` | Validazione delle note rispetto allo schema definito |
| `schema-infer` / `/schema-infer` | Proposta automatica di una configurazione di schema dalla wiki |
| `lint-frontmatter` / `/lint-frontmatter` | Validazione della sintassi delle intestazioni YAML OKF v0.2 |
| `validate-cq` / `/validate-cq` | Validazione della copertura rispetto alle Competency Questions |
| `suggest-odp` / `/suggest-odp` | Suggerimento di schemi di progettazione ontologica (Ontology Design Patterns) |
| `neuro-check` / `/neuro-check` | Controllo di coerenza logica e inferenza di collegamenti concettuali |
| `ke-maturity` / `/ke-maturity` | Valutazione della maturità del sistema su 6 dimensioni operative |
| `ontology-check` / `/ontology-check` | Validazione logica delle regole ontologiche (concetti isolati, cicli) |
| `stats` / `/stats` | Calcolo delle metriche di crescita della wiki |
| `merge <a> <b>` / `/merge` | Unione nell'interfaccia di due articoli che trattano lo stesso argomento |
| `split <art> <sezione>` / `/split` | Divisione di un articolo lungo in due schede distinte |
| `stub <concetto>` / `/stub` | Creazione di una nota segnaposto per approfondimenti futuri |
| `retag <art> [+tag]` / `/retag` | Aggiornamento o aggiunta di tag a una scheda |
| `export-semantic` / `/export-semantic` | Esportazione dei dati nei formati standard W3C (JSON-LD e Turtle) via UI |

---

## 6. 🎓 Tutorial per la Tesi Magistrale (esempio applicato: `projects/tesi`)

Questa sezione mostra come usare Wiki-Forge dall'inizio alla fine per una **Tesi Magistrale**, applicandolo concretamente alla knowledge base di esempio `projects/tesi/wiki`. Le domande proposte possono essere incollate direttamente nella chat dell'interfaccia grafica.

### 6.1 Analisi Approfondita del Repository e della Wiki

#### Filosofia e Architettura del Progetto

Wiki-Forge è un modello di supporto al lavoro intellettuale che si basa sul pattern **"LLM Wiki"** (ispirato ad Andrej Karpathy) e sul formato **Open Knowledge Format (OKF v0.2)**.

A differenza del classico RAG (che risponde "al volo" pescando da documenti grezzi), l'assistente nell'interfaccia UI agisce come un **Knowledge Engineer attivo**: compila, valuta, collega e mantiene in modo incrementale una wiki persistente, che viene poi trasformata in capitoli di tesi pronti per la stampa (PDF).

#### Mappatura della directory `projects/tesi/wiki` nell'Interfaccia

Nello pannello **Vault Explorer** dell'interfaccia grafica trovi le cartelle tematiche della tesi:

- `temi/`: I concetti fondanti (es. `competenze-e-hr.md`, `sostituzione-o-trasformazione.md`, `capacita-emergenti-llm.md`, `governance-controllo-responsabilita.md`).
- `analisi/`: Approfondimenti contestuali e dati (es. `evidenza-mercato-del-lavoro.md`, `geopolitica-ia-poli-us-eu-cn.md`).
- `Q&A/`: Sintesi argomentative pronte all'uso (es. `sintesi-previsioni-lavoro-hr.md`).
- `autori/`: Schede sui pensatori chiave (es. Andrew Ng, Geoffrey Hinton, David Graeber, Nello Cristianini, Andrej Karpathy).
- `capitoli/`: Le bozze dei capitoli veri e propri della tesi (`00` fino a `07`).

---

### 6.2 Domande di Esempio da Incollare nella Chat

Copia e incolla queste richieste nella chat dell'interfaccia grafica (**💬 3. Chiedi**):

#### A. Esplorazione Concettuale e Collegamenti (`/consult` + `/backlinks`)
1. `/consult Analizza le relazioni tra il concetto di 'lavori di merda' (bullshit jobs) di David Graeber e l'automazione della 'routine igienica' da parte dell'IA. Quali nuove forme di lavoro HR potrebbero emergere?`
2. `/backlinks competenze-e-hr Mostrami tutti i collegamenti entranti verso la scheda competenze e Risorse Umane.`

#### B. Approfondimento Critico e Stress-Test (`/adversarial-review` + `/deep-research`)
3. `/adversarial-review Esegui una revisione avversaria dell'affermazione: 'L'IA non sostituisce le professioni ma ricompone i task'. Evidenzia i punti deboli.`
4. `/deep-research Quali attività HR risultano maggiormente trasformate secondo le fonti presenti nel grafo?`

#### C. Tracciabilità e Validazione Fonti (`/trace` + `/verify`)
5. `/trace "Solo il 2,5% dei compiti lavorativi reali è completato con successo in autonomia"`
6. `/verify capitoli/01-introduzione Segna il Capitolo 1 come revisionato dall'autore.`

---

## 7. Guida alla Risoluzione dei Problemi nell'Interfaccia Grafica

### "Non vedo i nuovi file caricati nell'Explorer"
- Assicurati di aver cliccato il pulsante **⚡ 2. Compila** dopo aver caricato i documenti con **📥 1. Carica**.

### "I wikilink risultano interrotti dopo aver spostato una nota"
- Invia il comando `/audit` nella chat per rilevare eventuali link rotti e poi `/reindex` per aggiornare gli indici.

### "Voglio scaricare la tesi completa in PDF ma non voglio usare il terminale"
- Apri il menu **🛠️ Strumenti** nella barra in alto e clicca sul pulsante **Esporta PDF Tesi**. Troverai il file pronto nella cartella `output/`.
