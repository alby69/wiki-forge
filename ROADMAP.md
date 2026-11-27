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
| Unificazione radici di stato in `.wiki-forge/` con migrazione | ✅ | [Architettura](docs/architettura/ARCHITECTURE.md) |
| Drift advisory `docs/` ↔ wiki nei log dello scheduler | ✅ | [KE](docs/processi/KNOWLEDGE_ENGINEERING.md) |
| `/history` e `/rollback` come funzionalità fantasma | ✅ | [Catalogo comandi](docs/riferimenti/SLASH_COMMANDS_REFERENCE.md) |
| Claim local/cloud e hook backup inerte | ✅ | [Guida operativa](docs/guida/GUIDA_OPERATIVA.md) |
| Scorciatoie e registro azioni dell'editor | ✅ | [Barra alto](docs/help/barra-alto.md) |
| Comando unico di verifica e numeri aggiornati | ✅ | [Verifica di coerenza](docs/README.md) |
| Valutazione OKF upstream v0.3 | ✅ | [OKF spec](docs/standard/OKF_SPEC.md) |
| A10: E2E Playwright e soglie di copertura CI | ✅ | `.github/workflows/test.yml` |
| Motore di reasoning SLM locale CPU-only con SSE `<think>` | ✅ | [Architettura](docs/architettura/ARCHITECTURE.md) |
| Upload GGUF chunked, attivazione e disattivazione locale dalla Config UI | ✅ | [Guida utente](docs/guida/USER_GUIDE.md) |

Baseline verificata: **112 route HTTP**, **166 handler bus** in 20 moduli,
**52 comandi slash / 21 con caso dedicato**, **120 tool MCP**, **32 gap noti**,
zero gap `route-without-bus`. `npm run manifest:check` applica l'invariante.
Verifica corrente: `npm run verify` con venv Python da `requirements.txt`
esegue docs/wiki/registry/manifest, typecheck, build, `npm test` 604/604, pytest
168/168, E2E Playwright 1/1 e gate copertura `scripts/` 26% (soglia 24%) e
`semantics/` 64% (soglia 64%).
`git diff --check` resta verde.

La documentazione è stata riorganizzata in cinque cartelle tematiche e il
percorso didattico ha una scorciatoia coerente: `Ctrl+Alt+W` apre **Wiki Docs**,
mentre `Ctrl+Alt+D` resta **Digest** nella Review Studio.

## Legenda

✅ completato · 🔄 in corso · ⬜ da fare. Le voci completate confluiscono nella
tabella "Stato completato"; i gate restano documentati in "Verifica di coerenza"
di [`docs/README.md`](docs/README.md).

## Progress dashboard

| # | Phase | Status | Notes |
|---|---|---|---|
| 90 | Allineamento documentale e ROADMAP veritiera | ✅ | Completata: metriche generate e docs allineati; la specifica numerava 29–43, mappati 1:1 su 90–104. |
| 91 | Quality gate CI completo e supply chain | ✅ | Completata: `ci.yml` esegue `npm run verify` (matrice 2×2), gate TS 88.50%, `git diff --check`, security workflow e badge README. |
| 92 | Chiusura migrazione stato e rimozione fallback `.wikiforge/` | ✅ | Completata: fallback rimosso, `--status` in `entrypoint.sh`, fixture v3 con SHA256 pre/post e rollback. |
| 93 | Contratto unico Node↔Python | ✅ | Completata: OpenAPI FastAPI esportato, client TS generato, frame SSE/JSON-lines tipizzati e gate `python-contract:check`. |
| 94 | Retrieval ibrido e valutazione misurabile | ✅ | Completata: 50 domande IT/EN, BM25+RRF+grafo, embeddings off di default, `eval:check` nel gate. |
| 95 | Provenienza per affermazione e verifica delle citazioni | ✅ | Ancore `[^src:ID#Lx-Ly]`, gate L4/stable, `/verify-citations`, scheda Review Studio, export PROV-O. |
| 96 | Sicurezza dei contenuti non fidati e prompt injection | ⬜ | Sanitizzazione HTML presente; marcatura `untrusted` e confine esplicito nei prompt assenti. |
| 97 | Osservabilità LLM, costi e quote | ⬜ | `/api/metrics` esiste; token, costi e budget non misurati. |
| 98 | Collaborazione multi-utente | ⬜ | SSE e RBAC opt-in presenti; ETag `If-Match` e merge a tre vie assenti. |
| 99 | Pubblicazione e interoperabilità accademica | ⬜ | PDF presente; BibTeX/CSL, DOCX ed export statico non presenti. |
| 100 | Pack di dominio (verticali) | ⬜ | Nessun pack installabile presente. |
| 101 | Accessibilità, UX e wizard persistente | ⬜ | Stato wizard lato server presente; ripresa UI dopo reload e audit WCAG assenti. |
| 102 | Scalabilità e prestazioni | ⬜ | Nessun benchmark 1k/10k/50k note dichiarato. |
| 103 | Release, distribuzione e comunità | ⬜ | Nessuna release/tag; `src-tauri/` ed `extension/` sono prototipi non pubblicati. |
| 104 | Burn-down dei gap del manifest e copertura comandi | ⬜ | 32 gap noti, 51 comandi catalogati e 21 con case dedicato. |

