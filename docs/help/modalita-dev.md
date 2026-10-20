---
id: modalita-dev
title: Developer Mode e strumenti
icon: 👑
order: 13
group: ⚙️ Progetti e Dev Mode
mode: dev
keywords: [dev, developer, modalità, mode, workbench, ke, tools, script, avanzato, skills]
context: [modalita-dev, ke-workbench, tools]
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
- i risultati finiscono nella wiki (`/api/ke/*` del backend).

### 🛠️ Tools
Il **pannello degli script** (Python) del progetto, per categoria:

- **Ingestion** — Convert Sources to Markdown, Web Clipper, Import NotebookLM Export, Voice & Multimedia Ingest...
- **OKF Maintenance** — Lint OKF Bundle, Append OKF Log Entry, Regenerate OKF Indexes, OKF Bundle Analytics, Migrate to OKF v0.2
- **Analysis & Metrics** — Global Wiki Statistics, Calculate Maturity Score, Graph Louvain Analytics
- **Taxonomy** — Suggest Taxonomy Tags
- **Thesis & Study** — Compile Thesis Draft, Export Thesis to PDF
- **Knowledge Engineering** — Infer Domain Schema, Lint Schema, Competency Questions, ODP Suggester, Neuro-Symbolic Check, KE Maturity, Semantic RDF Exporter, Ontology Rule Engine
- **Wizard** — Domain Setup Wizard

Ogni script mostra **parametri con descrizione**, pulsante **Execute** e **console di log** con l'output.

### ⚙️ Config
Impostazioni del progetto (LLM, cartelle, OKF...): vedi *Progetti e configurazione*.

## Skills dell'agente

La cartella `skills/` contiene i pacchetti di competenza dell'agente. In chat, `/skill` elenca quelli registrati; i comandi specializzati sono nel pannello **⚡ Comandi**.

## Quando usare cosa

- **Focus Mode** per la routine: caricare, compilare, chiedere.
- **Developer Mode** quando serve uno **script**, una **metrica**, la **configurazione** o il **Knowledge Engineering**.

**Approfondisci:** `docs/KE_PLAYBOOK.md` (flussi KE), `docs/KNOWLEDGE_ENGINEERING.md`, `docs/PROCEDURES.md` (operazioni su script).
