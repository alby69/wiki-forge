---
type: Reference
title: Wiki-Forge Script Control Panel
description: Panoramica degli script Python per gestione e compilazione wiki-forge
status: draft
tags: ["topic/ai", "status/draft"]
generated:
  by: process:wiki-forge-compile
  at: "2026-10-09T00:00:00Z"
sources:
  - id: wiki_forge_script_panel_guide_NoteLM
    resource: raw/wiki_forge_script_panel_guide_NoteLM_COMPILED.md
    title: Guida Completa agli Script del Wiki-Forge Script Control Panel
    author: process:notebooklm
    last_modified: "2026-10-09"
---

# Wiki-Forge Script Control Panel

Il **Wiki-Forge Script Control Panel** è l'interfaccia del pannello strumenti (Tools) che permette di eseguire da browser oltre 15 script Python per la manutenzione, conversione, validazione semantica e compilazione della knowledge base conforme a OKF v0.2.

## Summary

- **Architettura**: Backend basato su Server-Sent Events (SSE) per streaming in tempo reale dei log di esecuzione, senza comandi da terminale.
- **Ingestione**: Conversione da fonti eterogenee (PDF/EPUB/DOCX, clip web, export NotebookLM) verso raw/ e wiki/ strutturati.
- **Gestione vault**: Calcolo maturità, suggerimenti tag, versioning/rollback e procedura guidata wizard.
- **Conformità OKF v0.2**: Lint frontmatter, reindex, stats, migrazione e logging auditabile.
- **Knowledge Engineering**: Validazione CQ, suggerimenti ODP, neuro-symbolic check, schema lint/infer, ontology check, export semantico (JSON-LD/Turtle).
- **Compilazione tesi**: Aggregazione di note mature e export PDF tramite Pandoc/LaTeX.

## What it does

Wiki-Forge combina Zettelkasten con Ingegneria della Conoscenza (CommonKADS), adottando Open Knowledge Format (OKF v0.2) per garantire tracciabilità, verificabilità e portabilità [1-9]. Il pannello esegue gli script con validazione form dinamica e gestione eccezioni in streaming SSE [9].

## Main Command Categories

### Ingestione e Conversione (Source Ingestion & Clipping)
- **conv2md.py / run_convert.sh (/convert-only)**: Estrae e converte PDF/EPUB/DOCX da `sources/` a `raw/` con pulizia e frontmatter iniziale [14-29].
- **clip2md.py**: Web clipper per articoli web salvati in `sources/web-clips/` con metadati di provenienza [30-36].
- **notebooklm_import.py**: Importa export NotebookLM riformattati per OKF v0.2 con wikilink [37-43].

### Gestione Vault e Ciclo di Vita
- **maturity_calculator.py (/maturity)**: Calcola maturity score (0-100) su 5 criteri [50-60].
- **suggest_tags.py (/tag-suggest)**: Suggerimenti tag da vocabolario controllato [62-68].
- **versioning.py (/rollback)**: Snapshot e rollback di note [69-74].
- **wizard.py (/wizard)**: Configurazione scenari operativi (Academic Thesis, Business KB, Personal Study) [75-80].

### Standard OKF v0.2
- **okf_lint.py (/lint-frontmatter)**: Validazione schema OKF v0.2 (campi obbligatori, enumerazioni) [88-93].
- **migrate_to_okf.py**: Migrazione note esistenti a OKF v0.2 [94-99].
- **okf_reindex.py (/reindex)**: Rigenera indici e MOC [100-106].
- **okf_log.py**: Log auditabile modifiche [107-109].
- **okf_stats.py/wiki_stats.py (/stats)**: Metriche salute wiki (METRICS.md) [110-116].

### Knowledge Engineering & Ontologie
- **cq_validator.py (/validate-cq)**: Validazione Competency Questions, gap analysis [124-129].
- **odp_suggester.py (/suggest-odp)**: Suggerimenti Ontology Design Patterns [130-133].
- **neuro_symbolic_check.py (/neuro-check)**: Ponte neuro-simbolico per contraddizioni/inferenze [134-137].
- **ke_maturity.py (/ke-maturity)**: Valutazione maturità KE su scala L1-L4 [138-141].
- **schema_lint.py (/schema-lint), schema_infer.py (/schema-infer)**: Validazione e inferenza schema tipizzato [142-147].
- **ontology_rules.py (/ontology-check)**: Coerenza ontologica (cicli, classi, revisione) [148-151].
- **export_semantic.py (/export-semantic)**: Export RDF (JSON-LD, Turtle .ttl) con IRI permanenti [152-158].

### Aggregazione, Compilazione Tesi, Export PDF
- **generate_thesis.py (/thesis-chapter)**: Aggrega note mature in `output/thesis.md` [169-175].
- **export_thesis_pdf.py (make thesis-pdf)**: Compila PDF editoriale con Pandoc/LaTeX [176-181].
- **check_docs_sync.py**: Sincronizzazione docs/skill con codice [183-186].

## How to Use It

Il pannello è accessibile dall'interfaccia wiki-forge (Vite+TypeScript) nella sezione Tools. Selezionando un comando viene invocato lo script corrispondente; i log vengono streammati via SSE in tempo reale. Le operazioni seguono il flusso operativo OKF: ingestione → strutturazione → validazione → maturazione → compilazione tesi [15-21, 165-167].

## Related

- [[linee-guida-tesi-hr]]
- [[governance-controllo-responsabilita]]

## Sources

- [NotebookLM — Guida Script Panel](raw/wiki_forge_script_panel_guide_NoteLM_COMPILED.md#L1-L120)
- [NotebookLM — Knowledge Engineering & Export](raw/wiki_forge_script_panel_guide_NoteLM_COMPILED.md#L119-L158)
- [NotebookLM — Compilazione Tesi ed Esportazione](raw/wiki_forge_script_panel_guide_NoteLM_COMPILED.md#L160-L186)