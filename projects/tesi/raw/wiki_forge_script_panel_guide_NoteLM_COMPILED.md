# Guida Completa agli Script del Wiki-Forge Script Control Panel

## 1. Introduzione ed Architettura del Pannello di Controllo

**`wiki-forge`** è un motore di Knowledge Base dinamica basato sull'approccio **LLM Wiki** e sullo standard **Open Knowledge Format (OKF v0.2)** [31, 37]. Il sistema combina la presa appunti in stile **Zettelkasten** [3, 33] con i principi rigidi dell'**Ingegneria della Conoscenza (Knowledge Engineering - KE)** e della metodologia **CommonKADS** [4, 41].

L'interfaccia utente di `wiki-forge` (sviluppata in Vite + TypeScript) include il **Wiki-Forge Script Control Panel (Pannello Strumenti 🛠 Tools)** [39]. Questo pannello permette agli utenti e agli Ingegneri della Conoscenza di eseguire direttamente da browser oltre **15 script Python** fondamentali per la manutenzione, la conversione, la validazione semantica e la compilazione tipografica della Knowledge Base [38, 39].

Il backend esegue gli script tramite un’architettura basata su **Server-Sent Events (SSE)**, consentendo lo streaming in tempo reale dei log di esecuzione, la validazione dei form dinamici e la gestione delle eccezioni senza richiedere comandi da terminale [39].

---

## 2. Ingestione e Conversione delle Fonti (Source Ingestion & Clipping)

Gli script di questa categoria costituiscono la **Fase 2 del flusso operativo** [35, 36]. Il loro scopo è trasformare documenti eterogenei non strutturati (PDF, EPUB, DOCX, pagine web) in file Markdown puliti e pronti per l'elaborazione da parte dell'Agente LLM [35, 37].

```
sources/ (PDF, EPUB, DOCX) ──► conv2md.py / run_convert.sh ──► raw/ (Inbox dell'Agente)
Web / URL                  ──► clip2md.py                  ──► sources/web-clips/
Export NotebookLM          ──► notebooklm_import.py        ──► wiki/ (Note OKF v0.2)
```

### `scripts/conv2md.py` (richiamato da `run_convert.sh` / `/convert-only`)
* **Cosa fa:** Estrae il testo da documenti non strutturati (PDF scientifici, EPUB, file Word DOCX) posizionati nella cartella `sources/` e li converte in file Markdown salvati nella cartella `raw/` (l'inbox dell'Agente) [35, 37].
* **Come funziona:**
  1. Utilizza librerie di estrazione testo (Pandoc, PyPDF, pdfplumber) per analizzare la struttura del documento.
  2. Rimuove elementi di disturbo (intestazioni di pagina, numeri di pagina ripetuti, note a piè di pagina orfane).
  3. Formatta i titoli (`# H1`, `## H2`) e genera un primo blocco di frontmatter YAML contenente il nome della fonte, l'hash del file e la data di conversione [37].

### `scripts/clip2md.py`
* **Cosa fa:** Agisce come un **Web Clipper** automatico per salvare articoli web, documentazione e pagine di ricerca direttamente nella Knowledge Base sotto `sources/web-clips/` [35, 37].
* **Come funziona:**
  1. Effettua il fetching dell'URL fornito dall'utente tramite HTTP request.
  2. Analizza l'HTML ed estrae il corpo principale dell'articolo (pulendo pubblicità, menu di navigazione e script).
  3. Converte l'HTML in Markdown e inietta i metadati di provenienza (`canonical_url`, `clipped_at`, `author`) per garantire la tracciabilità delle fonti [34, 37].

### `scripts/notebooklm_import.py`
* **Cosa fa:** Importa note, riassunti ed export provenienti da **Google NotebookLM** integrandoli nella struttura di `wiki-forge` [35, 37].
* **Come funziona:**
  1. Effettua il parsing dei file esportati da NotebookLM.
  2. Estrae le citazioni e i riferimenti puntuali alle fonti sorgente.
  3. Riformatta il contenuto conformandolo allo schema OKF v0.2 e generando i wikilink `[[...]]` verso i concetti già presenti nel vault [31, 37].

---

## 3. Gestione del Vault, Maturità e Ciclo di Vita delle Note

Gli script di questa categoria gestiscono il ciclo di vita delle note permanenti (Zettelkasten), monitorando il loro stato di maturazione e la gestione delle versioni [3, 35, 37].

