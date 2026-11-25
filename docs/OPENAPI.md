# Browser OpenAPI / Swagger — Wiki-Forge v4.1

Questo documento descrive il contratto HTTP unificato di Wiki-Forge e il browser
API self-hosted introdotto nella **Fase 1** del refactoring dell'API layer.

## 1. Dove si trova

Con il gateway Node in funzione (`npm run api`, oppure `npm run dev:all`):

| Risorsa | URL | Contenuto |
|---|---|---|
| Browser Swagger UI | `http://localhost:3001/api/docs` | Interfaccia interattiva, asset serviti localmente |
| Documento OpenAPI 3.1 | `http://localhost:3001/api/openapi.json` | Specifica JSON generata a runtime |
| Tramite Vite | `http://localhost:5173/api/docs` | Stesso gateway, attraverso il proxy `/api` |

Swagger UI arriva dal pacchetto npm `swagger-ui-dist`: **nessuna CDN**, nessuna
richiesta a `unpkg` o `jsdelivr`. Funziona quindi offline e nel container Docker
dove la UI non ha accesso a Internet.

## 2. Un'unica fonte di verità

La specifica **non** è un YAML scritto a mano. È generata dai costrutti TypeScript:

```text
src/shared/api/types.ts       DTO di trasporto (tipi puri, nessuna dipendenza runtime)
src/shared/api/contracts.ts   ROUTES + defineRoute() + SCHEMAS
src/shared/api/endpoints.ts   EndpointTypes: tipi TS request/response per ogni id
src/shared/api/router.ts      matching :param e interpolazione dei path
src/backend/server/api/openapi.ts   generatore OpenAPI 3.1 + merge FastAPI
src/backend/server/api/docsBrowser.ts  /api/openapi.json, /api/docs, asset statici
src/frontend/api/client.ts    client tipizzato generato da ROUTES
src/frontend/core/apiBus.ts   bus comandi frontend (eventi + client tipizzato)
```

Ogni voce di `ROUTES` dichiara una sola volta:

- metodo e path (con placeholder `:nome`), `operationId`, tag e sommario;
- nome del **comando del bus** (`x-command`), usato dalle fasi successive;
- parametri path/query/header, schema JSON Schema della richiesta e della risposta;
- flag `projectScoped`, `stream: 'sse' | 'binary'`, status di successo ed eventuale deprecazione.

Le nuove route C6/C7 sono `POST /api/v1/graph/reconcile` (stage-only, human
approval) e `GET /api/v1/graph/events` (SSE `graph:changed`).

Da questo catalogo derivano: il routing, la validazione delle richieste (Fase 2),
il client tipizzato del frontend e il bus UI (Fase 3) e la documentazione.
Aggiungere un endpoint significa **modificare `contracts.ts`, il tipo in
`endpoints.ts` e il solo handler di dominio**, non aggiornare quattro file diversi.
L'assertion compile-time in `endpoints.ts` segnala subito un id di `ROUTES`
rimasto senza tipi.

> I metodi pubblici di `AgentServer` e gli endpoint esistenti restano invariati:
> il catalogo è additivo e non rompe i client attuali.

## 3. Cosa contiene la specifica

- **104 operazioni** Node: Vault, Chat, Projects, Changesets, Review Studio,
  Research Studio, Study Studio, Scheduler F3/F5/F6, KE Workbench, Ingestion,
  Files, Catalogues, Knowledge Graph/Neo4j, Identity, UI access/preferences e
  Documentazione.
- `components.schemas` con i DTO condivisi (per esempio `WikiNote`, `Changeset`,
  `SchedulerStatus`, `ResearchAnswer`).
- `securitySchemes.WikiForgeToken`: header `X-WikiForge-Token`, richiesto solo
  quando il server è avviato con `WIKIFORGE_API_TOKEN`. La pagina di documentazione
  è pubblica; il browser inietta il token e il progetto attivo da
  `localStorage` (`wikiforge.token`, `wikiforge.projectId`).