Le fasi 90–104 corrispondono alle fasi 29–43 del documento di specifica: la
rinumerazione è necessaria perché l'introduzione dichiara chiuse le fasi 0–89.
Ogni fase richiede branch `phase-NN-slug`, PR separata, test, documentazione,
CHANGELOG e rigenerazione degli artefatti; il passaggio a ✅ richiede criteri di
accettazione verificati e `npm run verify` verde.

## Phase 90 — Allineamento documentale e ROADMAP veritiera ✅ Done

**Goal:** Far dire al progetto la verità su se stesso, sempre, senza intervento manuale.

**Deliverables:**
- Backfill delle funzionalità v4.x già esistenti ma non tracciate (Health & Maturity API, Procedure Engine, Safe Vault/Changeset, Review/Research/Study Studio, Live Sync/ETag, API Contract Layer, bus kernel/moduli/porte, hardening di produzione, SLM locale + registro GGUF, wizard stateful).
- Script `scripts/gen_doc_metrics.py` che legge il manifest generato e produce un blocco di metriche iniettato tra `<!-- metrics:start -->` e `<!-- metrics:end -->` in `README.md` e `docs/architettura/ARCHITECTURE.md`.
- `check_docs_sync.py` esteso: fallisce se i numeri in prosa differiscono dal manifest.
- Descrizione e topic GitHub proposti in `docs/riferimenti/REPO_METADATA.md`.
- Sezione README "Stato dei componenti" che dichiara `src-tauri/` ed `extension/` sperimentali.

**Criteri di accettazione:**
- Zero discrepanze numeriche tra README, ARCHITECTURE e manifest; `check_docs_sync.py` lo verifica in CI.
- La ROADMAP elenca ogni fase con stato coerente con i test.

## Phase 91 — Quality gate CI completo e supply chain ✅ Done

**Goal:** Nessuna modifica entra in `main` senza passare gli stessi controlli che eseguirebbe uno sviluppatore scrupoloso.

**Deliverables:**
- Workflow GitHub Actions `ci.yml` che esegue `npm run verify` con matrice Node 20/22 e Python 3.11/3.12.
- Job Playwright separato (smoke e2e: avvio, apertura nota, salvataggio con ETag, chat con provider mock, apertura dei tre Studio).
- Soglie di copertura TS e Python non decrescenti, con report.
- CodeQL, `npm audit` / `pip-audit`, gitleaks, Dependabot, SBOM CycloneDX, build Docker con `hadolint` e Trivy.
- `CODEOWNERS`, `SECURITY.md`, template di issue/PR e badge CI nel README.

**Criteri di accettazione:**
- Una PR con test rotto, manifest non sincronizzato o segreto committato fallisce.

## Phase 92 — Chiusura migrazione stato e rimozione fallback `.wikiforge/` ✅ Done

**Goal:** Una sola cartella di stato, nessun comportamento "dipende da quale esiste".

**Deliverables:**
- `scripts/migrate_state_roots.py --status` eseguito in `entrypoint.sh` con avviso se esiste ancora `.wikiforge/`.
- Finestra di deprecazione di una release minor, poi rimozione del fallback in lettura Node e Python.
- Test di migrazione e rollback su vault di esempio anonimizzati; pulizia di `.gitignore`/`.dockerignore` e dei documenti che citano la vecchia radice.

**Criteri di accettazione:**
- `grep -rn "\.wikiforge/" src bin scripts --exclude-dir=__pycache__` non trova usi funzionali della vecchia radice, solo la migrazione.
- Un vault v3 si migra senza perdita (confronto SHA256 pre/post).

## Phase 93 — Contratto unico Node↔Python ✅ Done

**Goal:** Far sì che cambiare il servizio Python in modo incompatibile sia impossibile senza che i test lo notino.

