# Piano di disaccoppiamento architetturale — Backend come motore autonomo

> **Scopo**: rendere Wiki-Forge un motore di knowledge engineering indipendente dall'interfaccia.
> Ogni UI (web, CLI, MCP, TUI futura) deve essere un **adapter** che consuma lo stesso contratto,
> senza che il backend debba essere modificato per cambiare interfaccia.

- **Stato**: 🟧 In corso
- **Iniziato**: 2026-11-25
- **Responsabile**: lavoro iterativo, una fase alla volta
- **Documenti collegati**: [`ROADMAP.md`](ROADMAP.md), [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md), [`SLASH_COMMANDS_REFERENCE.md`](SLASH_COMMANDS_REFERENCE.md), [`SCRIPT_AUTOMATION_REFERENCE.md`](SCRIPT_AUTOMATION_REFERENCE.md)

---

## 1. Principio guida

```
Un solo kernel di comandi  +  N adapter indistinguibili
```

L'unica fonte di verità è il **manifest dei comandi**. Il catalogo HTTP dichiarativo
(`src/shared/api/contracts.ts`), i comandi chat, i tool MCP e la CLI devono derivare
da quel manifest. Nessun adapter può contenere logica di business.

**Test di accettazione finale**: scrivere una seconda interfaccia (per esempio una TUI o
un client Tauri) che consumi solo `/api/*` e il manifest, con **zero modifiche al backend**.

---

## 2. Stato attuale (baseline 2026-11-25)

### 2.1 Punti di forza già presenti

| Elemento | Posizione | Perché è utile |
|---|---|---|
| Catalogo dichiarativo | `src/shared/api/contracts.ts:110-116` | 104 route, SSOT per path, metodi, schema e OpenAPI |
| Bus request/response | `src/backend/server/bus/messageBus.ts:62-148` | Già pensato per CLI/scheduler (commento `:1-8`) |
| Risultati trasport-neutral | `src/backend/server/api/http.ts:5-25` | `json` / `sse` / `binary`, nessun tipo HTTP nei moduli |
| Moduli di dominio | `src/backend/server/modules/` | 99 handler registrati, separati dal gateway |
| Identità server-derived | `src/backend/server/auth/principal.ts:25-37` | Il client non può forgiare il `Principal` |
| Registry script generata | `scripts/gen_script_registry.py`, `src/backend/server/generated/scriptRegistry.generated.ts` | Modello già collaudato di codegen con `--check` |
| FastAPI separata | `src/backend/wikiforge/api/api_server.py:54-116` | Secondo processo per il grafo |

### 2.2 Problemi da risolvere

1. **`AgentServer` è un god object da 5257 righe** (`src/backend/server/agentServer.ts`).
   Contiene gateway, auth, RBAC, LLM, chat, slash router, snapshot, proxy FastAPI,
   scheduler e wrapper progetti. `DomainServices` ha 126 metodi
   (`src/backend/server/modules/services.ts:116-126`) e i moduli richiamano la facciata.
2. **Dipendenze invertite**: backend → frontend in `agentServer.ts:5-7`,
   `modules/services.ts:10`; `src/shared/api/endpoints.ts:41-58` importa tipi da
   `@frontend/*`; frontend → backend in `ToolsModal.ts:1` e `KEWorkbenchModal.ts:1`.
3. **Quattro registri di comandi divergenti**: 104 route, 99 handler bus, ~49 slash
   command di cui solo ~20 con case reale (`agentServer.ts:2941-3050`), 8 tool MCP
   (`mcp_server.py:16-125`). Molti comandi UI cadono nel fallback LLM generico
   (`agentServer.ts:3052-3073`). 5 route non passano dal bus (`docs.openapi`,
   `docs.swagger`, `graph.sync`, `graph.validate`, `graph.rag`).
4. **MCP non è un adapter**: `mcp_server.py:399-449` duplica 6 workflow KE con
   subprocess propri; `:451-487` ritorna sempre `status: "completed"`; `:229` legge
   sempre `repo_root/wiki`, senza `projectId`, token o policy F5/F6.
   `openapi.ts:268` pubblicizza tool inesistenti.
