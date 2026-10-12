---
type: Concept
title: "Capitolo 3: Progettazione della Piattaforma di Gestione della Conoscenza Ibrida"
description: "Architettura ibrida tra NotebookLM (Discovery) e Wiki-Forge (Consolidation): OKF v0.2, SHACL e GraphRAG"
status: draft
maturita: 50
tags: [thesis/chapter, topic/architecture, topic/wiki-forge, status/draft]
generated:
  by: process:jules-agent
  at: "2026-10-12T00:00:00Z"
verified:
  - by: human:autore
    at: "2026-10-12T00:00:00Z"
sources:
  - id: thesis-design-doc
    resource: raw/thesis-design-doc.md
    title: "Documento di Progettazione della Tesi Magistrale"
---

# Capitolo 3: Progettazione della Piattaforma di Gestione della Conoscenza Ibrida

## 3.1 Il Workflow Ibrido a Due Stadi
L'architettura proposta integra le peculiarità di due ambienti complementari:
1. **Stadio di Discovery (NotebookLM)**: Ingestione rapida di fonti primarie (PDF, trascrizioni, paper), estrazione di sintesi preliminari, FAQ e Audio Overview.
2. **Stadio di Consolidation (Wiki-Forge)**: Importazione tramite `notebooklm_import.py`, compilazione agentica in note atomiche (`wiki/`), tagging semantico, e interconnessione in Knowledge Graph.

## 3.2 Dettagli Tecnico-Standard
- **Open Knowledge Format (OKF v0.2)**: Specifiche per frontmatter YAML, tracciamento delle fonti e ciclo di vita delle note (`status`, `maturita`, `verified`).
- **Validazione Ontologica SHACL**: Definizione di vincoli W3C (`shapes.ttl`) per garantire l'integrità strutturale della Knowledge Base.
- **GraphRAG & Competency Questions**: Navigazione di grafi k-hop ed esecuzione di quesiti di ricerca strutturati via `cq_validator.py`.
- **Trust Tiers**: Classificazione della conoscenza in `unverified`, `machine-confirmed` e `human-reviewed`.

## 3.3 Analisi Critica delle Scelte Architetturali
- **Punti di Forza**: Superamento dei silos informativi, persistenza della conoscenza compilata, tracciabilità al rigo sorgente (`#L10-L25`).
- **Punti di Debolezza e Mitigazioni**: Curva di apprendimento tecnica, necessità di governance *human-in-the-loop*.

## Collegamenti Correlati
- [[capitoli/01-introduzione|Capitolo 1: Introduzione]]
- [[capitoli/04-mappatura-e-automazione-hr|Capitolo 4: Mappatura e Automazione HR]]
- [[strumenti/index|Strumenti]]
- [[tools/index|Tools]]
- [[linee-guida-tesi-hr]]
