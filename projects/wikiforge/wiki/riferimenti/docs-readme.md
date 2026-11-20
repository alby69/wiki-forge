---
type: Reference
title: "Wiki-Forge Documentation Index"
description: "Indice completo dei documenti in docs/ (24 file), dei contenuti della guida in-app (docs/help/, 18 argomenti) e dei mockup in docs/mockups/."
resource: docs/README.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/en]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-readme-md
    resource: docs/README.md
    title: "Wiki-Forge Documentation Index"
    author: human:alby69
---
# Wiki-Forge Documentation Index

Indice completo dei documenti in `docs/` (24 file), dei contenuti della guida in-app (`docs/help/`, 18 argomenti) e dei mockup in `docs/mockups/`.

## 📖 Per utenti ed operatori

| Documento | Contenuto |
|---|---|
| [`GUIDA_OPERATIVA.md`](../guida/guida-operativa.md) | **Guida unica non tecnica**: attività, flusso di lavoro tipico e buone pratiche. Punto di partenza consigliato. |
| [`USER_GUIDE.md`](../guida/user-guide.md) | Focus Mode: i 3 passi (Carica / Compila / Chiedi), wizard guidati, toolbar dell'editor e Review Studio. |
| [`TUTORIAL.md`](../guida/tutorial.md) | Guida operativa completa: UI, workflow in 5 fasi, use case, comandi chat, troubleshooting. |
| [`THESIS_GUIDE.md`](../guida/thesis-guide.md) | Esempio applicato alla Tesi Magistrale: dai capitoli al PDF finale (`output/thesis_final.pdf`). |
| [`WORKFLOW.md`](../guida/workflow.md) | Flusso integrato NotebookLM → Wiki-Forge in 5 fasi + checklist operativa settimanale. |
| [`STARTUP.md`](../guida/startup.md) | Da una wiki esistente a un nuovo progetto da zero. |
| [`SOURCES.md`](sources.md) | Gestione delle fonti (sources/, backup/, conversione). |

## 🎓 Studio e sintesi

| Documento | Contenuto |
|---|---|
| [`KNOWLEDGE_ENGINEERING.md`](../processi/knowledge-engineering.md) | Manuale operativo di Knowledge Engineering (ruoli, processi). |
| [`METRICS.md`](METRICS.md) | Metriche della wiki (calcolo e interpretazione). |
| [`KARPATHY_LLM_WIKI.md`](../standard/karpathy-llm-wiki.md) | Il pattern "LLM Wiki" di Andrej Karpathy (origine filosofica del progetto). |
| [`GRAPH_RAG.md`](../architettura/graph-rag.md) | Knowledge Graph semantico e sistema GraphRAG stateful. |

## ⚙️ Knowledge Engineer & architettura

| Documento | Contenuto |
|---|---|
| [`ARCHITECTURE.md`](../architettura/architecture.md) | Architettura di sistema v4.1: diagramma unico frontend/health engine/procedure/vault/Review Studio. |
| [`TECHNICAL_ARCHITECTURE.md`](../architettura/technical-architecture.md) | Analisi tecnica approfondita: moduli, versioning, Review Studio, MCP, export RDF, confronto con LLM locali. |
| [`EDITOR_MIGRATION.md`](../architettura/editor-migration.md) | Architettura dell'editor note: adapter CodeMirror/Milkdown-Crepe, frontmatter OKF, wikilink e validazione. |
| [`FRONTEND_UIUX_PLAN.md`](../architettura/frontend-uiux-plan.md) | Studio UI/UX del frontend e piano KISS/DRY: azioni uniche, design system, disaccoppiamento e ciclo di vita progetti. |
| [`KE_PLAYBOOK.md`](../processi/ke-playbook.md) | Scala di maturità L1-L4, KE Workbench, scrittura di procedure TOML. |
| [`PROCEDURES.md`](../standard/procedures.md) | Specifica del Procedure Engine: schema TOML, DAG, criteri di uscita. |
| [`SCHEMA.md`](../standard/schema.md) | Guida allo schema tipizzato (`[schema]`), validazione e inferenza (`/schema-lint`, `/schema-infer`). |
| [`ROADMAP.md`](roadmap.md) | Roadmap di sviluppo. |