**Deliverables:**
- Esportazione dell'OpenAPI FastAPI in `src/shared/api/generated/python.openapi.json` tramite `scripts/export_python_openapi.py` e client TS tipizzato generato.
- Tutte le chiamate Node→Python passano da quel client; il proxy `/api/v1/graph/*` usa i tipi generati.
- Schema tipizzato dei frame SSE del reasoning e del protocollo JSON-lines di `LlamaCppClient`, con test di contratto da entrambi i lati.
- Controllo CI `python-contract:check`.

**Criteri di accettazione:**
- Rinominare un campo in una risposta FastAPI fa fallire `npm run typecheck` o `python-contract:check`.
- Nessun `fetch`/`spawn` verso Python fuori dal client generato.

## Phase 94 — Retrieval ibrido e valutazione misurabile ✅ Done

**Goal:** Trovare le note giuste in modo affidabile e dimostrarlo con numeri.

**Deliverables:**
- Harness `tests/eval/` con almeno 50 domande d'oro IT+EN, `recall@5`, `MRR`, precisione delle citazioni e tasso di "non so" corretti.
- Indice BM25 incrementale aggiornato dai salvataggi; livello semantico opzionale (`[retrieval.embeddings].enabled=false`) con vettori su disco.
- Fusione RRF con espansione a 1 salto sul grafo; `/consult`, `/search`, `/related` e Deep Research dietro la porta `Retriever` con fallback deterministico.
- Report in `.wiki-forge/health/eval/` riassunto nel Health Score.

**Criteri di accettazione:**
- Il retriever ibrido supera la baseline di un margine fissato nel test; la CI fallisce in caso di regressione.
- Con embeddings disabilitati tutto funziona senza dipendenze nuove.

## Phase 95 — Provenienza per affermazione e verifica delle citazioni ✅ Done

**Goal:** Far sì che ogni frase importante di una nota stabile riconduca al punto esatto della fonte.

**Deliverables:**
- Estensione compatibile OKF con ancore `[^src:ID#L12-L18]`, documentata in `docs/standard/OKF_EXTENSIONS.md`.
- Comando `/verify-citations [nota|cartella]` e scheda Verifica in Review Studio: esistenza fonte, righe, hash, ancore orfane e affermazioni senza ancora.
- Verifica semantica opzionale consultiva (`supported / partial / unsupported`).
- Gate L4/`stable` con zero ancore orfane e copertura minima configurabile; export PROV-O via `BaseGraphExporter`.

**Criteri di accettazione:**
- Una nota `stable` con ancora a righe cancellate non può essere marcata verificata.
- Test su ancora valida, fonte modificata e riga inesistente.

**Done:**
- Nuovo `src/shared/domain/citations.ts`: parser di ancore e `sources:`, `claimStats`, `evaluateCitations` (orphan / missing-source / range / hash), `claimForAnchor`; report deterministico con coverage.
- Gate in `recordHumanVerification`: blocca sempre su ancore orfane/fonti mancanti/range; su `setStable` blocca anche coverage sotto `WIKIFORGE_CITATION_MIN_COVERAGE` e hash mismatch; `applyVerification` scrive i baseline `sha256:` nelle fonti.
- Route `review.citations` + slash `/verify-citations` + scheda "Citazioni OKF" in Review Studio; `ApiStorage.checkCitations`; `executeVerifyCitationsWorkflow` per nota o cartella (≤50) con report markdown; verdict LLM opzionale (max 8 ancore, advisory).
- Nuovo `src/backend/wikiforge/semantics/prov_exporter.py` (`ProvGraphExporter`) ed `scripts/export_prov.py`: nota come `prov:Entity`, ogni ancora come span derivato (`prov:wasDerivedFrom`, `wf:lineAnchor/startLine/endLine/sourceSha256`), ogni `verified:` come `prov:Activity` (`prov:wasGeneratedBy`, `prov:wasAssociatedWith`); output `output/prov_export.ttl` e `.jsonld`.
- Nuovo `docs/standard/OKF_EXTENSIONS.md`; `docs/README.md` lo indicizza; `docs_to_wiki.py` / `docs_book.py` rigenerati.
- Test: `tests/citations.test.ts` (5 casi) e `tests/python/test_prov_exporter.py` (4 casi). Manifest rigenerato: 112 route, 166 handler bus, 52 comandi slash (21 con case dedicato), 120 tool MCP, 32 gap.
- Verifica: `npm run verify` verde (TS coverage 93.10%+), `git diff --check` verde.

**Goal:** Far sì che ogni frase importante di una nota stabile riconduca al punto esatto della fonte.