5. **Business logic nel browser**: `markdownParser.ts:11-51`, `graphService.ts:11-40`,
   `wikiEdit.ts`, `VersionTimeline.ts:60-66` (storia sintetica), `templateService.ts`.
   Fallback silenziosi in `ApiStorage.ts:157-167,218-228,506-551` e due facciate API
   (`ApiStorage.ts:121-146` vs `core/apiBus.ts:27-35`).
6. **Gap enterprise**: bus/sessioni/SSE in memoria, lock PID
   (`scheduler/lock.ts:58-107`), stato su filesystem, RBAC disattivato
   (`config/config.toml:103-104`), token opzionale (`auth/principal.ts:79-80`),
   bootstrap `admin/admin`, CORS `*`, nessun body size limit, `spawn` che eredita
   tutti i segreti (`executionModule.ts:78-92`), nessun log strutturato o tracing.

### 2.3 Baseline verifiche (prima di ogni modifica)

```bash
npm run typecheck   # OK
npm test            # 523 test, 521 pass, 2 fail pre-esistenti
```

Fail pre-esistenti, **non causati da questo piano**:
- `C4 — declarative Neo4j graph routes` (test che richiede graph store attivo)
- `A5 — deterministic orphan and frontmatter repair`

---

## 3. Architettura target

```
  Web UI    CLI    MCP    Scheduler    FastAPI KG    Test harness
     \       |       |        |            |             /
      \      |       |        |            |            /
       +-----+-------+--------+------------+-----------+
       |        COMMAND KERNEL (MessageBus)              |
       |  manifest + RBAC + audit + eventi + correlation |
       +---------------------+--------------------------+
                             |
       +---------------------+--------------------------+
       |  Use case / Application layer (modules/*)       |
       |  vault | review | research | study | ke | ...   |
       +---------------------+--------------------------+
                             |
       +---------------------+--------------------------+
       |  Ports (interfacce)                              |
       |  FileStore, StateStore, Queue, LlmClient,        |
       |  ScriptRunner, IdentityStore, Clock              |
       +---------------------+--------------------------+
                             |
        Filesystem (oggi) → Postgres / Redis / S3 (dopo)
```

**Regole architetturali**

- Un adapter non importa mai un altro adapter.
- Un modulo di dominio non importa mai `src/frontend`, `node:http` o tipi UI.
- Tutto ciò che è persistente passa da una porta, non da `fs` diretto.
- Ogni comando mutante ha: permesso, actor server-derived, audit, esito esplicito.

---

## 4. Fasi

Legenda stato: ⬜ non iniziata · 🟧 in corso · ✅ completata · ⛔ bloccata

