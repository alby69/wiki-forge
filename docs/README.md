# Wiki-Forge Documentation Index

Indice completo dei documenti in `docs/` (21 file) e dei contenuti della guida in-app (`docs/help/`).

## 📖 Per utenti ed operatori

| Documento | Contenuto |
|---|---|
| [`USER_GUIDE.md`](USER_GUIDE.md) | Focus Mode: i 3 passi (Carica / Compila / Chiedi), wizard guidati, toolbar dell'editor. |
| [`TUTORIAL.md`](TUTORIAL.md) | Guida operativa completa: UI, workflow in 5 fasi, use case, comandi chat, troubleshooting. |
| [`THESIS_GUIDE.md`](THESIS_GUIDE.md) | Esempio applicato alla Tesi Magistrale: dai capitoli al PDF finale (`output/thesis_final.pdf`). |
| [`WORKFLOW.md`](WORKFLOW.md) | Flusso integrato NotebookLM → Wiki-Forge in 5 fasi + checklist operativa settimanale. |
| [`STARTUP.md`](STARTUP.md) | Da una wiki esistente a un nuovo progetto da zero. |
| [`SOURCES.md`](SOURCES.md) | Gestione delle fonti (sources/, backup/, conversione). |

## 🎓 Studio e sintesi

| Documento | Contenuto |
|---|---|
| [`KNOWLEDGE_ENGINEERING.md`](KNOWLEDGE_ENGINEERING.md) | Manuale operativo di Knowledge Engineering (ruoli, processi). |
| [`METRICS.md`](METRICS.md) | Metriche della wiki (calcolo e interpretazione). |
| [`KARPATHY_LLM_WIKI.md`](KARPATHY_LLM_WIKI.md) | Il pattern "LLM Wiki" di Andrej Karpathy (origine filosofica del progetto). |
| [`GRAPH_RAG.md`](GRAPH_RAG.md) | Knowledge Graph semantico e sistema GraphRAG stateful. |

## ⚙️ Knowledge Engineer & architettura

| Documento | Contenuto |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Architettura di sistema v4.1: diagramma unico frontend/health engine/procedure/vault. |
| [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) | Analisi tecnica approfondita: moduli, versioning, MCP, export RDF, confronto con LLM locali. |
| [`KE_PLAYBOOK.md`](KE_PLAYBOOK.md) | Scala di maturità L1-L4, KE Workbench, scrittura di procedure TOML. |
| [`PROCEDURES.md`](PROCEDURES.md) | Specifica del Procedure Engine: schema TOML, DAG, criteri di uscita. |
| [`SCHEMA.md`](SCHEMA.md) | Guida allo schema tipizzato (`[schema]`), validazione e inferenza (`/schema-lint`, `/schema-infer`). |
| [`ROADMAP.md`](ROADMAP.md) | Roadmap di sviluppo. |

## 📐 Standard, sicurezza e processi

| Documento | Contenuto |
|---|---|
| [`OKF_SPEC.md`](OKF_SPEC.md) | Specifica Open Knowledge Format (OKF) v0.2: frontmatter, trust tiers, indici. |
| [`MIGRATION.md`](MIGRATION.md) | Flusso Plan-Review-Apply: proposte `wiki-edit` + **Applica modifica**, changeset backend, soft delete. |
| [`AUDIT_BASELINE.md`](AUDIT_BASELINE.md) | Baseline audit del repository (fase 0). |
| [`CHANGELOG.md`](CHANGELOG.md) | Storico delle release. |

## 🤖 Operatività dell'agente

| Documento | Contenuto |
|---|---|
| [`AGENT.md`](../AGENT.md) (radice) | Operating manual v3.0 per agenti LLM: ruolo, OKF checklist, skill router (10 skill), macro-command. |
| [`help/*.md`](help/) (14 file) | Contenuti della **guida in-app** (pannello **?** / tasto **F1** e comando `/help`), serviti da `GET /api/help`. |

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
| `stati-okf` | `TUTORIAL.md` §5.1, `OKF_SPEC.md` §3/§6 |
| `studio-sintesi` | `TUTORIAL.md` FASE 4 |
| `esportare` | `TUTORIAL.md` FASE 5, `THESIS_GUIDE.md` |
| `problematic` | `TUTORIAL.md` §7 (troubleshooting) |
| `progetti-config` | `TUTORIAL.md` FASE 1, `STARTUP.md` |
| `modalita-dev` | `TUTORIAL.md` §3 (KE Workbench), `KE_PLAYBOOK.md` |
| `maturita-metriche` | `TUTORIAL.md` FASE 4, `METRICS.md`, `KE_PLAYBOOK.md` |

## Verifica di coerenza

```bash
python scripts/check_docs_sync.py   # struttura docs/ e frontmatter di docs/help/*.md
npm run typecheck                   # TypeScript
npm test                            # test backend (include /api/help)
```
