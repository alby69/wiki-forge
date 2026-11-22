# Catalogo sicurezza e automazione degli script

> **AUTO-GENERATO** da `python scripts/gen_script_registry.py`. Fonte: `src/backend/wikiforge/core/script_schema.py`. Non modificare a mano.

Questo è il catalogo unico usato dal Policy Agent F5, dalla coda F6, dal pannello Script Control Panel e dalla tab **🤖 Agenti & Schedule**. Le classi `workspace`, `wiki-write` e `blocked` non vengono mai eseguite automaticamente: i job corrispondenti restano disabilitati finché una persona non li approva esplicitamente.

<!-- DOC_BLOCK:script-automation -->
### Wizard

| Script | Safety | Schedulabile | Default | Orario suggerito | Override arg | Requisiti | Note |
|---|---|---|---|---|---|---|---|
| `wizard` | 🔴 blocked — mai automatico | no | no | `—` | — | tty | Interattivo: non schedulabile. |

### Ingestion

| Script | Safety | Schedulabile | Default | Orario suggerito | Override arg | Requisiti | Note |
|---|---|---|---|---|---|---|---|
| `clip2md` | 🟡 workspace — scrive in `raw/`, `sources/` o `docs/` | sì | no (F6) | `0 1 * * 0` | — | network | Scarica URL esterni e scrive in sources/web-clips/. |
| `conv2md` | 🟡 workspace — scrive in `raw/`, `sources/` o `docs/` | sì | no (F6) | `0 1 * * *` | — | — | Scrive in raw/: abilitare solo con approvazione F6. |
| `enrich_cot` | 🟠 wiki-write — scrive nella wiki | sì | no (F6) | `0 2 * * *` | — | llm | Scrive note nella wiki: sempre F6. |
| `notebooklm_import` | 🟡 workspace — scrive in `raw/`, `sources/` o `docs/` | sì | no (F6) | `10 1 * * 0` | — | — | Crea note in raw/ da export NotebookLM. |
| `voice_ingest` | 🟡 workspace — scrive in `raw/`, `sources/` o `docs/` | sì | no (F6) | `20 1 * * 0` | — | — | Crea note da audio/trascrizioni in raw/. |

### OKF Maintenance

| Script | Safety | Schedulabile | Default | Orario suggerito | Override arg | Requisiti | Note |
|---|---|---|---|---|---|---|---|
| `migrate_to_okf` | 🔴 blocked — mai automatico | no | no | `—` | — | — | Migrazione irreversibile del frontmatter: solo manuale. |
| `okf_lint` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `0 2 * * *` | — | — | Valida frontmatter e bundle OKF v0.2. |
| `okf_log` | 🟠 wiki-write — scrive nella wiki | sì | no (F6) | `0 6 * * *` | — | — | Accoda a wiki/log.md: richiede F6. Args: `{"type": "Update"}` |
| `okf_reindex` | 🟠 wiki-write — scrive nella wiki | sì | no (F6) | `10 6 * * *` | — | — | Rigenera wiki/index.md e indici tematici: richiede F6. |
| `okf_stats` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `10 2 * * *` | — | — | Report statistiche OKF. |

### Analysis & Metrics

| Script | Safety | Schedulabile | Default | Orario suggerito | Override arg | Requisiti | Note |
|---|---|---|---|---|---|---|---|
| `check_docs_sync` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `0 6 * * 1` | fix=true → workspace | — | Con --fix riscrive docs/help/: in quel caso diventa workspace. |
| `graph_analytics` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `0 2 * * 0` | — | — | Analisi Louvain in sola lettura. |
| `maturity_calculator` | 🟠 wiki-write — scrive nella wiki | sì | no (F6) | `30 6 * * 1` | write=true → wiki-write | — | Con --write modifica il frontmatter: richiede F6. Args: `{"path": "wiki"}` |
| `wiki_stats` | 🟡 workspace — scrive in `raw/`, `sources/` o `docs/` | sì | no (F6) | `20 6 * * 1` | — | — | Aggiorna docs/METRICS.md: richiede F6. |

### Taxonomy

| Script | Safety | Schedulabile | Default | Orario suggerito | Override arg | Requisiti | Note |
|---|---|---|---|---|---|---|---|
| `suggest_tags` | 🟠 wiki-write — scrive nella wiki | sì | no (F6) | `40 6 * * 1` | write=true → wiki-write | — | Con --write modifica il frontmatter: richiede F6. Args: `{"all": true, "wiki": "wiki"}` |