**Deliverables:**
- Estensione compatibile OKF con ancore `[^src:ID#L12-L18]`, documentata in `docs/standard/OKF_EXTENSIONS.md`.
- Comando `/verify-citations [nota|cartella]` e scheda Verifica in Review Studio: esistenza fonte, righe, hash, ancore orfane e affermazioni senza ancora.
- Verifica semantica opzionale econsultiva (`supported / partial / unsupported`).
- Gate L4/`stable` con zero ancore orfane e copertura minima configurabile; export PROV-O via `BaseGraphExporter`.

**Criteri di accettazione:**
- Una nota `stable` con ancora a righe cancellate non può essere marcata verificata.
- Test su ancora valida, fonte modificata e riga inesistente.

## Phase 96 — Sicurezza dei contenuti non fidati e prompt injection ✅ Done

**Goal:** Un documento malevolo caricato nella wiki non deve poter comandare l'IA.

**Deliverables:**
- Etichettatura `trust: untrusted` per `clip2md`, upload e conversioni, con blocchi delimitati nei prompt e istruzione di sistema che li tratta come dati.
- Rilevatore deterministico di istruzioni nascoste, zero-width, `display:none` e URL di esfiltrazione.
- Punteggio di rischio changeset (molti file, config, `AGENT.md`, script, nuovi domini) con conferma esplicita.
- Redazione di segreti prima dei provider cloud (solo Admin può disattivarla), allowlist di egress e blocco SSRF.
- Suite `tests/security/injection/` con almeno 20 payload IT/EN.

**Criteri di accettazione:**
- Tutti i payload finiscono in "richiede revisione" o vengono neutralizzati.
- `clip2md` rifiuta `http://169.254.169.254/` e `http://localhost:*`.

**Done:**
- Nuovo `src/shared/domain/contentSecurity.ts` e `src/backend/wikiforge/security/content_security.py`: detector deterministico di istruzioni nascoste, zero-width, markup nascosto, URL di esfiltrazione; redazione di segreti; `wrapUntrusted`.
- `clip2md.py` valida l'URL (blocco localhost/private/link-local/metadata) e scrive frontmatter `trust: untrusted` con `risk_flags`; corpo redatto.
- `LlmClient.buildUserContentWithContext` redige i segreti e delimita con `<untrusted-content>` le note con `trust: untrusted`; system prompt aggiornato con regola di trattare i blocchi come dati.
- `ChangesetStore` calcola `riskScore`, `riskReasons`, `requiresConfirmation`; `changesets.apply` richiede `confirm` esplicito per changeset a rischio; `autonomy` conferma i propri apply.
- Suite `tests/security/injection/` con 20 payload IT/EN; test top-level `tests/injection.test.ts` non necessario (nested registrato in `npm test`).

## Phase 97 — Osservabilità LLM, costi e quote ⬜ Todo

**Goal:** Sapere quanto costa e perché ha sbagliato ogni chiamata all'IA.

**Deliverables:**
- Middleware `LlmClient` che registra provider, modello, token in/out, latenza, esito, correlation id e comando bus, senza contenuti dei prompt nei log.
- Metriche Prometheus su `/api/metrics`, span OpenTelemetry e pannello "Uso IA" in sola lettura.
- `[llm.budget]` con token/giorno, soft e hard limit, errore tipizzato e fallback deterministico.

**Criteri di accettazione:**
- All'hard limit nessuna chiamata parte verso il provider.
- Nessun testo di note o prompt compare nei log salvo `debug` esplicito.

## Phase 98 — Collaborazione multi-utente ⬜ Todo

**Goal:** Far lavorare più persone sulla stessa wiki senza pestarsi i piedi.

**Deliverables:**
- Merge a tre vie su conflitto ETag con UI di risoluzione a blocchi, niente CRDT.
- Presenza e lock cooperativo a scadenza su SSE; ACL per cartella/nota in `.wiki-forge/acl.toml` applicate dal bus.
- Assegnazione revisioni, coda "da rivedere", notifiche in-app e feed attività da `command:handled`.
- Adapter `StateStore` SQLite (WAL) opzionale; file resta il default.

**Criteri di accettazione:**
- Due scritture simultanee sulla stessa nota non producono perdita di dati né file corrotto.
- Un `viewer` che chiama una route di scrittura riceve 403.

## Phase 99 — Pubblicazione e interoperabilità accademica ⬜ Todo

**Goal:** Uscire dalla wiki verso articoli, tesi, siti e bibliografie.

