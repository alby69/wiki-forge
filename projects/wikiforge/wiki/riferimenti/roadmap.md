---
type: Reference
title: "ROADMAP — Wiki-Forge v4.1"
description: "Questo è l'unico piano di miglioramento del repository. La cronologia delle"
resource: ROADMAP.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-26T00:00:00Z"
sources:
  - id: source-roadmap-md
    resource: ROADMAP.md
    title: "ROADMAP — Wiki-Forge v4.1"
    author: human:alby69
---
# ROADMAP — Wiki-Forge v4.1

Questo è l'unico piano di miglioramento del repository. La cronologia delle
fasi 0–89 è chiusa e consultabile nel
[changelog](changelog.md); i vecchi piani di implementazione
sono stati accorpati in [architettura](../architettura/architecture.md),
[Knowledge Engineering](../processi/knowledge-engineering.md) e
[self-wiki](../standard/self-wiki.md).

## Stato completato

| Area | Stato | riferimento |
|---|---|---|
| Fondamenta, ingestione, OKF v0.2, multi-progetto | ✅ | [Guida operativa](../guida/guida-operativa.md) |
| Web UI, Focus Mode, wizard, Study/Review/Research Studio | ✅ | [Tutorial](../guida/tutorial.md) |
| Tesi dinamica e PDF stampabile | ✅ | [Tesi magistrale](../guida/thesis-guide.md) |
| Knowledge Engineering L1-L4, ontologie, CQ, GraphRAG | ✅ | [KE](../processi/knowledge-engineering.md) |
| Disaccoppiamento contratto/bus/adapter, RBAC, produzione | ✅ | [Architettura](../architettura/architecture.md) |
| Agenti schedulati, Policy Agent F5/F6, automazione script | ✅ | [Automazione](script-automation-reference.md) |
| `docs/` come wiki OKF del progetto `wikiforge` | ✅ | [Self-wiki](../standard/self-wiki.md) |
| Documentazione tematica e manuale stampabile | ✅ | [Indice didattico](docs-readme.md) |
| Unificazione radici di stato in `.wiki-forge/` con migrazione | ✅ | [Architettura](../architettura/architecture.md) |
| Drift advisory `docs/` ↔ wiki nei log dello scheduler | ✅ | [KE](../processi/knowledge-engineering.md) |
| `/history` e `/rollback` come funzionalità fantasma | ✅ | [Catalogo comandi](slash-commands-reference.md) |
| Claim local/cloud e hook backup inerte | ✅ | [Guida operativa](../guida/guida-operativa.md) |
| Scorciatoie e registro azioni dell'editor | ✅ | [Barra alto](help-barra-alto.md) |
| Comando unico di verifica e numeri aggiornati | ✅ | [Verifica di coerenza](docs-readme.md) |
| Valutazione OKF upstream v0.3 | ✅ | [OKF spec](../standard/okf-spec.md) |
| A10: E2E Playwright e soglie di copertura CI | ✅ | `.github/workflows/test.yml` |
| Motore di reasoning SLM locale CPU-only con SSE `<think>` | ✅ | [Architettura](../architettura/architecture.md) |
| Upload GGUF chunked e attivazione locale dalla Config UI | ✅ | [Guida utente](../guida/user-guide.md) |

Baseline verificata: **110 route HTTP**, **163 handler bus** in 20 moduli,
**51 comandi slash / 20 con caso dedicato**, **118 tool MCP**, **32 gap noti**,
zero gap `route-without-bus`. `npm run manifest:check` applica l'invariante.
Verifica corrente: `npm run verify` con venv Python da `requirements.txt`
esegue docs/wiki/registry/manifest, typecheck, build, `npm test` 602/602, pytest
168/168, E2E Playwright 1/1 e gate copertura `scripts/` 26% (soglia 24%) e
`semantics/` 64% (soglia 64%).
`git diff --check` resta verde.

La documentazione è stata riorganizzata in cinque cartelle tematiche e il
percorso didattico ha una scorciatoia coerente: `Ctrl+Alt+W` apre **Wiki Docs**,
mentre `Ctrl+Alt+D` resta **Digest** nella Review Studio.

## Legenda

✅ completato · 🔄 in corso · ⬜ da fare. Le voci completate confluiscono nella
tabella "Stato completato"; i gate restano documentati in "Verifica di coerenza"
di [`docs/README.md`](docs-readme.md).