### Thesis & Study

| Script | Safety | Schedulabile | Default | Orario suggerito | Override arg | Requisiti | Note |
|---|---|---|---|---|---|---|---|
| `export_thesis_pdf` | 🔵 report — scrive solo in `output/` | sì | sì | `30 4 * * 0` | — | pandoc | Scrive output/thesis_final.pdf via Pandoc. |
| `generate_thesis` | 🔵 report — scrive solo in `output/` | sì | sì | `0 4 * * 0` | — | — | Scrive output/thesis_compiled.md. |

### Knowledge Engineering

| Script | Safety | Schedulabile | Default | Orario suggerito | Override arg | Requisiti | Note |
|---|---|---|---|---|---|---|---|
| `cq_validator` | 🔵 report — scrive solo in `output/` | sì | sì | `0 3 * * 1` | — | — | Scrive output/cq_validation_report.md. |
| `docs_wiki_drift` | 🟠 wiki-write — scrive nella wiki | sì | no (F6) | `0 7 * * 1` | check=true → read-only | — | Senza --check riscrive la proiezione OKF: richiede F6. Con --check diventa read-only. Args: `{"docs_dir": "docs", "wiki_dir": "projects/wikiforge/wiki"}` |
| `export_semantic` | 🔵 report — scrive solo in `output/` | sì | sì | `0 3 * * 0` | — | — | Esporta RDF in output/. |
| `ke_maturity` | 🔵 report — scrive solo in `output/` | sì | sì | `40 3 * * 1` | — | — | Scrive output/ke_maturity_report.md. |
| `neuro_symbolic_check` | 🔵 report — scrive solo in `output/` | sì | sì | `20 3 * * 1` | — | llm | Scrive output/neuro_symbolic_report.md. |
| `odp_suggester` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `50 2 * * *` | — | — | Suggerisce ODP senza scrivere. |
| `ontology_rules` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `40 2 * * *` | — | — | Controlla cicli e coerenza ontologica. |
| `schema_infer` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `20 2 * * *` | — | — | Propone uno schema senza scrivere. |
| `schema_lint` | 🟢 read-only — nessuna scrittura rilevante | sì | sì | `30 2 * * *` | — | — | Valida le note rispetto a config.toml. |
| `wiki_program_change_apply` | 🔴 blocked — mai automatico | no | no | `—` | — | — | Solo F6: richiede --reviewer e --confirm iniettati dal server. |
| `wiki_program_change_propose` | 🔵 report — scrive solo in `output/` | sì | sì | `30 7 * * 1` | — | — | Accoda la proposta in output/program-changes/. |
<!-- /DOC_BLOCK:script-automation -->

## Convenzioni

- **Schedulabile = no**: script interattivi o irreversibili, eseguibili solo dal pannello.
- **Default = no (F6)**: il job può essere creato, ma nasce disabilitato e ogni esecuzione mutante passa dalla coda di approvazione.
- `requires` indica dipendenze esterne (`llm`, `network`, `pandoc`, `tty`).
- `Args` sono gli argomenti precompilati dal catalogo; il parser dei job li valida contro i parametri dichiarati nello schema.
- **Override arg**: quando gli argomenti risolti soddisfano la condizione, la classe di sicurezza cambia (es. `docs_wiki_drift --check` diventa `read-only`). Il Policy Agent F5 classifica sempre l'invocazione effettiva.
- **A1 — `--findings` (sola lettura)**: `okf_lint`, `graph_analytics`, `odp_suggester` e `cq_validator` accettano un flag additivo `--findings` che stampa su stdout un envelope unico `{"schema": "wikiforge.finding/v1", "count": N, "findings": [...]}`. Ogni finding ha `findingId`, `kind`, `confidence`, `evidence`, `targetPath` e `proposedAction`; gli ID sono deterministici (`<kind>-<slug>-<hash(evidence)>`). La modalità non scrive alcun file: anche per `cq_validator` il report `output/cq_validation_report.md` non viene generato. Il modello condiviso risiede in `src/backend/wikiforge/core/findings.py` ed è importato in modo lazy solo quando il flag è presente, così i percorsi legacy restano invariati anche negli embedder che copiano solo `scripts/`. `--json` e l'output testuale restano byte-identici.
