# ROADMAP — Wiki-Forge v4.1

Questo è l'unico piano di miglioramento del repository. La cronologia delle
fasi 0–89 è chiusa e consultabile nel
[changelog](docs/riferimenti/CHANGELOG.md); i vecchi piani di implementazione
sono stati accorpati in [architettura](docs/architettura/ARCHITECTURE.md),
[Knowledge Engineering](docs/processi/KNOWLEDGE_ENGINEERING.md) e
[self-wiki](docs/standard/SELF_WIKI.md).

## Stato completato

| Area | Stato | riferimento |
|---|---|---|
| Fondamenta, ingestione, OKF v0.2, multi-progetto | ✅ | [Guida operativa](docs/guida/GUIDA_OPERATIVA.md) |
| Web UI, Focus Mode, wizard, Study/Review/Research Studio | ✅ | [Tutorial](docs/guida/TUTORIAL.md) |
| Tesi dinamica e PDF stampabile | ✅ | [Tesi magistrale](docs/guida/THESIS_GUIDE.md) |
| Knowledge Engineering L1-L4, ontologie, CQ, GraphRAG | ✅ | [KE](docs/processi/KNOWLEDGE_ENGINEERING.md) |
| Disaccoppiamento contratto/bus/adapter, RBAC, produzione | ✅ | [Architettura](docs/architettura/ARCHITECTURE.md) |
| Agenti schedulati, Policy Agent F5/F6, automazione script | ✅ | [Automazione](docs/riferimenti/SCRIPT_AUTOMATION_REFERENCE.md) |
| `docs/` come wiki OKF del progetto `wikiforge` | ✅ | [Self-wiki](docs/standard/SELF_WIKI.md) |
| Documentazione tematica e manuale stampabile | ✅ | [Indice didattico](docs/README.md) |
| Confine tra radici di stato `.wikiforge/` e `.wiki-forge/` | ✅ | [Architettura](docs/architettura/ARCHITECTURE.md) |
| Drift advisory `docs/` ↔ wiki nei log dello scheduler | ✅ | [KE](docs/processi/KNOWLEDGE_ENGINEERING.md) |
| `/history` e `/rollback` come funzionalità fantasma | ✅ | [Catalogo comandi](docs/riferimenti/SLASH_COMMANDS_REFERENCE.md) |
| Claim local/cloud e hook backup inerte | ✅ | [Guida operativa](docs/guida/GUIDA_OPERATIVA.md) |
| Scorciatoie e registro azioni dell'editor | ✅ | [Barra alto](docs/help/barra-alto.md) |
| Comando unico di verifica e numeri aggiornati | ✅ | [Verifica di coerenza](docs/README.md) |
| Valutazione OKF upstream v0.3 | ✅ | [OKF spec](docs/standard/OKF_SPEC.md) |

Baseline verificata: **105 route HTTP**, **158 handler bus** in 20 moduli,
**51 comandi slash / 20 con caso dedicato**, **113 tool MCP**, **32 gap noti**,
zero gap `route-without-bus`. `npm run manifest:check` applica l'invariante.
Verifica corrente: `npm run verify` con venv Python da `requirements.txt`
esegue `npm test` 595/595, pytest 161/161, docs/wiki/registry/manifest,
typecheck e build; `git diff --check` resta verde.

La documentazione è stata riorganizzata in cinque cartelle tematiche e il
percorso didattico ha una scorciatoia coerente: `Ctrl+Alt+W` apre **Wiki Docs**,
mentre `Ctrl+Alt+D` resta **Digest** nella Review Studio.

## Piano di miglioramento

### P0 — Qualità e gate

1. **Chiudere A10: E2E e soglie di copertura in CI**
   - Aggiungere un percorso Playwright sul flusso Carica → Compila → Chiedi e
     soglie minime di copertura per `scripts/` e `src/backend/wikiforge/semantics`.
   - *Accettazione*: `.github/workflows/test.yml` esegue E2E e fallisce sotto
     soglia; il report è allegato come artifact.

### P1 — Manutenzione e standard

1. **Unificare `.wikiforge/` e `.wiki-forge/`**
   - Decisione attuale: mantenere il confine, ora coperto da test e controllo
     docs. Le due radici contengono cicli di vita diversi, non lo stesso dato.
     Un'eventuale unificazione va fatta come progetto separato con dual-read e
     single-write, backup, snapshot e rollback; non con uno spostamento delle
     directory.
   - *Accettazione*: una sola radice di stato per Node e Python, con test di
     migrazione e istruzioni per i vault esistenti.

## Legenda

✅ completato · 🔄 in corso · ⬜ da fare. Le voci completate confluiscono nella
tabella "Stato completato"; i gate restano documentati in "Verifica di coerenza"
di [`docs/README.md`](docs/README.md).