### `scripts/maturity_calculator.py` (`/maturity`)
* **Cosa fa:** Calcola l'**Indice di Maturità (Maturity Index da 0 a 100)** di ogni nota della wiki, determinando quando una nota è pronta per essere promossa o inclusa nella tesi/report finale [35, 37].
* **Come funziona:**
  1. Scansiona le note presenti in `wiki/`.
  2. Valuta un punteggio ponderato basato su 5 criteri:
     * **Frontmatter OKF (20%):** Validità e completezza dei metadati YAML.
     * **Densità di Collegamento (20%):** Presenza di `[[wikilink]]` verso altre note.
     * **Ancoraggio alle Fonti (20%):** Citazioni esplicite verso la cartella `sources/`.
     * **Maturità del Testo (20%):** Lunghezza, articolazione dei paragrafi e assenza di TODO.
     * **Revisione Umana (20%):** Presenza di approvazione esplicita o flag `status: stable`.
  3. Aggiorna il campo `maturity_score` nel frontmatter della nota [37].

### `scripts/suggest_tags.py` (`/tag-suggest`)
* **Cosa fa:** Suggerisce tag rilevanti per una nota attingendo da un vocabolario controllato per evitare duplicazioni o sinonimi non coordinati [35, 37].
* **Come funziona:**
  1. Analizza il testo della nota estraendo i termini chiave.
  2. Mappa i termini chiave rispetto ai tag già esistenti nella Knowledge Base e nell'ontologia di dominio.
  3. Restituisce una lista di tag consigliati e aggiunge automaticamente i tag mancanti nel frontmatter [37].

### `scripts/versioning.py` (`/rollback`)
* **Cosa fa:** Gestisce il motore di snapshot temporali e permette di effettuare il **rollback** ad uno stato precedente della wiki [35, 37].
* **Come funziona:**
  1. Mantiene uno storico delle versioni delle note quando l'Agente LLM o l'utente apportano modifiche sostanziali.
  2. In caso di allucinazioni o errori di ristrutturazione, ripristina la versione precedente della nota salvaguardando l'integrità del vault [35].

### `scripts/wizard.py` (`/wizard`)
* **Cosa fa:** CLI e procedura guidata per la configurazione iniziale degli **Scenari Operativi** della wiki [35, 37].
* **Come funziona:**
  1. Presenta un menu interattivo per selezionare lo scenario (es. *Academic Thesis*, *Business KB*, *Personal Study*).
  2. Aggiorna `config.toml` e `config/scenarios.toml` impostando le regole di prompting, i livelli di fiducia dei dati (*trust tiers*) e i template di capitolo corretti [35, 37].

---

## 4. Standard OKF v0.2 e Manutenzione della Knowledge Base

L'**Open Knowledge Format (OKF v0.2)** è lo standard adottato da `wiki-forge` per garantire che la conoscenza gestita dall'LLM sia interamente strutturata, verificabile e portabile [31, 37, 38].

### `scripts/okf_lint.py` (`/lint-frontmatter`)
* **Cosa fa:** Linter e validatore di conformità sintattica per lo schema OKF v0.2 [36, 37].
* **Come funziona:**
  1. Legge il frontmatter YAML di ogni nota.
  2. Controlla la presenza dei campi obbligatori (`id`, `title`, `type`, `status`, `trust_tier`, `sources`).
  3. Verifica che i valori appartengano alle enumerazioni consentite (es. `type: [permanent, fleeting, structure]`, `trust_tier: [L1, L2, L3, L4]`) e segnala le note non conformi [36, 37].

### `scripts/migrate_to_okf.py`
* **Cosa fa:** Automatizza la migrazione di note esistenti o file Markdown generici verso lo standard OKF v0.2 [37].
* **Come funziona:**
  1. Identifica le intestazioni esistenti e i metadati parziali.
  2. Inietta la struttura YAML standard OKF v0.2 generando ID univoci e trasformando i link tradizionali in `[[wikilink]]` [37].

### `scripts/okf_reindex.py` (`/reindex`)
* **Cosa fa:** Rigenera gli indici tematici, le mappe di navigazione e le pagine MOC (Map of Content) della wiki (OKF §8) [36, 37].
* **Come funziona:**
  1. Scansiona l'intero vault in `wiki/`.
  2. Raccoglie la gerarchia dei concetti, i tag e le relazioni reciproche tra le note.
  3. Aggiorna e sovrascrive i file di indice principale garantendo che non vi siano note isolate o non raggiungibili [36].

### `scripts/okf_log.py`
* **Cosa fa:** Mantiene il registro cronologico immutabile delle modifiche apportate alla KB (OKF §9) [37].
* **Come funziona:** Traccia ogni operazione (creazione, aggiornamento, promozione, unione di note) scrivendo un log auditabile utile per la tracciabilità delle azioni dell'Agente AI [37].

