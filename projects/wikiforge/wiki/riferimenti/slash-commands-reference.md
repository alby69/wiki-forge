---
type: Reference
title: "Catalogo unico dei comandi slash"
description: "Questo documento è la sorgente umana unica dei comandi slash di Wiki-Forge. README.md, TUTORIAL.md, docs/help/chat-comandi.md e l'agente fanno riferimento a…"
resource: docs/SLASH_COMMANDS_REFERENCE.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-slash-commands-reference-md
    resource: docs/SLASH_COMMANDS_REFERENCE.md
    title: "Catalogo unico dei comandi slash"
    author: human:alby69
---
# Catalogo unico dei comandi slash

Questo documento è la **sorgente umana unica** dei comandi slash di Wiki-Forge. `README.md`, `TUTORIAL.md`, `docs/help/chat-comandi.md` e l'agente fanno riferimento a questo file invece di duplicare la tabella.

Il pannello **⚡ Comandi** della chat è generato da `skills/*/SKILL.md`: quando aggiungi o cambi un comando, aggiorna prima lo skill, poi questa tabella e infine esegui `python scripts/check_docs_sync.py --fix` per ricalcolare l'hash dei riferimenti nelle guide in-app.

<!-- DOC_BLOCK:slash-commands -->
| Comando | Categoria | Cosa fa | Equivalente UI / nota |
|---|---|---|---|
| `/compile` | Ingestione | Compila tutte le fonti `raw/` in note OKF della wiki | Pulsante **⚡ Compila** |
| `/convert-only` | Ingestione | Converte i file grezzi senza arricchimento LLM | Pannello **🛠️ Strumenti** |
| `/ingest <file>` | Ingestione | Ingerisce una singola fonte nella cartella scelta | **⚡ Compila** + selezione file |
| `/recompile <file>` | Ingestione | Rielabora una fonte già compilata | Pannello **🛠️ Strumenti** |
| `/new-article <nome>` | Curatela | Crea una nota da template | Solo catalogo/skill:usa **📐 Template** o **➕ Nuovo file** |
| `/merge <a> <b>` | Curatela | Unisce due note sullo stesso argomento | Menu contestuale |
| `/split <nota> <sezione>` | Curatela | Separa una sezione in una nuova nota | Menu contestuale |
| `/stub <concetto>` | Curatela | Crea una nota segnaposto | Menu contestuale |
| `/retag <nota> [+tag]` | Curatela | Aggiunge o aggiorna i tag di una nota | Editor frontmatter |
| `/verify <nota>` (alias `/human-review`) | Curatela | Registra la verifica umana e promuove il trust tier a 🟢 | **🧐 Review Studio → Verifica** |
| `/diff <nota>` | Curatela | Confronta la nota con uno snapshot precedente | **🧐 Review Studio → Confronta versioni** (deterministico) |
| `/audit` | Audit | Controlla link rotti, note orfane e frontmatter | **🛡️ Audit** nei report |
| `/reindex` | Audit | Rigenera gli indici generali e tematici | **🛠️ Strumenti → okf_reindex** |
| `/prune` | Audit | Rimuove bozze e note vuote | Conferma richiesta |
| `/lint-frontmatter` | Audit | Valida la sintassi YAML OKF v0.2 | **🛠️ Strumenti → okf_lint** |
| `/schema-lint` | Audit | Valida le note rispetto allo schema tipizzato | **🛠️ Strumenti → schema_lint** |
| `/schema-infer` | Audit | Propone una configurazione di schema dalla wiki | **🛠️ Strumenti → schema_infer** |
| `/ontology-check` | Audit | Controlla regole ontologiche e coerenza dei link | **🛠️ Strumenti** |
| `/validate-cq` | Audit | Verifica la copertura delle Competency Questions | **🛠️ Strumenti → cq_runner** |
| `/suggest-odp` | Audit | Suggerisce Ontology Design Patterns | **🛠️ Strumenti** |
| `/neuro-check` | Audit | Controllo logico e inferenza di collegamenti concettuali | **🛠️ Strumenti** |
| `/stats` | Audit | Metriche di crescita della wiki | `docs/METRICS.md` |
| `/ke-maturity` | Audit | Valutazione della maturità su 6 dimensioni | **KE Workbench** |
| `/maturity` | Audit | Sintesi L1-L4 della maturità KE | **`GET /api/v1/health`** |
| `/consult <argomento>` | Ricerca | Sintesi multi-fonte con citazioni `[[wikilink]]` | **🔎 Research Studio → Consult** |
| `/search <query>` | Ricerca | Ricerca full-text con numeri di riga | **🔎 Research Studio → Ricerca** |
| `/backlinks <nota>` | Ricerca | Note che citano la nota indicata | **🔎 Research Studio → Backlink** |
| `/related <nota>` | Ricerca | Correlazioni suggerite tra note non collegate | **🔎 Research Studio → Correlate** |
| `/trace <argomento>` | Ricerca | Traccia note e fonti raw di un'affermazione | **🔎 Research Studio → Traccia** |
| `/deep-research <domanda>` | Ricerca | Report esteso con matrice delle fonti | **🔎 Research Studio → Deep Research** |
| `/study-guide [argomento]` | Studio | Guida di studio | **📚 Study Studio → Guida** |
| `/quiz [argomento]` | Studio | Quiz di autovalutazione | **📚 Study Studio → Quiz** |
| `/mindmap [argomento]` | Studio | Mappa concettuale | **📚 Study Studio → Mindmap** |
| `/audio-overview [argomento]` | Studio | Script Host A / Host B | **📚 Study Studio → Audio** |
| `/note <testo>` | Studio | Appunto rapido nello scratchpad | **📚 Study Studio → Note** |
| `/promote-note` | Studio | Promuove un appunto a nota wiki | **📚 Study Studio → Promuovi** |
| `/thesis-chapter` | Studio | Aggrega capitoli e sintesi mature | **📚 Study Studio → Tesi** |
| `/adversarial-review [nota]` | Studio | Revisione critica: contraddizioni e citazioni mancanti | **🧐 Review Studio → Critica** |
| `/digest` | Studio | Riassunto attività e salute della wiki | **🧐 Review Studio → Digest** (deterministico) |
| `/slides [capitoli]` (alias `/generate-slides`) | Studio | Presentazione reveal.js dai capitoli | **🛠️ Strumenti → slides** |
| `/export-semantic` | Knowledge Engineering | Export W3C JSON-LD e Turtle | **🛠️ Strumenti → export_semantic** |
| `/tag-suggest <nota>` | Knowledge Engineering | Suggerisce tag per una nota | **🛠️ Strumenti → suggest_tags** |
| `/sources regenerate` | Utility | Rigenera il registro bibliografico | Forma breve: `/sources` |
| `/template show` | Utility | Mostra il template standard | Solo catalogo/skill:nessun handler chat |
| `/export` | Utility | Esporta la struttura della wiki | Menu **⋯** |
| `/wizard [scenario]` | Utility | Scenari guidati di onboarding | **🧙 Wizard** |
| `/help [argomento]` | Utility | Guida in-app in testo | Pannello **?** / tasto **F1** |
| `/skill` | Utility | Scanner interattivo degli skill | **🛠️ Strumenti → Skill Scanner** |
| `/apply` (alias `/applica`) | Utility | Applica una proposta di modifica dalla chat | Pulsante **Applica modifica** |
<!-- /DOC_BLOCK:slash-commands -->

## Convenzioni

- I comandi marked **solo catalogo/skill** sono dichiarati negli skill ma non hanno un handler nel router chat: usare l'equivalente grafico indicato.
- `/verify` e `/human-review` sono alias dello stesso comando; `/slides` e `/generate-slides` sono alias; `/apply` e `/applica` sono alias.
- I sei comandi di ricerca aprono la scheda corrispondente della Research Studio con la query già compilata.
- I comandi di studio usano gli stessi generatori deterministici della Study Studio.

## Comandi pianificati

`/rollback` e `/history` **non sono implementati** come comandi chat. Lo storico e il ripristino sono disponibili solo dalla UI (🕐 Cronologia e Review Studio). Gli eventuali comandi chat sono elencati in [`ROADMAP.md`](roadmap.md) nella sezione *Comandi chat pianificati*.
