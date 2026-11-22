---
type: Reference
title: "Developer Mode e strumenti"
description: "Argomenti: dev, developer, modalità, mode, workbench, ke, tools, script, avanzato, skills, automazione, schedulazione, agenti"
resource: docs/help/modalita-dev.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it, help]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-help-modalita-dev-md
    resource: docs/help/modalita-dev.md
    title: "Developer Mode e strumenti"
    author: human:alby69
---
## Attivare Developer Mode

Clicca il **badge modalità** in alto (🌱 Focus → 👑 Developer) oppure **Ctrl+Shift+D**. In Developer Mode la barra in alto mostra 4 pulsanti al posto dei 4 passi.

## I quattro strumenti

### 🪄 Onboarding Wizard
Scenario guidato in 3 passi (vedi *Progetti e configurazione*).

### 🧠 KE Workbench
Il laboratorio di **Knowledge Engineering**:

- **Use case** predefiniti (modello concettuale, validazione, audit, pattern, interoperabilità, governance) con passi eseguibili;
- ogni esecuzione scrive nella **console di log** della finestra;
- i risultati finiscono nella wiki (`/api/ke/*` del backend);
- tab **🤖 Agenti & Schedule**: card dei job automatici con orario, prossima corsa e ultimo esito, interruttore on/off, **Esegui ora**, **Annulla**, log in streaming e storico dei run. I job creati dagli script mostrano il badge **🕒 job script**, gli argomenti risolti e il pulsante **🗑 Rimuovi** (i 9 job Use Case restano intatti). La console è nascondibile e ridimensionabile;
- sezione **Policy & Approvazioni**: decisioni del Policy Agent con motivazione e fonti, e step mutanti in attesa di approvazione con pulsanti **✅ Approva** / **❌ Rifiuta**. Nessuna modifica alla wiki viene applicata senza un tuo consenso esplicito.

### 🛠️ Tools
Il **pannello degli script** (Python) del progetto, per categoria:

- **Ingestion** — Convert Sources to Markdown, Web Clipper, Import NotebookLM Export, Voice & Multimedia Ingest...
- **OKF Maintenance** — Lint OKF Bundle, Append OKF Log Entry, Regenerate OKF Indexes, OKF Bundle Analytics, Migrate to OKF v0.2
- **Analysis & Metrics** — Global Wiki Statistics, Calculate Maturity Score, Graph Louvain Analytics
- **Taxonomy** — Suggest Taxonomy Tags
- **Thesis & Study** — Compile Thesis Draft, Export Thesis to PDF
- **Knowledge Engineering** — Infer Domain Schema, Lint Schema, Competency Questions, ODP Suggester, Neuro-Symbolic Check, KE Maturity, Semantic RDF Exporter, Ontology Rule Engine
- **Wizard** — Domain Setup Wizard

Ogni script mostra **parametri con descrizione**, pulsanti **▶ Run Tool** e **🕒 Schedula** e **console di log** con l'output. Il pulsante Schedula crea un job nell'orario suggerito usando gli stessi argomenti del form, assegna un ID automatico e avvisa quando il job mutante resta disabilitato fino all'approvazione F6; gli script `blocked` non sono schedulabili. Il badge accanto al nome (🟢 read-only, 🔵 report, 🟡 workspace, 🟠 wiki-write, 🔴 blocked) proviene dal **catalogo unico di sicurezza e automazione** — classe di rischio, orario suggerito, requisiti e argomenti predefiniti — [`SCRIPT_AUTOMATION_REFERENCE.md`](script-automation-reference.md): non duplicarlo qui.

<!-- DOC_BLOCK_REF:script-automation docs/SCRIPT_AUTOMATION_REFERENCE.md sha256:4578868ea434b746f5fbe14f5f0f259614699cc9f325335ddf15537336982c6b -->

### ⚙️ Config
Impostazioni del progetto (LLM, cartelle, OKF...): vedi *Progetti e configurazione*.

## Skills dell'agente

La cartella `skills/` contiene i pacchetti di competenza dell'agente. In chat, `/skill` elenca quelli registrati; i comandi specializzati sono nel pannello **⚡ Comandi**.

## Quando usare cosa

- **Focus Mode** per la routine: caricare, compilare, chiedere.
- **Developer Mode** quando serve uno **script**, una **metrica**, la **configurazione** o il **Knowledge Engineering**.

**Approfondisci:** `docs/KE_PLAYBOOK.md` (flussi KE), `docs/KNOWLEDGE_ENGINEERING.md`, `docs/PROCEDURES.md` (operazioni su script).