### `scripts/okf_stats.py` / `scripts/wiki_stats.py` (`/stats`)
* **Cosa fa:** Calcola le metriche quantitative e lo stato di salute della wiki, generando o aggiornando il report `METRICS.md` [36, 37].
* **Come funziona:**
  1. Calcola il numero totale di note, la percentuale di note mature, la densità media di collegamenti per nota, e la distribuzione dei *trust tiers*.
  2. Genera un report dettagliato in Markdown con grafici ASCII e indicatori di progresso [37].

---

## 5. Ingegneria della Conoscenza, Ontologie e Validazione Semantica

Questa suite comprende gli strumenti per il **Knowledge Engineer** dedicati alla validazione logica formale e all'interoperabilità con i grafi di conoscenza [38].

### `scripts/cq_validator.py` (`/validate-cq`)
* **Cosa fa:** Esegue la validazione delle **Competency Questions (CQ)** per verificare che la Knowledge Base sia in grado di rispondere alle domande fondamentali del dominio [38].
* **Come funziona:**
  1. Mappa le domande di competenza definite nel file di configurazione a test unitari SPARQL o Cypher.
  2. Esegue i test sul grafo della conoscenza estratto dalle note.
  3. Identifica eventuali "buchi di conoscenza" (*knowledge gaps*) e genera un report di copertura [38].

### `scripts/odp_suggester.py` (`/suggest-odp`)
* **Cosa fa:** Raccomanda **Ontology Design Patterns (ODPs)** formali (es. *AgentRole*, *Temporal Properties*, *Situations*) per modellare relazioni complesse [38].
* **Come funziona:** Analizza i pattern di relazioni emergenti tra le note e suggerisce l'adozione di pattern ontologici standardizzati per evitare modellazioni monolitiche o fragili [38].

### `scripts/neuro_symbolic_check.py` (`/neuro-check`)
* **Cosa fa:** Funziona come un **Ponte Neuro-Simbolico** per rilevare contraddizioni logiche e inferire collegamenti mancanti tra le note [38].
* **Come funziona:** Combina le regole di inferenza simbolica (RDFS/OWL) con le capacità semantiche del LLM per identificare affermazioni discordanti nel vault o suggerire nuovi wikilink tipizzati [38].

### `scripts/ke_maturity.py` (`/ke-maturity`)
* **Cosa fa:** Valuta il livello di maturità complessivo dell'architettura di Ingegneria della Conoscenza su 6 dimensioni (L1-L4) [38].
* **Come funziona:** Misura il grado di formalizzazione del dominio, l'automazione dei test SHACL/CQ, la qualità dell'ancoraggio alle fonti e la copertura semantica [38].

### `scripts/schema_lint.py` & `scripts/schema_infer.py` (`/schema-lint`, `/schema-infer`)
* **Cosa fa:** Esegue la validazione rigorosa (`schema_lint`) e l'inferenza automatica (`schema_infer`) dello schema tipizzato della wiki `[schema]` [38].
* **Come funziona:**
  * `schema_infer.py`: Analizza le note scansionando i predicati ricorrenti e propone uno schema di classi e proprietà.
  * `schema_lint.py`: Verifica che ogni nota rispetti i vincoli di tipo, dominio e intervallo definiti nello schema tipizzato [38].

### `scripts/ontology_rules.py` (`/ontology-check`)
* **Cosa fa:** Esegue la validazione ontologica leggera (rilevamento di dipendenze circolari dirette A -> B -> A, coerenza delle classi e presenza di revisione umana per note `stable`) [36, 38].
* **Come funziona:** Costruisce un grafo in memoria dai wikilink, esegue controlli di ciclo e verifica la coerenza logica delle relazioni [36, 38].

### `scripts/export_semantic.py` (`/export-semantic`)
* **Cosa fa:** Esporta l'intera Knowledge Base in formati RDF W3C standard (**JSON-LD** e **Turtle `.ttl`**) [36, 38].
* **Come funziona:**
  1. Mappa nodi, metadati e wikilink tipizzati (`[[predicato::target]]`) in triple RDF.
  2. Assegna identificatori permanenti W3ID/IRI (`https://w3id.org/wikiforge/id/{note_id}`).
  3. Salva i file esportati in `output/wiki_export.jsonld` e `output/wiki_export.ttl` per la consultazione su Protege o GraphDB [36, 38].

---

## 6. Aggregazione, Compilazione Tesi ed Esportazione PDF

La **Fase 5 del flusso operativo** proietta la conoscenza dinamica interconnessa in un documento statico stampabile di qualità tipografica [32, 35, 36].

```
wiki/ (Note mature) ──► generate_thesis.py ──► output/thesis.md ──► export_thesis_pdf.py ──► output/thesis.pdf
```