- Parametro `X-Project-Id` sui route project-scoped, con fallback a `?projectId=`.
- Risposte SSE documentate come `text/event-stream`; i frame terminano con
  `data: [DONE]\n\n`.
- Sezione `x-wikiforge.mcp` con trasporti (stdio e Streamable HTTP) e i tool
  generati da `COMMAND_MANIFEST.mcpTools` (`src/shared/mcp/tools.ts`).

### Servizio FastAPI

`loadOpenApiDocument()` prova a leggere `http://localhost:8000/openapi.json`
(con timeout 1,5 secondi). In Docker l'indirizzo è configurabile tramite
`FASTAPI_SERVER_URL`. Se il servizio non risponde, viene unito lo snapshot
locale `FASTAPI_SNAPSHOT`, generato dai modelli Pydantic di
`src/backend/wikiforge/api/api_server.py`.

L'unione è **non distruttiva**: le operazioni Node (per esempio
`POST /api/v1/graph/rag`, che fa da proxy) restano quelle del catalogo; la
definizione upstream viene allegata come `x-upstream-contract`. Le operazioni
assenti nel gateway, come `GET /api/v1/health`, vengono aggiunte con il server
FastAPI. Nessun YAML va mantenuto a mano.

## 4. Come aggiungere un endpoint

1. Definire richiesta/risposta in `src/shared/api/types.ts` se servono nuovi DTO.
2. Aggiungere una `defineRoute({ id, method, path, command, ... })` in
   `ROUTES`, con schemi JSON Schema e flag `projectScoped`/`stream`.
3. Aggiungere la voce corrispondente in `src/shared/api/endpoints.ts`: l'assert
   `IsExact<keyof EndpointTypes, EndpointId>` rende l'omissione un errore di
   `typecheck`.
4. Implementare l'handler in un modulo di dominio e registrarlo sul bus con lo
   stesso `command`, mantenendo comportamento e envelope `{ success, ... }`.
5. Aggiungere un test in `tests/openapi.test.ts`, `tests/bus.test.ts` o
   `tests/modules.test.ts`.
6. Verificare:

```bash
npm run typecheck
npm test
python scripts/check_docs_sync.py
python scripts/docs_wiki_drift.py --check
```

## 5. Bus backend e moduli di dominio (Fase 2)

Il backend è stato disaccoppiato senza toccare la facciata pubblica:

```text
AgentServer.handleRequest()
  ├─ handleDocsRequest() / auth.me                → pubblici
  ├─ auth B4 (token + CORS)                       → prima del dispatch e del proxy
  ├─ reverse proxy FastAPI (sync/validate/rag)    → byte-compatibile
  ├─ matchRoute(ROUTES, method, path)             → command + params + schema
  ├─ payload = query + headers + body + params   → i params sono authoritative
  └─ MessageBus.dispatch(command, payload, context)
       ├─ CatalogueModule    3    help/skills
       ├─ ToolsModule        3    script registry, KE use cases
       ├─ ReviewModule       3    coda recensioni (.llm-wiki/reviews.json)
       ├─ IngestionModule    3    coda SQLite e conversione CoT
        ├─ GraphModule        7    cluster, insight, Neo4j (query/sync/status),
        │                           reconcile stage-only e SSE graph.events
       ├─ ProjectsModule    12    CRUD progetti, config, import/export
       ├─ ChangesetsModule   5    stages plan → review → apply
       ├─ FilesModule        1    download binario con containment check
       ├─ SchedulerModule   12    F3/F5/F6, SSE events/run, approvali, job script (S3)
       ├─ ExecutionModule    2    script SSE e KE use case SSE
       ├─ VaultModule       16    note, cartelle, trash, upload, ingest
       ├─ ReviewStudioModule 7    meta/verify/digest/critica/snapshot
       ├─ ResearchModule     7    search/backlinks/related/trace/consult
       ├─ StudyModule        7    guide/quiz/mindmap/audio/note/thesis
       ├─ ChatModule         1    chat JSON e SSE
        └─ UiModule           3    ui.access, ui.preferences.get/put
```

