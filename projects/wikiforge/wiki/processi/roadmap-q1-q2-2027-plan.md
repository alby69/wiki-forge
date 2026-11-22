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

> **Stato: studio completato, piano approvato, implementazione avviata (3/23 step: A0 ✅, B0 ✅, C0 ✅).**
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
| A1 | ⬜ | — |
| A2 | ⬜ | — |
| A3 | ⬜ | — |
| A4 | ⬜ — **richiede approvazione utente** | — |
| A5 | ⬜ | — |
| B0 | ✅ | `tests/authCharacterization.test.ts` (8 test di baseline, nessun cambio funzionale) |
| B1 | ⬜ | — |
| B2 | ⬜ | — |
| B3 | ⬜ | — |
| B4 | ⬜ | — |
| B5 | ⬜ | — |
| B6 | ⬜ | — |
| B7 | ⬜ | — |
| C0 | ✅ | `[neo4j]` in 3 config, `config_schema.py`, `requirements.txt`, `tests/python/test_config_schema.py` (6 nuovi test) |
| C1 | ⬜ | — |
| C2 | ⬜ | — |
| C3 | ⬜ | — |
| C4 | ⬜ | — |
| C5 | ⬜ | — |
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
A5 4.5, L4 ~3.0; dopo C0: C1 1, Neo4j ~0.65; gli altri valori coincidono
ancora con “Oggi”).

| ID | Capacità | Oggi | Dopo step | Target Q2 |
| :--- | :--- | :---: | :---: | :---: |
| A1 | Scheduler, trigger e stato persistente (F0–F6, S0–S6) | 3 | 3 | 5 |
| A2 | Rilevamento gap / entità orfane / incoerenze | 2 | 3 | 5 |
| A3 | ODP proattivi e generazione note | 2.5 | 2.5 | 5 |
| A4 | Validazione, auto-repair e rollback | 2 | 2 | 5 |
| A5 | Guardrail, approvazione e audit | 4 | 4.5 | 5 |
| — | **Complessivo L4** | **~2.5** | **~3.0** | **4.5–5** |
| B1 | Autenticazione / identità del chiamante | 0.5 | 0.5 | 5 |
| B2 | Ruoli e matrice permessi (Reader/Contributor/KE/Admin) | 0 | 0 | 5 |
| B3 | Isolamento progetto/cartella e membership | 2.5 | 2.5 | 5 |
| B4 | Provenance `human:<id>` / `process:<id>` vincolata | 3 | 3 | 5 |
| B5 | UI identità e sessione | 0 | 0 | 5 |
| — | **Complessivo RBAC** | **~1** | **~1** | **5** |
| C1 | Driver e configurazione Neo4j | 0 | 1 | 5 |
| C2 | Watcher vault → Neo4j (graph_watcher.py) | 1 | 1 | 5 |
| C3 | Export Cypher/RDF batch | 2.5 | 2.5 | 4 |
| C4 | Interrogazione Cypher live | 0 | 0 | 5 |
| C5 | Sync Neo4j → vault Markdown | 0 | 0 | 5 |
| C6 | Riconciliazione e soppressione echo | 0 | 0 | 5 |
| C7 | Propagazione real-time al browser | 0 | 0 | 5 |
| — | **Complessivo Neo4j** | **~0.5** | **~0.65** | **5** |

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
  noti** (e non corretti) il bypass del proxy graph — 502 senza token quando
  FastAPI è irraggiungibile, da chiudere in B4 — e il `reviewer` raw del body
  con default `'human'` (B5). Nessun file di produzione modificato.

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
| 2026-11-22 | B0 | — (nessun cambio) | — | — | Baseline auth fissata da 8 test: token opzionale, envelope 401 esatto, docs pubblici; noti e non corretti il bypass graph (B4) e il reviewer raw (B5). |
| 2026-11-22 | C0 | C1 · Neo4j complessivo | 0 · ~0.5 | 1 · ~0.65 | Config `[neo4j]` dichiarata e disabilitata in 3 file, schema e dipendenze vincolate; 6 test dedicati, nessuna connessione o import del driver. |

> **Istruzione per il manutentore**: quando chiudi uno step, aggiungi qui una
> riga con il grado nuovo, aggiorna la colonna “Dopo step” in §3 e lo stato in
> §2 nello **stesso commit**. Il grado complessivo è la media dei componenti
> del track; non arrotondare mai verso l'alto in assenza di test verdi.
