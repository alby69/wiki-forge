---
type: Process
title: "Piano — Agenti schedulati per la manutenzione autonoma della wiki (KE Workbench)"
description: "Trasformare i 6 Guided Use Cases del KE Workbench, oggi eseguibili solo a"
resource: docs/KE_AGENT_SCHEDULER_PLAN.md
tags: [scope/docs, layer/generated, area/processi, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-ke-agent-scheduler-plan-md
    resource: docs/KE_AGENT_SCHEDULER_PLAN.md
    title: "Piano — Agenti schedulati per la manutenzione autonoma della wiki (KE Workbench)"
    author: human:alby69
---
# Piano — Agenti schedulati per la manutenzione autonoma della wiki (KE Workbench)

> **Stato: piano approvato — F0, F1, F2, F3 e F4 implementati.** Le decisioni
> di §12 sono state confermate: orari OK, `auto_apply = false`, parser cron con
> la libreria leggera `cron-parser`, F5 rimandata dopo F1–F4. F0 è un refactor
> trasparente, F1 valida la configurazione, F2 espone la classe `Scheduler` con
> clock, lock, stato e timers iniettati, F3 la avvia dentro `httpServer.ts`
> collegandola a `runUseCase()` e alle API REST/SSE e F4 aggiunge la tab
> **🤖 Agenti & Schedule** al KE Workbench. Restano sospese solo F5 e F6.
>
> Autore: analisi del codice esistente (`agentServer.ts`, `scripts/`, `config/`).
> Pubblico: Knowledge Engineer e manutentore del progetto.

### Avanzamento

| Fase | Stato | Artefatti |
| :--- | :--- | :--- |
| F0 | ✅ | `src/backend/server/useCaseRunner.ts`, `tests/useCaseRunner.test.ts`; endpoint SSE invariato |
| F1 | ✅ | `scheduler/cron.ts`, `scheduler/jobStore.ts`, `config/agent_schedule.toml`, `tests/agentScheduler.test.ts`, dipendenza `cron-parser` |
| F2 | ✅ | `scheduler/scheduler.ts`, `scheduler/runtimeState.ts`, `scheduler/lock.ts`, `tests/agentSchedulerEngine.test.ts`, test abort in `tests/useCaseRunner.test.ts`; supporto `AbortSignal` in `useCaseRunner.ts`, nuove voci in `.gitignore` |
| F3 | ✅ | `agentServer.ts` (lifecycle, adapter, endpoint REST/SSE), `httpServer.ts` (avvio + `SIGINT`/`SIGTERM`), `scheduler/scheduler.ts` (subscribe, override, cancel, `use_case_event`), `tests/agentScheduleApi.test.ts` |
| F4 | ✅ | `KEWorkbenchModal.ts` (tab, card, toggle, Esegui ora, annulla, orario, storico), `schedulePanel.ts` (view model e parsing SSE), `tests/schedulePanel.test.ts`, `tests/keWorkbenchSchedule.test.ts` |
| F5–F6 | ⬜ | Prossime fasi (vedi §9) |

---

## 1. Obiettivo

Trasformare i 6 **Guided Use Cases** del KE Workbench, oggi eseguibili solo a
 mano, in **job ricorrenti** eseguiti da "agenti" (lavoratori automatici con un
 ruolo KE) che:

1. lanciano i Use Case a orari stabiliti o al verificarsi di eventi;
2. producono report e log tracciabili;
3. non modificano la wiki senza una soglia di sicurezza (dry-run + approvazione);
4. sono visibili e governabili dalla stessa UI del Workbench.

Il principio guida è **non riscrivere nulla**: gli script Python e l'endpoint SSE
esistenti restano l'unica fonte di verità.

---

## 2. Cosa esiste già e viene riutilizzato

| Asset esistente | Posizione | Ruolo nel piano |
| :--- | :--- | :--- |
| `KE_USE_CASES` (6 definizioni con step e argomenti) | `src/backend/server/agentServer.ts` | Registro dei job: non duplicare gli ID |
| `SCRIPT_REGISTRY` + `buildCliArgs()` | `src/backend/server/agentServer.ts` | Esecuzione degli script Python |
| `POST /api/ke/use-cases/execute` (SSE) | `src/backend/server/agentServer.ts` | Motore di esecuzione da estrarre e condividere |
| 16 script CLI Python | `scripts/*.py` | Lavoro effettivo (già testato) |
| Health engine | `src/backend/wikiforge/api/health.py` | Segnale per l'eventuale Policy Agent |
| Versioning / snapshot | `scripts/versioning.py`, `wiki/versions/`, `.wiki-forge/snapshots/` | Snapshot prima dei job mutanti |
| Review Studio | `src/frontend/components/ke/ReviewStudio.ts` | Approvazione umana dei cambiamenti |
| `smol-toml` | `package.json` | Parsing della configurazione TOML |
| `graph_watcher.py` | `src/backend/wikiforge/watcher/graph_watcher.py` | Trigger basati su eventi (F6) |
| `LogConsole` | `src/frontend/components/tools/LogConsole.ts` | Visualizzazione dei log nella UI |

Nota operativa già documentata: l'API gira con `tsx` senza hot-reload
(`docker compose restart api` dopo le modifiche a `src/backend/server/**`).

---

## 3. Architettura: due livelli separati

```text
        ┌───────────────────────────────────────────────────────────┐
        │  KE Workbench UI (nuova tab "Agenti & Schedule")          │
        │  job card · prossima corsa · ultimo esito · Esegui ora    │
        └───────────────────────────┬───────────────────────────────┘
                                    │ REST + SSE
        ┌───────────────────────────▼───────────────────────────────┐
        │  AgentServer (processo API, sempre attivo)                │
        │  ┌──────────────┐   ┌──────────────────┐   ┌────────────┐ │
        │  │ Scheduler    │──►│ UseCaseRunner    │──►│ script.py  │ │
        │  │ (quando)     │   │ (riutilizzato)   │   │ subprocess │ │
        │  └──────┬───────┘   └──────────────────┘   └────────────┘ │
        │         │ opzionale (F5)                                  │
        │  ┌──────▼───────┐   ┌──────────────────┐                  │
        │  │ Policy Agent │──►│ health / reports │                  │
        │  │ (cosa)       │   │ → scelta UC      │                  │
        │  └──────────────┘   └──────────────────┘                  │
        └───────────────────────────────────────────────────────────┘
```

- **Scheduler** = deterministica, auditabile, senza LLM. È il cuore della
  manutenzione automatica.
- **Policy Agent** = opzionale; usa l'health engine e i report dei Use Case per
  decidere *quale* UC lanciare, lasciando traccia della decisione. Va
  introdotto solo dopo che lo scheduler è stabile (F5).

### 3.1 Perché lo scheduler sta nel server API, non nel browser

L'app può essere chiusa (anche nella shell Tauri): un `setInterval` nel
frontend smetterebbe di girare. Il processo `api` (container Docker o
`httpServer.ts`) è sempre attivo ed è l'unico che conosce `rootDir`, i progetti
e i permessi di scrittura. Lo scheduler va quindi inizializzato in
`httpServer.ts` accanto ad `AgentServer`.

### 3.2 Nuovi file previsti

F0–F4 sono già reali: `useCaseRunner.ts`, `scheduler/cron.ts`,
`scheduler/jobStore.ts`, `scheduler/scheduler.ts`, `scheduler/runtimeState.ts`,
`scheduler/lock.ts`, `config/agent_schedule.toml`, il collegamento in
`agentServer.ts`/`httpServer.ts`, la tab in `KEWorkbenchModal.ts`, il modulo
`schedulePanel.ts` e i relativi test.
Gli altri file della tabella sono ancora da creare nelle fasi successive.

| File | Contenuto |
| :--- | :--- |
| `src/backend/server/useCaseRunner.ts` | `runUseCase(id, args, onEvent)` estratto dall'handler SSE attuale |
| `src/backend/server/scheduler/cron.ts` | Parser cron 5 campi, `interval`, `at`; funzioni pure |
| `src/backend/server/scheduler/jobStore.ts` | Caricamento/validazione TOML + stato runtime |
| `src/backend/server/scheduler/scheduler.ts` | Loop, lock, retry, timeout, shutdown, event emitter |
| `src/backend/server/scheduler/policyAgent.ts` | (F5) decisione LLM con log audit |
| `config/agent_schedule.toml` | Configurazione versionata dei job |
| `.wiki-forge/scheduler-state.json` | Ultimo esito, `next_run_at`, conteggio errori (gitignored) |
| `.wiki-forge/scheduler.lock` | Lock con PID per evitare doppie istanze |
| `output/scheduler/<job>-<timestamp>.log` | stdout/stderr di ogni corsa |
| `src/frontend/components/ke/AgentSchedulePanel.ts` | Tab UI nel KE Workbench |

---

## 4. Modello dati e configurazione

### 4.1 `config/agent_schedule.toml`

```toml
[agent.scheduler]
enabled = true
timezone = "Europe/Rome"        # salviamo in UTC, mostriamo in locale
max_concurrency = 1             # gli script scrivono su wiki/: serializzare
default_timeout_seconds = 900
log_dir = "output/scheduler"

[[agent.scheduler.jobs]]
id = "nightly-validation"
role = "Ontology Guardian"       # ruolo CommonKADS, solo documentazione
use_case = "ke_ontological_validation"
schedule = "0 2 * * *"           # min ora giorno mese giorno-settimana
enabled = true
project = "default"
args = { wiki_dir = "wiki" }
auto_apply = false               # true solo per job che non toccano la wiki
max_retries = 2

[[agent.scheduler.jobs]]
id = "weekly-cq-audit"
role = "Knowledge Auditor"
use_case = "ke_cq_assessment"
schedule = "20 2 * * 0"          # domenica 02:20
enabled = true
args = {}
auto_apply = false
max_retries = 1

[[agent.scheduler.jobs]]
id = "monthly-maturity"
role = "Governance Analyst"
use_case = "ke_maturity_eval"
schedule = "0 3 1 * *"           # il 1° del mese
enabled = false                  # spento finché non si approva il write
args = { write = false }         # sovrascrive i default dello step
auto_apply = false
```

Override per progetto: `projects/<id>/agent_schedule.toml`, con merge sulla
configurazione globale. Validazione all'avvio: ogni `use_case` deve esistere in
`KE_USE_CASES`, ogni `args` deve essere accettato da `buildCliArgs()`, gli ID
devono essere univoci. Un job invalido viene disabilitato e segnalato nella UI,
non fa cadere il server.

### 4.2 Stato runtime

```json
{
  "version": 1,
  "jobs": {
    "nightly-validation": {
      "last_run_at": "2026-11-19T02:00:12Z",
      "last_status": "success",
      "last_duration_ms": 41200,
      "next_run_at": "2026-11-20T02:00:00Z",
      "consecutive_failures": 0,
      "retry_count": 0,
      "last_log": "output/scheduler/nightly-validation-....log"
    }
  }
}
```

Stati: `idle → scheduled → running → success | failed | skipped | cancelled`.
`skipped` vale quando il job è già in corso (single-flight) o disabilitato.
Il file (`.wiki-forge/scheduler-state.json`) è scritto in modo atomico
(temp + rename) ed è gitignored: uno stato corrotto o assente viene
ricostruito dalla configurazione senza bloccare l'avvio. Al riavvio, un job
trovato in `running` è marcato `failed` con
`last_error = "interrupted by scheduler restart"` e ripartito subito.

Artefatti locali di F2 (tutti gitignored o sotto `output/`):
`.wiki-forge/scheduler.lock` (PID + hostname, lock stale ripreso
automaticamente), `output/scheduler/<job>-<timestamp>.log` (output redatto) e
`output/scheduler/audit.jsonl` (una riga JSON per corsa con `actor:
"scheduler"`, esiti, codici di uscita e percorso del log).

---

## 5. Classificazione dei 6 Use Case — cosa automatizzare subito

La distinzione decisiva è **chi scrive**: `output/` è sicuro, `wiki/` no.

| UC | Step | Effetto | Automatizzare |
| :--- | :--- | :--- | :--- |
| 1 — Schema & Taxonomy | `schema_infer`, `schema_lint` | lettura | ✅ subito |
| 1 — Schema & Taxonomy | `suggest_tags` (default `all`, senza `--write`) | lettura/suggerimenti | ✅ subito; se si passa `write=true` serve approvazione |
| 2 — Ontological Validation | `ontology_rules`, `okf_lint` | lettura | ✅ subito, quotidiane |
| 3 — CQ & Coverage | `cq_validator` → `output/`, `wiki_stats` → `docs/METRICS.md` | report | ✅ subito (fuori da `wiki/`) |
| 4 — Neuro-Symbolic & ODP | `odp_suggester`, `neuro_symbolic_check` → `output/` | report | ✅ subito |
| 5 — Semantic Export | `export_semantic` → `output/` | report | ✅ subito |
| 5 — Semantic Export | `okf_reindex` → `wiki/index.md` + MOC | **scrive wiki/** | ⚠️ solo con snapshot + approvazione |
| 6 — Maturity | `ke_maturity` → `output/` | report | ✅ subito |
| 6 — Maturity | `maturity_calculator` (default `write: true`) | **scrive frontmatter** | ⚠️ default da cambiare a `dry-run` nel job |

**Schedule consigliato al primo rilascio** (tutto in modalità sicura):

| Orario | Job | Use Case |
| :--- | :--- | :--- |
| 02:00 ogni giorno | `nightly-validation` | UC2 |
| 02:20 ogni giorno | `daily-cq-coverage` | UC3 |
| 03:00 domenica | `weekly-neuro-symbolic` | UC4 |
| 04:00 domenica | `weekly-rdf-export` | UC5 (solo `export_semantic`, step 1) |
| 03:00 il 1° del mese | `monthly-maturity` | UC6 (step 2, report) |
| — | UC1 | manuale o settimanale in sola lettura |
| su `note.created` (debounce 5m, disabilitato) | `note-created-review` (F6) | UC1 (step 0 in sola lettura; step 2 in approvazione) |

---

## 6. Motore di scheduling

1. **Trigger supportati**
   - `cron`: 5 campi, risolti in `next_run_at`; timezone configurato, orari
     salvati in UTC.
   - `interval`: `"every=6h"` / `"every=30m"` come alternativa leggibile.
   - `event`: pubblicato da watcher/webhook (F6), con *debounce* di 5 minuti.
   - manuale: `POST /api/ke/schedule/:id/run` (usato anche dal pulsante UI).
2. **Tick**: un solo timer di 30s in `AgentServer`; per ogni job confronta
   `now >= next_run_at`. Niente timer per job → niente deriva temporale.
3. **Single-flight**: `runningJobs: Set<string>`; se il job è già in corso,
   registra `skipped` e riprogramma il prossimo slot.
4. **Lock inter-processo**: `.wiki-forge/scheduler.lock` con PID; all'avvio, se
   il PID non è vivo, il lock viene ripreso. Evita due container che scrivono
   la stessa wiki.
5. **Concorrenza**: `max_concurrency = 1` di default; i job mutanti non
   possono girare in parallelo con nessun altro job.
6. **Timeout e abort**: `AbortController` per job; su timeout lo step viene
   ucciso e il job marcato `failed` con motivo.
7. **Retry**: `max_retries` con backoff 1m, 5m; dopo l'ultimo fallimento il
   job resta abilitato ma viene segnalato in UI (nessun silenzio).
8. **Shutdown**: `SIGINT`/`SIGTERM` ferma il loop e attende la fine del job
   attivo (o lo cancella dopo il timeout).

**Implementazione F2** (`scheduler/scheduler.ts`): tutti i confini I/O sono
iniettati — `now()`, `setTimeoutFn`/`clearTimeoutFn`, `stateStore`, `lock`,
`executeJob` e `onEvent`. Il loop è un solo timer che si riarma dopo il
completamento del tick (nessuna sovrapposizione, nessuna deriva). I job
eleggibili vengono avviati in parallelo fino a `max_concurrency`; l'aggiunta a
`runningJobs` avviene in modo sincrono prima del primo `await`, quindi il limite
vale anche dentro lo stesso tick. Il runner era già stato esteso in F2 con un
`signal?` opzionale che uccide il processo figlio e attende l'evento `close`
prima di risolvere (codice di uscita convenzionale 124); il comportamento SSE
senza segnale resta identico.

**Implementazione F3**: `AgentServer.executeScheduledJob()` è l'adapter tra
`Scheduler` e `runUseCase()` — passa l'`AbortSignal` del job e usa `stepIndices`
per saltare gli step che scrivono nella wiki. Il run manuale SSE inoltra gli
eventi originali del runner dentro eventi `use_case_event`, quindi il contratto
è lo stesso di `/api/ke/use-cases/execute`. `subscribe()` permette ai client SSE
di ricevere `job_started`/`job_output`/`job_finished` in tempo reale. I toggle
di F3 (`PATCH`) sono salvati in `scheduler-state.json` come override e
riapplicati all'avvio senza riscrivere il TOML, che resta la fonte di verità.
Un annullamento manuale riporta il job allo slot cron regolare; un
annullamento per shutdown viene recuperato subito al riavvio.

---

## 7. Governance e sicurezza

- **Dry-run di default**: i job con step che scrivono su `wiki/` devono avere
  `auto_apply = false`. Il report finisce in `output/scheduler/` e la UI mostra
  un pulsante *Applica* che passa da Review Studio.
- **Snapshot prima della mutazione**: richiamo di `scripts/versioning.py` per
  le note coinvolte; rollback disponibile con `/rollback`.
- **Audit log**: `output/scheduler/audit.jsonl` con `{job, useCase, startedAt,
  endedAt, status, exitCodes, filesChanged, actor="scheduler"}`. I file di log
  non contengono token o chiavi (redazione di `api_key`/`token`).
- **Isolation progetto**: `projectId` viene passato a `resolveProjectRoot()` e
  a `buildCliArgs()` esattamente come nel percorso manuale.
- **RBAC**: se `[enterprise].enable_rbac = true`, run manuali e toggle richiedono
  il ruolo KE; i job schedulati girano con il ruolo di sistema.
- **Autorità sull'LLM**: nella F1–F4 lo scheduler non chiama l'LLM; decisioni e
  output sono deterministici e verificabili. In F5 l'LLM è **consultivo** e non
  può autorizzare mutazioni: restituisce al massimo una scelta tra gli step in
  sola lettura. Una risposta non valida o un LLM assente fa scattare la regola
  deterministica (fail-closed) e la decisione viene comunque registrata con
  rationale e fonti. Ogni step mutante resta soggetto ad approvazione umana.

---

## 8. API e UI

| Endpoint | Metodo | Scopo |
| :--- | :--- | :--- |
| `/api/ke/schedule` | GET | Job, stato, `next_run_at`, ultimo esito |
| `/api/ke/schedule/:id` | PATCH | Abilita/disabilita, cambia orario |
| `/api/ke/schedule/:id/run` | POST | Esecuzione immediata (SSE, riusa `runUseCase`) |
| `/api/ke/schedule/:id/cancel` | POST | Annulla il job in corso |
| `/api/ke/schedule/runs` | GET | Storico con filtro per job |
| `/api/ke/schedule/events` | GET (SSE) | Stato live per la UI |
| `/api/ke/schedule/decisions` | GET (F5) | Decision log con rationale e fonti, filtrabile per job |
| `/api/ke/schedule/approvals` | GET (F6) | Coda approvazioni, filtrabile per job/stato |
| `/api/ke/schedule/trigger` | POST (F6) | Webhook evento (`note.created`/`modified`/`deleted`) |
| `/api/ke/schedule/approvals/:id/approve` | POST (F6) | Esegue lo step mutante dopo approvazione umana |
| `/api/ke/schedule/approvals/:id/reject` | POST (F6) | Rifiuta lo step mutante senza eseguirlo |

Tutti gli endpoint sono protetti dallo stesso token API (`WIKIFORGE_API_TOKEN`)
del resto del server; RBAC per ruolo (§7) resta un'estensione futura. L'health
check è `GET /api/ke/schedule`: `errors` segnala i job invalidi senza bloccare
l'avvio del server.

La tab **🤖 Agenti & Schedule** è implementata in F4 nel KE Workbench: una card
per job con ruolo, Use Case, cron leggibile ("ogni giorno alle 02:00"), prossima
corsa, ultimo esito, interruttore on/off, **Esegui ora**, **Annulla** e un campo
per cambiare l'orario (sempre via `PATCH`). La sidebar mostra lo stato del lock
e gli ultimi run; il `LogConsole` esistente riceve gli eventi del run manuale
(scheduler + `use_case_event`) e lo stream live aggiorna le card. La console
resta nascondibile/ridimensionabile come richiesto per il Workbench.

F5/F6 aggiungono nella stessa tab una sezione **Policy & Approvazioni**: le
decisioni recenti mostrano azione, origine (LLM/fallback), rationale e fonti,
mentre gli step mutanti in attesa mostrano job, step e pulsanti espliciti
**✅ Approva** / **❌ Rifiuta**. Lo stream live aggiorna la sezione quando arriva
una `policy_decision`, un'`approval_required` o un `event_triggered`.

---

## 9. Fasi di attuazione

| Fase | Contenuto | Effort | Criterio di accettazione |
| :--- | :--- | :--- | :--- |
| **F0** | Estrarre `runUseCase()` condiviso da SSE e scheduler | ½ giorno | I test SSE esistenti passano senza cambi di comportamento |
| **F1** | Parser cron/interval + validazione config, test puri | 1 giorno | Cron invalido respinto; `next_run_at` corretto con timezone |
| **F2** ✅ | Scheduler loop, lock, retry, timeout, stato su disco | 2 giorni | ✅ Verificato: 3 slot consecutivi senza duplicazioni, single-flight, restart con recupero di run interrotti, backoff 1m/5m, timeout con abort, audit redatto — 11 test in `tests/agentSchedulerEngine.test.ts` (uno aggiunto in F3 per le due politiche di annullamento) |
| **F3** ✅ | API REST/SSE + avvio in `httpServer.ts` | 1 giorno | ✅ Verificato: snapshot con errori di config, PATCH con override persistenti e cron invalido respinto, run manuale SSE con eventi del runner, audit filtrabile, stream live, annullamento e shutdown — 8 test in `tests/agentScheduleApi.test.ts` |
| **F4** ✅ | Tab UI nel Workbench | 1½ giorno | ✅ Verificato: tab con card per job, toggle e cambio orario persistenti, "Esegui ora" con log SSE, annulla, stream live e storico esiti — 10 test in `tests/schedulePanel.test.ts` e `tests/keWorkbenchSchedule.test.ts` |
| **F5** ✅ | Policy Agent (LLM) con decision log | 1–2 giorni | ✅ Verificato: 7 test in `tests/policyAgent.test.ts`; ogni decisione ha rationale e fonti, gli step mutanti sono hard-blocked anche se l'LLM li richiede, l'LLM assente/invalido usa il fallback deterministico registrato, i segreti sono redatti |
| **F6** ✅ | Trigger da eventi (watcher/webhook) + approvazione mutanti | 1 giorno | ✅ Verificato: 5 test in `tests/eventTriggers.test.ts` e 5 in `tests/agentScheduleF5F6.test.ts`; `note.created` → job dopo debounce, step mutante accodato ed eseguito solo dopo `POST .../approve` con snapshot e audit `actor: human` |

**Sequenza completata**: F0 → F1 → F2 → F3 → F4 → collaudo → F5 → F6. La wiki
si auto-aggiorna con report in sola lettura; gli step che scrivono restano
sottoposti a decisione umana esplicita.

---

## 10. Test

- **Unitari** (`tests/*.test.ts` con `tsx`): parser cron, clamp, calcolo
  `next_run_at`, validazione job, backoff, redazione log.
- **Integrazione F2** (`tests/agentSchedulerEngine.test.ts`, 11 test): clock e
  timer iniettati, `rootDir` temporaneo, lock e store su disco; copre 3 slot
  consecutivi senza duplicazioni, single-flight, persistenza/recupero al
  restart, lock PID (live vs stale), backoff 1m/5m, esaurimento retry, timeout
  con abort, `max_concurrency`, audit redatto e configurazione disabilitata;
  il test aggiunto in F3 verifica che l'annullamento manuale torni allo slot
  cron e che quello da shutdown venga recuperato subito. `tests/useCaseRunner.test.ts`
  aggiunge un test di abort del processo figlio.
- **Integrazione F3** (`tests/agentScheduleApi.test.ts`, 8 test): `AgentServer`
  con `rootDir` temporaneo, `scripts/` copiati nel progetto finto e
  `agent_schedule.toml` locale; copre snapshot e errori di config, toggle con
  override persistenti, cron invalido, run manuale SSE con eventi del runner,
  audit filtrato per job, stream live, 404/409 e configurazione invalida che
  non avvia lo scheduler.
- **Integrazione F4** (`tests/keWorkbenchSchedule.test.ts`, 2 test): DOM mock
  minimalista, fetch mock delle API F3; verifica il rendering delle tab, il
  caricamento dello snapshot, l'apertura dello stream live e le card job.
  `tests/schedulePanel.test.ts` (8 test) copre view model, formattazione UTC,
  parsing SSE a chunk e mapping degli eventi nel LogConsole.
  F5/F6 aggiungono due test in `tests/schedulePanel.test.ts` (view model e
  nuovi eventi SSE) e estendono il mock API in `tests/keWorkbenchSchedule.test.ts`.
- **Integrazione F5** (`tests/policyAgent.test.ts`, 7 test): decisione LLM valida
  con rationale/fonti, guardia anti-mutazione, fallback deterministico e
  redazione dei segreti, lettura del log newest-first con filtro e righe corrotte.
- **Integrazione F6** (`tests/eventTriggers.test.ts`, 5 test e
  `tests/agentScheduleF5F6.test.ts`, 5 test): debounce con timer iniettati,
  deduplicazione per percorso, filtro per job/evento/progetto, validazione del
  webhook, coda di approvazione, rifiuto senza esecuzione e approvazione con
  audit umano e snapshot.
- **Totale**: 229 test, 228 superati, 1 saltato.
- **Regressone**: i test correnti `tests/keUseCases.test.ts` devono passare
  identici dopo F0.
- **Python**: `pytest tests/test_*.py` invariato; gli script non cambiano
  (F6 imposta solo `PYTHONIOENCODING=utf-8` per evitare errori `charmap` su
  Windows).

---

## 11. Rischi e mitigazioni

| Rischio | Mitigazione |
| :--- | :--- |
| Due istanze scrivono la stessa wiki | Lock con PID + `max_concurrency = 1` |
| Job mutante danneggia note | `auto_apply = false`, guardia F5 sugli script mutanti, snapshot, Review Studio, rollback, approvazione umana F6 |
| Ore/DST sbagliate | Salvataggio UTC, conversione solo in UI |
| Processo API chiuso durante il job | Timer nel server, non nel browser; retry al riavvio |
| Log con segreti | Redazione di token/api key prima di scrivere su disco |
| LLM non deterministico (F5) | Decision log + approvazione umana obbligatoria |
| Config errata | Validazione all'avvio, job invalido disabilitato e segnalato |

---

## 12. Decisioni (approvate)

1. **Orari**: confermati, così come riportati in §5 e in
   `config/agent_schedule.toml`.
2. **Auto-apply**: `auto_apply = false` per tutti i job; il validatore di F1
   forza comunque `false` e segnala un errore se un file lo imposta a `true`.
3. **Parser cron**: libreria leggera **`cron-parser`** (CommonJS, già
   dipendenza di `package.json`); il modulo `scheduler/cron.ts` aggiunge solo
   il formato `every=<n>m|h|d` e la descrizione leggibile per la UI.
4. **Policy Agent LLM (F5)**: F2–F4 restano deterministici e senza chiamate LLM.
   F5 aggiunge un livello consultivo e fail-closed: l'LLM può soltanto restringere
   gli step in sola lettura; rationale e fonti sono obbligatori per ogni
   decisione, l'output non valido ricade sulla regola deterministica e nulla
   viene mutato automaticamente.
5. **Mutazioni (F5/F6)**: `suggest_tags`, `okf_reindex` e `maturity_calculator`
   sono hard-blocked dall'esecuzione automatica. Vengono accodati in
   `.wiki-forge/scheduler-approvals.json` ed eseguiti solo dopo una POST umana,
   con snapshot preventivi e audit separato (`actor: human`).
6. **Trigger F6**: il trigger sopravvive al riavvio solo come configurazione;
   la coda di debounce è in memoria e viene annullata allo shutdown. Il webhook
   accoda solo job abilitati; il job di esempio `note-created-review` resta
   disabilitato (`enabled = false`) per evitare corse non richieste.

> F0–F6 sono completati: lo scheduler è attivo nel processo API, con API
> REST/SSE, adapter a `runUseCase()`, tab **🤖 Agenti & Schedule**, Policy Agent
> con decision log, trigger da eventi e approvazione umana degli step mutanti
> nel KE Workbench.
