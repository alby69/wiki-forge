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
| 1 | [Guida operativa](guida/GUIDA_OPERATIVA.md) | Attività, flusso tipico e buone pratiche, senza concetti tecnici. |
| 2 | [Focus Mode](guida/USER_GUIDE.md) | I tre passi **Carica / Compila / Chiedi**, wizard e personalizzazione UI. |
| 3 | [Tutorial completo](guida/TUTORIAL.md) | Interfaccia, workflow in 5 fasi, comandi chat e troubleshooting. |
| 4 | [Avvio e nuovi progetti](guida/STARTUP.md) | Da una wiki esistente a un progetto da zero. |
| 5 | [Tesi magistrale](guida/THESIS_GUIDE.md) | Dalle fonti al PDF, con il workflow ibrido NotebookLM + Wiki-Forge. |
| 6 | [Pattern LLM Wiki](standard/KARPATHY_LLM_WIKI.md) | Origine filosofica del progetto e confronto con l'addestramento. |
| 7 | [Knowledge Engineering](processi/KNOWLEDGE_ENGINEERING.md) | Ruoli, maturità L1-L4, use case, ontologie e validazione. |
| 8 | [Specifiche OKF](standard/OKF_SPEC.md) | Frontmatter, trust tier e indici del formato adottato. |
| 9 | [Schema tipizzato](standard/SCHEMA.md) | Validazione e inferenza dello schema. |
| 10 | [Procedure Engine](processi/PROCEDURES.md) | Schema TOML, DAG, pause umane e criteri di uscita. |
| 11 | [Manuale dell'agente](processi/AGENT.md) | Operating manual v3.0 per agenti LLM. |
| 12 | [Migrazione changeset](processi/MIGRATION.md) | Flusso Plan-Review-Apply e proposte `wiki-edit`. |
| 13 | [Wiki di self-documentazione](standard/SELF_WIKI.md) | Come `docs/` diventa la wiki OKF del progetto. |
| 14 | [Architettura](architettura/ARCHITECTURE.md) | Topologia, componenti, studio, frontend e vincoli di sviluppo. |
| 15 | [OpenAPI e contratti](architettura/OPENAPI.md) | Route generate, Swagger self-hosted e manifest dei comandi. |
| 16 | [GraphRAG](architettura/GRAPH_RAG.md) | Grafo semantico, export e pipeline stateful. |
| 17 | [Editor note](architettura/EDITOR_MIGRATION.md) | Adapter CodeMirror/Milkdown, frontmatter e wikilink. |
| 18 | [Comandi slash](riferimenti/SLASH_COMMANDS_REFERENCE.md) | Catalogo canonico usato da README, tutorial, help e agente. |
| 19 | [Automazione script](riferimenti/SCRIPT_AUTOMATION_REFERENCE.md) | Classi di sicurezza e job dei 29 script. |
| 20 | [Manifest comandi](riferimenti/COMMAND_MANIFEST.md) | Conteggi generati: non modificare a mano. |
| 21 | [Gestione fonti](riferimenti/SOURCES.md) | Cartelle `sources/`, `backup/` e conversione. |
| 22 | [Changelog](riferimenti/CHANGELOG.md) | Storico delle release. |
| 23 | [Roadmap](../ROADMAP.md) | Stato completato e piano dei miglioramenti aperti. |

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
| `inizio` | [Focus Mode](guida/USER_GUIDE.md), [Tutorial](guida/TUTORIAL.md) §2 |
| `barra-alto` | [Tutorial](guida/TUTORIAL.md) §2 |
| `caricare-documenti` | [Tutorial](guida/TUTORIAL.md) FASE 2, [Fonti](riferimenti/SOURCES.md) |
| `compilare` | [Tutorial](guida/TUTORIAL.md) FASE 3, [Tesi](guida/THESIS_GUIDE.md) |
| `chat-comandi` | [Comandi slash](riferimenti/SLASH_COMMANDS_REFERENCE.md), [Manuale agente](processi/AGENT.md) |
| `viste-grafo` | [Tutorial](guida/TUTORIAL.md) §2, [GraphRAG](architettura/GRAPH_RAG.md) |
| `modifica-note` | [Focus Mode](guida/USER_GUIDE.md), [Editor](architettura/EDITOR_MIGRATION.md) |
| `review-studio` | [Tutorial](guida/TUTORIAL.md) §2/§5, [Architettura](architettura/ARCHITECTURE.md) §3.4 |
| `research-studio` | [Tutorial](guida/TUTORIAL.md) §2/§5, [Architettura](architettura/ARCHITECTURE.md) §3.4 |
| `study-studio` | [Tutorial](guida/TUTORIAL.md) §4, [Architettura](architettura/ARCHITECTURE.md) §3.4 |
| `stati-okf` | [Specifiche OKF](standard/OKF_SPEC.md) §3/§6 |
| `studio-sintesi` | [Tutorial](guida/TUTORIAL.md) FASE 4 |
| `esportare` | [Tutorial](guida/TUTORIAL.md) FASE 5, [Tesi](guida/THESIS_GUIDE.md) |
| `problematic` | [Tutorial](guida/TUTORIAL.md) §7 |
| `progetti-config` | [Tutorial](guida/TUTORIAL.md) FASE 1, [Avvio](guida/STARTUP.md) |
| `modalita-dev` | [Automazione script](riferimenti/SCRIPT_AUTOMATION_REFERENCE.md), [Knowledge Engineering](processi/KNOWLEDGE_ENGINEERING.md) |
| `maturita-metriche` | [Knowledge Engineering](processi/KNOWLEDGE_ENGINEERING.md) §9, [Metriche](riferimenti/METRICS.md) |
| `wiki-di-wiki-forge` | [Self-wiki](standard/SELF_WIKI.md), `scripts/docs_to_wiki.py`, [Knowledge Engineering](processi/KNOWLEDGE_ENGINEERING.md) UC7/UC8 |
| `ui-personalizzazione` | [Focus Mode](guida/USER_GUIDE.md), [OpenAPI](architettura/OPENAPI.md) route `ui.*` |

## Mockup

I prototipi della Review Studio sono in [`riferimenti/mockups/`](riferimenti/mockups/README.md):
HTML interattivo e cinque anteprime (Verifica, Critica, Digest, Confronto
versioni e menu contestuale).

## Verifica di coerenza

```bash
python scripts/check_docs_sync.py   # struttura docs/, topic help e parità versionale
python scripts/docs_to_wiki.py --check
make docs-book-check               # dopo `make docs-book`: manuale stampabile aggiornato
npm run manifest:check              # coerenza del manifest generato
npm run typecheck
npm run build
npm test
python -m pytest tests/python
git diff --check
```
