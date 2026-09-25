# Wiki-Forge: Dynamic Knowledge Base Engine & Print Compiler

> A minimal, agent-agnostic template for building a **personal dynamic knowledge base
> that an LLM compiles, maintains, and transforms into print-ready documents for you** — based on Andrej Karpathy's
> [LLM Wiki](docs/KARPATHY_LLM_WIKI.md) pattern.

Instead of re-answering questions from raw documents every time (classic RAG),
the LLM acts as an active **Knowledge Engineer** — an intellectual partner that
**incrementally builds, evaluates, and maintains a persistent, interlinked wiki** of
Markdown files conforming to Google's **Open Knowledge Format (OKF v0.2)**.

This repository supports building **dynamic, incremental knowledge bases** (e.g. for a **Master's Thesis / Tesi Magistrale**, research projects, business wikis, or personal study) with a **dual output**:
1. **Dynamic Interactive Wiki**: Searchable, interlinked, interrogable via chat, and continually evolving.
2. **Static Print Output**: Compiled into formal chapters and exported as a publication-ready PDF via Pandoc.

---

## 🚀 Avvio Rapido (Per tutti gli utenti)

Non serve installare Python o Node.js! Segui questi tre semplici passaggi:

1. **Installa Docker Desktop** (se non lo hai già): [Scarica qui](https://www.docker.com/products/docker-desktop)
2. **Scarica questo repository** come file ZIP ed estrailo.
3. **Fai doppio click** sul file di avvio corrispondente al tuo sistema operativo nella cartella principale:
   - 🪟 Windows: `Start_WikiForge.bat`
   - 🍎 macOS: `Start_WikiForge.command` *(al primo avvio: clic destro → "Apri")*
   - 🐧 Linux: `Start_WikiForge.sh` *(assicurati che sia eseguibile: `chmod +x Start_WikiForge.sh`)*

L'applicazione si avvierà e il tuo browser si aprirà automaticamente su **http://localhost:5173**.

> 💡 **Per arrestare l'applicazione**, usa semplicemente il file `Stop_WikiForge.*` corrispondente.

---

## 🗺️ Mappa della Documentazione (Documentation Index)

La documentazione è organizzata chiaramente in base al tipo di utente:

### 📖 Per Utenti ed Operatori (Non-Technical & Content Creators)
- **[`docs/TUTORIAL.md`](docs/TUTORIAL.md)** — **Guida Operativa dell'Utente**: Guida passo-passo che spiega come utilizzare il sistema giorno per giorno, con il prontuario dei comandi e la risoluzione dei problemi.
- **[`docs/THESIS_GUIDE.md`](docs/THESIS_GUIDE.md)** — **Guida alla Tesi Magistrale**: Esempio pratico e completo per costruire una tesi di laurea come Knowledge Base dinamica e generarne la versione stampabile in PDF.
- **[`docs/SOURCES.md`](docs/SOURCES.md)** — **Registro delle Fonti**: Registro bibliografico e guida alla tracciabilità delle fonti.

### ⚙️ Per Sviluppatori ed Ingegneri del Software (Technical Architecture)
- **[`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)** — **Architettura Tecnica**: Analisi dettagliata dell'architettura del sistema, server API, client LLM multi-provider, isolamento della memoria non-parametrica, motore di script SSE e confronto con l'addestramento *nanochat*.
- **[`docs/OKF_SPEC.md`](docs/OKF_SPEC.md)** — **Open Knowledge Format Spec v0.2**: Specifica tecnica standard per il formato delle note, frontmatter YAML, trust tiers ed indici.
- **[`docs/AGENT.md`](docs/AGENT.md)** — **Operating Manual dell'Agente**: Il manuale operativo che definisce il contratto, i ruoli e le capacità dell'agente LLM.
- **[`docs/CHANGELOG.md`](docs/CHANGELOG.md)** — **Storico dei Rilasci**: Registro dei cambiamenti e versionamento semantico.
- **[`docs/KARPATHY_LLM_WIKI.md`](docs/KARPATHY_LLM_WIKI.md)** — **Il Concetto Originario**: Copia offline dell'articolo di Andrej Karpathy sull'LLM Wiki.

---

## 🔄 Il Flusso Operativo in 5 Fasi Cronologiche

```
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 1: Configurazione & Inizializzazione                   │
 │ Setup config.toml, Scenario Wizard (wizard / /wizard)        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 2: Ingestione & Conversione Fonti                      │
 │ PDF/EPUB in sources/, conv2md, clip2md, notebooklm_import   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ FASE 3: Costruzione Incrementale & Consultazione            │
 │ /compile, /ingest, Web UI Editor, Graph View, /consult,     │
 │ /search, /backlinks, /related, /trace, versioning & /rollback│
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
 │ /thesis-chapter, generate_thesis, export_thesis_pdf (PDF)   │
 └──────────────────────────────┘
```

1. **Fase 1: Configurazione**: Imposta `config.toml` o usa la GUI **⚙️ Config** ed avvia il Wizard (`wizard` o `/wizard`).
2. **Fase 2: Ingestione**: Carica i file sorgente in `sources/` e convertili in Markdown con `bash run_convert.sh` (`convert-only` / `/convert-only`), ritaglia pagine sul web con `clip2md.py` o importa da NotebookLM con `notebooklm_import.py`.
3. **Fase 3: Costruzione & Consultazione**: Avvia `/compile` per elaborare i file in `raw/` o `/ingest` per un singolo file, esegui il riesame con `/recompile`, crea nuove schede con `/new-article`, interroga la wiki con `/consult`, cerca con `/search`, esplora i collegamenti con `/backlinks` e `/related`, e traccia le affermazioni alle fonti originali con `/trace`. Gestisci le versioni e ripristina stati precedenti con `/rollback`.
4. **Fase 4: Sintesi & Maturazione**: Genera materiale didattico ed analisi con `/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/deep-research`, prendi appunti veloci con `/note` e promuovili ad articoli con `/promote-note`, suggerisci tag con `/tag-suggest` e calcola l'indice di completamento delle pagine con `/maturity`.
5. **Fase 5: Compilazione & Stampa PDF**: Aggrega le note mature con `/thesis-chapter` (`generate_thesis.py`) ed esporta il PDF finale con `export_thesis_pdf.py` (`make thesis-pdf`). Gestisci la manutenzione della wiki con `/audit`, `/reindex`, `/prune`, `/lint-frontmatter`, `/stats`, `/merge`, `/split`, `/stub`, `/retag`, rigenera la bibliografia con `/sources` (`sources regenerate`), visualizza modelli con `/template` (`template show`), confronta versioni con `/diff`, ed esporta dati con `/export` e `/help`.

---

## 🛠️ Cosa C'è nel Repository

```
.
├── config.toml          # Configurazione principale (titolo, percorsi, LLM, OKF)
├── config/
│   └── scenarios.toml   # Preset di scenario (Academic, Business, Research, ecc.)
├── scripts/
│   ├── conv2md.py            # Conversione PDF/EPUB/DOCX -> Markdown (raw/)
│   ├── run_convert.sh        # Wrapper per conv2md.py
│   ├── notebooklm_import.py # Importazione note ed export da NotebookLM
│   ├── wiki_stats.py        # Calcolo metriche wiki e METRICS.md
│   ├── suggest_tags.py      # Suggerimento tag da vocabolario controllato
│   ├── clip2md.py           # Web clipper -> Markdown (sources/web-clips/)
│   ├── maturity_calculator.py # Calcolo Indice di Maturità (0-100)
│   ├── versioning.py        # Snapshot di versione e motore di rollback
│   ├── check_docs_sync.py   # Verificatore di sincronizzazione documentazione/skills
│   ├── migrate_to_okf.py    # Migrazione frontmatter a OKF v0.2
│   ├── okf_lint.py          # Linter e validatore schema OKF v0.2
│   ├── okf_log.py           # Registro cronologico delle modifiche (OKF §9)
│   ├── okf_reindex.py       # Rigenerazione indici tematici (OKF §8)
│   ├── okf_stats.py         # Statistiche ed analisi trust tier OKF
│   ├── generate_thesis.py   # Aggregazione capitoli tesi da note mature
│   ├── export_thesis_pdf.py # Esportazione della tesi in PDF tramite Pandoc
│   └── wizard.py            # CLI guidata per scenari operativi
├── AGENT.md             # Manuale operativo dell'Agente LLM (symlink a docs/AGENT.md)
├── skills/              # Pacchetti di Skill modulari per l'agente
├── docs/                # Documentazione centralizzata (TUTORIAL, THESIS_GUIDE, ecc.)
├── src/                 # Sorgenti applicazione Web UI e Agent Server (TypeScript)
├── sources/             # Cartella file sorgenti ORIGINALI (backup/ - mai modificati)
├── raw/                 # Testo grezzo convertito (inbox dell'agente)
├── wiki/                # La Knowledge Base viva ed interconnessa
├── output/              # Risultati temporanei, report e PDF finali
├── Dockerfile           # Ambiente riproducibile (Python + Pandoc)
└── Makefile             # Scorciatoie per terminale
```

---

## 🌐 Web UI & Pannello di Controllo Strumenti

L'applicazione include un'interfaccia Web avanzata (Vite + TypeScript) con:
- **Pannello Strumenti (🛠️ Tools)**: Esegue tutti i 15 script Python direttamente dal browser con form dinamici e console di log in tempo reale tramite Server-Sent Events (SSE).
- **Gestore Configurazione (⚙️ Config)**: Modifica `config.toml` graficamente.
- **Project Switcher**: Gestisci più progetti contemporaneamente isolati in `projects/`.
- **Vault Explorer & CodeMirror 6 Editor**: Naviga nel vault, modifica note con completamento dei `[[wikilink]]` e salvataggio diretto su disco.
- **Force Graph Viewer**: Mappa interattiva delle relazioni tra note.
- **Chat Drawer**: Assistente agente integrato con streaming delle risposte, tasti scorciatoia ed il pulsante **📌 Attach to Wiki**.

---

## 📄 Requisiti e Requisiti di Sistema

- **Docker Desktop** (consigliato per l'avvio con un click) oppure:
- Python 3.11+
- Pandoc (per la compilazione dei PDF e la conversione DOCX/EPUB)
- Node.js 20+ (per lo sviluppo locale dell'interfaccia Web UI)