**Deliverables:**
- Import BibTeX/CSL-JSON e da Zotero, campo `cite_key`, risoluzione `[@chiave]` in `/thesis-chapter` e PDF con stile CSL.
- Template di stampa Pandoc/Typst in `templates/print/` ed export DOCX.
- Export sito statico della sola parte `status: stable` con ricerca locale e grafo.
- Compatibilità testata con vault Obsidian senza perdita di frontmatter e wikilink.

**Criteri di accettazione:**
- Tesi di esempio compila in PDF con bibliografia corretta (snapshot sul `.md` e smoke sul PDF).
- L'export statico non contiene note non `stable` né file di `raw/`.

## Phase 100 — Pack di dominio (verticali) ⬜ Todo

**Goal:** Partire in cinque minuti in un settore reale, con ontologia e procedure già pronte.

**Deliverables:**
- Pack installabili in `packs/<nome>/`: `compliance-iso`, `gdpr-registro-trattamenti`, `onboarding-aziendale`, `quaderno-di-laboratorio`, `legale-pratica`, `corso-didattico`.
- Comando `wf pack list|install|remove` e voce nel wizard; wiki di esempio con dati fittizi e test `okf_lint.py`/SHACL.
- Avviso esplicito in ogni pack: struttura, non consulenza legale o sanitaria.

**Criteri di accettazione:**
- Installare un pack su vault vuoto produce wiki che passa lint e SHACL e raggiunge almeno L2.

## Phase 101 — Accessibilità, UX e wizard persistente ⬜ Todo

**Goal:** Un'interfaccia che tutti possono usare e che non fa perdere il lavoro.

**Deliverables:**
- Persistenza lato server dello stato del wizard con ripresa dopo reload.
- Audit WCAG 2.2 AA con `axe` in Playwright su editor, tre Studio, grafo e impostazioni; focus trap, ARIA, contrasti e alternativa testuale al grafo.
- Controllo CI di completezza i18n IT/EN e budget prestazioni UI misurati su vault di prova.

**Criteri di accettazione:**
- Zero violazioni `axe` serious/critical sulle schermate coperte.
- Ricaricare la pagina a metà wizard riprende dal passo corretto.

## Phase 102 — Scalabilità e prestazioni ⬜ Todo

**Goal:** Dimostrare che regge 10.000 note, non solo 100.

**Deliverables:**
- `scripts/gen_bench_vault.py` per vault da 1k/10k/50k note con grafo realistico.
- Benchmark `npm run bench` per avvio, indicizzazione, ricerca, `WikiGraphDto`, SSE con N client, `/audit` e `/reindex`.
- Indici incrementali, paginazione/virtualizzazione di albero e grafo, backpressure SSE.
- Tabella tempi e limiti noti in `docs/riferimenti/PERFORMANCE.md`.

**Criteri di accettazione:**
- Su 10k note ricerca p95 e salvataggio+reindex incrementale entro soglie protette da test di regressione.
- Il grafo non blocca il thread UI oltre il budget definito.

## Phase 103 — Release, distribuzione e comunità ⬜ Todo

**Goal:** Rendere il progetto installabile, citabile e trovabile.

**Deliverables:**
- Versionamento semantico automatico, tag e GitHub Releases con changelog generato.
- Immagini GHCR (`ui`, `api`, `kg-api`, `worker`) con firma cosign e `docker-compose.prod.yml`.
- Decisione su `src-tauri/` ed `extension/`: build firmate in release oppure spostamento in `experimental/` o archiviazione, dichiarata nel README.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CITATION.cff`, screenshot aggiornati, guida "Prova in 5 minuti" e `README.en.md`.

**Criteri di accettazione:**
- `docker run` dell'immagine pubblicata avvia l'app con vault demo.
- La release `v4.2.0` (o successiva) esiste con artefatti verificabili.

## Phase 104 — Burn-down dei gap del manifest e copertura comandi ⬜ Todo

**Goal:** Trasformare i gap noti non bloccanti in zero, o in elenco giustificato.

**Deliverables:**
- `docs/riferimenti/MANIFEST_GAPS.md` generato con causa, responsabile e azione per ciascun gap.
- Case dedicato per i comandi più usati tra quelli senza implementazione, oppure rimozione con nota di deprecazione.
- `manifest:check` con soglia decrescente: i gap non aumentano e calano ad ogni release minor.
- Allineamento di CLI `wf`, MCP e `/help` al catalogo aggiornato.

**Criteri di accettazione:**
- Gap noti ≤ 10, ciascuno con motivazione scritta; nessun comando catalogato risponde "non implementato".