Degli **104 endpoint** del catalogo, **99 comandi** sono instradati sul bus. Il piano F0–F6 prevedeva 98 endpoint sulla baseline documentale storica di 95; il catalogo reale era già a 101 prima delle tre route `ui.*`, quindi il conteggio è stato riallineato al codice.
I cinque rimanenti restano deliberatamente nel gateway: `docs.openapi` e
`docs.swagger` sono pubblici e serviti da `docsBrowser.ts`, mentre i tre
`graph.proxy` sono protetti dal gate B4 come ogni ingresso non pubblico e
preservano byte-per-byte il proxy FastAPI `/api/v1/graph/sync|validate|rag`.

- **B7 — identità**: `GET /api/auth/me` (tag `Identity`, comando `auth.me`,
  schema `AuthIdentity`) è la route additiva che il frontend usa per risolvere
  l'attore e i ruoli dal server. Senza credenziali è pubblica e riporta
  `authenticated=false`; con Bearer invalido restituisce l'envelope 401 di B0.
  Il client invia il Bearer IdP tramite `Authorization` solo quando presente,
  lasciando invariato l'header legacy `X-WikiForge-Token`.

- **F1/F2 — UI access e preferenze**: `GET /api/ui/access` restituisce ruoli, azioni, operazioni e pannelli consentiti per l'identità corrente; `GET /api/ui/preferences` e `PUT /api/ui/preferences` gestiscono le preferenze dell'utente. Tutte richiedono il ruolo minimo Reader e passano da `UiModule`. La chiave dello store è derivata da `source:actor` (SHA-256); il body non può impostare `actor`, `roles` o la chiave utente. Il frontend carica tutto via `apiBus` e applica il filtro RBAC dopo il merge delle preferenze.

- **C4 — Neo4j dichiarativo**: `POST /api/v1/graph/cypher` (query read-only C3),
  `POST /api/v1/graph/sync/neo4j` (scan idempotente del vault) e
  `GET /api/v1/graph/status` (configurazione senza connessioni) sono route
  additive dichiarate in TS e servite da `GraphModule` tramite il bus. Il tool
  `neo4j_api_tool.py` restituisce errori tipizzati e un `mode` esplicito
  `live`/`mock`; ruoli RBAC: Reader per query/status, Contributor per sync. Gli
  endpoint graph legacy restano invariati e protetti da B4.
- **C6/C7 — riconciliazione ed eventi**: `POST /api/v1/graph/reconcile` esegue
  la query DB → vault e **stagea** revisioni non conflittuali come changeset
  (`process:neo4j-reconciler`), senza mai scrivere il vault; richiede il ruolo
  Contributor. Il progetto di staging è sempre quello di `X-Project-Id`: un
  `projectId` nel body è accettato solo per compatibilità. La risposta riporta
  `staged`, `skipped` e `skippedEvents`. `GET /api/v1/graph/events` è una route
  SSE additiva (Reader) che pubblica snapshot e frame `graph:changed` dal
  GraphEventHub, filtrati per progetto; il frontend li consuma solo tramite
  `apiBus.stream()`.

- `MessageBus` (`src/backend/server/bus/messageBus.ts`) supporta handler multipli,
  middleware, eventi `command:handled`/`command:failed` e un `CommandContext`
  con `rootDir`, `projectId`, `operationId`, `correlationId` e l'hook `onClose`
  usato dai flussi SSE per liberare i client al disconnect.
- I risultati sono HTTP-neutrali (`src/backend/server/api/http.ts`): `json`,
  `binary` (byte passati senza modifiche) e `sse`. `sendApiResult()` è l'unico
  punto che scrive `ServerResponse`, imposta gli header SSE e chiude il flusso;
  così scheduler, CLI e test possono chiamare gli stessi comandi senza HTTP.
- Le envelope `{ success, ... }`, i percorsi su disco, la scrittura atomica e la
  sequenza SSE `start → stdout/stderr → exit → [DONE]` sono invariate. Questo
  vale anche per i flussi a alto rischio migrati per ultimi (`scripts.execute`,
  `ke.useCases.execute`, `schedule.events`, `schedule.run`, `chat.send`).