| Fase | Obiettivo | Stato | Periodo |
|---|---|---|---|
| [Fase 0](#fase-0--inventario-e-guardie) | Manifest comandi + test di parità | ✅ Completata | 2026-11-25 |
| [Fase 1](#fase-1--inversione-delle-dipendenze) | Nessun import frontend in backend/shared | ✅ Completata | 2026-11-25 |
| [Fase 2](#fase-2--kernel-di-comandi) | Estrazione del kernel da `AgentServer` | ✅ Completata | 2026-11-25 |
| [Fase 3](#fase-3--cli-first-class) | CLI che chiama l'API | ✅ Completata | 2026-11-25 |
| [Fase 4](#fase-4--mcp-come-adapter) | MCP generato dal manifest | ✅ Completata | 2026-11-25 |
| [Fase 5](#fase-5--ui-solo-presentazione) | Logica di business fuori dal browser | ✅ Completata | 2026-11-25 |
| [Fase 6](#fase-6--indurimento-enterprise) | Persistenza, worker, osservabilità | ✅ Completata | 2026-11-25 |

---

### Fase 0 — Inventario e guardie

**Stato**: ✅ Completata · **Priorità**: P0 · **Durata stimata**: 1-2 gg

**Obiettivo**: avere una fotografia machine-readable di tutti i comandi e un test che
impedisca nuovo drift mentre si lavora alle fasi successive.

**Attività**
- [x] Analisi della baseline e dei quattro registri divergenti
- [x] Generatore `scripts/gen_command_manifest.mjs`
- [x] Output `src/shared/api/generated/commandManifest.generated.ts`
- [x] Output `docs/COMMAND_MANIFEST.md`
- [x] Test `tests/commandManifest.test.ts` con parità route ↔ manifest ↔ bus ↔ slash ↔ MCP
- [x] Script npm `manifest:check` e `--check` nel generatore

**Risultato (2026-11-25)**: 104 route, 99 comandi bus, 51 slash command, 8 tool MCP,
37 gap noti espliciti. `manifest:check` e 4/4 test di parità verdi.

**Accettazione**
- `npm run manifest:check` fallisce se una route non ha handler bus.
- Il drift noto è **esplicito** nel manifest (campo `gaps`), non nascosto.
- `npm run typecheck` resta verde; `npm test` non peggiora la baseline (2 fail noti).

**Rischi**: la costruzione di `AgentServer` nel generatore deve usare una root temporanea
e RBAC disattivato per evitare effetti collaterali.

---

### Fase 1 — Inversione delle dipendenze

**Stato**: ✅ Completata · **Priorità**: P0 · **Durata stimata**: 2-3 gg

**Obiettivo**: spezzare gli import dal backend/shared verso il frontend.

**Attività**
- [x] Creare `src/shared/domain/` con `WikiNote`, `MarkdownParser`, `okfFrontmatter`
- [x] Spostare `ScriptDef`, `ChatRequest`, `KEUseCaseDef` fuori da `agentServer.ts`
- [x] Rimuovere `@frontend/core/types/*` da `src/shared/api/endpoints.ts:41-58`
- [x] Aggiornare i re-export per mantenere compatibili i consumer esistenti
- [x] Aggiungere un test di guardia: nessun file in `src/backend/**` o `src/shared/**` importa `@frontend/*`

**Risultato (2026-11-25)**: i tipi canonici risiedono in `src/shared/domain/`; i vecchi
percorsi frontend sono re-export. Azzerati anche gli import frontend → backend. Il
generatore `gen_script_registry.py` ora emette l'import da `@shared/domain/scripts`.
Verifiche: `typecheck` verde, `manifest:check` verde, 11/11 test mirati verdi,
`npm test` 528/530 con le stesse 2 fail pre-esistenti.

**Accettazione**
- `grep -r "@frontend/" src/backend src/shared` non restituisce risultati.
- Nessun cambiamento comportamentale: test e typecheck verdi come in baseline.

**Rischi**: i tipi spostati devono restare identici; usare solo spostamenti e re-export.

---

### Fase 2 — Kernel di comandi

**Stato**: ✅ Completata · **Priorità**: P1 · **Durata stimata**: 1-2 settimane

**Obiettivo**: separare il kernel dal trasporto HTTP e unificare slash command e bus.

**Attività**
- [x] Creare `src/backend/app/createKernel.ts` (registrazione centralizzata dei moduli di dominio)
- [x] Far dipendere `createKernel` da porte iniettate invece che da `DomainServices`
- [x] Registrare ogni slash command implementato come comando bus (`cmd.compile`, `cmd.audit`, ...)
- [x] Registrare anche gli slash command senza case dedicato come comandi generici (`cmd.*`)
- [x] Rendere `AgentServer` adapter HTTP sottile: auth → validazione → dispatch → rendering
- [x] Spostare il rendering Markdown di `/help` in `CatalogueModule.renderHelpAnswer`
- [x] Portare le tre route FastAPI (`graph.sync`, `graph.validate`, `graph.rag`) sul bus con ruoli RBAC espliciti
- [x] Collegare `validateWithSchema` al bus tramite middleware installato dal gateway, dopo RBAC
- [x] Estrarre cataloghi/helper in `agentServerCatalogs.ts` e dominio in `services/{scheduler,vault,review,knowledge}Service.ts`

**Accettazione**
- Tutti i comandi del manifest sono dispatchabili senza HTTP.
- Ogni handler riceve un `Principal` server-derived, anche chiamato da CLI/scheduler.
- `AgentServer.ts` scende sotto 1500 righe.

---

### Fase 3 — CLI first-class

**Stato**: ✅ Completata · **Priorità**: P1 · **Durata stimata**: 3-5 gg

**Obiettivo**: ogni azione dell'UI abbia un equivalente CLI che chiama l'API.

**Attività**
- [x] Spostare `createApiClient()` in `src/shared/api/client.ts`
- [x] Aggiungere `commander` come dipendenza diretta
- [x] Creare `bin/wf.ts` con:
  - `wf api <operationId> --project <id> --input payload.json`
  - `wf wiki list|save|move|delete|ingest`
  - `wf review verify|digest|diff|restore`
  - `wf study quiz|guide|mindmap|note`
  - `wf ke run <script>`
  - `wf schedule status|approvals|approve <id>`
  - `wf cmd compile|audit|reindex|wizard <scenario>|deep-research <question>`
  - `wf manifest --format json|text`
- [x] Flag uniformi: `--json`, `--project`, `--token`, `--output`, `--dry-run`, `--yes`
- [x] Exit code: 0 ok · 2 validazione · 3 auth · 4 policy · 5 backend
- [x] Sostituire i target "promemoria" in `Makefile:31-59` con vere chiamate `wf`

**Accettazione**
- Ogni azione UI ha un comando CLI con lo stesso contratto.
- La CLI usa HTTP, non il bus in-process; il dispatch locale resta fuori dal perimetro Fase 3.
- Verifica: `typecheck`, `manifest:check`, `git diff --check` verdi; suite `541` test, `539` pass, `2` fail pre-esistenti.

---

### Fase 4 — MCP come adapter

**Stato**: ✅ Completata · **Priorità**: P2 · **Durata stimata**: 1 settimana

**Obiettivo**: eliminare il secondo backend in Python.

**Attività**
- [x] Sostituire il JSON-RPC artigianale con SDK ufficiale (Node, Streamable HTTP + stdio)
- [x] Generare `tools/list` dal manifest
- [x] Tool mutanti solo con token + RBAC + F5/F6
- [x] Rimuovere `KE_USE_CASE_COMMANDS` (`mcp_server.py:399-449`) e delegare al kernel
- [x] Aggiungere `projectId`, principal, containment dei path, status onesto, progress SSE
- [x] Configurare un client MCP reale nel repo (stdio via `wf mcp`)
- [x] Allineare `openapi.ts:268` e la documentazione ai tool effettivi

**Accettazione**
- `tools/list` derivato dal codice, nessun workflow duplicato.
- Un tool MCP fallisce se il corrispondente comando API fallisce.
- Nessun accesso filesystem diretto fuori dalle porte del backend.
- Verifica: `typecheck`, `manifest:check`, `git diff --check` verdi; suite `546` test, `544` pass, `2` fail pre-esistenti.

**Perché conta**: prima di questa fase MCP era un server che apriva i file e lanciava script per conto suo,
quindi non vedeva progetti, permessi, audit o policy. Ora è solo un altro client
dell'API, esattamente come la CLI e la UI.

---

### Fase 5 — UI solo presentazione

**Stato**: ✅ Completata · **Priorità**: P2 · **Durata stimata**: 1 settimana

**Attività**
- [x] DTO arricchiti dal backend (wikilink, tag, backlink, grafo)
- [x] Eliminare fallback silenziosi con banner offline esplicito
- [x] Unificare `ApiStorage` e `core/apiBus` in un'unica facciata
- [x] Storia versioni da `review.snapshots` invece di timestamp sintetici
- [x] Actor/reviewer sempre da `Principal`
- [x] Template canonici nel backend, preview locale in UI

**Accettazione**: test di accettazione finale del §1 superato. `typecheck`, `manifest:check`, `git diff --check` verdi; manifest 105 route, 156 bus command, 34 gap.

---

### Fase 6 — Indurimento enterprise

**Stato**: ✅ Completata · **Priorità**: P3 · **Durata stimata**: 2-4 settimane (parallela)

**Attività**
- [x] RBAC fail-closed, token obbligatorio in prod, rimozione `admin/admin`
- [x] CORS allowlist, body size limit, 400 su JSON invalido, error envelope con `correlationId`
- [x] Log JSON strutturati, OpenTelemetry, `/api/healthz`, `/api/readyz`, `/api/metrics`
- [x] Porta `StateStore`: filesystem → Postgres (stato/sessioni) → Redis (queue/pub-sub/lock) → S3 (blob)
- [x] Outbox per approvals e lock distribuito al posto del lock PID
- [x] Separare API stateless (N repliche), scheduler con leader lease, worker script con pool
- [x] Timeout, env allowlist e buffer limitati per i subprocess
- [x] Avviare il backend come utente non-root (causa del problema `users.json` del 2026-11-25)
- [x] Servire gli asset statici dalla API per rimuovere il drift `docker-compose.yml` / `render.yaml`

**Accettazione**
- `enable_rbac=false` impossibile in prod; health/metrics esposti su prefisso `/api`; sessioni persistenti via `StateStore`.
- Nessun processo backend gira come root; scheduler embedded disattivabile con `WIKIFORGE_EMBED_SCHEDULER=false` quando gira il worker separato.
- Verifica finale: `typecheck`, `manifest:check`, `git diff --check` verdi; suite 575/575 con le dipendenze Python di `requirements.txt` installate.

---

## 5. Regole di lavoro

1. **Una fase alla volta**, senza mischiare refactor e nuove funzionalità.
2. Ogni fase termina con `npm run typecheck` e `npm test`; la baseline è 2 fail noti.
3. Ogni deviazione dal piano va registrata nel §6 con data e motivazione.
4. Le fasi non si segnano complete finché non sono verificate, non solo scritte.

## 6. Registro avanzamento

| Data | Fase | Azione | Esito |
|---|---|---|---|
| 2026-11-25 | — | Analisi architetturale e stesura del piano | ✅ |
| 2026-11-25 | Fase 0 | Baseline `typecheck` OK, `npm test` 521/523 (2 fail pre-esistenti) | ✅ |
| 2026-11-25 | Fase 0 | Generatore manifest e test di parità | ✅ |
| 2026-11-25 | Fase 0 | Verifica finale: 104 route, 37 gap baseline, `manifest:check` e 4/4 test | ✅ |
| 2026-11-25 | Fase 1 | `src/shared/domain/` canonico, re-export frontend, import backend/shared ripuliti | ✅ |
| 2026-11-25 | Fase 1 | Estensione: migrati anche i tipi research/review/study e il template del registry generator | ✅ |
| 2026-11-25 | Fase 1 | Guard test `tests/domainBoundaries.test.ts` e verifica 528/530 test | ✅ |
| 2026-11-25 | Fase 2 | Avviata: `createKernel.ts` centralizza la registrazione dei 12 moduli di dominio | 🟧 In corso |
| 2026-11-25 | Fase 2 | Verifica mirata: `typecheck` verde, 49/50 test (1 fail noto `graphRoutes`) | ✅ |
| 2026-11-25 | Fase 2 | 20 slash implementati esposti come `cmd.*` + `chat.command`; bus 99 → 120 | ✅ |
| 2026-11-25 | Fase 2 | Manifest rigenerato, guard `slashBus` e `manifest:check` verdi | ✅ |
| 2026-11-25 | Fase 2 | Ruoli RBAC espliciti per `chat.command` e i 20 `cmd.*` | ✅ |
| 2026-11-25 | Fase 2 | Suite completa: 530/532 test, solo le 2 fail pre-esistenti | ✅ |
| 2026-11-25 | Fase 2 | `graph.sync`/`graph.validate`/`graph.rag` dispatchati dal bus con RBAC; bus 120 → 123 | ✅ |
| 2026-11-25 | Fase 2 | Gap noti 37 → 34; baseline aggiornata e `manifest:check` verde | ✅ |
| 2026-11-25 | Fase 2 | Suite completa: 531/533 test, solo le 2 fail pre-esistenti | ✅ |
| 2026-11-25 | Fase 2 | Validazione catalogue via middleware post-RBAC; schema `wiki.delete` allineato a `targetPath` | ✅ |
| 2026-11-25 | Fase 2 | Verifica finale: `typecheck`, `manifest:check`, `git diff --check` verdi; 531/533 test | ✅ |
| 2026-11-25 | Fase 2 | 32 slash senza case dedicato esposti come `cmd.*` generici; bus 123 → 155 | ✅ |
| 2026-11-25 | Fase 2 | Verifica finale: 533/535 test, solo le 2 fail pre-esistenti | ✅ |
| 2026-11-25 | Fase 2 | Rendering `/help` spostato in `CatalogueModule`; gateway più sottile | ✅ |
| 2026-11-25 | Fase 2 | Verifica finale: `typecheck`, `manifest:check`, `git diff --check` verdi; 533/535 test | ✅ |
| 2026-11-25 | Fase 2 | `createKernel` ora riceve `KernelPorts` via `portsFromServices`; moduli con porte specifiche | ✅ |
| 2026-11-25 | Fase 2 | Cataloghi/helper in `agentServerCatalogs.ts`; servizi scheduler/vault/review/knowledge in `server/services/`; `agentServer.ts` 833 righe | ✅ |
| 2026-11-25 | Fase 2 | Guard architetturali aggiornati; verifica finale verde: `typecheck`, `manifest:check`, `git diff --check`, 535/537 test | ✅ |
| 2026-11-25 | Fase 3 | `createApiClient` spostato in `src/shared/api/client.ts`; shim frontend mantenuto | ✅ |
| 2026-11-25 | Fase 3 | `commander` dipendenza diretta; `bin/wf.ts` con api/wiki/review/study/ke/schedule/cmd/manifest, flag uniformi e exit code | ✅ |
| 2026-11-25 | Fase 3 | Target promemoria del Makefile sostituiti con chiamate `wf`; test CLI HTTP con server mock | ✅ |
| 2026-11-25 | Fase 3 | Verifica finale verde: `typecheck`, `manifest:check`, `git diff --check`; 539/541 test, 2 fail pre-esistenti | ✅ |
| 2026-11-25 | Fase 4 | `src/shared/mcp/tools.ts` SSOT dei tool; manifest e OpenAPI generati da esso; SDK MCP Node con stdio e Streamable HTTP | ✅ |
| 2026-11-25 | Fase 4 | `mcp_server.py` ridotto a shim; KE use case delegati al kernel; test MCP con client SDK reale e server HTTP mock | ✅ |
| 2026-11-25 | Fase 4 | Verifica finale verde: `typecheck`, `manifest:check`, `git diff --check`; 544/546 test, 2 fail pre-esistenti | ✅ |
| 2026-11-25 | Fase 5 | DTO grafo/template e snapshot, facciata API unificata, banner offline, provenance da `Principal` | ✅ |
| 2026-11-25 | Fase 5 | `loadCanonicalTemplates()` degrada ai template locali se API assente; manifest 105 route, 156 bus command, 34 gap | ✅ |
| 2026-11-25 | Fase 5 | Verifica finale verde: `typecheck`, `manifest:check`, `git diff --check`; suite 575/575 | ✅ |
| 2026-11-25 | Fase 6 | CORS, body limit, correlationId, RBAC prod, log JSON, metriche e health endpoint sotto `/api` | ✅ |
| 2026-11-25 | Fase 6 | `StateStore` selezionabile, outbox approvals, lock lease, worker separato, subprocess hardening, container non-root | ✅ |
| 2026-11-25 | Fase 6 | API serve asset statici da `dist/`; scheduler embedded disattivabile; Compose avvia worker dedicato | ✅ |
| 2026-11-25 | Fase 6 | Verifica finale verde: `typecheck`, `manifest:check`, `git diff --check`; suite 575/575 con dipendenze Python installate | ✅ |

## 7. Decisioni e domande aperte

- **D1** — La CLI chiama l'API via HTTP (richiesto); il dispatch in-process resta fuori
  dal perimetro Fase 3.
- **D2** — Il manifest resta generato, non scritto a mano, seguendo il modello di
  `gen_script_registry.py`.
- **D3** — Risolto in Fase 4: SDK MCP Node, per condividere il client tipizzato con CLI e UI.
- **D4** — Risolto in Fase 6: `WIKIFORGE_STATE_BACKEND` seleziona `file`/`memory` oppure un adapter HTTP per Postgres/Redis/S3. Default `file` in sviluppo; in produzione le chiavi di stato, sessioni e approvals possono essere instradate a backend remoti senza driver nativi nel gateway.
