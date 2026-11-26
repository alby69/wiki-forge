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

Baseline verificata: **105 route HTTP**, **158 handler bus** in 20 moduli,
**51 comandi slash / 20 con caso dedicato**, **113 tool MCP**, **32 gap noti**,
zero gap `route-without-bus`. `npm run manifest:check` applica l'invariante.
Verifica storica: `npm test` 593/593 con venv Python da `requirements.txt`,
pytest semantico 6/6, typecheck, build, compose e `git diff --check` verdi.

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

2. **Bloccare il confine tra le due radici di stato**
   - Il motore Python (`src/backend/wikiforge/api/health.py`) scrive health in
     `.wikiforge/`, mentre il runtime Node usa `.wiki-forge/` per stato, lock,
     snapshot e changeset. La documentazione ora dichiara esplicitamente il
     confine; resta da impedire che un futuro refactor lo confonda di nuovo.
   - *Accettazione*: test di regressione che verifichino `.wikiforge/STATUS.md`,
     `.wikiforge/metrics/history.jsonl` e `.wiki-forge/state/` come percorsi
     distinti, più un controllo docs che fallisca se i documenti tornano a
     descrivere una radice unica.

### P1 — Funzionalità e coerenza

3. **Parità chat/UI per cronologia e rollback**
   - La UI espone già `VersionTimeline` e il ripristino dagli snapshot; i
     comandi `/history` e `/rollback` restano da allineare.
   - *Accettazione*: i comandi usano lo stesso snapshot store e producono lo
     stesso audit di **Confronta versioni**; help topic aggiornato.

4. **Drift advisory `docs/` ↔ wiki più esplicito**
   - `docs_to_wiki.py --check` già rileva il drift; rendere il report consultivo
     più leggibile nei log del job `weekly-docs-wiki-drift`.
   - *Accettazione*: il report elenca sorgente, nota generata e motivazione,
     senza mutare nulla senza F6.

5. **Rivedere i claim “local/cloud” nella documentazione**
   - Verificare gli hook di backup configurati rispetto a quanto descritto
     nella sezione enterprise della documentazione.
   - *Accettazione*: testo e configurazione concordano; nessuna funzionalità
     presentata come disponibile se è solo un hook inerte.

### P2 — Manutenzione e standard

6. **Unificare `.wikiforge/` e `.wiki-forge/`**
   - `.wiki-forge/` è la radice attiva; `.wikiforge/` è storica ma ancora usata
     dal motore Python. Valutare migrazione con snapshot e rollback.
   - *Accettazione*: una sola radice di stato per Node e Python, con test di
     migrazione e istruzioni per i vault esistenti.

7. **Valutare OKF upstream v0.3**
   - La specifica locale è v0.2 e il repository upstream ha pubblicato v0.3.
   - *Accettazione*: tabella di compatibilità e decisione documentata
     (adozione, adattamento o mantenimento di v0.2).

8. **Rinfrescare numeri e claim dei test**
   - I conteggi 593/593 e 6/6 sono la baseline verificata dopo il
     disaccoppiamento; qualsiasi nuova suite deve aggiornare README e roadmap.
   - *Accettazione*: un solo comando (documentato) produce i numeri citati.

9. **Scorciatoie dell'editor: documentazione e registro**
    - Verificare che l'header mostri solo Info, Revisione e Cronologia e che le
      studio siano globali.
    - *Accettazione*: guida in-app, `actions.ts` e test DOM allineati.

## Legenda

✅ completato · 🔄 in corso · ⬜ da fare. Le voci completate confluiscono nella
tabella "Stato completato"; i gate restano documentati in "Verifica di coerenza"
di [`docs/README.md`](docs/README.md).
