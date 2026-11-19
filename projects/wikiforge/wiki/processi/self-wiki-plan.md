---
type: Process
title: "Piano: docs/ come wiki di wiki-forge"
description: "Progetto di self-documentazione: la cartella docs/ diventa la wiki consultabile di wiki-forge stesso."
resource: docs/SELF_WIKI_PLAN.md
tags: [scope/docs, layer/generated, area/processi, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-self-wiki-plan-md
    resource: docs/SELF_WIKI_PLAN.md
    title: "Piano: docs/ come wiki di wiki-forge"
    author: human:alby69
---
# Piano: `docs/` come wiki auto-documentante di wiki-forge

## 1. Obiettivo

Trasformare il corpus `docs/` nella **wiki di wiki-forge**: una base di conoscenza OKF v0.2 consultabile dall'LLM per chiarire dubbi sull'architettura e sul funzionamento del programma, con accumulazione delle risposte approvate e nessuna mutazione automatica.

Decisioni confermate:

1. Il bundle generato è **commitato** in git (diff leggibili, review possibile).
2. Nella wiki sono inclusi **`docs/help/`** e **`docs/mockups/`**.
3. Il progetto è **dedicato**: `projects/wikiforge/`.
4. La lingua di ogni nota è **quella del sorgente** (tag `lang/it` o `lang/en`).
5. Si implementa fino alla **Fase 75** (non il ponte alle modifiche automatiche).

## 2. Principio architetturale: sorgente + proiezione

`docs/` resta la **single source of truth** e non viene modificato nella sua struttura. Uno script generatore produce una **proiezione OKF** in `projects/wikiforge/wiki/`.

Motivo: i 18 file `docs/help/*.md` hanno un frontmatter proprio (`id`, `title`, `icon`, `order`, `group`, `mode`, `keywords`, `context`) richiesto da `/api/help` e verificato da `scripts/check_docs_sync.py`. Convertirlo in place romperebbe la guida in-app. La proiezione converte i metadati senza toccare l'originale.

```
docs/  (sorgente, intoccata)
  └─ scripts/docs_to_wiki.py --check
       └─ projects/wikiforge/wiki/  (bundle OKF generato + layer sintesi curato)
            └─ Research Studio "📚 Wiki Docs" → /api/notes/research/*?projectId=wikiforge
```

## 3. Tassonomia

| Area (cartella OKF) | `type` | Contenuto |
|---|---|---|
| `guida/` | `Playbook` | Guide operative, tutorial, workflow, avvio, tesi |
| `architettura/` | `Concept` | Architettura, architettura tecnica, GraphRAG |
| `processi/` | `Process` / `Playbook` | Manuale agente, KE, migrazione, scheduler, questo piano |
| `standard/` | `Reference` | OKF, schema, procedure, pattern Karpathy |
| `riferimenti/` | `Reference` | Indice docs, roadmap, changelog, audit, mockup, topic help |
| `sintesi/` | `Reference` | Note **curate** da risposte approvate (non rigenerate) |

Tag sempre presenti: `scope/docs`, `layer/generated` (o `layer/curated`), `area/<cartella>`, `lang/it|en`.

Provenienza: ogni nota generata ha `generated.by: process:docs-to-wiki`, `generated.at` uguale al `BUILD_STAMP` dello script (valore fisso per garantire idempotenza dei file commitati) e `sources[0].resource` che punta al documento sorgente.

## 4. Mapping completo dei documenti

### 4.1 Guida (`guida/`)

| Sorgente | Nota OKF | `type` | Lingua |
|---|---|---|---|
| `docs/GUIDA_OPERATIVA.md` | `guida/guida-operativa.md` | Playbook | it |
| `docs/USER_GUIDE.md` | `guida/user-guide.md` | Playbook | it |
| `docs/TUTORIAL.md` | `guida/tutorial.md` | Playbook | it |
| `docs/THESIS_GUIDE.md` | `guida/thesis-guide.md` | Playbook | it |
| `docs/STARTUP.md` | `guida/startup.md` | Playbook | it |
| `docs/WORKFLOW.md` | `guida/workflow.md` | Playbook | it |

### 4.2 Architettura (`architettura/`)

| Sorgente | Nota OKF | `type` | Lingua |
|---|---|---|---|
| `docs/ARCHITECTURE.md` | `architettura/architecture.md` | Concept | en |
| `docs/TECHNICAL_ARCHITECTURE.md` | `architettura/technical-architecture.md` | Concept | it |
| `docs/GRAPH_RAG.md` | `architettura/graph-rag.md` | Concept | it |

### 4.3 Processi (`processi/`)

| Sorgente | Nota OKF | `type` | Lingua |
|---|---|---|---|
| `docs/AGENT.md` | `processi/agent-manual.md` | Playbook | it |
| `AGENT.md` (puntatore root) | alias → `processi/agent-manual.md` | — | — |
| `docs/KE_PLAYBOOK.md` | `processi/ke-playbook.md` | Playbook | it |
| `docs/KNOWLEDGE_ENGINEERING.md` | `processi/knowledge-engineering.md` | Process | it |
| `docs/MIGRATION.md` | `processi/migration.md` | Process | it |
| `docs/KE_AGENT_SCHEDULER_PLAN.md` | `processi/ke-agent-scheduler-plan.md` | Process | it |
| `docs/SELF_WIKI_PLAN.md` | `processi/self-wiki-plan.md` | Process | it |

### 4.4 Standard (`standard/`)

| Sorgente | Nota OKF | `type` | Lingua |
|---|---|---|---|
| `docs/OKF_SPEC.md` | `standard/okf-spec.md` | Reference | en |
| `docs/SCHEMA.md` | `standard/schema.md` | Reference | it |
| `docs/PROCEDURES.md` | `standard/procedures.md` | Reference | it |
| `docs/KARPATHY_LLM_WIKI.md` | `standard/karpathy-llm-wiki.md` | Reference | en |

### 4.5 Riferimenti (`riferimenti/`)

| Sorgente | Nota OKF | `type` | Lingua |
|---|---|---|---|
| `docs/README.md` | `riferimenti/docs-readme.md` | Reference | en |
| `docs/SOURCES.md` | `riferimenti/sources.md` | Reference | it |
| `docs/ROADMAP.md` | `riferimenti/roadmap.md` | Reference | it |
| `docs/CHANGELOG.md` | `riferimenti/changelog.md` | Reference | en |
| `docs/AUDIT_BASELINE.md` | `riferimenti/audit-baseline.md` | Reference | it |
| `docs/mockups/README.md` | `riferimenti/mockups.md` | Reference | it |

### 4.6 Guida in-app (`riferimenti/help-*.md`)

I 18 file `docs/help/<id>.md` diventano `riferimenti/help-<id>.md` con `type: Reference`. Il frontmatter originale viene rimosso nella proiezione e sostenuto da `resource`, `description` (derivata da `keywords`/titolo) e tag `help`, `lang/it`.

`inizio`, `barra-alto`, `caricare-documenti`, `compilare`, `chat-comandi`, `viste-grafo`, `modifica-note`, `review-studio`, `research-studio`, `study-studio`, `stati-okf`, `studio-sintesi`, `esportare`, `problematic`, `progetti-config`, `modalita-dev`, `maturita-metriche`, `wiki-di-wiki-forge`.

### 4.7 Esclusioni

- **`docs/METRICS.md`** è rigenerato da `npm test` (tramite `wiki_stats.py`); inclusione nella proiezione creerebbe drift continuo. Le metriche restano consultabili nel progetto `tesi`.
- Le immagini in `docs/mockups/*.png` non sono note: i link vengono riscritti come percorsi assoluti `/docs/mockups/<file>`.

## 5. Fasi

| Fase | Contenuto | Stato |
|---|---|---|
| 70 | Piano e mapping (questo documento) | Done |
| 71 | `scripts/docs_to_wiki.py`: generatore idempotente con `--check`, `--json`, `--dry-run` | Done |
| 72 | Progetto `wikiforge` (registry, config, bundle generato) | Done |
| 73 | Validazione: `check_docs_sync.py` + `okf_lint.py`, test Python/TS | Done |
| 74 | UX: bottone **📚 Wiki Docs**, Research Studio con `projectId=wikiforge`, help topic | Done |
| 75 | Accumulazione: note in `sintesi/` con `verified: human:*`, job consultivo di drift | Done |
| 76 | Ponte alle modifiche al programma (approvazione F6) | **Non implementato** |

## 6. Salvaguardie

- Nessuna modifica automatica a `docs/` o al codice: `auto_apply = false` per ogni job.
- Il job di drift scrive solo in `output/` e passa dal Policy Agent F5 (rationale + fonti obbligatorie).
- La promozione di una risposta a nota `sintesi/` è un comando **umano** esplicito (`scripts/promote_doc_answer.py`), con `verified.by: human:<id>`.
- `scripts/check_docs_sync.py` continua a verificare i 18 topic help, i comandi skill e la parità versionale: la proiezione non li altera.

## 7. Comandi

```bash
python scripts/docs_to_wiki.py                 # rigenera il bundle
python scripts/docs_to_wiki.py --check         # verifica drift (CI)
python scripts/docs_to_wiki.py --json          # output machine-readable
python scripts/okf_lint.py projects/wikiforge/wiki --json
python scripts/docs_wiki_drift.py --json
python scripts/promote_doc_answer.py --title "..." --question "..." --answer-file ... --reviewer human:<id>
```