### `scripts/generate_thesis.py` (richiamato da `/thesis-chapter`)
* **Cosa fa:** Aggrega e ordina le note mature della wiki per costruire i capitoli di una tesi magistrale, un saggio o un report finale [35, 37].
* **Come funziona:**
  1. Legge la struttura dei capitoli configurata in `config.toml` o definita dalle pagine MOC.
  2. Seleziona soltanto le note con `maturity_score` e `trust_tier` idonei.
  3. Risolve i riferimenti incrociati e unisce le note in un unico documento monolitico in `output/thesis.md` [35, 37].

### `scripts/export_thesis_pdf.py` (richiamato da `make thesis-pdf`)
* **Cosa fa:** Compila il documento Markdown aggregato in un **PDF stampabile di livello editoriale** utilizzando Pandoc e LaTeX [32, 37].
* **Come funziona:**
  1. Invoca Pandoc applicando template LaTeX accademici personalizzati.
  2. Genera automaticamente l'indice generale, l'indice delle figure, la numerazione delle sezioni e la bibliografia BibTeX integrata.
  3. Salva il PDF finale compilato nella cartella `output/` [32, 37].

### `scripts/check_docs_sync.py`
* **Cosa fa:** Verifica che la documentazione in `docs/` e le definizioni delle skill dell'Agente siano perfettamente allineate con il codice degli script [37].
* **Come funziona:** Confronta le definizioni delle interfacce con i file Markdown di documentazione per evitare disallineamenti tra i comandi disponibili e le guide utente [37].

---

## 7. Tabella Riassuntiva dei Comandi e degli Script

| Comando UI / CLI | Script Python Principale | Categoria Funzionale | Output / Output File |
| :--- | :--- | :--- | :--- |
| `/convert-only` | `scripts/conv2md.py` | Ingestione Fonti | `raw/*.md` |
| Web Clipper | `scripts/clip2md.py` | Ingestione Fonti | `sources/web-clips/*.md` |
| Import NotebookLM | `scripts/notebooklm_import.py` | Ingestione Fonti | `wiki/*.md` |
| `/maturity` | `scripts/maturity_calculator.py` | Gestione Vault | `maturity_score` nel frontmatter |
| `/tag-suggest` | `scripts/suggest_tags.py` | Gestione Vault | `tags` aggiornati |
| `/rollback` | `scripts/versioning.py` | Gestione Vault | Ripristino snapshot |
| `/wizard` | `scripts/wizard.py` | Configurazione | `config.toml` aggiornato |
| `/lint-frontmatter` | `scripts/okf_lint.py` | Standard OKF v0.2 | Log di conformità OKF |
| `/reindex` | `scripts/okf_reindex.py` | Standard OKF v0.2 | Mappe di contenuto MOC |
| `/stats` | `scripts/wiki_stats.py` / `okf_stats.py` | Standard OKF v0.2 | `METRICS.md` |
| `/validate-cq` | `scripts/cq_validator.py` | Knowledge Engineering | Report di copertura CQ |
| `/suggest-odp` | `scripts/odp_suggester.py` | Knowledge Engineering | Suggerimenti ODP |
| `/neuro-check` | `scripts/neuro_symbolic_check.py` | Knowledge Engineering | Log contraddizioni/inferenze |
| `/ke-maturity` | `scripts/ke_maturity.py` | Knowledge Engineering | Valutazione livello KE (L1-L4) |
| `/schema-lint` | `scripts/schema_lint.py` | Knowledge Engineering | Validazione schema tipizzato |
| `/ontology-check` | `scripts/ontology_rules.py` | Knowledge Engineering | Log coerenza ontologica |
| `/export-semantic` | `scripts/export_semantic.py` | Knowledge Engineering | `output/wiki_export.ttl` / `.jsonld` |
| `/thesis-chapter` | `scripts/generate_thesis.py` | Compilazione PDF | `output/thesis.md` |
| `make thesis-pdf` | `scripts/export_thesis_pdf.py` | Compilazione PDF | `output/thesis.pdf` |

---

## 8. Conclusioni

Il **Wiki-Forge Script Control Panel** rappresenta il punto di unione tra l'interazione in linguaggio naturale con l'Agente AI e il controllo deterministico sugli standard dei dati [31, 38, 39]. 

Grazie a questi 15+ script Python modulari, `wiki-forge` assicura che una Knowledge Base personale non rimanga una raccolta disordinata di appunti, ma evolva in modo incrementale ed espresso verso un **Enterprise Knowledge Graph** verificabile, conforme agli standard W3C e pronto per la pubblicazione o la stampa [31, 32, 38].
