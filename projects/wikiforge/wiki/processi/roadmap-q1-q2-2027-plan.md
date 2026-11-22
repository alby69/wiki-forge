---
type: Process
title: "Piano Q1–Q2 2027 — L4 autonomo, RBAC multi-utente, Neo4j bidirezionale"
description: "Il piano copre i tre blocchi della roadmap Q1–Q2 2027:"
resource: docs/ROADMAP_Q1_Q2_2027_PLAN.md
tags: [scope/docs, layer/generated, area/processi, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-roadmap-q1-q2-2027-plan-md
    resource: docs/ROADMAP_Q1_Q2_2027_PLAN.md
    title: "Piano Q1–Q2 2027 — L4 autonomo, RBAC multi-utente, Neo4j bidirezionale"
    author: human:alby69
---
# Piano Q1–Q2 2027 — L4 autonomo, RBAC multi-utente, Neo4j bidirezionale

> **Stato: studio completato, piano approvato, implementazione avviata (18/23 step: A0 ✅, A1 ✅, A2 ✅, A3 ✅, B0 ✅, B1 ✅, B2 ✅, B3 ✅, B4 ✅, B5 ✅, B6 ✅, B7 ✅, C0 ✅, C1 ✅, C2 ✅, C3 ✅, C4 ✅, C5 ✅).**
> Questo è un **documento vivo**: a ogni step completato aggiornare la tabella
> `§3 Grado di implementazione`, la tabella `§2 Avanzamento` e il `§11 Registro
> aggiornamenti`, con lo stesso commit. Il grado indicato oggi è la **baseline
> misurata sul codice**, non un'aspirazione.
>
> Fonti: `docs/ROADMAP.md` §“🔮 Medio / Lungo Termine (Q1-Q2 2027)” (testo canonico),
> studio statico di `src/backend/**`, `scripts/**`, `config/**`, `src/frontend/**`
> e del piano chiuso `docs/KE_AGENT_SCHEDULER_PLAN.md` (F0–F6, S0–S6).
> Pubblico: Knowledge Engineer, manutentore e reviewer di sicurezza.

---

## 1. Ambito e vincoli

Il piano copre i tre blocchi della roadmap Q1–Q2 2027:

| Track | Obiettivo roadmap | Sigla step |
| :--- | :--- | :--- |
| **A** | L4 — Fully-Autonomous Agentic Workflows | `A0`–`A5` |
| **B** | RBAC multi-utente (authn, permessi, provenance) | `B0`–`B7` |
| **C** | Integrazione bidirezionale real-time con Neo4j | `C0`–`C8` |

### 1.1 Vincoli invarianti (valgono per ogni step)

1. **Nessuna rottura di contratto**: endpoint, envelope `{ success, ... }`, metodi
   pubblici di `AgentServer`, `ApiStorage` e dei 15 moduli di dominio restano
   invariati. Le novità sono **additive** (nuovi campi opzionali, nuove route
   dichiarate, nuovi eventi).
2. **Nessun `fetch` diretto nell'UI**: ogni chiamata passa da
   `src/frontend/api/client.ts` → `src/frontend/core/apiBus.ts`. Nuovi eventi
   vanno in `AppEvents` (`src/frontend/core/events.ts`).
3. **OpenAPI generato da TS**: nuove route solo in `src/shared/api/contracts.ts`
   e `endpoints.ts`; mai YAML scritto a mano. L'assertion `IsExact` deve restare
   verde.
4. **`auto_apply` resta `false`**: `src/backend/server/scheduler/jobStore.ts`
   forza il valore a `false`; `blocked` e mutanti restano disabilitati. Ogni
   mutazione passa dalla coda F6 (`approvalStore.ts` + snapshot + audit).
5. **Validazioni verdi a ogni step**: `npm run typecheck`, `npm test`,
   `npm run build`, `PYTHONPATH=.:scripts pytest tests/python/`,
   `python scripts/gen_script_registry.py --check`,
   `python scripts/check_docs_sync.py`, `python scripts/docs_to_wiki.py --check`,
   `python scripts/docs_wiki_drift.py --check`,
   `python scripts/okf_lint.py wiki`, `git diff --check`.
6. **Commit e push per step**, come già fatto per S0–S6.
7. **Fail-closed**: se un segnale (policy, health, riconciliazione) non è
   attendibile, lo step si astiene e lascia una proposta, non applica.

---

## 2. Avanzamento

| Step | Stato | Artefatti |
| :--- | :--- | :--- |
| A0 | ✅ | `src/backend/wikiforge/api/health.py` (`count_cq_gaps`), `tests/python/test_health_gate.py` (8 test) |
| A1 | ✅ | `src/backend/wikiforge/core/findings.py` (`Finding`, `make_finding`, `findings_envelope`, `print_findings`, schema `wikiforge.finding/v1`), adattatori in 4 script (`--findings`, lazy `load_findings_api()` in `okf_common.py`), docstring `--write` rimossa da `odp_suggester.py`, `tests/python/test_findings.py` (4 test) |
| A2 | ✅ | `src/backend/server/scheduler/eventQueue.ts` (coda JSONL persistente), `eventTriggers.ts` (restore, dedupe e consumed su disk), `agentServer.ts` (wiring + emitter `note.modified`/`note.deleted`), `tests/eventTriggers.test.ts` (3 nuovi test), `tests/agentScheduleF5F6.test.ts` (2 nuovi test: restart e write-hook) |
| A3 | ✅ | `src/backend/server/findingChangeset.ts` (ponte Finding → changeset + validazione envelope), `changesetStore.ts` (campi additivi `finding`/`requireOriginal`/`snapshotId`, hook snapshot, `rollback()`), `agentServer.ts` (snapshot hook nel factory), `frontend/core/types/review.ts` (tab `proposte`), `storage/ApiStorage.ts` (`listReviewProposals`), `components/review/ReviewStudio.ts` (tab Proposte via `apiBus`), `tests/findingChangeset.test.ts` (6 test), `tests/reviewProposals.test.ts` (1 test) |
| A4 | ⬜ — **richiede approvazione utente** | — |
| A5 | ⬜ | — |
| B0 | ✅ | `tests/authCharacterization.test.ts` (8 test di baseline, nessun cambio funzionale) |
| B1 | ✅ | `Principal` in `bus/messageBus.ts`, `auth/principal.ts`, `agentServer.ts`, `tests/principal.test.ts` (6 test) |
| B2 | ✅ | `config_schema.py` (enterprise.auth/roles/projectAcls), 3 config, `auth/rbacConfig.ts`, `tests/rbacConfig.test.ts` (6 test), `test_config_schema.py` (4 nuovi) |
| B3 | ✅ | `auth/rbacMiddleware.ts` (policy + `bus.use`), `auth/rbacConfig.ts` (loader sync + ACL cartella), `bus/messageBus.ts` (`context.rbac`), `agentServer.ts`, `approvalStore.ts`, `projectsModule.ts`, `schedulerModule.ts`, `tests/rbacMiddleware.test.ts` (28 test) |
| B4 | ✅ | `auth/apiToken.ts` (confronto constant-time + estrazione header), `agentServer.ts` (auth prima del proxy graph, envelope 401 B0), `api/openapi.ts`, `docs/OPENAPI.md`, `tests/apiToken.test.ts` (9 test), `tests/authCharacterization.test.ts` (4 nuovi test) |
| B5 | ✅ | `auth/actor.ts` + `scripts/actor_provenance.py` (grammatica condivisa), `agentServer.ts` (strict mode, binding verify/approval, flag F6-only, guard stable), `changesetStore.ts` (campi additivi), 4 moduli bus, script Python e registry rigenerato, `tests/provenance.test.ts` (10 test), `tests/python/test_provenance.py` (4 test) |
| B6 | ✅ | `auth/idp.ts` (OIDC/JWKS, SAML, OAuth2 + claim mapping), `auth/principal.ts` (auth unica), `auth/rbacConfig.ts` + `config_schema.py` + 3 config, `apiToken.ts` (bearer dedicato), `rbacMiddleware.ts` (ruoli IdP senza inheritance), `agentServer.ts` (auth prima del proxy, Principal al bus), `tests/idp.test.ts` (10 test mock, zero rete) |
| B7 | ✅ | `shared/api/types.ts` (`AuthIdentityDto`) + `contracts.ts` (`auth.me`, schema `AuthIdentity`), `endpoints.ts`, `agentServer.ts` (handler bus + route pubblica), `auth/rbacMiddleware.ts` (ruolo Reader), `frontend/api/client.ts` (`getBearerToken`), `frontend/core/auth.ts`, `frontend/store/appStore.ts` (slice `auth`), `frontend/core/apiBus.ts`, `storage/ApiStorage.ts`, `components/ui/Header.ts` (chip/gating), `components/review/ReviewStudio.ts` e `components/ke/KEWorkbenchModal.ts` (attore strict), `frontend/index.ts` (refresh), `tests/authUi.test.ts` (13 test), `tests/openapi.test.ts` (4 assert) |
| C0 | ✅ | `[neo4j]` in 3 config, `config_schema.py`, `requirements.txt`, `tests/python/test_config_schema.py` (6 nuovi test) |
| C1 | ✅ | `src/backend/wikiforge/semantics/neo4j_client.py` (`Neo4jConfig.from_config`/`from_env`, `Neo4jClient.connect`/`verify_connectivity`/`session`/`close`, lazy import, DI), `graph_watcher.py` e `graph_rag_pipeline.py` (parametri opzionali additivi), `tests/python/test_neo4j_client.py` (9 test) |
| C2 | ✅ | `watcher/graph_watcher.py` (MERGE parametrizzato, hash/revision, delete con slug annidato, `on_moved` + debounce, `on_event` strutturato, `--project`), `tests/python/test_graph_watcher_neo4j.py` (9 test) |
| C3 | ✅ | `semantics/neo4j_query.py` (`Neo4jQueryService.execute_read`, whitelist, timeout/limit, binding, errori tipizzati), `graph_rag_pipeline.py` ($entities, modi mock/live espliciti, `error_type`, commenti fuorvianti rimossi), `docs/GRAPH_RAG.md`, `tests/python/test_graph_rag_live.py` (19 test) |
| C4 | ✅ | `contracts.ts`/`endpoints.ts` (3 route additive e tipi), `modules/graphModule.ts` (3 handler bus), `modules/pythonTool.ts` (stdin opzionale), `semantics/neo4j_api_tool.py` (status/query/sync), `watcher/graph_watcher.py` (watchdog lazy + `sync_note()`), `auth/rbacMiddleware.ts` (ruoli), `docs/OPENAPI.md`, `tests/graphRoutes.test.ts` (5 test), `tests/python/test_neo4j_api_tool.py` (11 test) |
| C5 | ✅ | `semantics/neo4j_reconciler.py` (query C3 read-only `wf:revision > checkpoint`, frontmatter OKF, conflitto `wf:baseHash`), `neo4j_api_tool.py` (`reconcile` con stdin JSON), `watcher/graph_watcher.py` (`wf:path` + `wf:baseHash`), `server/neo4jReverseSync.ts` (stage con `process:neo4j-reconciler`, dedupe e checkpoint), `tests/neo4jReverseSync.test.ts` (5 test), `tests/python/test_neo4j_reconciler.py` (7 test) |
| C6 | ⬜ | — |
| C7 | ⬜ | — |
| C8 | ⬜ | — |

Legend: ⬜ Todo · 🔄 In corso · ✅ Implementato e verificato · ⛔ Bloccato

---

## 3. Grado di implementazione (tabella viva)

Scala: **0** assente · **1** bozza/flag inerte · **2** parziale/read-only ·
**3** advisory strutturato · **4** autonomo limitato e governato · **5** completo
secondo la roadmap. I valori “Oggi” sono la baseline di questo studio.
La colonna **Dopo step** va aggiornata a ogni step chiuso (dopo A0: A2 3,
A5 4.5, L4 ~3.0; dopo A1: A2 3.5, A3 3, L4 ~3.2; dopo A2: A1 4, L4 ~3.4; dopo A3: A3 3.5, A4 3, A5 4.5, L4 ~3.6; dopo B1: B1 1.5; dopo B2: B1 2, B2 1; dopo B3: B2 3.5,
B3 4, RBAC ~3.0; dopo B4: B1 4.5 (RBAC invariato ~3.0); dopo B5: B4 4.5,
RBAC ~3.5; dopo B6: B1 5, B2 5, RBAC ~4.5 (la UI identità B5 resta 0);
dopo B7: B5 5, RBAC 5 (pilastro RBAC completo);
dopo C0: C1 1, Neo4j ~0.65; dopo C1: C1 2.5, Neo4j ~0.8; dopo C2: C2 3.5, Neo4j ~1.2; dopo C3: C4 3, Neo4j ~1.6; dopo C4: C1 3.5, C4 4, Neo4j ~1.9; dopo C5: C3 3, C5 3, Neo4j ~2.5; gli altri valori coincidono ancora con “Oggi”).

| ID | Capacità | Oggi | Dopo step | Target Q2 |
| :--- | :--- | :---: | :---: | :---: |
| A1 | Scheduler, trigger e stato persistente (F0–F6, S0–S6) | 3 | 4 | 5 |
| A2 | Rilevamento gap / entità orfane / incoerenze | 2 | 4 | 5 |
| A3 | ODP proattivi e generazione note | 2.5 | 3.5 | 5 |
| A4 | Validazione, auto-repair e rollback | 2 | 3 | 5 |
| A5 | Guardrail, approvazione e audit | 4 | 4.5 | 5 |
| — | **Complessivo L4** | **~2.5** | **~3.6** | **4.5–5** |
| B1 | Autenticazione / identità del chiamante | 0.5 | 5 | 5 |
| B2 | Ruoli e matrice permessi (Reader/Contributor/KE/Admin) | 0 | 5 | 5 |
| B3 | Isolamento progetto/cartella e membership | 2.5 | 4 | 5 |
| B4 | Provenance `human:<id>` / `process:<id>` vincolata | 3 | 4.5 | 5 |
| B5 | UI identità e sessione | 0 | 5 | 5 |
| — | **Complessivo RBAC** | **~1** | **5** | **5** |
| C1 | Driver e configurazione Neo4j | 0 | 3.5 | 5 |
| C2 | Watcher vault → Neo4j (graph_watcher.py) | 1 | 3.5 | 5 |
| C3 | Export Cypher/RDF batch | 2.5 | 3 | 4 |
| C4 | Interrogazione Cypher live | 0 | 4 | 5 |
| C5 | Sync Neo4j → vault Markdown | 0 | 3 | 5 |
| C6 | Riconciliazione e soppressione echo | 0 | 0 | 5 |
| C7 | Propagazione real-time al browser | 0 | 0 | 5 |
| — | **Complessivo Neo4j** | **~0.5** | **~2.5** | **5** |

---

## 4. Baseline: cosa esiste già (studio del codice)

### 4.1 Track A — L4

**Già solido.** `scheduler/` (cron, `jobStore`, `scheduler.ts` con lock/clock/abort,
`runtimeState`, `runtime` audit), `policyAgent.ts` consultivo e fail-closed,
`approvalStore.ts` con dedupe, `eventTriggers.ts` con debounce in memoria,
`changesetStore.ts` con staging/apply/reject e snapshot. 9 job Use Case e job
script in `config/agent_schedule.toml` / `config/script_schedules.toml`, tutti
`auto_apply = false`; `jobStore.ts:269-273` forza il valore a `false`.

**Mancanze critiche:**

- `src/backend/wikiforge/api/health.py:127` conta solo `"❌ Unanswered"` e
  `"[FAILED]"`, mentre `scripts/cq_validator.py` emette
  `❌ Scoperte (knowledge gap)` / `Uncovered (Knowledge Gaps)`. `cq_gaps` può
  restare 0 con gap reali → il gate L4 può essere **falsamente positivo**.
- Nessuno scanner continuo del vault: `note.created/published` arrivano da API,
  `note.modified`/`note.deleted` non risultano emessi; la coda eventi non
  sopravvive al restart.
- `scripts/odp_suggester.py` è periodico, read-only, a keyword, senza
  `findingId`/confidence/evidence/proposte applicabili; la docstring cita un
  `--write` inesistente.
- `scripts/graph_analytics.py` e `scripts/wiki_stats.py` rilevano gap e orfani
  ma sono solo metriche; `health.py:85-102` espone `orphan_ratio` read-only.
- Deep Research scrive `output/research-*.md` e `wiki/synthesis/<slug>.md` solo
  su richiesta, senza loop di rivalidazione del gap.

### 4.2 Track B — RBAC

**Già solido.** Isolamento fisico per progetto (`config/projects.json`,
`projectService.ts:219-289`, `validateSafePath()`), changeset per progetto,
convenzione attori OKF (`docs/OKF_SPEC.md:52-65,86-102`) con lint e trust tiers,
script con provenance reale (`promote_doc_answer.py`, `program_change_common.py`,
`docs_to_wiki.py` → `process:docs-to-wiki`).

**Mancanze critiche:**

- `agentServer.ts:1493-1501`: un solo token condiviso, opzionale, comparato con
  `===`; nessuna identità, ruolo, scadenza o revoca.
- `agentServer.ts:1611-1616`: il proxy FastAPI `/api/v1/graph/{sync,validate,rag}`
  gira **prima** di CORS e `validateApiToken` → bypass. FastAPI
  (`api_server.py:23-148`) non ha alcuna dipendenza di sicurezza.
- `[enterprise].enable_rbac` (`config/config.toml:96-98`, 3 copie) è letto solo
  dalla validazione di forma (`config_schema.py:85`): **nessun codice runtime lo
  usa**. Non esiste alcun catalogo ruoli.
- `MessageBus` ha l'hook `use()` (`bus/messageBus.ts:45-48,65-69`) ma nessun
  middleware registrato; `CommandContext` non ha `Principal`.
- `schedulerModule.ts:214` e `agentServer.ts:1162-1265`: `reviewer` è stringa
  libera del body, default `'human'`; `decidedBy: 'mario'` e
  `--reviewer human:mario` sono due rappresentazioni diverse della stessa
  decisione. `changesetStore.ts:31,105-114` usa `author: 'agent'` e
  apply/reject sono anonimi.
- `approvalStore.ts:54-60` non filtra per `project` pur avendo il campo:
  qualsiasi chiamante può enumerare/decidere approvazioni di altri progetti.
- Nessuna UI di login/sessione; `ReviewStudio.ts:53` usa
  `localStorage['wiki-forge:reviewer']`, `KEWorkbenchModal.ts:791` hardcode
  `'utente workbench'`.

### 4.3 Track C — Neo4j

**Già solido.** Export batch idempotente (`markdown_to_cypher.py`,
`markdown_to_rdf.py`, `base_parser.py` con `slugify()` per id annidati),
`graph_analytics.py` per community/gap, endpoint FastAPI
`/api/v1/graph/{sync,validate,rag}` e relativo proxy Node.

**Mancanze critiche:**

- **Zero** import del driver: `requirements.txt:12` dichiara `neo4j` ma nessun
  codice fa `GraphDatabase.driver(...)`. `graph_watcher.py:35,94-102` accetta un
  driver iniettato e non fa nulla se assente; non è avviato da nessun servizio.
- `graph_watcher.py:110,136` usa di default `wiki/`, che non esiste: le wiki
  attive sono sotto `projects/wikiforge/wiki/`. Nessuno scoping per progetto,
  nessun `on_moved`, nessun debounce, nessun checkpoint/hash.
- `graph_watcher.py:85-87` calcola l'id di delete con `slugify(p.stem)` invece
  della regola `slugify(f"{parent}-{stem}")` di `base_parser.py:57-60`: le
  note annidate non vengono cancellate correttamente. Le stringhe Cypher sono
  interpolate, non parametrizzate, e multi-statement (il driver richiede una
  statement per `session.run()`).
- `graph_rag_pipeline.py:138-171` non esegue la query: restituisce
  `mock_results` costanti; i parametri neo4j di `__init__` (`:55-58`) sono
  memorizzati e mai usati. `docs/GRAPH_RAG.md:94` dice il contrario.
- Nessun endpoint Cypher live, nessuna direzione DB → Markdown, nessun
  metadata di riconciliazione (`wf:source`, `wf:revision`, `wf:contentHash`,
  `wf:origin`), nessun checkpoint, nessun evento `graph:changed` in
  `src/frontend/core/events.ts:4-19`, nessun SSE/WebSocket.
- `networkx` usato da `graph_analytics.py:16` non è in `requirements.txt`.

---

## 5. Decisioni proposte — da confermare prima di A4

Queste decisioni **non sono ancora state approvate** e non vanno implementate
senza un'esplicita conferma:

1. **Non attivare mai `auto_apply = true`** per i job esistenti. Al suo posto,
   introdurre una modalità separata `off | propose | bounded` con:
   - `off` (default): nessuna mutazione automatica, comportamento attuale;
   - `propose`: ogni finding diventa un changeset in Review Studio (equivalente
     a F6, senza scritture dirette);
   - `bounded`: sola allowlist di script `read-only`/`report`, percorsi e tipi
     di finding approvati, rivalidazione prima di ogni apply, snapshot e
     rollback automatico se la rivalidazione fallisce, audit `process:<id>`.
2. Il gate L4 (A0) deve rimanere **rosso** finché `cq_gaps > 0` o ci sono
   orfani irrisolti: nessun claim di autonomia su dati non veritieri.
3. La riconciliazione Neo4j (C6) può auto-applicare **solo** modifiche non
   conflittuali; i conflitti restano sempre in changeset.

---

## 6. Sequenza di esecuzione e dipendenze

```text
A0 ─┐                                   ┌─ A4 (bounded; richiede conferma + A0 + B5 + C6)
    ├─ A1 ─ A2 ─ A3 ────────────────────┤
B0 ─ B1 ─ B2 ─ B3 ─ B4 ─ B5 ────────────┴─ A5
                        │
                        ├────────────────── C4 (query live solo dopo B4: niente endpoint aperto)
C0 ─ C1 ─ C2 ─ C3 ──────┴─ C4 ─ C5 ─ C6 ─ C7 ─ C8
                                  │
B6 ─ B7 (IdP + UI identità, Q2) ───┘
```

Ordine consigliato (ogni riga = un commit/push):

1. **Fondamenta senza cambi di comportamento**: `A0`, `B0`, `C0`.
2. **RBAC opt-in**: `B1`, `B2`, `B3`.
3. **Chiusura bypass e provenance**: `B4`, `B5`.
4. **Autonomia advisory**: `A1`, `A2`, `A3`.
5. **Neo4j reale**: `C1`, `C2`, `C3`, `C4`.
6. **Bidirezionalità**: `C5`, `C6`.
7. **Autonomia limitata**: `A4` (solo dopo conferma), `A5`.
8. **Enterprise e UI**: `B6`, `B7`, `C7`, `C8`.

Dipendenze dure: `A4 ⟵ A0, A3, B5, C6`; `A5 ⟵ A4`; `C4 ⟵ B4`;
`C5 ⟵ C2, B5`; `C6 ⟵ C5`; `C7 ⟵ C6`; `B5 ⟵ B1`.

---

## 7. Track A — L4 Fully-Autonomous Agentic Workflows

### A0 — Gate L4 veritiero

- **Obiettivo**: eliminare il falso positivo del gate; nessuna autonomia può
  essere dichiarata se i gap non vengono contati.
- **Modifiche**: `src/backend/wikiforge/api/health.py` (parsing robusto di
  `❌ Scoperte (knowledge gap)`, `Uncovered (Knowledge Gaps)`,
  `❌ Unanswered`, `[FAILED]`), normalizzazione case-insensitive, test sulle
  stringhe reali emesse da `scripts/cq_validator.py`. Nessuna API pubblica
  cambiata (`cq_gaps` resta lo stesso campo).
- **Accettazione**: con un fixture contenente 3 gap reali, `cq_gaps === 3` e
  `level < 4`; con output pulito, `cq_gaps === 0` e il gate può essere 4;
  variazioni di casing/emoji non abbassano il conteggio a 0.
- **Verifica**: nuovo `tests/python/test_health_gate.py`; `pytest tests/python/`,
  `okf_lint.py`, `npm test` (nessun cambio envelope).
- **Grado atteso**: A2 2 → 3, A5 4 → 4.5 (gate attendibile).
- **Risultato (2026-11-22)**: ✅ completato. `count_cq_gaps()` usa la riga di
  riepilogo `Uncovered (Knowledge Gaps): N` come fonte autoritativa e, in
  assenza, conta le righe di dettaglio con le etichette note; 8 test in
  `tests/python/test_health_gate.py` (incluso uno sull'output reale di
  `generate_report()`), 73 test Python totali verdi. Nessun campo o envelope
  API modificato.

### A1 — Modello `Finding` unificato (solo lettura)

- **Obiettivo**: un unico formato strutturato per gap, orfani, incoerenze e
  suggerimenti ODP, senza alcuna scrittura.
- **Modifiche**: nuovo `src/backend/wikiforge/core/findings.py` con
  `Finding { findingId, kind, confidence, evidence[], targetPath, proposedAction }`;
  adattatori in `scripts/odp_suggester.py`, `scripts/graph_analytics.py`,
  `scripts/cq_validator.py` e `scripts/okf_lint.py`; correzione della docstring
  che cita `--write`. ID deterministici (`<kind>-<slug>-<hash(evidence)>`).
- **Accettazione**: tutti i detector emettono JSON con lo stesso schema;
  due run consecutivi producono gli stessi `findingId`; nessun file viene
  scritto (verificato con snapshot dell'albero prima/dopo).
- **Verifica**: `tests/python/test_findings.py` (schema, determinismo,
  read-only) + `gen_script_registry.py --check` (nessun cambio di safety).
- **Grado atteso**: A2 3 → 3.5, A3 2.5 → 3.
- **Risultato (2026-11-22)**: ✅ completato. Nuovo modello condiviso
  `src/backend/wikiforge/core/findings.py` con dataclass `Finding` immutabile,
  costruttore validato `make_finding()` (kind tra 4 valori, confidence 0–1,
  evidence non vuota) e ID deterministici `<kind>-<slug>-<sha256[:12]>` calcolati
  su evidence canonica ordinata e de-duplicata più target e proposedAction.
  L'envelope unico `{"schema": "wikiforge.finding/v1", "count": N,
  "findings": [...]}` è emesso dal flag additivo `--findings` dei quattro
  detector (`cq_validator`, `graph_analytics`, `odp_suggester`, `okf_lint`), che
  restituiscono prima di qualunque scrittura: anche `cq_validator` non genera
  più il report in modalità findings, mentre `--json` e l'output testuale
  restano byte-identici. Il modello è importato in modo **lazy** tramite
  `okf_common.load_findings_api()`, così gli embedder che copiano solo `scripts/`
  (es. `tests/agentScriptJobs.test.ts`) non regressano. La docstring di
  `odp_suggester.py` non cita più `--write` (inesistente). Quattro test Python
  coprono schema unico, validazione, determinismo/order-independence e snapshot
  read-only dell'albero su due run dei quattro comandi; 91 test Python verdi,
  suite Node verde, registry e safety invariati (29 script). Gradi A2 3.5,
  A3 3, L4 ~3.2.

### A2 — Scanner continuo ed eventi persistenti

- **Obiettivo**: collegare il rilevamento ai trigger F6 con eventi che
  sopravvivono al restart.
- **Modifiche**: emitter `note.modified` / `note.deleted` dove avvengono le
  scritture API (`agentServer.ts`, `modules/filesModule.ts`); coda eventi su
  disco (es. `.wiki-forge/event-queue.jsonl`) consumata da
  `scheduler/eventTriggers.ts`; dedupe persistente al posto del solo debounce
  in memoria.
- **Accettazione**: modifica ed eliminazione di una nota generano l'evento
  atteso; un evento in coda prima del restart viene consumato dopo; un evento
  duplicato non lancia due run; i 9 job e `auto_apply=false` restano invariati.
- **Verifica**: estensioni a `tests/eventTriggers.test.ts` e
  `tests/agentScheduleF5F6.test.ts` + test di restart della coda.
- **Grado atteso**: A1 3 → 4.
- **Risultato (2026-11-22)**: ✅ completato. Nuovo
  `src/backend/server/scheduler/eventQueue.ts`: coda JSONL append-only in
  `<root>/.wiki-forge/event-queue.jsonl` con record
  `{ id, jobId, project, event, enqueuedAt, fireAt, state }`, scrittura
  sincrona (l'hook `publish()` è sincrono), riscrittura atomica con rename su
  `consumed` e tolleranza a righe corrotte. `EventTriggerBus` accetta
  l'opzione additiva `queue`: al publish ogni evento subscribed viene persistito
  come `pending`, i duplicati per path non creano nuovi record ma azzerano il
  timer (quiet period sliding), e `restore()` ricostruisce i bucket all'avvio
  con `max(0, fireAt - now)`. `cancelJob()` chiude i record del job rimosso;
  `stop()` lascia i record pending di proposito, così il prossimo bus li
  recupera. `fire()` marca `consumed` prima di invocare `onTrigger`, quindi un
  restart non può rilanciare lo stesso evento. In `agentServer.ts` la coda è
  collegata al bus con path `<root>/.wiki-forge/event-queue.jsonl` e gli
  emitter `note.modified` (save con contenuto cambiato e apply-edit) e
  `note.deleted` (solo file `.md` soft-deleted) pubblicano tramite lo stesso
  watcher di `note.created`; `publishNoteCreated` è invariato. I 9 job, gli
  step F5/F6 e `auto_apply=false` restano invariati; nessun endpoint, envelope
  o metodo pubblico cambiato. Verifica: 3 nuovi test in
  `tests/eventTriggers.test.ts` (tipi supportati, restart+consumo una sola
  volta, duplicato post-restart) e 2 in `tests/agentScheduleF5F6.test.ts`
  (evento accodato prima del restart consumato dopo, write-hook API che generano
  i due nuovi tipi); suite Node 434 test (433 pass + 1 skip pre-esistente).
  Gradi A1 4, L4 ~3.4.

### A3 — Proposte applicabili via changeset (`propose`)

- **Obiettivo**: trasformare ogni `Finding` in una proposta umana reversibile.
- **Modifiche**: ponte `Finding → changesetStore.stage()` (path, frontmatter,
  rationale, evidence, sources), con snapshot e rollback già esistenti;
  visualizzazione nella Review Studio; la modalità `propose` del §5 resta
  **default** finché A4 non è approvato.
- **Accettazione**: un finding di gap produce un changeset; **nessun file è
  scritto** prima di `changesets.apply`; approve → file + snapshot; reject →
  nessun file; rollback ripristina i byte originali.
- **Verifica**: `tests/findingChangeset.test.ts` + test UI nella Review Studio
  via `apiBus`; nessun endpoint cambiato.
- **Grado atteso**: A3 3 → 3.5, A4 2 → 3, A5 4.5 → 5.
- **Risultato (2026-11-22)**: ✅ completato. Nuovo
  `src/backend/server/findingChangeset.ts` valida l'envelope
  `wikiforge.finding/v1` (schema, count, kind, confidence, evidence, path) e
  converte ogni `Finding` in input per `changesetStore.stage()`: se il target è
  una nota Markdown esistente viene aggiunta una sezione proposta con
  `requireOriginal: true` (il changeset rifiuta l'apply se i byte sono cambiati
  dopo lo staging), altrimenti viene creata una nota OKF sotto `wiki/proposte/`.
  Il contesto del finding (`findingId`, `kind`, `confidence`, `evidence`,
  `targetPath`, `proposedAction`) è copiato nel changeset insieme a rationale e
  sources; lo staging è idempotente (uno changeset per finding, duplication
  riportata come `skipped`). Lo store ha campi additivi (`finding`,
  `requireOriginal`, `snapshotId`, `rolled_back_at`, `rolled_back_by`), un hook
  `snapshot` opzionale e `rollback()`: l'apply scrive solo dopo approvazione
  umana e lascia uno snapshot pre-write con reason che cita il changeset; il
  rollback ripristina i byte originali (o rimuove in trash il file creato).
  `agentServer.ts` collega l'hook snapshot esistente senza nuove route; gli
  endpoint, le envelope e i metodi pubblici esistenti restano invariati (solo
  aggiunte additive), la modalità `propose` resta default e `auto_apply` non
  viene attivato. La Review Studio ha una quinta tab **Proposte** che legge i
  finding staged tramite `changesets.list` dell'`apiBus` tipizzato (zero
  `fetch` diretti): mostra id, kind, confidenza, target, azione, evidenze e
  rationale. Verifica: 6 test in `tests/findingChangeset.test.ts` (validazione
  envelope, nessuna scrittura prima di apply, snapshot + rollback, reject senza
  file, stale rejected, idempotenza) e 1 in `tests/reviewProposals.test.ts`
  (render tab via apiBus); suite Node 441 test (440 pass + 1 skip
  pre-esistente). Gradi A3 3.5, A4 3, A5 4.5, L4 ~3.6.

### A4 — Modalità `bounded` (solo dopo approvazione esplicita)

- **Obiettivo**: autonomia limitata e governata, **non** `auto_apply=true`.
- **Modifiche**: configurazione `autonomy.mode = off | propose | bounded`
  (default `off`), allowlist di script/percorsi/tipi di finding, rivalidazione
  obbligatoria prima di ogni apply (`okf_lint` + `shacl` + `cq_validator`),
  snapshot e rollback automatico, audit `process:wiki-forge-autonomy`.
- **Accettazione**: in `off` nessuna mutazione; in `propose` tutto in changeset;
  in `bounded` solo allowlist e solo se la rivalidazione passa; uno script
  `wiki-write`/`blocked` non è mai auto-applicato; un fallimento di
  rivalidazione fa rollback e lascia un finding; il gate A0 resta rosso se
  `cq_gaps > 0`.
- **Verifica**: test tabellari dei 3 modi × 5 classi di sicurezza, test di
  rollback e di audit; `git diff --check`.
- **Grado atteso**: A4 3 → 4.5, A1 4 → 4.5, complessivo L4 ~4.4.

### A5 — Auto-repair di orfani e incoerenze semantiche

- **Obiettivo**: risolvere entità orfane e incoerenze frontmatter entro
  l'allowlist di A4.
- **Modifiche**: riparatore deterministico che usa `base_parser.slugify()` per
  risolvere i link annidati, genera stub-note da template OKF e normalizza
  frontmatter; in caso di conflitto (hash locale ≠ hash base) passa a changeset.
- **Accettazione**: fixture con 3 orfani → 3 riparazioni idempotenti (secondo
  run: 0 modifiche); 1 conflitto → 1 changeset e 0 scritture; `okf_lint.py`
  verde su tutto l'output.
- **Verifica**: `tests/python/test_orphan_repair.py` + test TS del ponte
  changeset; validazione completa.
- **Grado atteso**: A2 3.5 → 5, A4 4.5 → 5, complessivo L4 4.5–5.

---

## 8. Track B — RBAC multi-utente

### B0 — Caratterizzazione auth (nessun cambio di comportamento)

- **Obiettivo**: fissare con test il comportamento attuale prima di toccarlo.
- **Modifiche**: solo test; eventuale comparazione constant-time di
  `validateApiToken()` (invisibile ai client).
- **Accettazione**: 200 senza token configurato, 401 con token errato, docs e
  OpenAPI pubblici, `decidedBy` raw, bypass del proxy graph **documentato come
  noto** (non ancora corretto, lo farà B4).
- **Verifica**: `tests/authCharacterization.test.ts`; tutti i test esistenti
  invariati.
- **Grado atteso**: nessun cambio (baseline B1 0.5).
- **Risultato (2026-11-22)**: ✅ completato. `tests/authCharacterization.test.ts`
  (8 test) fissa: 200 senza token, 401 con envelope esatto con token mancante o
  errato, token valido via `X-WikiForge-Token` e `Authorization: Bearer`,
  `/api/openapi.json` e `/api/docs` pubblici. Sono inoltre **documentati come
  noti** il bypass del proxy graph — 502 senza token quando FastAPI è
  irraggiungibile, poi chiuso in B4 — e il `reviewer` raw del body con default
  `'human'` (B5). Nessun file di produzione modificato.

### B1 — Principal derivato dal server (additivo, senza enforcement)

- **Obiettivo**: smettere di fidarsi del `reviewer` inviato dal client.
- **Modifiche**: `Principal { actor: 'human:<id>' | 'process:<id>', roles[], source }`
  opzionale in `CommandContext` (`bus/messageBus.ts`); popolato in
  `dispatchApiCommand()` da header/token verificati; in legacy mode
  (`enable_rbac=false`) → `process:api-token` senza ruoli e comportamento
  attuale identico.
- **Accettazione**: `context.principal` derivato dal server; i campi
  `reviewer`/`user`/`actor` nel body **non** possono sovrascriverlo; envelope e
  test esistenti byte-identici.
- **Verifica**: `tests/principal.test.ts` + `npm test`, `typecheck`.
- **Grado atteso**: B1 0.5 → 1.5.
- **Risultato (2026-11-22)**: ✅ completato. `Principal { actor, roles, source }`
  aggiunto a `CommandContext` come campo opzionale; `auth/principal.ts`
  deriva l'attore lato server e `dispatchApiCommand()` lo popola per ogni
  richiesta HTTP. In legacy mode l'attore canonico è `process:api-token`, senza
  ruoli (`source: 'legacy-token'`). Header client (`X-Principal-*`) e campi body
  (`principal`, `reviewer`, `user`, `actor`) non possono sovrascriverlo: il
  campo `principal` del body viene rimosso prima del dispatch, gli altri restano
  invariati. I caller non-HTTP restano senza principal (additività). 6 nuovi
  test in `tests/principal.test.ts`; B0 rimane byte-identico (8/8), suite
  completa 352 pass + 1 skip. Nessun enforcement attivo: B3/B5 lo introdurranno
  dietro `enable_rbac`.

### B2 — Config e catalogo ruoli (inerti)

- **Obiettivo**: dichiarare ruoli e provider senza attivare nulla.
- **Modifiche**: `config_schema.py:85` esteso con `enterprise.auth`
  (issuer, audience, jwksUrl, samlMetadataUrl) e `enterprise.roles` /
  `enterprise.projectAcls`; chiavi commentate nelle 3 copie di `config.toml`;
  lettore TOML lato Node (`smol-toml` già presente).
- **Accettazione**: config valida; impostare `enable_rbac=true` **da solo**
  non cambia alcuna risposta; test carica 4 ruoli e ne verifica i default.
- **Verifica**: test configurazione Python + `check_docs_sync.py`.
- **Grado atteso**: B2 0 → 1, B1 1.5 → 2.
- **Risultato (2026-11-22)**: ✅ completato. Schema `enterprise` esteso con
  `auth` (issuer/audience/jwksUrl/samlMetadataUrl), `roles` e `projectAcls`;
  le 3 copie config dichiarano i ruoli canonici Reader, Contributor,
  KnowledgeEngineer, Admin con permessi e ACL per `default`/`tesi`/`wikiforge`,
  mentre `[enterprise.auth]` resta commentato in attesa di B6. Nuovo lettore
  Node `auth/rbacConfig.ts` (`loadRbacConfig`, `normalizeRbacConfig`,
  `rolesForProject`, `defaultRbacConfig`) con fallback ai 4 ruoli se il file
  manca. 4 nuovi test Python (22 totali nello schema config) e 6 test Node:
  il caso `enable_rbac=true` da solo lascia invariati 200/401/docs. Nessun
  middleware o enforcement: B3 e B6 restano da fare.

### B3 — Gate RBAC opt-in via middleware del bus

- **Obiettivo**: il vero controllo permessi, disattivato di default.
- **Modifiche**: un `bus.use(...)` che mappa `operationId × projectId × cartella`
  → ruolo richiesto: **Reader** (letture/export), **Contributor** (note,
  changeset stage, upload), **Knowledge Engineer** (verify, use case, script,
  scheduler), **Admin** (progetti, approvazioni, config). 403 con envelope
  esistente. Filtro membership su `GET /api/projects` e approvazioni;
  `ApprovalStore.list()` riceve un parametro `project` opzionale.
- **Accettazione**: tabella 4 ruoli × comandi rappresentativi × progetto/
  cartella; con flag spento tutti i 200 attuali restano; cross-project
  enumeration → vuoto/403; envelope invariato.
- **Verifica**: `tests/rbacMiddleware.test.ts` + test approvazioni per
  progetto; `npm test`, `typecheck`.
- **Grado atteso**: B2 1 → 3.5, B3 2.5 → 4.
- **Risultato (2026-11-22)**: ✅ completato. Il middleware `createRbacMiddleware()`
  viene installato su ogni `AgentServer` ma è no-op con `enable_rbac=false`:
  B0 resta 8/8, i 200 attuali e l'envelope 401 sono byte-identici. Con il flag
  acceso la decisione (`allowed`, `roles`, `requiredRole`, `visibleProjects`)
  viene scritta in `context.rbac`; `OPERATION_ROLES` mappa esplicitamente tutti
  gli 84 comandi registrati (sconosciuti → `Admin`, fail closed) e
  `projectAcls["progetto/cartella"]` restringe i ruoli per cartella. Il 403 usa
  `error(..., 403)` con envelope `{ success: false, error }` invariato.
  `projects.list` e `schedule.approvals` filtrano per membership;
  `ApprovalStore.list()` accetta `project` opzionale. 28 nuovi test in
  `tests/rbacMiddleware.test.ts` (matrice 4 ruoli × comandi, ACL cartella, 403,
  cross-project enumeration vuota, approvazioni per progetto); suite Node
  386 pass + 1 skip pre-esistente. Nessun IdP: il principal legacy
  `process:api-token` eredita l'ACL di progetto come service account; B5/B6
  completeranno provenance e identità umana.

### B4 — Chiusura dei bypass auth

- **Obiettivo**: nessuna porta d'ingresso non autenticata quando il token è
  configurato.
- **Modifiche**: spostare/equivalenziare il controllo del token prima del proxy
  FastAPI (`agentServer.ts:1611-1616`); dipendenza FastAPI no-op se non
  configurato; compare constant-time; correggere il drift
  `WIKIFORGE_TOKEN` → `WIKIFORGE_API_TOKEN` in `openapi.ts:245,258`.
- **Accettazione**: senza token, tutti gli endpoint (graph e docs inclusi)
  rispondono come oggi; con token, graph lo richiede e docs resta pubblico;
  envelope 401 identico a B0.
- **Verifica**: estensione di `tests/authCharacterization.test.ts` e test
  OpenAPI; `docs/OPENAPI.md` aggiornato se cambia lo schema di sicurezza.
- **Grado atteso**: B1 2 → 4.5.
- **Risultato (2026-11-22)**: ✅ completato. Nuovo `auth/apiToken.ts` con
  `verifyApiToken()` (hash SHA-256 a lunghezza fissa + `timingSafeEqual`, quindi
  nessuna dipendenza temporale dal contenuto) e `apiTokenFromRequest()` (header
  `X-WikiForge-Token` singolo/ripetuto, `Authorization: Bearer`, bare token;
  `Bearer` senza valore → nessun token). `validateApiToken()` lo usa come
  unica fonte di verità. In `handleRequest()` CORS/OPTIONS e docs restano
  pubblici, poi arriva il controllo token **prima** del proxy FastAPI: con token
  configurato `/api/v1/graph/{sync,validate,rag}` senza o con token errato
  risponde 401 con l'envelope esatto di B0, mentre con token valido raggiunge
  l'upstream (502 se irraggiungibile). Senza token configurato il proxy resta
  raggiungibile come prima; il preflight graph risponde 204. Drift OpenAPI
  corretto (`WIKIFORGE_TOKEN` → `WIKIFORGE_API_TOKEN`) in `openapi.ts` e
  `docs/OPENAPI.md`, con asserzioni nella characterization. 9 nuovi test in
  `tests/apiToken.test.ts` e 4 nuovi in `tests/authCharacterization.test.ts`;
  suite Node 398 pass + 1 skip pre-esistente. `C4 ⟵ B4` è ora sbloccato.

### B5 — Provenance vincolata al Principal (dual-mode)

- **Obiettivo**: un'unica rappresentazione dell'attore, server-trusted.
- **Modifiche**: in strict mode (`enable_rbac=true`) sostituire il reviewer del
  body con `principal.actor` in `recordHumanVerification`, `decideApproval`
  (`decidedBy`, `approvedBy`, `--reviewer` injection), changeset
  `stage/apply/reject` (campi `actor` additivi) e script
  `promote_doc_answer.py` / `wiki_program_change_apply.py`; regex attore
  condivisa (mirror TS/Python come da pattern SSOT); scritture sintetiche
  con `process:<id>` canonico. Legacy mode invariato.
- **Accettazione**: verify/approve/changeset scrivono sempre
  `human:<id-autenticato>` o `process:<id>` indipendentemente dal body;
  `okf_lint.py` e ontology Rule 3 (`stable` richiede `human:*`) verdi; audit
  coerente su tutti i campi.
- **Verifica**: test di binding provenance + `okf_lint.py` su output generati;
  nessun test asserisce più `'qa'`/`'mario'` raw in strict mode.
- **Grado atteso**: B4 3 → 4.5, B1 4.5 → 5 in modalità enterprise.
- **Risultato (2026-11-22)**: ✅ completato. Grammatica attore canonica in
  `src/backend/server/auth/actor.ts` e `scripts/actor_provenance.py` (mirror
  TS/Python, riutilizzata da `okf_lint.py`, `promote_doc_answer.py` e
  `program_change_common.py`). Con `enable_rbac=true` il server ignora
  `reviewer`/`user`/`actor` del body: verify, decisioni F6 e changeset
  (`actor`, `applied_by`, `rejected_by` additivi) scrivono sempre il
  `Principal` server-derived. Il flag `--allow-process-actor` di
  `wiki_program_change_apply.py` è F6-only (ritirato da
  `withoutApprovalFlags`) e l'audit registra `actor: process` per le approvazioni
  di processo; `stable` con principal non umano viene rifiutato con
  `stable-requires-human-actor` (Rule 3). In legacy mode il reviewer grezzo e
  l'assenza di campi additivi restano invariati. Registry e documentazione
  script rigenerati dalla SSOT Python. 10 test Node + 4 Python dedicati, suite
  408 pass + 1 skip pre-esistente, Python 87 pass. Grado provenance 3 → 4.5,
  RBAC complessivo ~3.5; B1 resta 4.5 fino all'IdP di B6.

### B6 — Adapter IdP (OIDC / SAML / OAuth2)

- **Obiettivo**: autenticazione enterprise reale dietro lo stesso flag.
- **Modifiche**: provider pluggable: OIDC (discovery + JWKS + issuer/audience/
  expiry), SAML 2.0 (metadata + ACS + validazione assertion), OAuth2
  authorization-code per il browser; mapping claim → `Principal`/ruoli.
- **Accettazione**: test con JWKS e IdP mockati; audience/expiry invalidi → 401
  con envelope attuale; i ruoli dei claim alimentano la matrice B3; nessuna
  route esistente toccata.
- **Verifica**: `tests/idp.test.ts` (mock, zero rete), `typecheck`, `npm test`.
- **Grado atteso**: B1 5 (enterprise), B2 3.5 → 5.
- **Risultato (2026-11-22)**: ✅ completato. `[enterprise.auth].provider` è
  l'unico interruttore e agisce solo con `enable_rbac=true`: senza provider
  (o con RBAC spento) B0/B3/B4/B5 restano byte-identici. Nuovo `auth/idp.ts`
  con adapter pluggabili: OIDC (JWT RS256/384/512 con discovery/JWKS injectati,
  issuer/audience/exp/nbf), SAML 2.0 (metadata + verifier di assertion
  iniettato) e OAuth2 authorization-code (exchange iniettato + id_token OIDC).
  Il mapping claim → `Principal` usa la grammatica canonica B5 e la `roleMap`
  TOML; i ruoli IdP alimentano direttamente la matrice B3 e, se vuoti, **non**
  ereditano più l'ACL del service account. `apiToken.ts` espone un bearer
  dedicato; un bearer invalido dà sempre il 401 B0 senza dispatch, anche con
  token condiviso valido. Il token condiviso resta accettato come
  `process:api-token`. Nessuna route, envelope o metodo pubblico è stato
  aggiunto o modificato; la UI resta invariata (B7). 10 test Node in
  `tests/idp.test.ts` con JWKS/metadata/exchange mockati e zero rete; suite
  418 pass + 1 skip pre-esistente, Python 87 pass. Gradi B1 5, B2 5, RBAC
  complessivo ~4.5.

### B7 — UI identità via solo transport tipizzato

- **Obiettivo**: login/sessione e controlli gated per ruolo senza `fetch`.
- **Modifiche**: `getToken` cablato in `createApiClient` da campo additivo
  dell'app-store; controlli sign-in/sign-out; rendering in base ai ruoli;
  nuova route additiva `GET /api/auth/me` dichiarata in `contracts.ts` (OpenAPI
  generato); sostituire `localStorage['wiki-forge:reviewer']` e
  `'utente workbench'` con l'attore autenticato in strict mode.
- **Accettazione**: zero `fetch(` nei componenti; snapshot OpenAPI aggiornato
  dalla generazione; in legacy mode la UI è identica a oggi.
- **Verifica**: `tests/authUi.test.ts`, `tests/openapi.test.ts`, `typecheck`,
  `npm test`.
- **Grado atteso**: B5 0 → 5, complessivo RBAC 5.
- **Risultato (2026-11-22)**: ✅ completato. Nuova route additiva
  `GET /api/auth/me` dichiarata in `contracts.ts` con DTO `AuthIdentityDto` e
  schema `AuthIdentity`: senza credenziali è pubblica e riporta
  `authenticated=false`, con Bearer invalido restituisce l'envelope 401 esatto
  di B0 prima di qualunque dispatch. Il client tipizzato separa
  `getBearerToken` (`Authorization: Bearer`, dallo slice additivo `auth`
  dell'app-store) dal legacy `getToken` (`X-WikiForge-Token`): senza token non
  viene inviato alcun header `Authorization`. Nessun `fetch(` nei componenti.
  Chip identità, form di sign-in e azioni gated per ruolo compaiono solo per
  identità IdP verificate; in legacy mode l'header resta byte-identico. In
  strict mode Review Studio e KE Workbench usano l'attore server-derived al
  posto di `wiki-forge:reviewer` / `'utente workbench'`. 13 test in
  `tests/authUi.test.ts` + 4 assert in `tests/openapi.test.ts`; suite Node
  429 test (428 pass + 1 skip pre-esistente), Python 87 pass. Grado B5 5,
  RBAC 5/5: pilastro completato.

---

## 9. Track C — Neo4j bidirezionale

### C0 — Configurazione e dipendenze (inerti)

- **Obiettivo**: dichiarare la connessione senza aprirla.
- **Modifiche**: sezione `[neo4j]` in `config/config.toml` (uri, user,
  `passwordEnv`, database, TLS, mapping per progetto) + schema in
  `config_schema.py`; pin di `neo4j` e aggiunta di `networkx` in
  `requirements.txt`.
- **Accettazione**: validazione config verde; nessun endpoint, envelope o
  metodo pubblico cambiato; nessun tentativo di connessione a startup.
- **Verifica**: test config + `check_docs_sync.py`, `pytest tests/python/`.
- **Grado atteso**: C1 0 → 1.
- **Risultato (2026-11-22)**: ✅ completato. `[neo4j]` (`enabled`, `uri`, `user`,
  `passwordEnv`, `database`, `tls`, tabella `projects`) aggiunto a
  `config/config.toml` e alle due config di progetto; schema corrispondente in
  `config_schema.py`; `requirements.txt` vincola `neo4j>=5.26,<6.0` e dichiara
  `networkx>=3.4,<4.0`. `enabled = false` ovunque e nessun modulo importa il
  driver: la validazione resta un parsing TOML puro (verificato da test).
  6 nuovi test in `tests/python/test_config_schema.py`; 18 test totali in quel
  file, 79 nel suite Python. Nessun endpoint, envelope o metodo pubblico toccato.

### C1 — Client Neo4j con dependency injection

- **Obiettivo**: un solo punto di connessione, testabile senza database.
- **Modifiche**: nuovo `src/backend/wikiforge/semantics/neo4j_client.py`
  (`Neo4jConfig.from_config/env()`, `connect()`, `verify_connectivity()`,
  `close()`, lazy import del driver); interfaccia fake per test; costruttori di
  `graph_watcher.py` e `graph_rag_pipeline.py` restano compatibili (nuovi
  parametri opzionali).
- **Accettazione**: test con fake driver per connect/verify/close e modalità
  non configurata; zero rete; import dei moduli sempre riuscito.
- **Verifica**: `tests/python/test_neo4j_client.py`; `pytest tests/python/`.
- **Grado atteso**: C1 1 → 2.5.
- **Risultato (2026-11-22)**: ✅ completato. Nuovo
  `src/backend/wikiforge/semantics/neo4j_client.py` con `Neo4jConfig` frozen
  dataclass (nessun segreto memorizzato, sola variabile d'ambiente nominata da
  `passwordEnv`), costruttori `from_config()` (tabella `[neo4j]` o config
  repository) e `from_env()` (opt-in `NEO4J_ENABLED`, default disabilitato),
  risoluzione database per progetto e upgrade TLS dello schema URI.
  `Neo4jClient` espone `connect()`, `verify_connectivity()`, `session()` e
  `close()` idempotente, più `driver` per i consumer: con `enabled=false` o
  password assente ogni operazione è un no-op e il factory del driver non viene
  mai chiamato. Il driver reale è importato solo dentro il factory di default,
  quindi l'import del modulo riesce anche senza `neo4j` installato e senza
  aprire socket. `driver_factory` è il punto di iniezione usato dai test con un
  fake completo (zero rete). `graph_watcher.py` e `graph_rag_pipeline.py`
  accettano un `neo4j_client` opzionale aggiuntivo: le firme legacy restano
  invariate e il watcher preferisce il driver del client quando presente.
  Verifica: 9 test in `tests/python/test_neo4j_client.py` (import senza driver,
  config/env, TLS, no-op disabilitato e senza password, connect/verify/close con
  fake, failure swallowed, compatibilità costruttori in subprocess con watchdog
  stub) + 91 pre-esistenti; 100 test Python verdi, nessun endpoint o metodo
  pubblico esistente toccato. Gradi C1 2.5, Neo4j ~0.8.

### C2 — Sync vault → Neo4j reale e idempotente

- **Obiettivo**: rendere `graph_watcher.py` una sincronizzazione vera.
- **Modifiche**: query parametrizzate (`$id`, `$title`, `$content`, `$hash`,
  `$revision`), una statement per `session.run()`, metadata
  `wf:source/origin/contentHash/lastModified/revision`, delete con
  `base_parser.slugify()` annidato, `on_moved()` + debounce,
  `LiveGraphWatcher` accetta/forwarda `on_change_callback` opzionale, eventi
  strutturati `{"event":"graph.changed","origin":"vault","path":…,"id":…,
  "revision":…}`.
- **Accettazione**: `tests/test_graph_watcher.py:15-35` passa invariato; test
  fake-driver: un MERGE parametrizzato per nota, delete annidato corretto,
  hash invariato → nessuna scrittura, callback strutturato; senza driver
  resta no-op; avviato con `--project` che risolve `projects/<id>/wiki`.
- **Verifica**: `tests/python/test_graph_watcher_neo4j.py`, pytest, `npm test`.
- **Grado atteso**: C2 1 → 3.5.
- **Risultato (2026-11-22)**: ✅ completato. `graph_watcher.py` ora esegue una
  sincronizzazione reale e idempotente: ogni nota produce un unico `MERGE` Cypher
  parametrizzato (`$id`, `$title`, `$content`, `$hash`, `$revision`) con un
  `session.run()` dedicato e metadata `wf:source`, `wf:origin`,
  `wf:contentHash`, `wf:lastModified`, `wf:revision`. L'hash SHA-256 del testo e
  un contatore di revisione eliminano le scritture ripetute (contenuto
  invariato → zero Cypher e zero eventi), mentre il delete usa lo stesso
  `base_parser.slugify()` annidato del parser (`folder/sub/nested.md` →
  `folder-sub-nested`) in una `MATCH … DETACH DELETE $id` parametrizzata.
  `on_moved()` gestisce i rename come delete + MERGE con un solo paio di
  eventi, il debounce coalesce i doppi eventi watchdog e il nuovo `on_event`
  emette `{"event":"graph.changed","origin":"vault","path":…,"id":…,
  "revision":…,"action":…}` senza toccare la firma legacy
  `on_change_callback(action, path)` che resta maiuscola. Senza driver il
  watcher rimane un no-op per Neo4j ma notifica comunque i callback; con un
  client C1 il `connect()` è lazy e un client disabilitato resta innocuo. La CLI
  accetta `--project <id>` e risolve `projects/<id>/wiki`; `LiveGraphWatcher`
  inoltra i nuovi parametri in modo additivo. Verifica: 9 test in
  `tests/python/test_graph_watcher_neo4j.py` (replica invariata di
  `tests/test_graph_watcher.py:15-35`, un MERGE per nota, no-op su hash
  invariato, revision, delete annidato, move, callback strutturati, forwarding
  e `--project`, errore driver inghiottito); 18 test C1+C2, 109 test Python
  totali, 441 test Node (440 pass + 1 skip pre-esistente). Nessun endpoint,
  envelope o metodo pubblico esistente cambiato. Gradi C2 3.5, Neo4j ~1.2.

### C3 — Cypher live read-only

- **Obiettivo**: eseguire davvero le query generate, in sicurezza.
- **Modifiche**: `Neo4jQueryService.execute_read(cypher, params, project_id)`
  con whitelist `MATCH/RETURN`, timeout, limite righe, binding parametrico;
  `graph_rag_pipeline.execute_cypher_node()` usa il servizio **solo** con
  driver configurato, altrimenti `mode="mock"` esplicito (mai silenzioso);
  rimossi i commenti fuorvianti.
- **Accettazione**: test esistenti mock verdi in modalità esplicita; test con
  fake driver: Cypher parametrizzato, risultati in `graph_results`; query di
  scrittura rifiutate con errore tipizzato.
- **Verifica**: `tests/python/test_graph_rag_live.py`, pytest,
  `docs/GRAPH_RAG.md` aggiornato.
- **Grado atteso**: C4 0 → 3.
- **Risultato (2026-11-22)**: ✅ completato. Nuovo
  `src/backend/wikiforge/semantics/neo4j_query.py` con
  `Neo4jQueryService.execute_read(cypher, params, project_id)`: una sola
  statement `MATCH/RETURN` ammessa (commenti e letterali rimossi prima del
  controllo), rifiuto tipizzato `ReadOnlyViolation` per scritture, procedure,
  multi-statement o `RETURN` mancante, binding sempre tramite mappa parametrica,
  timeout (default 5 s) e `LIMIT` di righe (default 100) applicati lato
  servizio; `project_id` risolve il database via `Neo4jConfig` e gli errori del
  driver sono avvolti in `QueryExecutionError`. Il client C1 resta l'unico
  punto di connessione: il servizio non importa il driver e con client
  disabilitato non apre sessioni. `generate_cypher_node()` ora emette
  `WHERE any(e IN $entities …)` con `cypher_params` dedicati (più nessuna
  interpolazione di entità o commenti con contesto errore) e
  `execute_cypher_node()` sceglie esplicitamente `mode="live"` quando il driver
  è configurato e `mode="mock"` altrimenti, scrivendo il modo nello stato: una
  richiesta live senza driver è un errore tipizzato `query_mode`, mai un
  downgrade silenzioso. I vecchi fixture mock restano identici e sono usati
  solo in modalità mock; gli errori di query finiscono in `error_type`
  (`read_only_violation`, `query_execution_error`, `query_mode`,
  `pipeline_error`). I commenti fuorvianti su "native Neo4j SHOW VECTOR
  INDEXES" e sulla traversal sono stati sostituiti con descrizioni esplicite
  di fixture. Verifica: 19 test in `tests/python/test_graph_rag_live.py`
  (whitelist, letterali/commenti, binding+timeout+LIMIT+database, cap righe,
  errori driver, pipeline live/mock, rifiuto scritture, query generata
  parametrizzata); 5 test legacy in `tests/test_graph_rag.py` verdi in modalità
  mock esplicita; 128 test Python totali, 441 Node invariati.
  `docs/GRAPH_RAG.md` aggiornato. Nessun endpoint, envelope o metodo pubblico
  esistente cambiato. Gradi C4 3, Neo4j ~1.6.

### C4 — Nuove route dichiarative da TS

- **Obiettivo**: esporre query/stato senza toccare i 3 endpoint graph esistenti.
- **Modifiche**: nuove route **additive** in `contracts.ts`/`endpoints.ts`:
  `graph.cypher` (`POST /api/v1/graph/cypher`), `graph.sync.neo4j`
  (`POST /api/v1/graph/sync/neo4j`), `graph.status` (`GET /api/v1/graph/status`);
  nuovi handler nel bus (o estensione di `graphModule.ts`). Da fare **dopo B4**:
  il proxy graph attuale è prima del token.
- **Accettazione**: `IsExact` e `tests/openapi.test.ts` verdi; nuovi path in
  `/api/openapi.json`; `/api/v1/graph/sync|validate|rag` byte-compatibili;
  endpoint protetti come il resto del gateway.
- **Verifica**: `npm run typecheck`, `npm test`, `npm run build`.
- **Grado atteso**: C4 3 → 4, C1 2.5 → 3.5.
- **Risultato (2026-11-22)**: ✅ completato. Tre route **additive** dichiarate
  una sola volta in `contracts.ts`/`endpoints.ts` e servite dal bus:
  `POST /api/v1/graph/cypher` (query read-only C3), `POST /api/v1/graph/sync/neo4j`
  (scan `projects/<id>/wiki` con l'handler idempotente C2) e
  `GET /api/v1/graph/status` (configurazione senza connessioni). Il nuovo
  `semantics/neo4j_api_tool.py` espone `status|query|sync` con envelope
  `{ success, ... }`, errori tipizzati (`read_only_violation`,
  `validation_error`, `invalid_request`, `query_execution_error`) e `mode`
  esplicito `live`/`mock`; la libreria Cypher resta validata prima di qualunque
  uso del driver e la sync non scrive mai vault file. `GraphModule` registra i
  tre nuovi comandi, `pythonTool.ts` accetta `stdin` opzionale e gestisce gli
  errori di spawn, `graph_watcher.py` importa `watchdog` in modo lazy ed espone
  `sync_note()` senza cambiare la firma legacy. Ruoli RBAC espliciti: Reader per
  `graph.cypher`/`graph.status`, Contributor per `graph.sync.neo4j`. Il gate B4
  protegge le nuove route con l'envelope 401 esatto; i tre proxy FastAPI
  `/api/v1/graph/sync|validate|rag` restano byte-compatibili e raggiungibili con
  token valido. OpenAPI passa a 93 endpoint / 88 comandi su bus (`GraphModule` 5).
  Verifica: 5 test Node in `tests/graphRoutes.test.ts`, 11 test Python in
  `tests/python/test_neo4j_api_tool.py` con fake driver e zero rete, 446 test
  Node totali (445 pass + 1 skip pre-esistente), 139 test Python, test legacy
  graph-watcher/GraphRAG invariati. Nessun endpoint, envelope o metodo pubblico
  esistente cambiato. Gradi C4 4, C1 3.5, Neo4j ~1.9.

### C5 — Reverse sync DB → vault via changeset

- **Obiettivo**: la direzione mancante, senza scritture dirette.
- **Modifiche**: reconciler legge nodi con `wf:revision > checkpoint`, genera
  patch Markdown e li **staged** in `changesetStore`; conflitto (hash locale ≠
  hash base) → report e nessuna sovrascrittura; rispetto di
  `agent.confirm_destructive`.
- **Accettazione**: test fake-driver: 1 nodo cambiato → 1 changeset con path e
  frontmatter corretti; nessun file scritto prima di `changesets.apply`;
  conflitto → 0 scritture; provenance `process:neo4j-reconciler` (B5).
- **Verifica**: `tests/neo4jReverseSync.test.ts`, pytest, `okf_lint.py`.
- **Grado atteso**: C5 0 → 3, C3 2.5 → 3.

**Risultato (2026-11-22).** Chiuso. `neo4j_reconciler.reconcile()` legge una
statement read-only con `wf:revision > $checkpoint` tramite C3, ricostruisce il
path vault da `wf:path` (con fallback sicuro all'id) e produce solo JSON:
proposal con frontmatter OKF (`title`, `type`, `tags`, `wf.origin/revision/hash`)
oppure conflict quando l'hash locale non coincide con `wf:baseHash`. C2 ora
scrive `wf:path` e `wf:baseHash` senza cambiare il contratto legacy. Il ponte
`neo4jReverseSync.ts` valida l'envelope, stagea ogni revisione una sola volta in
`ChangesetStore` con `actor: process:neo4j-reconciler` (B5), `requireOriginal` e
sources tipizzate, e avanza il checkpoint solo in assenza di conflitti. Nessun
file vault viene scritto prima di `changesets.apply`; `confirm_destructive=true`
viene rispettato come obbligo di revisione umana, mai come auto-apply. Il
validator C3 ora preserva letterali e nomi di proprietà tra backtick durante la
validazione (necessario per ``n.`wf:revision` ``). 5 test Node e 7 test Python
nuovi (451 Node totali: 450 pass + 1 skip; 146 Python), C2/C4 e GraphRAG legacy
invariati. Nessun endpoint, envelope o metodo pubblico esistente cambiato.

### C6 — Riconciliazione e soppressione echo

- **Obiettivo**: convergenza senza loop infiniti.
- **Modifiche**: metadata `wf:origin` (`browser|watcher|neo4j|reconciler`),
  `wf:baseHash`, `wf:localHash`, `wf:dbHash`, `wf:revision`; dedup id e
  checkpoint store; auto-apply solo per modifiche non conflittuali, conflitti
  in changeset.
- **Accettazione**: test dei 4 scenari (vault→DB, DB→vault, entrambi→conflitto,
  evento ripetuto→nessun duplicato); secondo run idempotente; la scrittura
  DB→vault non torna indietro come nuovo evento vault.
- **Verifica**: `tests/graphReconciliation.test.ts` + test checkpoint;
  validazione completa.
- **Grado atteso**: C5 3 → 4.5, C6 0 → 4.5, C2 3.5 → 4.5.

### C7 — Propagazione real-time al browser

- **Obiettivo**: il grafo UI si aggiorna quando cambia il DB.
- **Modifiche**: `graph:changed` in `AppEvents`; nuova route additiva
  `graph.events` (SSE) dichiarata in `contracts.ts` e consumata via
  `apiBus.stream()`; subscription in `index.ts` → `refreshGraph()` /
  `loadVault(true)`; adapter puro da `GraphData` del server senza cambiare
  `GraphService.generateGraphData()`.
- **Accettazione**: zero `fetch(` nei componenti; test con frame SSE → evento
  `graph:changed` + grafo aggiornato; `npm test`, `typecheck`.
- **Verifica**: `tests/graphEvents.test.ts`, `tests/openapi.test.ts`.
- **Grado atteso**: C7 0 → 5, complessivo Neo4j ~5.

### C8 — Documentazione e collaudo finale

- **Obiettivo**: distinguere pubblicità reale, mock e modalità batch.
- **Modifiche**: `docs/GRAPH_RAG.md`, `docs/TECHNICAL_ARCHITECTURE.md`,
  `docs/ROADMAP.md`, questa tabella e la proiezione wiki; rimuovere le
  affermazioni oggi inesatte (“Cypher eseguito contro il database”,
  “sincronizzazione istantanea Neo4j/RDF”).
- **Accettazione**: tutti i comandi del gate §1.1 verdi; tabella §3 e registro
  §10 aggiornati; commit e push.
- **Grado atteso**: chiusura del piano.

---

## 10. Gate di validazione comune

Da eseguire a ogni step (gli stessi del collaudo S6):

```bash
npm run typecheck
npm test
npm run build
PYTHONPATH=.:scripts pytest tests/python/
python scripts/gen_script_registry.py --check
python scripts/check_docs_sync.py
python scripts/docs_to_wiki.py --check
python scripts/docs_wiki_drift.py --check
python scripts/okf_lint.py wiki
git diff --check
```

Warning pre-esistenti e non bloccanti: `configLoader: 'native'`/ESM di Vite e
chunk >500 kB. Skip pre-esistente: 1 test `opencode CLI not installed`.

---

## 11. Registro aggiornamenti grado

| Data | Step | Capacità | Da | A | Note |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 2026-11-22 | — | studio iniziale | — | — | Baseline misurata: L4 ~2.5, RBAC ~1, Neo4j ~0.5 su 5. Nessuno step implementato. |
| 2026-11-22 | A0 | A2 / A5 · L4 complessivo | 2 / 4 · ~2.5 | 3 / 4.5 · ~3.0 | Gate `cq_gaps` corretto: parsing delle etichette reali di `cq_validator.py`, 8 test dedicati verdi, L4 non raggiungibile con gap aperti. |
| 2026-11-22 | A1 | A2 / A3 · L4 complessivo | 3 / 2.5 · ~3.0 | 3.5 / 3 · ~3.2 | Modello `Finding` unificato e read-only con schema `wikiforge.finding/v1`, ID deterministici e import lazy; 4 adattatori con `--findings` (nessuna scrittura), 4 test Python (schema, determinismo, snapshot), 91 test Python verdi, registry/safety invariati. |
| 2026-11-22 | A2 | A1 · L4 complessivo | 3 · ~3.2 | 4 · ~3.4 | Coda eventi JSONL persistente in `.wiki-forge/`, restore dei bucket al riavvio, dedupe su disco e mark `consumed` prima del trigger; emitter `note.modified` / `note.deleted` nelle scritture API. 5 nuovi test Node (8 in `eventTriggers`, 7 in `agentScheduleF5F6`), 434 test totali (433 pass + 1 skip); 9 job e `auto_apply=false` invariati. |
| 2026-11-22 | A3 | A3 / A4 / A5 · L4 complessivo | 3 / 2 / 4 · ~3.4 | 3.5 / 3 / 4.5 · ~3.6 | Ponte `Finding → changesetStore.stage()` con envelope validata, staging idempotente, `requireOriginal`, snapshot pre-write in apply e `rollback()` che ripristina i byte originali; nessun file scritto prima dell'approvazione umana. Review Studio con tab Proposte via `changesets.list` dell'apiBus tipizzato, zero fetch diretti e nessun endpoint cambiato. 7 nuovi test Node (6 backend + 1 UI), 441 test totali (440 pass + 1 skip); `propose` resta default, A4 non approvato, `auto_apply=false` invariato. |
| 2026-11-22 | B0 | — (nessun cambio) | — | — | Baseline auth fissata da 8 test: token opzionale, envelope 401 esatto, docs pubblici; noti e non corretti il bypass graph (B4) e il reviewer raw (B5). |
| 2026-11-22 | C0 | C1 · Neo4j complessivo | 0 · ~0.5 | 1 · ~0.65 | Config `[neo4j]` dichiarata e disabilitata in 3 file, schema e dipendenze vincolate; 6 test dedicati, nessuna connessione o import del driver. |
| 2026-11-22 | C1 | C1 · Neo4j complessivo | 1 · ~0.65 | 2.5 · ~0.8 | Client Neo4j injettabile con lazy import del driver, config/env opt-in, no-op quando disabilitato o senza password, connect/verify/close idempotenti; watcher e RAG accettano il client senza cambiare le firme legacy. 9 nuovi test Python (zero rete), 100 totali; nessun endpoint o metodo pubblico cambiato. |
| 2026-11-22 | C2 | C2 · Neo4j complessivo | 1 · ~0.8 | 3.5 · ~1.2 | Watcher vault → Neo4j reale: MERGE parametrizzato e metadata `wf:*`, hash/revision idempotenti, delete con slug annidato, `on_moved` + debounce, eventi `graph.changed` strutturati e callback legacy invariato; `--project` risolve `projects/<id>/wiki`. 9 nuovi test Python con fake driver (zero rete), 109 totali, 441 Node; nessun endpoint o metodo pubblico cambiato. |
| 2026-11-22 | C3 | C4 · Neo4j complessivo | 0 · ~1.2 | 3 · ~1.6 | Servizio Cypher read-only con whitelist MATCH/RETURN, binding parametrico, timeout/LIMIT, project→database e errori tipizzati; pipeline in `mode="live"` solo con driver, `mode="mock"` esplicito e mai downgrade silenzioso, query generata con `$entities`. 19 nuovi test Python (zero rete), 128 totali, 5 legacy GraphRAG verdi, `docs/GRAPH_RAG.md` aggiornato; nessun endpoint o metodo pubblico cambiato. |
| 2026-11-22 | C4 | C1 / C4 · Neo4j complessivo | 2.5 / 3 · ~1.6 | 3.5 / 4 · ~1.9 | Tre route TS additive (`graph.cypher`, `graph.sync.neo4j`, `graph.status`) e tre comandi bus in `GraphModule`; CLI Python `status/query/sync` con errori tipizzati, driver lazy e zero rete, `sync_note()` idempotente e watchdog opzionale. Gate B4 e ruoli RBAC espliciti, proxy graph legacy byte-compatibile, OpenAPI 93 endpoint / 88 comandi. 5 test Node + 11 Python nuovi (446 Node, 139 Python), legacy invariati; nessun endpoint, envelope o metodo pubblico esistente cambiato. |
| 2026-11-22 | B1 | B1 · RBAC complessivo | 0.5 · ~1 | 1.5 · ~1.5 | Principal server-derived opzionale nel bus, derivazione in `auth/principal.ts`, popolamento in `dispatchApiCommand`; body/header non possono sovrascriverlo; 6 test dedicati, nessun enforcement. |
| 2026-11-22 | B2 | B1 / B2 · RBAC complessivo | 1.5 · 0 · ~1.5 | 2 · 1 · ~2 | Schema enterprise con auth/roles/projectAcls, 4 ruoli canonici in 3 config, lettore TOML Node con default; 4 test Python + 6 Node, `enable_rbac=true` da solo non cambia risposte. |
| 2026-11-22 | B3 | B2 / B3 · RBAC complessivo | 1 · 2.5 · ~2 | 3.5 · 4 · ~3.0 | Gate opt-in sul bus: matrice 84 comandi → 4 ruoli (unknown = Admin), ACL per cartella, 403 con envelope esistente, `context.rbac`, filtri membership su progetti/approvazioni; 28 test Node, B0 invariato. |
| 2026-11-22 | B4 | B1 · RBAC complessivo | 2 · ~3.0 | 4.5 · ~3.0 | Confronto token constant-time e controllo prima del proxy graph: 401 B0 su graph senza/errato token, proxy raggiungibile con token valido, docs/OPTIONS pubblici, drift `WIKIFORGE_API_TOKEN` corretto; 13 nuovi test Node, B0/B3 invariati. |
| 2026-11-22 | B5 | B4 · RBAC complessivo | 3 · ~3.0 | 4.5 · ~3.5 | Attore canonico condiviso TS/Python; strict mode vincola verify, F6 e changeset al Principal, flag `--allow-process-actor` F6-only, guard `stable-requires-human-actor`; legacy invariato. 10 test Node + 4 Python, suite 408 pass + 1 skip. |
| 2026-11-22 | B6 | B1 / B2 · RBAC complessivo | 4.5 / 3.5 · ~3.5 | 5 / 5 · ~4.5 | Adapter OIDC/JWKS, SAML e OAuth2 dietro `enable_rbac` + `auth.provider`; bearer dedicato, 401 B0 invariato, ruoli claim nella matrice B3 senza inheritance ACL; 10 test mock zero-rete, suite 418 pass + 1 skip. |
| 2026-11-22 | B7 | B5 · RBAC complessivo | 0 · ~4.5 | 5 · 5 | Identità UI via solo transport tipizzato: `GET /api/auth/me` additiva e pubblica in modalità anonima, bearer dedicato dall'app-store, chip/gating solo per IdP verificato, attore strict negli strumenti di review; 13 test UI/auth + 4 assert OpenAPI, suite 428 pass + 1 skip. Pilastro RBAC completo. |
| 2026-11-22 | C5 | C3 / C5 · Neo4j complessivo | 2.5 / 0 · ~1.9 | 3 / 3 · ~2.5 | Reverse sync DB → vault come proposta: query read-only `wf:revision > checkpoint`, frontmatter OKF e conflitto su `wf:baseHash`; C2 aggiunge `wf:path`/`wf:baseHash`, CLI `reconcile` emette solo JSON e il ponte TS stagea con `process:neo4j-reconciler`, dedupe e checkpoint. Nessun file vault prima di `changesets.apply`, `confirm_destructive` come revisione obbligatoria; 5 test Node + 7 Python (451 Node: 450 pass + 1 skip, 146 Python), legacy invariati. |

> **Istruzione per il manutentore**: quando chiudi uno step, aggiungi qui una
> riga con il grado nuovo, aggiorna la colonna “Dopo step” in §3 e lo stato in
> §2 nello **stesso commit**. Il grado complessivo è la media dei componenti
> del track; non arrotondare mai verso l'alto in assenza di test verdi.
