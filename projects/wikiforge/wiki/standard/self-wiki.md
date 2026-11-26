---
type: Reference
title: "Wiki di self-documentazione"
description: "docs/ è la sorgente canonica della documentazione di wiki-forge. Questa"
resource: docs/standard/SELF_WIKI.md
tags: [scope/docs, layer/generated, area/standard, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-26T00:00:00Z"
sources:
  - id: source-docs-standard-self-wiki-md
    resource: docs/standard/SELF_WIKI.md
    title: "Wiki di self-documentazione"
    author: human:alby69
---
# Wiki di self-documentazione

`docs/` è la sorgente canonica della documentazione di wiki-forge. Questa
cartella viene proiettata in una wiki OKF v0.2 dedicata, `projects/wikiforge/wiki/`,
consultabile dal Research Studio con il pulsante **📚 Wiki Docs** (`Ctrl+Alt+W`).
La proiezione è generata, commitata e verificata: nessun job pianificato può
modificare automaticamente `docs/`, il codice o la wiki.

## 1. Principio: sorgente + proiezione

```text
docs/  (sorgente, intoccata)
  └─ scripts/docs_to_wiki.py --check
       └─ projects/wikiforge/wiki/  (bundle OKF generato + layer sintesi curato)
            └─ Research Studio "📚 Wiki Docs" → /api/notes/research/*?projectId=wikiforge
```

Il progetto è dedicato (`wikiforge`). Ogni nota generata mantiene la lingua del
sorgente (`lang/it` o `lang/en`), porta `generated.by: process:docs-to-wiki`,
un `BUILD_STAMP` fisso per l'idempotenza e un `sources[0].resource` che punta al
documento sorgente. I tag includono sempre `scope/docs`, `layer/generated`,
`area/<cartella>` e `lang/it|en`.

`docs/help/*.md` conserva il proprio frontmatter (`id`, `title`, `icon`,
`order`, `group`, `mode`, `keywords`, `context`) richiesto da `GET /api/help` e
verificato da `scripts/check_docs_sync.py`: la proiezione converte i metadati
senza toccare l'originale. `docs/riferimenti/METRICS.md` è escluso perché
rigenerato da `npm test`.

## 2. Tassonomia

| Cartella sorgente | Area OKF | `type` | Contenuto |
|---|---|---|---|
| `docs/guida/` | `guida/` | `Playbook` | Guide operative, tutorial, tesi, avvio |
| `docs/architettura/` | `architettura/` | `Concept` | Architettura, API, grafo, editor |
| `docs/processi/` | `processi/` | `Process` / `Playbook` | Manuale agente, KE, procedure, migrazione |
| `docs/standard/` | `standard/` | `Reference` | OKF, schema, pattern Karpathy, self-wiki |
| `docs/riferimenti/` | `riferimenti/` | `Reference` | Indice, changelog, comandi, help, mockup |
| — | `sintesi/` | `Reference` | Note **curate** da risposte approvate |

La mappatura completa è in `DOC_MAP` in `scripts/docs_to_wiki.py`.

## 3. Regola di proprietà

`build_bundle()` legge solo `docs/`; non legge mai la wiki. Le note in
`sintesi/` e le eventuali note scritte a mano nella wiki sono un livello
utente: non entrano negli indici generati, non vengono sovrascritte o cancellate
da `write_bundle()` e non generano drift. Solo una modifica in `docs/` cambia la
proiezione; per questo il reindex del progetto `wikiforge` è saltato
(`docsManaged: true`).

Le immagini non sono note: i link relativi vengono riscritti come percorsi
assoluti `/docs/riferimenti/mockups/<file>`.

## 4. Salvaguardie

- `auto_apply = false` per ogni job che tocca la documentazione.
- Il job `weekly-docs-wiki-drift` è consultivo con `--check` (rationale e fonti
  obbligatori) e mutante solo dopo approvazione F6.
- La promozione di una risposta a nota `sintesi/` richiede
  `scripts/promote_doc_answer.py` con `--reviewer human:<id>`.
- Il ponte wiki → programma usa due script: `wiki_program_change_propose.py`
  (sola lettura, whitelist dei percorsi, `find` univoco) e
  `wiki_program_change_apply.py` (mutante, hard-blocked, F6-only, con snapshot e
  audit).
- `scripts/check_docs_sync.py` verifica help topic, catalogo slash e parità
  versionale; `scripts/docs_to_wiki.py --check` verifica il bundle.

## 5. Comandi

```bash
python scripts/docs_to_wiki.py                 # rigenera il bundle
python scripts/docs_to_wiki.py --check         # verifica drift (CI)
python scripts/docs_to_wiki.py --json          # output machine-readable
python scripts/okf_lint.py projects/wikiforge/wiki --json
python scripts/docs_wiki_drift.py --check --json  # solo report
python scripts/promote_doc_answer.py --title "..." --question "..." \
    --answer-file ... --reviewer human:<id>
python scripts/wiki_program_change_propose.py --proposal output/program-changes/proposal.json
python scripts/wiki_program_change_apply.py --proposal output/program-changes/proposal.json \
    --reviewer human:<id> --confirm
```
