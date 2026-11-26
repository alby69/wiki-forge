---
type: Reference
title: "Indice della documentazione — Wiki-Forge v4.1"
description: "docs/ è la single source of truth della documentazione. È organizzata per"
resource: docs/README.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-26T00:00:00Z"
sources:
  - id: source-docs-readme-md
    resource: docs/README.md
    title: "Indice della documentazione — Wiki-Forge v4.1"
    author: human:alby69
---
# Indice della documentazione — Wiki-Forge v4.1

`docs/` è la **single source of truth** della documentazione. È organizzata per
argomento: si parte dalla guida operativa, si passa ai processi di Knowledge
Engineering e si chiude con architettura e riferimenti generati. La guida in-app
resta in `docs/help/` perché è servita da `GET /api/help`.

Per un unico file Markdown stampabile che segue il percorso qui sotto:

```bash
make docs-book      # genera output/manuale-wiki-forge.md
```

## Percorso didattico

Dalle basi all'implementazione. Ogni documento rimane leggibile in autonomia.

| # | Documento | Obiettivo |
|---:|---|---|
| 1 | [Guida operativa](../guida/guida-operativa.md) | Attività, flusso tipico e buone pratiche, senza concetti tecnici. |
| 2 | [Focus Mode](../guida/user-guide.md) | I tre passi **Carica / Compila / Chiedi**, wizard e personalizzazione UI. |
| 3 | [Tutorial completo](../guida/tutorial.md) | Interfaccia, workflow in 5 fasi, comandi chat e troubleshooting. |
| 4 | [Avvio e nuovi progetti](../guida/startup.md) | Da una wiki esistente a un progetto da zero. |
| 5 | [Tesi magistrale](../guida/thesis-guide.md) | Dalle fonti al PDF, con il workflow ibrido NotebookLM + Wiki-Forge. |
| 6 | [Pattern LLM Wiki](../standard/karpathy-llm-wiki.md) | Origine filosofica del progetto e confronto con l'addestramento. |
| 7 | [Knowledge Engineering](../processi/knowledge-engineering.md) | Ruoli, maturità L1-L4, use case, ontologie e validazione. |
| 8 | [Specifiche OKF](../standard/okf-spec.md) | Frontmatter, trust tier e indici del formato adottato. |
| 9 | [Schema tipizzato](../standard/schema.md) | Validazione e inferenza dello schema. |
| 10 | [Procedure Engine](../standard/procedures.md) | Schema TOML, DAG, pause umane e criteri di uscita. |
| 11 | [Manuale dell'agente](../processi/agent-manual.md) | Operating manual v3.0 per agenti LLM. |
| 12 | [Migrazione changeset](../processi/migration.md) | Flusso Plan-Review-Apply e proposte `wiki-edit`. |
| 13 | [Wiki di self-documentazione](../standard/self-wiki.md) | Come `docs/` diventa la wiki OKF del progetto. |
| 14 | [Architettura](../architettura/architecture.md) | Topologia, componenti, studio, frontend e vincoli di sviluppo. |
| 15 | [OpenAPI e contratti](../architettura/openapi.md) | Route generate, Swagger self-hosted e manifest dei comandi. |
| 16 | [GraphRAG](../architettura/graph-rag.md) | Grafo semantico, export e pipeline stateful. |
| 17 | [Editor note](../architettura/editor-migration.md) | Adapter CodeMirror/Milkdown, frontmatter e wikilink. |
| 18 | [Comandi slash](slash-commands-reference.md) | Catalogo canonico usato da README, tutorial, help e agente. |
| 19 | [Automazione script](script-automation-reference.md) | Classi di sicurezza e job dei 29 script. |
| 20 | [Manifest comandi](command-manifest.md) | Conteggi generati: non modificare a mano. |
| 21 | [Gestione fonti](sources.md) | Cartelle `sources/`, `backup/` e conversione. |
| 22 | [Changelog](changelog.md) | Storico delle release. |
| 23 | [Roadmap](roadmap.md) | Stato completato e piano dei miglioramenti aperti. |

## Struttura delle cartelle

| Cartella | Contenuto |
|---|---|
| [`guida/`](guida/) | Documenti operativi per utenti e operatori. |
| [`processi/`](processi/) | Manuale agente, Knowledge Engineering, procedure, migrazione. |
| [`standard/`](standard/) | OKF, schema, pattern LLM Wiki, self-wiki. |
| [`architettura/`](architettura/) | Architettura di sistema, API, grafo, editor. |
| [`riferimenti/`](riferimenti/) | Cataloghi generati, changelog, fonti, metriche e mockup. |
| [`help/`](help/) | 19 topic della guida in-app, serviti da `GET /api/help`. |

`riferimenti/METRICS.md` è rigenerato da `wiki_stats.py` tramite `npm test`; è
escluso dalla proiezione wiki per evitare drift continuo.

## Mappa: topic guida in-app ↔ documenti

| Topic (`docs/help/`) | Approfondimento |
|---|---|
| `inizio` | [Focus Mode](../guida/user-guide.md), [Tutorial](../guida/tutorial.md) §2 |
| `barra-alto` | [Tutorial](../guida/tutorial.md) §2 |
| `caricare-documenti` | [Tutorial](../guida/tutorial.md) FASE 2, [Fonti](sources.md) |
| `compilare` | [Tutorial](../guida/tutorial.md) FASE 3, [Tesi](../guida/thesis-guide.md) |
| `chat-comandi` | [Comandi slash](slash-commands-reference.md), [Manuale agente](../processi/agent-manual.md) |
| `viste-grafo` | [Tutorial](../guida/tutorial.md) §2, [GraphRAG](../architettura/graph-rag.md) |
| `modifica-note` | [Focus Mode](../guida/user-guide.md), [Editor](../architettura/editor-migration.md) |
| `review-studio` | [Tutorial](../guida/tutorial.md) §2/§5, [Architettura](../architettura/architecture.md) §3.4 |
| `research-studio` | [Tutorial](../guida/tutorial.md) §2/§5, [Architettura](../architettura/architecture.md) §3.4 |
| `study-studio` | [Tutorial](../guida/tutorial.md) §4, [Architettura](../architettura/architecture.md) §3.4 |
| `stati-okf` | [Specifiche OKF](../standard/okf-spec.md) §3/§6 |
| `studio-sintesi` | [Tutorial](../guida/tutorial.md) FASE 4 |
| `esportare` | [Tutorial](../guida/tutorial.md) FASE 5, [Tesi](../guida/thesis-guide.md) |
| `problematic` | [Tutorial](../guida/tutorial.md) §7 |
| `progetti-config` | [Tutorial](../guida/tutorial.md) FASE 1, [Avvio](../guida/startup.md) |
| `modalita-dev` | [Automazione script](script-automation-reference.md), [Knowledge Engineering](../processi/knowledge-engineering.md) |
| `maturita-metriche` | [Knowledge Engineering](../processi/knowledge-engineering.md) §9, [Metriche](riferimenti/METRICS.md) |
| `wiki-di-wiki-forge` | [Self-wiki](../standard/self-wiki.md), `scripts/docs_to_wiki.py`, [Knowledge Engineering](../processi/knowledge-engineering.md) UC7/UC8 |
| `ui-personalizzazione` | [Focus Mode](../guida/user-guide.md), [OpenAPI](../architettura/openapi.md) route `ui.*` |

## Mockup

I prototipi della Review Studio sono in [`riferimenti/mockups/`](mockups.md):
HTML interattivo e cinque anteprime (Verifica, Critica, Digest, Confronto
versioni e menu contestuale).

## Verifica di coerenza

Con l'ambiente Python di `requirements.txt` attivo, un solo comando esegue
tutti i gate (docs/help, proiezione wiki, manuale, registry, manifest, typecheck,
build, test Node e test Python) e stampa i conteggi aggiornati:

```bash
npm run verify
git diff --check
```