- `api/validation.ts` compila gli schemi JSON Schema di `contracts.ts` con Ajv
  (`validateWithSchema`). La validazione resta disponibile e non bloccante per
  non cambiare il comportamento dei client esistenti.
- Le dipendenze sono iniettate tramite `DomainServices` (`modules/services.ts`):
  risoluzione dei progetti, store dei changeset, scheduler, registry Python,
  servizi vault/studio e bus. Nessun modulo importa `AgentServer` a runtime,
  quindi non ci sono import circolari e i metodi pubblici della facciata restano
  invariati.

## 6. Client tipizzato e bus UI (Fase 3)

Il frontend non costruisce più URL API a mano:

```text
ROUTES ──► src/shared/api/endpoints.ts   EndpointTypes (104 id, assertion compile-time)
       ──► src/frontend/api/client.ts    createApiClient(): un metodo per EndpointId
                                          + call() + stream() (SSE incrementale)
       ──► src/frontend/core/apiBus.ts   apiBus.dispatch()/stream() + eventi UI
       ──► ApiStorage / projectService / modali  facciate compatibili
```

- `ApiRequest` separa `params`, `query`, `body` e `headers`. Il client interpola
  i path con `interpolatePath()`, serializza la query, invia `X-Project-Id` e
  l'eventuale `X-WikiForge-Token`, solleva `ApiClientError` con status e body
  sulle risposte non 2xx e restituisce la `Response` grezza per i flussi.
- `apiBus` aggiunge osservabilità (`api:request`, `api:result`, `api:error`,
  `api:stream`) e nuovi eventi di dominio (`reviews:changed`,
  `changesets:changed`, `schedule:changed`, `scripts:executed`), così i componenti
  possono reagire senza conoscersi. Il composition root (`index.ts`) resta l'unico
  punto che collega i callback UI.
- `ApiStorage` conserva tutti i **51 metodi pubblici** e i loro fallback;
  `projectService`, `ToolsModal`, `ReviewQueueModal`, `ChangesetReviewModal` e
  `KEWorkbenchModal` non contengono più `fetch` diretti. L'unico `fetch` frontend
  è quello del client tipizzato (quello di `llmClient.ts` parla con provider LLM
  esterni, non con le API di Wiki-Forge).
- I body legacy sono ancora accettati dal backend; il client invia le forme del
  contratto (per esempio `wiki.delete { path }`, `wiki.rename { from, to }`,
  `wiki.upload { path, content, encoding }`) e converte i mismatch storici
  lato facciata.
- Le due route S3 `scripts.schedule` e `scripts.unschedule` seguono lo stesso
  percorso: dichiarate una sola volta in `contracts.ts`, tipizzate in
  `endpoints.ts`, esposte in `/api/openapi.json` e servite dal bus tramite
  `SchedulerModule`. Nessun endpoint è stato aggiunto a mano fuori dal catalogo.

## 7. Stato del refactoring

| Fase | Stato | Contenuto |
|---|---|---|
| 1 — Contratti e browser API | ✅ completata | `ROUTES`, OpenAPI 3.1, Swagger self-hosted, merge FastAPI/MCP |
| 2 — Bus backend e moduli di dominio | ✅ completata | `MessageBus`, risultati HTTP-neutrali, validazione Ajv, 16 moduli più `auth.me`, 99 comandi su bus (3 di `UiModule`) |
| 3 — Client unico e bus UI | ✅ completata | `EndpointTypes` (104 id), client generato, `apiBus`, facciate senza `fetch` diretto |
| 4 — Documentazione e collaudo | ✅ completata | wiki rigenerata da `docs/`, drift check e verifica completa |

I client esistenti continuano a funzionare: endpoint, envelope e metodi pubblici
di `AgentServer` non sono cambiati. Le nuove chiamate API passano solo dal
client tipizzato e dal bus, mai da un componente a un altro.