## 📐 Standard, sicurezza e processi

| Documento | Contenuto |
|---|---|
| [`OKF_SPEC.md`](../standard/okf-spec.md) | Specifica Open Knowledge Format (OKF) v0.2: frontmatter, trust tiers, indici. |
| [`MIGRATION.md`](../processi/migration.md) | Flusso Plan-Review-Apply: proposte `wiki-edit` + **Applica modifica**, changeset backend, soft delete. |
| [`mockups/`](mockups.md) | Review Studio: prototipo HTML interattivo e 5 anteprime (Verifica, Critica, Digest, Diff, menu contestuale). |
| [`AUDIT_BASELINE.md`](audit-baseline.md) | Baseline audit del repository (fase 0). |
| [`SELF_WIKI_PLAN.md`](../processi/self-wiki-plan.md) | Piano di self-documentazione: `docs/` proiettato nella wiki OKF di `wikiforge` (fasi 70-76). |
| [`CHANGELOG.md`](changelog.md) | Storico delle release. |

## 🤖 Operatività dell'agente

| Documento | Contenuto |
|---|---|
| [`AGENT.md`](../processi/agent-manual.md) (radice) | Operating manual v3.0 per agenti LLM: ruolo, OKF checklist, skill router (10 skill), macro-command. |
| [`help/*.md`](help/) (18 file) | Contenuti della **guida in-app** (pannello **?** / tasto **F1** e comando `/help`), serviti da `GET /api/help`. |

## 🗺️ Mappa: argomenti guida in-app ↔ documenti

| Topic guida (`docs/help/`) | Approfondisci in |
|---|---|
| `inizio` | `USER_GUIDE.md`, `TUTORIAL.md` §2 |
| `barra-alto` | `TUTORIAL.md` §2 (viste e pulsanti) |
| `caricare-documenti` | `TUTORIAL.md` FASE 2, `SOURCES.md` |
| `compilare` | `TUTORIAL.md` FASE 3, `WORKFLOW.md` |
| `chat-comandi` | `TUTORIAL.md` §5, `AGENT.md` §5, README (radice) |
| `viste-grafo` | `TUTORIAL.md` §2 (viste dell'area di lavoro) |
| `modifica-note` | `USER_GUIDE.md` (toolbar), `TUTORIAL.md` FASE 3 |
| `review-studio` | `TUTORIAL.md` §2/§5.1, `USER_GUIDE.md` (Review Studio), `TECHNICAL_ARCHITECTURE.md` §2.11 |
| `research-studio` | `TUTORIAL.md` §2/§5, `USER_GUIDE.md` (Research Studio), `TECHNICAL_ARCHITECTURE.md` §2.12 |
| `study-studio` | `TUTORIAL.md` §4, `USER_GUIDE.md` (Study Studio), `TECHNICAL_ARCHITECTURE.md` §2.13 |
| `stati-okf` | `TUTORIAL.md` §5.1, `OKF_SPEC.md` §3/§6 |
| `studio-sintesi` | `TUTORIAL.md` FASE 4 |
| `esportare` | `TUTORIAL.md` FASE 5, `THESIS_GUIDE.md` |
| `problematic` | `TUTORIAL.md` §7 (troubleshooting) |
| `progetti-config` | `TUTORIAL.md` FASE 1, `STARTUP.md` |
| `modalita-dev` | `TUTORIAL.md` §3 (KE Workbench), `KE_PLAYBOOK.md` |
| `maturita-metriche` | `TUTORIAL.md` FASE 4, `METRICS.md`, `KE_PLAYBOOK.md` |
| `wiki-di-wiki-forge` | `SELF_WIKI_PLAN.md` (fasi 70-76), `docs_to_wiki.py`, `KNOWLEDGE_ENGINEERING.md` (UC8), `TUTORIAL.md` §5 |

## Verifica di coerenza

```bash
python scripts/check_docs_sync.py   # struttura docs/ e frontmatter di docs/help/*.md
npm run typecheck                   # TypeScript
npm test                            # test backend (include /api/help)
```
