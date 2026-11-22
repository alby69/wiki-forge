---
type: Reference
title: "Changelog"
description: "All notable changes to the wiki-forge template will be documented in this file."
resource: docs/CHANGELOG.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/en]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-changelog-md
    resource: docs/CHANGELOG.md
    title: "Changelog"
    author: human:alby69
---
# Changelog

All notable changes to the `wiki-forge` template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### S4 — Automazione script: UI di scheduling e gestione job

- **Script Control Panel**: badge di sicurezza letto dai metadati `automation` generati (🟢 read-only, 🔵 report, 🟡 workspace, 🟠 wiki-write, 🔴 blocked) e pulsante **🕒 Schedula** accanto a **▶ Run Tool**. Genera l'ID `script-<id>-<timestamp>`, usa l'orario predefinito del catalogo e riusa `collectArgs()` dell'esecuzione manuale; gli script `blocked`/non schedulabili hanno il pulsante disabilitato.
- **Flusso via bus**: la creazione passa da `apiBus.dispatch('scripts.schedule', …)`, mostra nel log gli avvisi F6 (job mutanti creati disabilitati) ed emette l'evento tipizzato `schedule:changed`; nessun `fetch` diretto e nessuna chiamata diretta fra componenti.
- **Agenti & Schedule**: le card dei job script mostrano badge "🕒 job script", `scriptId` e argomenti risolti; solo per `jobKind = script` compare **🗑 Rimuovi** (`apiBus.dispatch('scripts.unschedule', …)`), lasciando intatti i 9 job Use Case. La tab si aggiorna su `jobs_changed` e su `schedule:changed`.
- **View model**: `ScheduleJobView` espone `jobKind`/`scriptId`/`args` e `scriptSafetyBadge()` mappa il catalogo generato senza duplicare la classificazione di sicurezza del backend.
- **Test**: nuovo `tests/toolsModalScheduling.test.ts` (badge, pulsante disabilitato, payload POST con `X-Project-Id`, avvisi F6, evento `schedule:changed`), più estensioni a `keWorkbenchSchedule` e `schedulePanel`. Nessuna nuova route o modifica agli envelope API.

### S3 — Automazione script: API di scheduling e hot-reload

- **Nuove route dichiarative**: `POST /api/scripts/schedule` (`scripts.schedule`) e `DELETE /api/scripts/schedule/:jobId` (`scripts.unschedule`) aggiunte a `ROUTES`/`EndpointTypes` (89 id): OpenAPI 3.1 e tipi TS generati dagli stessi costrutti, senza YAML manuale. Envelope, endpoint esistenti e metodi pubblici di `AgentServer` invariati.
- **Persistenza atomica**: nuovo `scheduler/scriptJobStore.ts` scrive `config/script_schedules.toml` con `atomicWriteFile`, preserva l'header scritto a mano e riutilizza `parseScriptScheduleConfig()` come unica validazione (script noto e schedulabile, cron, argomenti, id duplicati anche rispetto a `agent_schedule.toml`). Il TOML resta la fonte di verità: i job creati sopravvivono al restart.
- **Sicurezza**: gli script `blocked`/non schedulabili sono respinti con 400, gli id duplicati con 409; i job mutanti vengono accettati ma forzati a `enabled = false` con un `warnings` che ricorda l'approvazione F6. La DELETE opera solo sui job `jobKind = script` e non tocca i 9 job Use Case.
- **Hot-reload**: `Scheduler.replaceJobs()` aggiorna l'array dei job in place, la registry `scheduledUseCases` viene ricostruita nello stesso oggetto e `EventTriggerBus.cancelJob()` elimina i debounce pendenti dei job rimossi. L'evento SSE `jobs_changed` viene mostrato nel log live del Workbench, così i job sono attivi immediatamente senza riavvio.
- **Test**: 6 nuovi test end-to-end in `tests/scriptScheduleApi.test.ts` (creazione read-only, mutanti disabilitati, rifiuti, evento bus, cancellazione trigger, restart) più copertura in `openapi.test.ts` e `schedulePanel.test.ts`. Tutte le validazioni Node/Python e i drift check restano verdi.

### S2 — Automazione script: approvazione e audit dei job script

- **Approvazione F6 dei job script**: `decideApproval()` risolve ora la registry combinata (`scheduledUseCases`) oltre a `KE_USE_CASES`: le richieste nate da un use case sintetico `__script__:<id>` possono finalmente essere approvate. Envelope e metodi pubblici di `AgentServer` invariati.
- **Argomenti risolti e redatti**: le approvazioni espongono `jobKind` e `scriptArgs` (default dello step + override del job) con la stessa redazione dell'audit; l'ordine di precedenza è allineato al runner. Gli step `wiki_program_change_apply` continuano a ricevere `reviewer`/`confirm` iniettati dal server.
- **Eventi e audit**: `approval_required` include `scriptIds` e `jobKind`; i run dello scheduler e quelli autorizzati dall'uomo registrano `jobKind` e `scriptId`, mantenendo `actor: human`, `approvalId` e `approvedBy`.
- **UI**: la card F6 distingue "job script" da "use case" e mostra "Args risolti"; il log live nomina gli script invece del solo indice dello step. Tutto via `apiBus`, nessun `fetch` diretto.
- **Regressioni**: nuovi test end-to-end (stage → approve di `okf_log` con scrittura di `wiki/log.md` e audit), mapping view model, render della card e redazione ricorsiva degli argomenti. Nessuna nuova route API.

### S1 — Automazione script: job script e classificazione arg-aware

- **Job script**: `JobDef` ha `jobKind`/`scriptId`; `parseScheduleConfig()` accetta `use_case` oppure `script` (mai entrambi) e carica anche `config/script_schedules.toml`. Gli id duplicati tra i due file vengono respinti; i 9 job Use Case esistenti restano invariati.
- **Use case sintetici**: ogni job script diventa un Use Case a 1 step (`__script__:<scriptId>`) con argomenti risolti dal catalogo; `Scheduler`, F5 e F6 non sono stati riscritti. I job mutanti restano disabilitati e passano dalla coda F6.
- **F5 arg-aware**: `SCRIPT_SCHEMAS` genera `argSafety`; `docs_wiki_drift` con `check=true` è `read-only`, `check_docs_sync` con `fix=true` diventa `workspace`, `blocked` resta sempre tale. Il Policy Agent classifica gli argomenti effettivi con fallback fail-closed.
- **Catalogo e test**: la tabella generata mostra gli override arg; nuovi test in `tests/agentScheduler.test.ts`, `tests/policyAgent.test.ts`, `tests/agentScriptJobs.test.ts` e nei test Python SSOT. Nessun endpoint o metodo pubblico di `AgentServer` è cambiato.

### S0 — Automazione script: SSOT di sicurezza e catalogo generato

- **Classificazione centralizzata**: `SCRIPT_SCHEMAS` (`script_schema.py`) contiene ora `automation` per tutti i 29 script: `safety`, `schedulable`, `enabledDefault`, `defaultSchedule`, `defaultArgs`, `requires`, `notes`. Le classi sono `read-only`, `report`, `workspace`, `wiki-write` e `blocked`.
- **Unica fonte anche in TypeScript e nei documenti**: `gen_script_registry.py` genera `scriptRegistry.generated.ts` e `docs/SCRIPT_AUTOMATION_REFERENCE.md`; `--check` verifica entrambi. Aggiunto il flag `--fix` allo schema di `check_docs_sync.py`, prima non dichiarato.
- **Policy derivata, non duplicata**: nuovo `scheduler/scriptSafety.ts` deriva `MUTATING_SCRIPT_IDS` dal registry generato, conserva il fallback legacy `promote_doc_answer` e tratta gli id sconosciuti come mutanti (fail-closed). `policyAgent.ts` ri-esporta la costante e usa `isMutatingScript` derivato.
- **Contratti OpenAPI**: aggiunto lo schema `ScriptAutomation` a `contracts.ts`/`types.ts` e la proprietà opzionale su `ScriptDefDto`. Nessun endpoint, envelope o metodo pubblico di `AgentServer` è cambiato.
- **Drift semantico**: `check_docs_sync.py` controlla anche il blocco `script-automation`; `docs/help/modalita-dev.md` punta al catalogo generato con hash aggiornato.
- **Documentazione e test**: aggiornati `docs/README.md`, `docs/SELF_WIKI_PLAN.md`, `ROADMAP.md`, `docs/KE_AGENT_SCHEDULER_PLAN.md` e il mapping della proiezione wiki. Nuovi test SSOT Python e aggiornamento di `tests/policyAgent.test.ts`.

### Fase 1 KISS/DRY: catalogo slash commands e pulizia documentale

- **Catalogo unico**: nuovo `docs/SLASH_COMMANDS_REFERENCE.md` con tutti i comandi slash, alias, categoria ed equivalente grafico. `README.md`, `TUTORIAL.md`, `docs/help/chat-comandi.md` e `docs/AGENT.md` ora puntano a questo file invece di duplicare la tabella.
- **Niente funzionalità fantasma**: rimossi i riferimenti a `/rollback` e `/history` come comandi chat esistenti; lo storico e il ripristino restano UI-only e i comandi pianificati sono tracciati in `docs/ROADMAP.md`.
- **Drift semantico**: `scripts/check_docs_sync.py` verifica ora l'hash del blocco `DOC_BLOCK:slash-commands` nei riferimenti delle guide in-app e offre `--fix` per aggiornarlo dopo una modifica al catalogo. Il controllo sostituisce la vecchia verifica dei comandi in `README.md`/`TUTORIAL.md`, ora semplici puntatori.
- **Proiezione wiki**: aggiunto il nuovo documento al mapping e rigenerata la wiki di self-documentazione da `docs/`.

### Fase 2 e 3 del refactoring API: bus backend, client tipizzato e bus UI

- **Bus backend disaccoppiato**: `MessageBus` (`src/backend/server/bus/messageBus.ts`) instrada 82 dei 87 comandi dichiarati in `ROUTES` con contesto `rootDir`/`projectId`/`operationId`/`correlationId`, hook `onClose` per gli SSE, middleware ed eventi `command:handled`/`command:failed`. `AgentServer.getBus()` è accessor additivo; `handleRequest()` e gli altri metodi pubblici restano invariati. I soli route non su bus sono i due endpoint docs pubblici e i tre proxy FastAPI `/api/v1/graph/sync|validate|rag`, lasciati prima di CORS/token.
- **Quindici moduli di dominio**: ai primi cinque (`CatalogueModule`, `ToolsModule`, `ReviewModule`, `IngestionModule`, `GraphModule`) si aggiungono `ProjectsModule`, `ChangesetsModule`, `FilesModule`, `SchedulerModule`, `ExecutionModule`, `VaultModule`, `ReviewStudioModule`, `ResearchModule`, `StudyModule` e `ChatModule`. Tutti ricevono dipendenze iniettate da `DomainServices` e nessuno importa `AgentServer` a runtime.
- **Risultati HTTP-neutrali**: `api/http.ts` definisce `json`, `binary` e `sse`; solo `sendApiResult()` scrive la `ServerResponse`. Le route migrate conservano envelope, percorsi su disco, scrittura atomica e la sequenza SSE `start → stdout/stderr → exit → [DONE]`, inclusi script, use case KE, scheduler e chat.
- **Validazione pronta**: `api/validation.ts` compila gli schemi JSON Schema del catalogo con Ajv; resta non bloccante per evitare cambi di comportamento ai client esistenti.
- **Client tipizzato generato dal catalogo**: `src/shared/api/endpoints.ts` dichiara `EndpointTypes` per tutti gli 87 id con assertion compile-time; `src/frontend/api/client.ts` genera un metodo per endpoint da `ROUTES`, con interpolazione path, query serializzata, header `X-Project-Id`/`X-WikiForge-Token`, `ApiClientError`, raw `Response` per stream/binary e parsing SSE incrementale.
- **Bus UI e nessun fetch sparso**: `src/frontend/core/apiBus.ts` espone `dispatch`/`stream` e pubblica eventi di lifecycle e di dominio (`reviews:changed`, `changesets:changed`, `schedule:changed`, `scripts:executed`). `ApiStorage` mantiene i 51 metodi pubblici e i fallback; `projectService`, `ToolsModal`, `ReviewQueueModal`, `ChangesetReviewModal` e `KEWorkbenchModal` non chiamano più `fetch` direttamente. La facciata conserva anche il `?projectId=` esplicito e gli alias legacy di `wiki.rename` (`newTitle`/`newName`), così gli integration test e i launcher esterni non cambiano.
- **Test e documentazione**: nuovi `tests/bus.test.ts`, `tests/modules.test.ts` e `tests/openapi.test.ts`; aggiornati `docs/OPENAPI.md`, `docs/ARCHITECTURE.md`, `docs/TECHNICAL_ARCHITECTURE.md`, `docs/README.md` e `README.md`, con proiezione wiki rigenerata. `npm test`, `npm run typecheck` e i controlli docs/wiki restano verdi.

### Fase 1 del refactoring API: contratti TypeScript e browser OpenAPI

- **Un'unica fonte di verità per le API**: `src/shared/api/contracts.ts` dichiara oltre 70 endpoint con `defineRoute<Req, Res>()` (metodo, path con `:param`, `operationId`, tag, schemi JSON Schema, flag SSE/binary e nome del comando del bus). `types.ts` contiene i DTO condivisi e `router.ts` il matching dei path. Nessun endpoint viene rimosso e i metodi pubblici di `AgentServer` restano invariati.
- **Specifica OpenAPI 3.1 generata dal codice**: `src/backend/server/api/openapi.ts` produce il documento da `ROUTES`, con `components.schemas`, security `X-WikiForge-Token`, header `X-Project-Id`, metadata MCP e merge non distruttivo della spec FastAPI (`FASTAPI_SERVER_URL`, con snapshot locale dei modelli Pydantic come fallback). Le operazioni del gateway non vengono mai sovrascritte.
- **Swagger UI self-hosted**: nuove route `GET /api/openapi.json` e `GET /api/docs`; gli asset vengono serviti dal pacchetto npm `swagger-ui-dist` con allowlist, senza CDN. La pagina è raggiungibile anche tramite il proxy Vite (`http://localhost:5173/api/docs`) e funziona offline/in Docker.
- **Documentazione**: nuovo `docs/OPENAPI.md`, aggiornati `docs/ARCHITECTURE.md`, `docs/TECHNICAL_ARCHITECTURE.md` e l'indice `docs/README.md`. Test dedicati in `tests/openapi.test.ts`; `npm test`, `npm run typecheck` e i controlli docs restano verdi.

### Nuovi nodi wiki: OKF valido e nessun drift da `docs/`

- **Frontmatter minimo generato per le note nuove**: `ensureOkfFrontmatter()` (in `src/frontend/services/okfFrontmatter.ts`) è usato da New Document, creazione file, salvataggio editor, upload, attach e sintesi deep research. Aggiunge `type: Note` e `title` solo quando mancano, lascia intatto il frontmatter già valido e non tocca i file riservati `index.md`/`log.md`. Le note create dall'utente passano così il lint OKF senza bisogno di template perfetti.
- **La proiezione dipende solo da `docs/`**: `build_bundle()` non legge più la wiki (prima indicizzava le note di `sintesi/`), quindi aggiungere una nota in qualsiasi cartella della wiki non cambia più gli indici generati e non produce `changed:`. `write_bundle()` continua a non cancellare i file extra.
- **Reindex sicuro**: la wiki `wikiforge` è marcata `docsManaged: true` in `config/projects.json`; `executeReindexWorkflow()` la salta, evitando che `okf_reindex.py` riscriva gli indici generati in un formato diverso e crei falso drift.
- Test: `tests/okfFrontmatter.test.ts` e `test_bundle_depends_only_on_docs_not_on_wiki_notes` in `tests/python/test_docs_to_wiki.py`.

### Fix CI: note utente preservate non più segnalate come drift

- **CI Test Suite e OKF Validation tornano verdi**: `scripts/check_docs_sync.py` chiamava `docs_to_wiki.check_bundle()` senza il filtro che già usavano `docs_wiki_drift.py` e i test Python, quindi `architettura/note_architettura.md` (nota scritta dall'utente nella wiki, non proiezione di `docs/`) faceva fallire ogni push con `unexpected:`. La policy è ora centralizzata in `docs_to_wiki.actionable_problems()`: vengono ignorati solo gli `unexpected:` di note **senza** provenance `generated.by: process:docs-to-wiki` (o in `sintesi/`); un file generato rimasto orfano continua a essere segnalato. Lo stesso filtro vale per `check_docs_sync.py`, `docs_wiki_drift.py` e `docs_to_wiki.py --check`, quindi anche note utente create in futuro non rompono la CI.
- Aggiunti test di regressione in `tests/python/test_docs_to_wiki.py` (entry point CI, nota utente con nome qualsiasi, file generato orfano ancora drift) e rafforzato `tests/test_standalone_scripts.py` per pretendere `status: success` dal check.

### Rinomina del pulsante Note rapide in Note

- Il pulsante della vista Scratchpad nella barra in alto si chiama ora **📒 Note** (prima **Note rapide**). Cambia solo l'etichetta italiana (`viewScratchpad` in `core/i18n/strings.ts`): la vista, i pulsanti e i comandi `/note` / `/promote-note` restano invariati. L'etichetta inglese rimane **Scratchpad**.

### Pannello Info Nodo chiuso di default

- Il pannello **Info Nodo** (Node Metadata / Backlinks / Outbound) non è più visibile quando apri una nota: parte **chiuso**. Il pulsante **📊 Info nodo** nella barra dell'editor lo apre e, se premuto di nuovo, lo chiude; lo stato del pulsante riflette quello del pannello. Lo stato iniziale è chiuso a ogni avvio (`contextVisible = false` in `index.ts` e `MarkdownEditor.ts`), mentre l'altezza del pannello resta persistita in `wiki-forge:context-height`. Test dedicati in `tests/nodeInfoVisibility.test.ts` e `tests/editorFormatting.test.ts`.

### Template grafici, pulsante File e Split a tre pannelli

- **Gestione template grafica**: nuova voce **📐 Template** nel menu `⋯` (aggiunta al catalogo azioni come `global:template`, quindi pinnabile nella barra). Apre il **Template Manager**: elenco dei template incorporati e personali, scelta del **predefinito**, creazione/modifica/eliminazione di template utente e pulsante **Nuovo documento**.
- **Nuovo documento**: il pulsante **➕ Nuovo file** nella barra laterale apre ora una finestra con **nome del documento**, **percorso modificabile nella wiki** (per creare la nota in una cartella diversa) e **selezione del template** (con anteprima del contenuto renderizzato). Il valore predefinito è il template scelto nel Template Manager. La nota viene creata tramite `storage.createFile(folderPath, fileName, content)`, perciò il frontmatter OKF v0.2 del template finisce subito nel file.
- **Built-in da `templates/`**: cinque template OKF v0.2 ispirati ai file del repository (`article.md`, `thesis_capitolo.md`, `thesis_domanda.md`, `thesis_sintesi.md`, `reveal/template.md`). I template utente vivono in `localStorage` (`wiki-forge:templates`, `wiki-forge:default-template`), senza modifiche al backend. `{{TITLE}}`, `{{DATE}}`, `{{ID}}`, `{{AUTHOR}}`, `{{CHAPTER_NUMBER}}`, `{{SUBTITLE}}` vengono sostituiti; gli altri segnaposto restano da compilare. Vedi `docs/USER_GUIDE.md` e `docs/help/modifica-note.md`.
- **Pulsante File nella barra in alto**: nuovo toggle **🗂️ File**, primo pulsante **dentro lo stesso riquadro segmentato** di Editor/Note/Grafo/Divisione, che mostra/nasconde il file manager laterale come le altre viste. Stato condiviso in `appStore.filesVisible` (persistito, con migrazione dalla vecchia chiave `wiki-forge:sidebar-collapsed`): lo stesso stato comanda il pulsante, la colonna laterale e il pannello File dello Split. Il vecchio gestore `◀`/`▶` sul bordo della colonna ora usa la medesima fonte di verità.
- **Split a tre pannelli**: **Divisione** ora mostra **File · Editor · Grafo** (non più due). Entrare in Split rende visibile il pannello File; uscire ripristina l'ultima vista singola. Aggiunti `SPLIT_PANE_IDS` e `isThreePaneSplit()` in `core/utils/viewMode.ts`.
- **Nota sui comandi chat**: `/template show` e `/new-article <nome>` sono ancora elencati nel catalogo comandi e negli skill, ma `processChatCommand` non ha handler per essi: il flusso grafico descritto sopra è la via affidabile per creare note da template. Test dedicati in `tests/templateService.test.ts` e `tests/templateModals.test.ts`; aggiornati `tests/viewMode.test.ts` e `tests/headerToolbarCustomizer.test.ts`. Validazione: `npx tsc --noEmit`, `npm test` (301 test, 300 pass, 1 skip), `npm run build` verdi.

### Research Studio — salvataggio delle risposte `/consult`

- Aggiunti due pulsanti accanto a **Copia risposta** nella scheda Consult: **📄 Salva nella wiki (OKF)** e **🗒️ Salva nello Scratchpad**. Il primo crea una nota `Reference` OKF v0.2 in `wiki/general/` validando frontmatter, attori, timestamp e fonti **prima** della scrittura, poi aggiorna gli indici; il secondo scrive una normale quick note in `notes/quick-notes.md`, già gestita dal flusso `/promote-note` e dal pannello Scratchpad della sidebar.
- Nuovo endpoint `POST /api/notes/research/promote-answer`, builder/validator deterministico in `researchAnswerNote.ts`, metodi `ApiStorage.researchPromoteAnswer` e callback `onScratchpadChanged` per aggiornare la sidebar dopo il salvataggio. Test dedicati in `tests/researchAnswerPromote.test.ts`; guida utente aggiornata in `docs/help/research-studio.md`.

### Rigenerazione wiki da `docs/` (script di drift)

- `scripts/docs_wiki_drift.py` ora **rigenera effettivamente la proiezione OKF** nella wiki di wikiforge quando rileva un drift, invece di limitarsi a segnalarlo. `--check` mantiene il vecchio comportamento consultivo in sola lettura. Vengono scritti solo i file generati: le note curate di `sintesi/`, `architettura/note_architettura.md` e `.wiki-forge/` sono preservate.
- **Fix dei percorsi relativi**: `--docs-dir` e `--wiki-dir` (e le stesse opzioni di `docs_to_wiki.py`) sono ora risolti rispetto alla radice del repository, non alla cartella del progetto da cui lo scheduler lancia lo script (`/app/projects/tesi`). Questo elimina i 53 falsi `missing:` dovuti a `cwd` diverso.
- Lo script è registrato come **mutante** in `MUTATING_SCRIPT_IDS`: i run schedulati vengono sottratti dal Policy Agent F5 e accodati per l'approvazione F6; l'esecuzione diretta scrive subito. Aggiornati registry, descrizioni degli Use Case e documentazione.

### Header personalizzabile

- Il menu `⋯` della barra in alto ora contiene **solo** l'elenco **Personalizza barra**, una riga per ogni azione globale: cliccare la riga esegue l'azione, spuntare la checkbox la mostra anche come pulsante nella barra (disattivandola il pulsante scompare). Nessuna seconda lista duplicata. La scelta è persistita in `localStorage` tramite `appStore.pinnedActionIds`; i valori iniziali riproducono il layout storico. La riga di **Wiki Docs** è disponibile solo in Developer Mode. Aggiunti test dedicati (`tests/headerToolbarCustomizer.test.ts`).
- **Editor / Note / Grafo / Divisione restano sempre nella prima riga** della barra. Le altre voci pinnate stanno alla loro destra e, quando non c'è spazio, passano in una **seconda riga centrata rispetto alla finestra** (ridimensionamento gestito senza scorrimento orizzontale). Il pulsante `⋯` resta sempre visibile in fondo alla prima riga; i tre punti sono disegnati in CSS (nessuna dipendenza dal glifo del font).

### Frontend UI/UX & Project Lifecycle — implementazione (Fase 78, fasi 1–7)

- **Design system minimale**: nuovi `styles/tokens.css` (colori, spaziature, raggi) e `styles/primitives.css` (`.wf-btn`, `.wf-field`, `.wf-modal*`, `.wf-menu*`, `.wf-toast*`, `.wf-tab*`, `.wf-palette*`). Le feature CSS riutilizzano le primitive invece di duplicare stili inline.
- **Catalogo azioni unico** (`core/actions.ts`): Header, header nota, menu contestuale e Command Palette leggono la stessa fonte; Research e Studio sono ora **solo globali** (rimossi i pulsanti duplicati dall'header della nota). Handler collegati una volta in `WikiForgeApp.bindGlobalActions()`.
- **Disaccoppiamento**: `core/events.ts` (eventBus tipizzato), `appStore` come unica fonte di verità del progetto attivo (`ApiStorage` delega ad esso), callback tipate per `MarkdownEditor` con overload storico conservato, `core/ui/resizer.ts` condiviso da MainLayout, Sidebar, ChatDrawer e KE Workbench (quattro implementazioni duplicate eliminate).
- **Scorciatoie e i18n**: un solo listener globale (`core/shortcuts.ts`) risolve la collisione `Ctrl+Alt+D` (Digest = `Ctrl+Alt+D`, Wiki Docs = `Ctrl+Alt+W`); `Ctrl+K` palette, `F1` guida, `Ctrl+Shift+D` toggle modalità. Dizionario IT/EN con selettore lingua nell'header e `document.documentElement.lang` sincronizzato (`index.html` ora `lang="it"`).
- **Dialoghi accessibili**: `services/notificationService.ts` (toast + `confirm`/`prompt` asincroni) sostituisce **ogni** `alert`/`confirm`/`prompt` nativo nel frontend.
- **Ciclo di vita progetti**: backend `projectService.ts` con rename, clone, archive/restore, export/import, stats e `DELETE` con **cestino come predefinito** (`permanent` richiede token di conferma, `default` protetto). Nuovo `ProjectManagerModal` frontend; `ConfigManager` non gestisce più creazione/cancellazione progetti e non usa più dialoghi nativi.
- **Documentazione**: aggiornati `ARCHITECTURE.md`, `TECHNICAL_ARCHITECTURE.md`, `USER_GUIDE.md`, `docs/help/progetti-config.md`, `ROADMAP.md`; wiki `wikiforge` rigenerata da `docs/`.
- **Validazione**: `npx tsc --noEmit`, `npm test` (274 pass, 1 skipped), `npm run build` verdi. I test Python passano tranne la nota utente preservata `architettura/note_architettura.md` e i test che richiedono `pyshacl`/`watchdog` non installati in questo ambiente.

### Frontend UI/UX & Project Lifecycle — studio e piano (Fase 78)

- Aggiunto `docs/FRONTEND_UIUX_PLAN.md`: audit dettagliato del frontend (pulsanti Research/Studio duplicati in header globale e header nota, ~746 stili inline, 4 resizer duplicati, 3 listener `keydown` con collisione `Ctrl+Alt+D`, doppia source of truth del progetto attivo) e piano in 7 fasi KISS/DRY con catalogo azioni unico, design system a token, primitive UI, disaccoppiamento, accessibilità/i18n e ciclo di vita progetti completo lato backend/frontend.
- `ROADMAP.md`: nuova fase 78 in stato Todo.

### Note Editor — migrazione a Milkdown/Crepe (WYSIWYG, disaccoppiato)

- **Adapter seam**: `MarkdownEditor.ts` resta lo shell (header, Node Info, Review/Research/Studio/Cronologia, save lifecycle) e delega la superficie di editing a `NoteEditorAdapter` (`EditorAdapter.ts`). Due motori: `CodeMirrorAdapter` (fallback/source view) e `milkdown/MilkdownAdapter` (Crepe 7.23 WYSIWYG, TypeScript vanilla, nessun React). `resolveEngine()` sceglie automaticamente Milkdown nei browser reali e CodeMirror con DOM mock nei test. Le azioni della toolbar sono semantiche (`toggleInline`, `applyBlock`, `insertColor`, `insertAlignment`, undo/redo); gli helper puri condivisi stanno in `editorMarkdownOps.ts`.
- **Caricamento lazily**: `MilkdownAdapter` è importato con `import()` dinamico: Crepe è ESM-only e il subpath `@milkdown/kit/component/diff` non è risolvibile dal test runner Node, che resta quindi sul fallback CodeMirror. Vite emette un chunk `MilkdownAdapter-*.js` separato. CSS Crepe (`common/style.css`, `frame-dark.css`) importati in `index.ts`.
- **Feature Crepe**: toolbar, tabelle GFM, KaTeX, upload immagini, slash command e blocchi di codice CodeMirror attivi; `AI` e `TopBar` disabilitati (Review/Research/Studio esistono già). Upload via `ApiStorage.uploadFile()` in `raw/assets`.
- **Frontmatter OKF byte-identico**: `WikiNote.frontmatterRaw` conserva il blocco YAML esatto; l'editor vede solo il body e `saveCurrentContent()` passa `frontmatterRaw + body` come `fullContent`. `ApiStorage.saveNote()` invia `rawContent`, che il backend scrive verbatim con `safeFs.atomicWriteFile()`.
- **Wikilink nativi**: plugin remark + nodo inline atomico (`milkdown/wikilink.ts`, helper puri in `wikilinkParsing.ts`) mantengono `[[target]]`, `[[target|label]]`, `[[predicate::target|label]]` e `#anchor` invariati durante la serializzazione (remark altrimenti escapa `[[`). Click bridgiati a `onOpenLink`. Colori/allineamenti inseriti come nodi `html` per evitare l'escape del markup.
- **Test e documentazione**: nuovi `tests/editorWikilink.test.ts` (8 test); `tests/editorFormatting.test.ts` e il test di round-trip frontmatter restano verdi. Nuovo `docs/EDITOR_MIGRATION.md`; aggiornati `ARCHITECTURE.md`, `TECHNICAL_ARCHITECTURE.md` e la proiezione wiki da `docs/`.
- **Fix scroll**: il tema Crepe non dichiara un contenitore di scroll e il wrapper dell'editor tagliava il contenuto. `styles/editor.css` rende il nodo `.ProseMirror` lo scroll container (`overflow: auto`): scorrimento verticale per note lunghe e orizzontale per tabelle/codice larghe, toolbar flottante ancorata a `.milkdown`, padding ridotto a `16px 20px` per il pannello ridimensionabile.

### Architettura coerente — Fase 77 (KISS/DRY, addio duplicazioni)

**Scopo originale — selezione del progetto.** Script Control Panel e KE Workbench inviano ora
`X-Project-Id` + `projectId` nel body; il backend sovrascrive gli argomenti `project` obsoleti
inviati dai form e passa `WIKIFORGE_PROJECT_ID` / `WIKI_FORGE_WIKI_DIR` ai processi Python.
Prima, senza header, il backend ricadeva su `default` e un path `wiki` veniva risolto a
`projects/tesi/wiki` anche con `wikiforge` selezionato. `okf_common.py` risolve ora il primo
candidato esistente nella direzione `<cwd> → projects/<selezionato> → <repo root>`.

- **Governance scheduler (A1/F5)**: `executeScheduledJob()` usa `ctx.steps ?? ctx.job.steps`.
  Prime della fix, uno step mutante trattenuto dal Policy Agent veniva rieseguito dal job
  schedulato. Test di regressione in `tests/agentScheduleF5F6.test.ts` (5/5).
- **Validazione config (A8)**: nuovo `src/backend/wikiforge/core/config_schema.py` con schema
  dichiarativo unico; `get_project_config()` fallisce con `ConfigError` su tipi errati; CLI
  `python -m src.backend.wikiforge.core.config_schema [file...]` stampa JSON. 12 test in
  `tests/python/test_config_schema.py`.
- **Registry script come Single Source of Truth (A1/A6)**: `SCRIPT_SCHEMAS` (Python) copre
  29 script (aggiunti `docs_wiki_drift`, `wiki_program_change_propose`,
  `wiki_program_change_apply`). `scripts/gen_script_registry.py` genera
  `src/backend/server/generated/scriptRegistry.generated.ts`; `--check` verifica la sincronía.
  Rimosso il registry duplicato in `agentServer.ts` e il probe a 29 subprocess `--json-schema`
  (endpoint `/api/scripts/list`: ~9,3 s → ~74 ms). 6 test in
  `tests/python/test_script_registry_ssot.py`.
- **Reindex senza fallback duplicato (A1)**: `executeReindexWorkflow()` invoca solo
  `scripts/okf_reindex.py` e propaga errori di avvio/uscita. Nuovo
  `src/backend/server/toolPaths.ts::resolveToolScript()` separa la root degli strumenti dalla
  root dati del progetto ed è usato da tutti i siti di spawn. 42 test workflows/agentServer.
- **Filesystem sicuro (A5/A11)**: nuovo `src/backend/server/safeFs.ts` con `atomicWriteFile`,
  `softDelete`, `listTrash`, `restoreFromTrash`. 23 scritture convertite; `deleteHandler` ora
  sposta nel cestino invece di `unlink`; nuove route `/api/wiki/trash` e
  `/api/wiki/trash/restore`; rimosse le route duplicate `/api/wiki/delete` e `/api/wiki/upload`.
  3 test in `tests/safeFs.test.ts`.
- **Changeset vivi (A7)**: `src/backend/server/changesetStore.ts` implementa
  Plan→Review→Apply sopra `safeFs`, con `/api/v1/changesets`, `/:id`, `/:id/apply`, `/:id/reject`.
  Il pulsante **📋 Proponi changeset** in `ChatDrawer.ts` accoda le proposte LLM senza scrivere
  i file; la coda **📋 Changesets** in `Header.ts` apre `ChangesetReviewModal`, ora project-scoped.
  Il vecchio `src/backend/wikiforge/vault.py` (orfano, nessun chiamante) è stato eliminato: la
  sua funzionalità è ora nel layer Node live. 5 test in `tests/changesets.test.ts`.
  *Correzione storica alla v4.1.0*: la voce "Safe Vault & Changeset Manager (`vault.py`)"
  descriveva un modulo che non è mai stato collegato al server; l'implementazione effettiva è
  quella sopra.
- **Confine runtime esplicito (A2/A3)**: `vite.config.ts` non istanzia più `AgentServer`; Vite
  è solo server statico + reverse proxy, con un unico `apiProxy` condiviso da dev e preview
  che pipes la risposta (SSE incluso). `npm run api` avvia il gateway standalone,
  `npm run dev:all` avvia gateway + UI; `docker-compose.yml` aggiunge il servizio FastAPI
  `kg-api` (:8000, interno) e imposta `FASTAPI_SERVER_URL=http://kg-api:8000` sul gateway.
  Nuovi target Makefile `api`, `kg-api`, `dev-all`. 5 test in `tests/runtimeBoundary.test.ts`.
- **Validazione**: `npx tsc --noEmit` OK; `npm test` 254 pass / 1 skipped;
  `PYTHONPATH=.:scripts pytest tests/python/` 44 pass (1 test fallisce solo perché il bundle
  contiene `projects/wikiforge/wiki/architettura/note_architettura.md`, file locale non
  tracciato dell'utente, da preservare).

### Self-Documentation Wiki — Fase 70-75

- **Plan & mapping (`docs/SELF_WIKI_PLAN.md`)**: `docs/` becomes the self-documentation wiki of wiki-forge. Source stays canonical; a deterministic OKF v0.2 projection is committed in `projects/wikiforge/wiki/` (source + projection, no in-place conversion, so `docs/help/*.md` frontmatter keeps working with `/api/help` and `check_docs_sync.py`). `docs/METRICS.md` is excluded because `npm test` regenerates it. Source language is preserved via `lang/it` / `lang/en` tags.
- **Generator (`scripts/docs_to_wiki.py`)**: idempotent projection of 43 sources into 51 OKF files (6 areas + curated `sintesi/`), with fixed `BUILD_STAMP`, `--check`, `--json` and `--dry-run`. Provenance uses `generated.by: process:docs-to-wiki`, quoted ISO timestamps and a `sources[].resource` pointer to each source document. Relative links are rewritten to generated notes; images resolve to `/docs/mockups/...`.
- **Dedicated project (`projects/wikiforge/`)**: registered in `config/projects.json` with its own `config.toml` (OKF v0.2, area→type map, allowed tags). The generated bundle is committed; `scripts/check_docs_sync.py` now fails on drift and `scripts/okf_lint.py projects/wikiforge/wiki --json` validates it.
- **Consultation UX (Fase 74)**: new **📚 Wiki Docs** top-bar button and `Ctrl+Alt+D` open the Research Studio scoped to `wikiforge` without switching the active vault. `ResearchOpenOptions` gained `projectId`/`scopeLabel`; `ApiStorage` adds explicit project scope to all `research*` calls and `getAllNotes` (both `projectId=` query parameter and `X-Project-Id` header, because the backend gives the header precedence). A scope badge marks the queried project; clicking a source note activates `wikiforge` and opens it in the editor. New in-app help topic `wiki-di-wiki-forge`.
- **Curated accumulation (Fase 75)**: `scripts/promote_doc_answer.py` promotes an approved answer into `wiki/sintesi/` with `verified: human:<id>` and regenerates the indexes; it is human-only and registered as a mutating script blocked by the F5 Policy Agent. `scripts/docs_wiki_drift.py` detects docs/wiki drift and regenerates the OKF projection (curated notes preserved), with `--check` for a read-only advisory report (rationale + sources, always exit 0); it is wired as `weekly-docs-wiki-drift` Use Case 7 with `auto_apply = false` and is hard-blocked by the F5 Policy Agent as a mutating script, so scheduled runs require F6 approval. No job writes to `docs/` or the code.
- **Tests**: `tests/python/test_docs_to_wiki.py` (9 tests: determinism, OKF lint, drift detection, provenance, human verification) and `tests/docsWikiScope.test.ts` (3 tests: scoped URLs/headers and Docs Wiki button wiring); updated scheduler/Use Case/Policy expectations for the new job.

### Self-Documentation Wiki — Fase 76

- **Wiki → program change bridge**: `scripts/wiki_program_change_propose.py` is a read-only step that validates a proposal (JSON or an assistant answer with `wiki-edit` blocks), checks a strict path allowlist and unique `find` matches, requires rationale and sources, and stages the record in `output/program-changes/` without touching program files.
- **Human-only apply**: `scripts/wiki_program_change_apply.py` is a mutating script that refuses to run without `--reviewer human:<id>` and `--confirm`; it snapshots every target file before an exact find/replace and appends a JSONL audit entry. It is hard-blocked from automatic execution by `MUTATING_SCRIPT_IDS`.
- **Use Case 8 / F6**: `ke_wiki_program_change` has a read-only stage step and a mutating apply step. The F5 Policy Agent withholds the apply step into the approval queue; only `POST /api/ke/schedule/approvals/:id/approve` injects the human reviewer and confirmation and executes it with an `actor: human` audit trail. The `wiki-program-change` job has `auto_apply = false` and is disabled by default.
- **Tests**: `tests/python/test_program_change.py` (7 tests: parsing, allowlist, replay protection, snapshots, audit, human reviewer) and `tests/programChangeBridge.test.ts` (3 tests: F5 withholding, F6 apply, direct-execution denial); updated Use Case and Policy expectations (now 8 Use Cases).

### Knowledge Engineer Scheduler — F5 & F6

- **Policy Agent (`scheduler/policyAgent.ts`)**: advisory, fail-closed LLM gate invoked before every job. It selects the read-only steps, forwards mutating ones to the approval queue, and appends a JSONL decision to `output/scheduler/decisions.jsonl` with a mandatory rationale, sources, origin and timestamp. Invalid/unavailable LLM output never widens permissions: it falls back to the deterministic "read-only + approval" rule and still logs a grounded decision. Rationale, sources and errors are redacted before reaching disk. `MUTATING_SCRIPT_IDS` hard-blocks `suggest_tags`, `okf_reindex` and `maturity_calculator` from automatic execution.
- **Event triggers (`scheduler/eventTriggers.ts`)**: debounce bus for `note.created`, `note.modified` and `note.deleted`, fed by `POST /api/ke/schedule/trigger` (webhook) and by the in-app note-creation hooks (`createFileHandler`, `uploadHandler`, `ingestMarkdownHandler`). Events are deduplicated by note path and collapse into a single run after a sliding quiet period (`debounce_seconds`, default 300s). Config keys: `event_trigger` and `debounce_seconds`; the shipped `note-created-review` job is opt-in.
- **Approval queue (`scheduler/approvalStore.ts`)**: pending/approved/rejected/failed requests persisted atomically in `.wiki-forge/scheduler-approvals.json`. Execution of a withheld step happens only after an explicit human POST, preceded by review snapshots of all wiki notes and followed by an audit entry with `actor: human`.
- **Scheduler changes**: preflight hook with a `job_skipped`/`policy_decision`/`approval_required`/`event_queued`/`event_triggered` SSE contract, `TriggerEvent` propagation to audit and LLM context, and `recordApprovalRun()` for human-authorised runs. `PYTHONIOENCODING=utf-8` is now set for spawned Python steps so Unicode output cannot fail a step on Windows.
- **REST API**: `GET /api/ke/schedule/decisions?jobId=&limit=`, `GET /api/ke/schedule/approvals?status=&jobId=`, `POST /api/ke/schedule/trigger`, `POST /api/ke/schedule/approvals/:id/approve` and `/reject` (optional `reviewer` and `reason`). All keep the existing `WIKIFORGE_API_TOKEN` guard; RBAC remains a future extension.
- **Workbench UI**: the **🤖 Agenti & Schedule** tab now shows a **Policy & Approvazioni** section with each decision's rationale and sources, pending mutating steps with explicit **✅ Approva** / **❌ Rifiuta** controls, and live refresh on the new SSE events. New pure view models and log mappings live in `schedulePanel.ts`.
- **Tests**: `tests/policyAgent.test.ts` (7), `tests/eventTriggers.test.ts` (5) and `tests/agentScheduleF5F6.test.ts` (5) plus 2 new `schedulePanel.test.ts` cases. Total: 229 tests, 228 pass, 1 skipped.

### Knowledge Engineer Scheduler — F0, F1, F2, F3 & F4
- **Shared Use Case runner (`useCaseRunner.ts`)**: the SSE execution logic was extracted into a reusable `runUseCase()` with an injected event callback and dependencies. The `/api/ke/use-cases/execute` endpoint now delegates to it with an identical event stream, so the future scheduler will not duplicate the execution path. F2 adds an optional `AbortSignal` that terminates the child process and waits for its `close` event; without a signal the SSE behaviour is unchanged.
- **Schedule configuration (`config/agent_schedule.toml`)**: six confirmed jobs with `auto_apply = false`; only reports are automated (`okf_reindex` and the frontmatter-writing `maturity_calculator` are excluded via `steps`).
- **Cron & config validation (`scheduler/cron.ts`, `scheduler/jobStore.ts`)**: 5-field cron and `every=<n>m|h|d` parsing via the lightweight `cron-parser` library, timezone-aware `nextRunAt()` (UTC instants), Italian schedule descriptions, and per-job validation that skips invalid entries instead of stopping startup.
- **Dependency**: added `cron-parser` (CommonJS, Node ≥18).
- **Scheduler engine (`scheduler/scheduler.ts`)**: deterministic `Scheduler` with a single self-rescheduling tick, injectable clock/timers/state/lock/executor, single-flight protection, `max_concurrency`, retry with 1m/5m backoff, timeout via `AbortController`, graceful `stop()` and a status snapshot consumed by the F3 API. Runs interrupted by a previous process are detected at startup and retried immediately. F3 adds `subscribe()`, runtime overrides and `cancelJob()`.
- **Runtime state & lock (`scheduler/runtimeState.ts`, `scheduler/lock.ts`)**: atomic writes to `.wiki-forge/scheduler-state.json` (missing/corrupt state rebuilt from config), PID-based `.wiki-forge/scheduler.lock` that recovers stale locks and never deletes a lock taken over by another process. Both paths are gitignored.
- **Audit & logs**: one redacted JSONL entry per run in `output/scheduler/audit.jsonl` plus a redacted per-run log file; API keys and tokens are stripped before anything reaches disk.
- **Runtime wiring (F3)**: `AgentServer.startScheduler()`/`stopScheduler()` load the TOML at boot and run the engine inside the API process; `httpServer.ts` starts it and cancels active jobs on `SIGINT`/`SIGTERM`. `AgentServer.executeScheduledJob()` forwards `AbortSignal` and `stepIndices` to `runUseCase()`, so mutating steps stay excluded. A broken config is reported by `GET /api/ke/schedule` without stopping the server.
- **REST & SSE API (F3)**: `GET /api/ke/schedule` (config + snapshot + errors), `PATCH /api/ke/schedule/:id` (enable/disable, cron change — persisted as overrides in `.wiki-forge/scheduler-state.json`, TOML stays the source of truth), `POST /:id/run` (SSE with scheduler events plus the original `use_case_event` stream), `POST /:id/cancel`, `GET /api/ke/schedule/runs?jobId=<id>` (filterable audit trail) and `GET /api/ke/schedule/events` (live SSE). Manual cancellation returns the job to its cron slot; shutdown cancellation is retried immediately on restart. All routes use the existing `WIKIFORGE_API_TOKEN` check.
- **Workbench tab (F4)**: new **🤖 Agenti & Schedule** tab in `KEWorkbenchModal.ts` with one card per job (role, Use Case, readable cron, next run, last outcome, failures), enable/disable and schedule-change buttons, **Esegui ora** streaming scheduler + Use Case events into the existing `LogConsole`, **Annulla**, a live SSE status stream and a compact run history. `schedulePanel.ts` holds the pure view model, UTC formatting, SSE frame parsing and event-to-log mapping.
- **Tests (F4)**: `tests/schedulePanel.test.ts` (8 tests) and `tests/keWorkbenchSchedule.test.ts` (2 DOM/fetch-mock tests). Total at F4: 210 tests, 209 pass, 1 skipped.
- **Tests (F0–F3)**: new `tests/useCaseRunner.test.ts` (4 tests), `tests/agentScheduler.test.ts` (8 tests, DST/timezone and shipped-config contract), `tests/agentSchedulerEngine.test.ts` (11 tests, including three consecutive slots without duplicates, restart recovery and the two cancellation policies) and `tests/agentScheduleApi.test.ts` (8 tests, full REST/SSE contract).

### KE Workbench Console
- **Hide & resize**: the Console Output has a `▾/▴ Console` toggle and a drag handle; height and collapsed state persist in `localStorage` and are re-clamped on window resize.

### Study Studio (UI)
- **Single study console (`StudyStudio.ts`)**: one modal with seven horizontal tabs — **Guida**, **Quiz**, **Mindmap**, **Audio**, **Note**, **Promuovi**, **Tesi** — reusing the Review Studio shell with an amber accent. Opened from the **📚 Studio** top-bar/editor buttons, the note context menu (Guida / Quiz / Mindmap / Copione audio), and `Ctrl+Alt+G/K/M/A`.
- **Study API (`agentServer.ts`)**: new routes `POST /api/notes/study/guide`, `/quiz`, `/mindmap`, `/audio-overview`, `/note`, `/promote-note`, `/thesis-chapter`.
- **Deterministic helpers (`studyHelpers.ts`)**: pure, unit-tested builders for study guides, exact-count quizzes (1–25), heading/wikilink mind maps with graph JSON, Host A / Host B audio scripts and thesis chapters filtered by maturity.
- **Command parity**: `executeStudyGuideWorkflow`, `executeQuizWorkflow`, `executeMindmapWorkflow`, `executeAudioOverviewWorkflow`, `executeNoteWorkflow`, `executePromoteNoteWorkflow` and the new `executeThesisChapterWorkflow` all call the shared builders, so chat and modal produce identical artefacts. `/thesis-chapter` is now routed in TypeScript and refreshes both `output/thesis-<slug>.md` and the canonical `output/thesis_compiled.md`.
- **UX details**: quiz count is exact (clamped 1–25), `sources` use real `note.path` values (no `wiki/wiki/...`), promotion uses the selected scratchpad entry and its text for the article title, and the Mindmap tab falls back to the first note.
- **Tests**: new `tests/studyHelpers.test.ts` (10 tests) and 4 integration tests in `tests/agentServer.test.ts`.
- **Documentation alignment**: README + docs index, GUIDA_OPERATIVA, USER_GUIDE, TUTORIAL (§2 and §4), TECHNICAL_ARCHITECTURE (§2.13), AGENT, WORKFLOW, CHANGELOG, both ROADMAPs, in-app help (new `study-studio` topic plus `inizio`, `barra-alto`, `modifica-note`, `chat-comandi`, `studio-sintesi`, `esportare`).

### Research Studio (UI)
- **Single query console (`ResearchStudio.ts`)**: one modal with six horizontal tabs — **Consult**, **Ricerca**, **Backlink**, **Correlate**, **Traccia**, **Deep Research** — reusing the Review Studio shell with a cyan accent. Opened from the **🔎 Research** top-bar button, the **🔎 Ricerca** editor button, the note context menu (Backlink / Correlate), `Ctrl+Alt+Q/S/B/L/T/H`, or by typing one of the six commands in chat.
- **Research API (`agentServer.ts`)**: new routes `GET /api/notes/research/search`, `GET /api/notes/research/backlinks`, `GET /api/notes/research/related`, `GET /api/notes/research/trace`, `POST /api/notes/research/consult`, `POST /api/notes/research/deep-research`.
- **Deterministic helpers (`researchHelpers.ts`)**: pure, unit-tested functions for tokenisation/key terms, ranked full-text search, wikilink backlinks, related-note suggestions (shared tags + vocabulary, excluding existing links) and trace-source resolution.
- **LLM paths with fallback**: `consultWiki` ranks the notes and answers with the configured model, falling back to a deterministic note list; `generateDeepResearch` writes `output/research-*.md` and `wiki/synthesis/*.md` with a source-attribution matrix and knowledge gaps, using the LLM for the body when available.
- **Tests**: new `tests/researchStudio.test.ts` (6 helper tests) and 4 integration tests in `tests/agentServer.test.ts`.
- **Documentation alignment**: README + docs index, USER_GUIDE, TUTORIAL (§2 and §5), TECHNICAL_ARCHITECTURE (§2.12), AGENT, CHANGELOG, ROADMAP, in-app help (new `research-studio` topic plus `inizio`, `barra-alto`, `modifica-note`, `chat-comandi`).

### Review Studio (UI)
- **Single review console (`ReviewStudio.ts`)**: one modal with four horizontal tabs — **Verifica**, **Critica**, **Digest**, **Confronta versioni** — dark theme and emerald accent. Opened from the note context menu (`ReviewContextMenu.ts`), the **🧐 Revisione** editor button, or `Ctrl+Alt+R/C/D/F`.
- **Review API (`agentServer.ts`)**: new routes `GET /api/notes/review/meta`, `POST /api/notes/review/verify`, `GET /api/notes/review/digest`, `POST /api/notes/review/critique`, `GET /api/notes/review/snapshots`, `GET /api/notes/review/diff`, `POST /api/notes/review/restore`.
- **Deterministic quality gate and digest**: `getReviewMeta` checks internal links, OKF frontmatter, tags, cited sources and `stale_after`; `getReviewDigest` groups `wiki/log.md` activity by day with health stats and next actions. Human verification reuses `recordHumanVerification` (same path as `/verify`).
- **Local snapshot store**: pre-write content saved to `.wiki-forge/snapshots/<note-path>/<timestamp>.md` plus a `.json` sidecar; the latest 25 snapshots per note are retained, gitignored, no git binary required. Unified line-by-line diff and one-click restore.
- **Critique tab**: LLM-backed adversarial review (`fast`/`standard`/`deep`, selectable focus) with a deterministic fallback when no provider is configured.
- **Design deliverables**: rewritten `docs/mockups/review-studio.html` and 5 regenerated PNG previews (Verifica, Critica, Digest, Diff, context menu), documented in `docs/mockups/README.md`.
- **Documentation alignment**: README + docs index, GUIDA_OPERATIVA, USER_GUIDE, TUTORIAL (§2 and §5.1), ARCHITECTURE, TECHNICAL_ARCHITECTURE (§2.11), AGENT, WORKFLOW, OKF_SPEC, THESIS_GUIDE, in-app help (new `review-studio` topic + `inizio`, `stati-okf`, `modifica-note`, `barra-alto`, `chat-comandi`, `maturita-metriche`), and both ROADMAPs.
- **Icon change**: the Review Studio entry points now use 🧐 instead of 🔍 (the editor button, the `review-studio` help topic icon, mockups and docs), because 🔍 was too similar to the Research Studio 🔎. 🔍 is kept where it means search/zoom/consult.

### Documentation & Screenshots Refresh
- **New `docs/GUIDA_OPERATIVA.md`**: single non-technical operational guide (glossary, Focus/Developer modes, activities A–I, typical workflow, best practices); indexed as the recommended starting point in `docs/README.md` and root `README.md`.
- **Recreated UI/UX screenshots (`img/`, 21 JPG @1920×1080)**: captured from the running app against the real `tesi` vault — 13 student scenarios (onboarding wizard, editor, upload, markdown import, wikilinks/backlinks, graph, split, scratchpad, chat commands, compile progress, study help) and 8 Knowledge Engineer scenarios (developer mode, KE Workbench, use-case log, Tools panel, tools execution log, Config Manager general/LLM, `/audit` chat); removed the 18 outdated screenshots.

### Bug Fixes
- **Mojibake repair in `agentServer.ts`**: 63 chat-output strings (e.g. `/audit`, `/quiz`, `/mindmap`, wizard and promote-note responses) were stored with double encoding (`ðŸ›¡ï¸ Audit Report` instead of `🛡️ Audit Report`, `ProtÃ©gÃ©` instead of `Protégé`); restored the correct UTF-8 characters.

### Context-Sensitive In-App Help & UI Polish
- **Help panel (F1 / `?` button)**: new `HelpPanel` component with live search, topic grouping, context-aware suggestions (⭐), and a "💬 Chiedi all'agente" hand-off that prefills the chat drawer.
- **`/help [topic]` chat command**: deterministic index/topic rendering served from `docs/help/*.md` (15 topics, including the new `review-studio`), plus new backend routes `GET /api/help` and `GET /api/help/<id>` (no LLM required, works offline).
- **Help context registry**: Config, Tools, Import, Wizard, KE Workbench, Version Timeline, upload and compile flows register their context so the panel suggests the relevant topic; fallbacks derive from mode/view.
- **Sidebar collapse**: toggle on the left sidebar (file manager + tag cloud), persisted in `localStorage` (`wiki-forge:sidebar-collapsed`).
- **Editor Cronologia**: new **🕐 Cronologia** button in the editor header opens the existing *Version History & Rollback* modal (`VersionTimeline.ts`), previously unreachable.
- **Docs realignment**: drift fixes across TUTORIAL, USER_GUIDE, WORKFLOW, README, KE_PLAYBOOK, MIGRATION, AGENT, ARCHITECTURE, TECHNICAL_ARCHITECTURE and THESIS_GUIDE; new `docs/README.md` documentation index; `scripts/check_docs_sync.py` now validates `docs/help/*.md` frontmatter (id, keys, `id == filename`, docs/README coverage).

## [4.1.0] - 2026-10-22

### Knowledge Engineer Cockpit, Stateful Procedure Engine & Plan-Review-Apply Vault
- **Unified Health & Metrics Engine (`health.py`)**:
  - Aggregates SHACL violations, Competency Question gaps, KE maturity score, raw pending items, orphan ratio, and broken links into a single 0-100 Health Score and L1-L4 Maturity Level.
  - Automatically generates `.wikiforge/STATUS.md` and logs historical snapshots to `.wikiforge/metrics/history.jsonl`.
  - Exposes REST endpoint `/api/v1/health` in FastAPI and AgentServer.
- **Safe Vault & Changeset Manager (`vault.py`)**:
  - Implemented atomic file writes using temporary files and `os.replace`.
  - Soft-delete moving removed files to `.wikiforge/trash/` with timestamping.
  - Staged Changeset JSON proposals (`.wikiforge/changesets/`) ensuring Plan-Review-Apply safety model.
- **Stateful Procedure Engine (`procedures.py`)**:
  - Declarative TOML procedure workflows in `config/procedures/*.toml` (including predefined KE procedures `ke.bootstrap`, `ke.intake`, `ke.compile`, `ke.ontological-integrity`, `ke.validate-cq`, `ke.export-semantic`).
  - DAG requirement validation, automated script execution, human review pauses, exit criteria validation, and run state persistence in `.wikiforge/state/<run_id>.json`.
  - Procedure execution REST endpoints (`GET /api/v1/procedures`, `POST /api/v1/procedures/run`, `POST /api/v1/procedures/runs/:id/approve`).
- **Resumable User Wizards**:
  - Added user wizard TOMLs (`user.onboarding`, `user.add-sources`, `user.weekly-check`) saved to `.wikiforge/wizard_state.json`.
  - Added **🔄 Riprendi Wizard** button in Focus Mode (`SimpleModeDashboard.ts`) for one-click session resumption.
- **Live Sync & ETag Conflict Prevention**:
  - Live Server-Sent Events endpoint `/api/v1/sync/events`.
  - SHA256 ETag `If-Match` validation on `saveWikiNote` returning HTTP 412 (Precondition Failed) on concurrent write collisions.
- **Frontend KE Cockpit & Command Palette (`Ctrl+K`)**:
  - Built `KECockpitModal.ts` displaying top health metrics card, Next Best Action recommendations, and procedure execution stepper.
  - Built `CommandPalette.ts` (`Ctrl+K`) for global note search and procedure actions.
  - Built `ChangesetReviewModal.ts` for unified diff review, accept/apply, and rejection of staged changesets.
- **Documentation Overhaul**:
  - Updated `README.md`, `AGENT.md` (adding Session Startup Directive), and created `docs/ARCHITECTURE.md`, `docs/KE_PLAYBOOK.md`, `docs/USER_GUIDE.md`, `docs/PROCEDURES.md`, and `docs/MIGRATION.md`.

## [4.0.0] - 2026-10-20

### Decoupled 5 Macro-Components Architectural Refactoring (KISS & DRY)
- **Centralized Core Library (`wikiforge-core`)**:
  - Implemented `get_project_config()` in `src/backend/wikiforge/core/config.py` as Single Source of Truth for loading `config.toml` with absolute path resolution and fallback defaults across all services and scripts.
  - Expanded domain-specific exception hierarchy in `src/backend/wikiforge/core/exceptions.py` with `IngestionError` alongside `WikiForgeError`, `ConfigError`, and `ConversionError`.
  - Defined dynamic script schema registry contract in `src/backend/wikiforge/core/script_schema.py`.
- **Dynamic CLI Schema Contract & Argument Mapper**:
  - Implemented `--json-schema` CLI flag across Python scripts in `scripts/`.
  - Replaced hardcoded `switch` statement in `agentServer.ts` with a generic `buildCliArgsFromSchema` argument mapper.
  - Updated `GET /api/scripts/registry` to query script schemas dynamically.
- **Unified SQLite Ingestion Queue Engine (`wikiforge-ingest`)**:
  - Refactored `scripts/conv2md.py` to use `scripts/ingest_queue.py` persistent SQLite database (`.wiki-forge/ingest_queue.db`) for file state lifecycle tracking (`pending`, `processing`, `completed`, `failed`) and SHA256 idempotency checking.
  - Removed duplicate `.wiki-forge/file_hashes.json` file cache logic.
- **API Gateway Consolidation (`wikiforge-api-gateway`)**:
  - Implemented HTTP reverse proxy in `AgentServer` (`agentServer.ts`) for `/api/v1/graph/*` endpoints (`sync`, `validate`, `rag`) to proxy requests to FastAPI Knowledge Graph backend service (`FASTAPI_SERVER_URL`), exposing a single unified API URL base (`http://localhost:3001/api/...`) to the Web UI.
- **Documentation Overhaul**:
  - Updated `docs/TECHNICAL_ARCHITECTURE.md` with Mermaid topology diagram for the 5 macro-components architecture.
  - Updated `README.md` directory layout to reflect `src/backend/wikiforge/core/`.

## [3.5.0] - 2026-10-15

### Refactoring Architetturale (KISS/DRY)
- **Decoupling**: Rimossa la logica LLM CoT da `conv2md.py` per rispettare il principio di singola responsabilità (KISS); creata `scripts/enrich_cot.py`.
- **DRY**: Introdotto `BaseGraphExporter` in `src/backend/wikiforge/semantics/base_parser.py` per unificare il parsing Markdown tra gli exporter RDF e Cypher.
- **DX**: Aggiunta gerarchia di eccezioni personalizzate (`WikiForgeError`, `ConfigError`, `ConversionError`, `GraphValidationError`) in `src/backend/wikiforge/core/exceptions.py`.
- **UI**: Esposto endpoint `GET /api/scripts/registry` ed aggiornato `ToolsModal.ts` nel frontend per generare dinamicamente i form UI dallo schema backend (DRY).

## [3.4.1] - 2026-10-10

### Added
- **Agent chat window enlarging (`src/components/chat/ChatDrawer.ts`)**: a `⛶` header button (or double-click on the title bar, or `Esc` to restore) maximizes the chat drawer into a full-screen overlay; a drag handle on the drawer's left edge lets the user resize the docked width (320px–~viewport), with the chosen width persisted in `localStorage`. Sticky sizing: opening the chat keeps the last maximized/resized state.
- **Scratchpad viewer in the sidebar (`src/components/ui/Sidebar.ts` + `GET /api/wiki/scratchpad`)**: the quick notes saved with `/note` (`notes/quick-notes.md`) are now listed in a dedicated `🗒️ Scratchpad` section below the tag cloud, with expandable per-entry previews (timestamp + text), a reload button, and a `🚀 Promuovi` action that runs `/promote-note <id>` in the chat. The server parses `## [timestamp]` blocks into entries; empty/missing scratchpad renders a friendly hint instead of an error.
- **Scratchpad note deletion & resizable panel**: a `🗑️ Cancella` button (with confirmation) removes a single entry via `POST /api/wiki/scratchpad/delete` (the server rewrites the scratchpad file without the deleted block); a `ns-resize` drag handle on the section's top edge lets the user resize the scratchpad panel height, persisted in `localStorage` (`wiki-forge:scratchpad-height`).
- **Project-scoped scratchpad**: quick notes now live in the active project's folder (`projects/<id>/notes/quick-notes.md`) instead of a global repo-root `notes/`, so they are versioned with the project and the agent only ever reads the active project's files. Updated `/note`, `/promote-note`, the scratchpad API, and the sidebar viewer accordingly.

### Fixed
- **`tmp-ke-test-*` folders accumulating at repo root** (`tests/keUseCases.test.ts`): the KE Use Case suite created a temp dir in `before()` but never removed it in `after()`, leaving junk folders after each test run; the temp dir is now cleaned up.
- **Removed leftover root `wiki/` folder** (test artifacts `prova`/`test-empty-folder`): the agent knowledge commands already resolve the active project's `projects/<id>/wiki`; the stray root folder no longer exists to confuse prompt context.
- **Expanded Agent Command Menu (`src/components/chat/commandCatalog.ts`)**: a clickable "Comandi" bar in the agent top bar expands an inline panel with every agent slash-command grouped by topic (Ingestione, Curatela, Audit, Ricerca, Studio, Knowledge Engineering, Presentazioni, Utility). Clicking a command pre-fills the chat input. Replaces the fixed shortcut buttons.
- **Human Review Command (`/verify`)** in `src/server/agentServer.ts`: records an OKF v0.2 `verified: - by: human:<id>` entry on a note, optionally promoting it to `status: stable`, and appends a dated entry to `wiki/log.md`. This is the only action that flips a node to the `human-reviewed` trust tier (🟢) in the graph and sidebar. Alias: `/human-review`. Documented in `skills/wiki-curate/SKILL.md` and `docs/AGENT.md`.

### Fixed
- **`make okf-lint` on fresh CI checkouts** (`Makefile`): the targets linted `wiki/`, which is gitignored and absent on a fresh checkout (CI failed with `Path 'wiki/' does not exist`). `okf-lint`/`okf-validate` now auto-detect the wiki: root `wiki/` if present, otherwise every populated `projects/*/wiki`, failing only when no wiki is found.
- **OKF lint violations in the `tesi` project wiki**: added missing OKF v0.2 frontmatter to `projects/tesi/wiki/tools/comandi-uso-wiki.md` and `projects/tesi/wiki/Q&A/sintesi-previsioni-lavoro-hr-md.md`, so `make okf-lint` passes on project wikis.
- **KE Workbench "script not found" + `spawn python3 ENOENT`** in `src/server/agentServer.ts`:
  - Registered the previously missing `schema_infer` and `schema_lint` tools in `SCRIPT_REGISTRY` (with dedicated `buildCliArgs` cases), so KE Use Case 1 (`ke_schema_modeling`) and the Script panel can run them.
  - Resolved Python scripts against the repository root instead of the per-project root (`projects/<id>`), fixing ENOENT/`can't open file` for any non-default project.
  - Added `resolvePythonCommand()`/`PYTHON_CMD` fallback (`python3` → `python`) for host environments where the `python3` alias is unavailable.
  - Auto-injected `--project <id>` when running schema tools for a non-default project, so project-local `config.toml`/wiki paths are used.
  - `Dockerfile.ui`: installed `python3`, `pip`, and `requirements.txt` so the API/UI containers can actually spawn the python script runners (rebuild required: `docker compose up -d --build`).
- **Nested `verified` parsing** in `src/services/markdownParser.ts`: added `MarkdownParser.extractVerifiedActors()` so OKF v0.2 `verified: - by:` object lists are read correctly; previously nested human/process actors were invisible, causing notes to be mis-tiered (e.g. a human-verified note shown as `machine-confirmed`).

## [3.4.0] - 2026-10-06

### Added
- **Native Desktop Shell & Local API Token Security (Modulo A / Phase 52)**:
  - Added Tauri v2 desktop scaffolding in `src-tauri/` (`tauri.conf.json`, `Cargo.toml`).
  - Added local token authentication middleware (`X-WikiForge-Token` or Bearer header) in `src/server/agentServer.ts` securing local HTTP endpoints.
- **Two-Step CoT Ingestion Pipeline & Persistent Queue with Vision Support (Modulo B / Phase 53)**:
  - Upgraded `scripts/conv2md.py` with Two-Step Chain-of-Thought processing (Analysis -> Generation) and SHA256 fast-path hash caching (<10ms skip).
  - Built persistent SQLite/disk ingestion queue engine (`scripts/ingest_queue.py`) with retry logic and REST/SSE progress endpoints in `AgentServer`.
  - Added multimodal Vision captioning fallback for PDF embedded figures.
- **Dedicated Web Clipper Chrome Extension (Modulo C / Phase 54)**:
  - Developed Chrome Manifest V3 extension in `extension/` (`manifest.json`, `popup.html`, `popup.js`, `content.js`, `background.js`) using `@mozilla/readability` and `turndown` for HTML-to-Markdown conversion.
  - Connected extension popup to local API (`/api/wiki/upload` / `/api/clip`) via secure token authentication.
- **Deep Research Web Engine & Auto-Synthesis (Modulo D / Phase 55)**:
  - Extended `/deep-research` in `src/server/agentServer.ts` with web search provider query generation and execution (Tavily/SearXNG/mock).
  - Added user search query preview & confirmation flow, auto-synthesizing research notes into `wiki/synthesis/` with `<think>` reasoning trace streaming.
- **Topological Graph Insights & Louvain Community Detection (Modulo E / Phase 56)**:
  - Added Louvain community detection and graph insight extraction (surprising connections, knowledge gaps) in `scripts/graph_analytics.py` and REST API endpoints in `AgentServer`.
  - Updated `src/components/graph/ForceGraphViewer.ts` with community palette coloring, cluster toggles, and "Deep Research" trigger button on gap cards.
- **Asynchronous Human-in-the-Loop Review Queue (Modulo F / Phase 57)**:
  - Created persistent review queue storage (`.llm-wiki/reviews.json`) and LLM item flagging (`Create Page`, `Deep Research`, `Skip`).
  - Built interactive UI panel `src/components/tools/ReviewQueueModal.ts` for human approval, editing, and rejection of recommendations.
- **Agent Skills Execution Security & Skill Scanner (Modulo G / Phase 58)**:
  - Added dynamic `SkillScanner` in `src/server/agentServer.ts` scanning `skills/*/SKILL.md` and added `/skill` command to chat drawer.
  - Implemented explicit user safety approval modal prompt for shell command executions and workspace boundaries.
- **UI/UX Reasoning & Render Enhancements**:
  - Added `<think>` reasoning trace collapsible blocks in `src/components/chat/ChatDrawer.ts` and `src/core/utils/markdown.ts`.
  - Enhanced KaTeX math formula and Mermaid diagram rendering error fallbacks in `src/components/editor/MarkdownEditor.ts`.

### Fixed
- **Web UI Favicon**: Added `public/favicon.svg` and linked it from `index.html`, removing a 404 on `/favicon.ico`.
- **View Mode Persistence**: The Editor/Graph/Split selection is now stored in `appStore` (`wiki-forge:view-mode`) and restored across reloads.

### Changed
- **Simple Mode Relocated to the Header**: The 3-step flow (`📥 Carica` → `⚡ Compila` → `💬 Chiedi`) moved from a full-width panel above the editor into a compact pill group centred in the top bar, rendered via a new `#simple-mode-slot` in `MainLayout`. The previously hardcoded 60–140% scale slider was removed in favour of fixed compact sizing.
- **Node Metadata Panel Moved Below the Editor**: `ContextPanel` changed from a 280px right-hand sidebar to a full-width horizontal bar under the editor/graph row, with title, tags, OKF trust badges, backlinks and outbound links laid out as inline clickable chips. Its resizer changed from horizontal (`col-resize`, 200–500px) to vertical (`row-resize`, 84–420px).
- **Sidebar Toolbar Single Row**: The five file-operation buttons were hardcoded into two separate containers (`#toolbar-primary` / `#toolbar-secondary`), forcing two rows regardless of available width. They now share one `.sidebar-toolbar` flex container with `flex-wrap`, so they fit on one line and wrap only when the sidebar is narrowed. The previously dead `.sidebar-toolbar` rules in `sidebar.css` were activated and extended with hover/focus states.

### Fixed
- **Unmatched API Routes Hung Instead of Returning 404**: `AgentServer.handleRequest()` returns `false` when no route matches, but `httpServer.ts` discarded the resolved value, so unknown paths never received a response and the client hung indefinitely. This masked missing routes as infinitely-pending requests. The server now answers `404` (JSON) for unmatched paths and `500` for handler exceptions, provided headers have not already been sent.
- **KE Workbench "Guided Use Cases" Showed Nothing**: The panel rendered empty because `GET /api/ke/use-cases` never responded. The `api` container runs `npx tsx` without hot reload, so a running instance predating a server-side commit does not expose newer routes, and the unmatched-path hang above made the request stall silently. `KEWorkbenchModal` now surfaces fetch failures (message and endpoint) in `#ke-usecase-list` instead of only logging to the console.
- **Script Control Panel Showed an Empty Menu**: `ToolsModal` fetched `/api/scripts/list` and `/api/scripts/execute` with relative URLs. In the Docker setup the UI (Vite, `:5173`) and the API (`:3001`) are separate origins, so those requests hit the Vite dev server instead of the API. They now go through the shared `resolveApiBaseUrl()` helper exported from `ApiStorage`, matching every other component.
- **Vite `/api` Proxy Always Returned 502**: Two compounding faults. `VITE_API_BASE_URL=http://127.0.0.1:3001` was reused as the proxy target, but inside the `ui` container `127.0.0.1` is the container itself rather than the `api` service, so the upstream connection failed. Additionally `getOriginalUrl()` read `req.url`, from which Connect has already stripped the `/api` mount prefix, producing `http://…:3001/scripts/list`. Introduced a separate `VITE_PROXY_TARGET` (set to `http://api:3001` in `docker-compose.yml`) and restored the `/api` prefix before forwarding.
- **Silent Script Registry Failure**: `fetchScriptRegistry()` swallowed every error with an empty `catch`, rendering an empty left menu with no indication of what went wrong. Failures now surface an error box with the message and endpoint, and are logged to the console.
- **Onboarding Wizard Blocked the Whole UI**: The wizard overlay was appended to `<body>` with the `.wf-modal-overlay` class (`display: flex`, blurred backdrop) but was never hidden unless `open()` was called. When onboarding had already been completed, the app rendered permanently blurred and unclickable with an invisible modal. The container is now hidden at construction.
- **Onboarding Wizard Clobbered `config.toml`**: `finishOnboarding()` unconditionally overwrote `project.context`, destroying any hand-written project description on re-run. It now only sets the scenario default when the field is empty.
- **View Mode Buttons Had No Active State**: The `Split` button's highlight was hardcoded in `Header`, so clicking `Editor` or `Graph` changed the layout without updating any button. Active state and `aria-selected` are now derived from `appStore.viewMode`.
- **Note Selection Was a No-Op in Graph-Only View**: Selecting a note from the sidebar while the editor was hidden appeared to do nothing; it now falls back to `Split`.

## [3.3.0] - 2026-10-05

### Added
- **Enterprise Semantic Knowledge Graph & Stateful GraphRAG System (Phase 50)**:
  - **W3C SHACL Validation Schema (`src/wikiforge/config/shapes.ttl`)**: Created W3C SHACL shape constraints (`wfs:PermanentNoteShape`, `wfs:AgentShape`) for note identifiers, titles, ISO dates, markdown body, author agent IRI attributions, and typed relationship targets (`wf:supports`, `wf:contradicts`, `wf:refersTo`).
  - **Zettelkasten-to-RDF Converter (`src/wikiforge/semantics/markdown_to_rdf.py`)**: Built `ZettelToRDFConverter` parsing frontmatter YAML, persistent W3ID URI minting (`wfid:`), typed wikilinks (`[[predicate::target]]`), and Turtle RDF graph generation (`.ttl`).
  - **Neo4j Cypher Property Graph Exporter (`src/wikiforge/semantics/markdown_to_cypher.py`)**: Built `ZettelToCypherConverter` generating idempotent Neo4j Cypher scripts with label constraints, property setters, and typed relationships.
  - **Stateful GraphRAG Pipeline (`src/wikiforge/semantics/graph_rag_pipeline.py`)**: Implemented stateful `WikiForgeGraphRAG` engine powered by LangGraph / LangChain with nodes for Entity Extraction, Text-to-Cypher generation, Neo4j/Mock Cypher Execution, conditional error self-correction routing, and grounded synthesis with PROV-O provenance.
  - **Automated CI/CD Workflow (`.github/workflows/shacl_validation.yml`)**: Added GitHub Actions pipeline converting Markdown Zettelkasten notes to Turtle RDF, running PySHACL constraint validation, generating Cypher scripts, and uploading graph artifacts.
  - **Comprehensive Test Suite & Documentation**: Added unit tests in `tests/test_shacl.py`, `tests/test_converters.py`, and `tests/test_graph_rag.py`; created developer & operator manual in `docs/GRAPH_RAG.md`.

## [3.2.0] - 2026-10-02

### Added
- **Typed Schema System & Linting Engine (Ticket 1 / Phase 49)**:
  - **Shared KE Library (`scripts/ke_common.py`)**: Centralized multi-project resolution, TOML loading (`load_config`), page iterator (`iter_pages`), wikilink resolver (`resolve_wikilink` supporting `prefLabel` and `altLabel`), schema loader (`load_schema`), and `emit` output helper.
  - **Schema Linter (`scripts/schema_lint.py`)**: Validates wiki pages against `[schema]` definitions in `config.toml`, checking missing required fields (`SCH-001`), unknown relations for types (`SCH-002`), unresolved target wikilinks (`SCH-003`), relation domain/range mismatches (`SCH-004`), cycles in acyclic relations (`SCH-005`), and unknown page types in strict mode (`SCH-006`).
  - **Schema Inferrer (`scripts/schema_infer.py`)**: Scans existing wiki pages and auto-proposes a candidate `[schema]` TOML block to `stdout` or JSON envelope without modifying `config.toml`.
  - **Config Manager GUI Enhancement (`src/components/ConfigManager.ts`)**: Added a read-only "Schema (Read-Only)" tab displaying schema status, strict mode, and defined type schemas.
  - **Scenario Presets (`config/scenarios.toml`)**: Added sensible `[schema]` preset blocks for academic, thesis, business, research, and creative scenarios.
  - **Documentation & Skills**: Created `docs/SCHEMA.md`, updated `docs/AGENT.md`, `skills/wiki-ke-ontology/SKILL.md`, `Makefile` (`make schema-lint`, `make schema-infer`), `README.md`, `docs/TUTORIAL.md`, and `ROADMAP.md`.
  - **Test Suite**: Added test fixtures under `tests/fixtures/ke_wiki/` seeded with violations SCH-001 through SCH-006, and unit tests in `tests/test_schema_lint.py` and `tests/test_schema_infer.py`.

## [3.1.0] - 2026-09-29

### Added
- **Full Knowledge Engineering Suite (Phases 37, 44–48)**:
  - **Semantic Export (RDF / JSON-LD / Turtle)**: Built `scripts/export_semantic.py` exporting OKF v0.2 knowledge bases to standard W3C semantic graph formats (`output/wiki_export.jsonld`, `output/wiki_export.ttl`) for GraphDB / Protégé interoperability. Added `/export-semantic` skill command and `make export-semantic` target.
  - **Lightweight Ontology Rule Engine**: Built `scripts/ontology_rules.py` validating logical ontology constraints: Rule 1 (unlinked `Concept` notes), Rule 2 (direct circular dependencies A -> B -> A), and Rule 3 (human-verification actor requirement for `stable` status notes). Added `/ontology-check` skill command and `make ontology-check` target.
  - **Model Context Protocol (MCP) Server**: Native MCP server (`src/server/mcp_server.py`) exposing `search_wiki`, `get_concept_metadata`, and `get_line_anchored_citation` tools to external AI agent ecosystems via `make mcp-serve`.
  - **Knowledge Engineer Operating Manual**: Created `docs/KNOWLEDGE_ENGINEERING.md` detailing domain modeling, OKF v0.2 quality verification, semantic interoperability, and lifecycle concept drift management.
  - **Web UI & Control Panel Integration**: Registered `export_semantic` and `ontology_rules` tools in `SCRIPT_REGISTRY` and `buildCliArgs` in `src/server/agentServer.ts` for execution via Web UI tools modal.

## [2.9.0] - 2026-09-16

### Added
- **Complete Documentation Overhaul & 5-Phase Operator Workflow**:
  - Eliminated outdated/redundant proposal files (`docs/versioning_proposal.md`, `docs/wikimap.md`) to streamline the `docs/` folder.
  - Renamed and updated `docs/TECHNICAL_ARCHITECTURE.md` as the single technical reference for developers, covering system component topology, multi-provider LLM client, REST/SSE agent server, script execution engine, OKF v0.2, versioning & snapshot rollback engine (`scripts/versioning.py`), and multi-project management.
  - Redesigned `docs/TUTORIAL.md` (Guida Operativa dell'Utente) in clear plain language for non-technical users and content creators, detailing the 5-phase chronological workflow for building a dynamic knowledge base.
  - Updated `docs/THESIS_GUIDE.md` as a step-by-step concrete operator guide for Master's Thesis (Tesi Magistrale) creation with dual output (dynamic searchable wiki + printable PDF via Pandoc).
  - Restructured `README.md` with a clear audience-based document index and 5-phase operator pipeline summary.
  - Synchronized `ROADMAP.md` tracking all completed phases up to v2.9.0.

## [2.8.0] - 2026-09-14

### Added
- **Web UI Python Script Control Panel** (Phases 38–40):
  - Unified Script Control Panel accessible directly from the Web UI navigation header via the "🛠️ Tools" button.
  - Exposes all 15 Python CLI scripts (`conv2md.py`, `clip2md.py`, `notebooklm_import.py`, `migrate_to_okf.py`, `okf_lint.py`, `okf_log.py`, `okf_reindex.py`, `okf_stats.py`, `wiki_stats.py`, `maturity_calculator.py`, `check_docs_sync.py`, `suggest_tags.py`, `generate_thesis.py`, `export_thesis_pdf.py`, `wizard.py`) through categorized graphical menus (Ingestion, OKF Maintenance, Analysis & Metrics, Taxonomy, Thesis & Study, Wizard).
  - Dynamic parameter form component (`ToolsModal.ts`) generating typed input fields (text, number, select/dropdown, checkbox) for each tool.
  - Real-time terminal-like log console (`LogConsole.ts`) streaming Python stdout and stderr using Server-Sent Events (SSE) with process cancellation support and log export.
  - Secure child process execution engine in `src/server/agentServer.ts` (`GET /api/scripts/list`, `POST /api/scripts/execute`, `GET /api/files/download`) using `child_process.spawn('python3', ...)` with strict parameter validation and path containment against command injection.
  - Integration test suite in `tests/scriptControlPanel.test.ts` verifying endpoints, argument building, SSE streaming, and security safeguards.

## [2.7.0] - 2026-09-02

### Added
- Open Knowledge Format (OKF v0.2) Integration & Tooling Suite (Phase 35):
  - Downloaded/saved offline OKF v0.2 Specification in `docs/OKF_SPEC.md`.
  - Added `[okf]` and `[okf.migration]` sections in `config.toml` defining controlled vocabulary (`type`) and folder-to-type migration mapping.
  - One-shot migration script `scripts/migrate_to_okf.py` for transforming existing `wiki/` Markdown articles into valid OKF v0.2 frontmatter with `type`, `title`, `description`, `status`, `generated`, `verified`, and standardized `sources`.
  - Built `scripts/okf_lint.py` validator enforcing required frontmatter fields, ISO 8601 timestamps, actor conventions (<producer>/<version>, human:<id>, process:<id>), and reserved file conventions (`index.md` §8 OKF and `log.md` §9 OKF).
  - Built `scripts/okf_reindex.py` for OKF §8 compliant `index.md` generation (with bundle-root `okf_version: "0.2"`).
  - Built `scripts/okf_log.py` for OKF §9 compliant chronological change logging into `wiki/log.md`.
  - Built `scripts/okf_stats.py` for computing OKF bundle analytics (type distribution, trust tiers: unverified / machine-confirmed / human-reviewed, status, stale items).
  - Added Makefile convenience targets (`okf-validate`, `okf-lint`, `okf-reindex`, `okf-log`, `okf-stats`).
  - Added GitHub Actions workflow `.github/workflows/okf-validate.yml` for automated CI validation.
  - Updated `AGENT.md` and `skills/` skill packages (`wiki-curate`, `wiki-audit`, `wiki-ingest`) with OKF frontmatter schema, credibility signals, and OKF compliance checklist.

## [2.6.0] - 2026-08-28

### Added
- Modular Agent Skills Refactor (Phases 30–34):
  - Created `skills/` directory containing self-contained skill packages with YAML frontmatter metadata (`wiki-ingest`, `wiki-curate`, `wiki-audit`, `wiki-query`, `wiki-study`, `wiki-onboarding`).
  - Converted `AGENT.md` into a lightweight progressive disclosure router referencing `skills/`, reducing token footprint by 75–85% per session.
  - `.claude/skills/` integration and `make skills-link` target in `Makefile` for Claude Code compatibility.
  - Automated doc & skill consistency check script `scripts/check_docs_sync.py` integrated into pre-commit hooks, GitHub Actions CI, and `make docs-sync`.

## [2.5.0] - 2026-08-28

### Added
- NotebookLM-Inspired Study & Knowledge Synthesis Suite (Phase 29):
  - Passage-level grounding with `#L<start>-L<end>` line-anchor citations in frontmatter and wikilinks.
  - `/study-guide`: generates structured study guides with executive summaries, section breakdowns, glossaries, and self-assessment QA in `output/study-guide-*.md`.
  - `/quiz`: generates interactive multi-choice quizzes with answer keys and explanations in `output/quiz-*.md`.
  - `/mindmap`: generates hierarchical Markdown concept trees and JSON node-link mindmaps in `output/mindmap-*.md`.
  - `/audio-overview`: generates Host A / Host B conversational dialogue scripts in `output/audio-script-*.md` with optional TTS integration.
  - `/note` and `/promote-note`: scratchpad logging in `notes/` and promoting notes to full wiki articles.
  - `/deep-research`: multi-source synthesis reports with claim attribution matrix and knowledge gap analysis in `output/research-*.md`.

## [2.4.0] - 2026-08-28

### Added
- Editor action buttons (`src/components/editor/MarkdownEditor.ts`): **💾 Save & Close** and **✖ Cancel** in the editor header while editing, replacing the lossy Edit/Preview toggle. Save & Close persists changes and returns to preview; Cancel discards unsaved edits. `Ctrl/Cmd+S` quick-save unchanged. A **💾 Save** button is now always visible in the header (in preview it re-persists the note), and the "Saved to disk! 💾" confirmation is rendered after the vault refresh instead of being wiped by it.
- **Fix: line wrapping in the CodeMirror editor** (`EditorView.lineWrapping`): long single-line notes (e.g. links) used to stretch the editor to thousands of pixels, pushing the header action buttons off-screen in Edit mode. The editor now wraps lines and the header is hardened (`flex-wrap: wrap`, `min-width: 0`) so actions always stay visible.
- Wizard management in the Web UI (`src/components/chat/ChatDrawer.ts`): `/wizard` shortcut button, a wizard scenario selector (Academic/Thesis, Business KB, Competitive Research, Fiction/Worldbuilding, Existing Wiki) that launches `/wizard <scenario>` directly in chat, and updated welcome message listing `/wizard`.
- Real `/wizard` command support (`src/server/agentServer.ts`): `/wizard` lists the available scenarios; `/wizard <scenario>` runs the scenario workflow through the LLM in both streaming and non-streaming paths, with a structured fallback when a provider is unavailable.
- Expanded `tests/workflows.test.ts` covering the `/wizard` scenario list and scenario execution (44 total passing tests).

## [2.3.0] - 2026-08-28

### Added
- CodeMirror 6 Markdown Editor integration (`src/components/editor/MarkdownEditor.ts`): replaced raw `<textarea>` in edit mode with CodeMirror 6, featuring Markdown syntax highlighting, `[[wikilink]]` autocompletion menu, and keyboard shortcuts (`Ctrl/Cmd+S`, `Ctrl/Cmd+B`, `Ctrl/Cmd+I`).
- Real-Time LLM Response Streaming: Server-Sent Events (SSE) streaming on `/api/chat` and `ApiStorage.sendChatStream()`, with streaming handlers in `LlmClient` for Anthropic, OpenAI-compatible APIs, and Ollama. Responses stream chunk-by-chunk in `ChatDrawer` without UI flickering.
- Chat History Persistence: `ChatDrawer` preserves chat sessions across page reloads using `localStorage` (`wiki-forge:chat-history`), with a "Clear history" button in the drawer header.
- CSS Theme Architecture: extracted inline styles into `src/styles/theme.css` with CSS custom properties (`--bg-primary`, `--border-color`, `--accent-blue`, `--accent-button`) and modular component stylesheets (`sidebar.css`, `chat-drawer.css`, `editor.css`).
- Added unit & integration test suites in `tests/editorAutocomplete.test.ts` and `tests/streaming.test.ts` (42 total passing tests).

## [2.2.0] - 2026-08-28

### Added
- Real Multi-Provider LLM Integration (`src/server/llmClient.ts`): supports OpenCode CLI (`opencode`), Anthropic API (`claude-3-5-sonnet`), OpenAI-compatible REST endpoints (`gpt-4o`), and local Ollama (`llama3`).
- Configurable `[agent.llm]` section in `config.toml` supporting provider selection, model selection, timeouts, and environment-based API key references.
- System prompt integration reading `AGENT.md` guidelines and project context dynamically for chat completions and workflows.
- Real Workflow Command Engine (`/compile`, `/audit`, `/reindex`, `/consult`, `/trace`) in `AgentServer` performing real disk ingestion, raw source renaming (`_COMPILED.md`), broken link/orphan audit, and automatic index writing.
- Security Hardening: Path traversal containment on `POST /api/wiki/save` and `POST /api/wiki/attach` returning HTTP 400 Bad Request on invalid paths; HTML sanitization in `src/core/utils/html.ts` and `src/core/utils/markdown.ts` neutralizing XSS payloads; message size limits (50,000 characters).
- Comprehensive test suites in `tests/llmClient.test.ts`, `tests/workflows.test.ts`, and `tests/security.test.ts` (26 total unit/integration tests).

### Changed
- Updated `ROADMAP.md` tracking Phases 23, 24, and 25 as ✅ Done.
- Updated `TUTORIAL.md` and `README.md` with multi-provider LLM configuration guides and security architecture details.

## [2.1.0] - 2026-08-28

### Added
- Phase 22 implementation: Interactive OpenCode Chat & Persistence Layer.
- Decoupled Backend Agent Server (`src/server/agentServer.ts`) providing REST endpoints (`/api/wiki/notes`, `/api/wiki/save`, `/api/wiki/attach`, `/api/chat`).
- Vite Dev Server plugin (`agentApiPlugin`) in `vite.config.ts` handling `/api` requests seamlessly during development and preview.
- `ApiStorage` class in `src/storage/ApiStorage.ts` implementing `IStorage` interface with live server API communication and static `FileStorage` fallback.
- `ChatDrawer` component in `src/components/chat/ChatDrawer.ts` with OpenCode agent workflow shortcuts (`/consult`, `/compile`, `/audit`, `/trace`, `/reindex`).
- `AttachModal` component in `src/components/chat/AttachModal.ts` enabling one-click response attachment to wiki notes.
- Direct editor file saving with visual confirmation ("Saved to disk! 💾") and automatic real-time re-indexing of graph nodes and backlinks.
- Integration test suite in `tests/agentServer.test.ts` verifying all REST API endpoints and storage adapters.

### Changed
- Updated `ROADMAP.md` marking Phase 22 as ✅ Done.
- Updated `README.md` and `TUTORIAL.md` with complete documentation for OpenCode Chat, API endpoints, and direct file saving.

## [2.0.0] - 2026-08-27

### Added
- Complete Command Reference system in `AGENT.md` (v2.0) with 15+ atomic commands (`ingest`, `new-article`, `merge`, `split`, `stub`, `audit`, `reindex`, `stats`, `export`, `trace`, etc.).
- `TUTORIAL.md` additions: §11 Command Cheat Sheet, §12 Troubleshooting, and §13 Long-Term Care.
- Standard article template `templates/article.md`.
- `CHANGELOG.md` for release and version tracking.
- `wiki_stats.py` script for metrics calculation and `METRICS.md` generation.
- `clip2md.py` script for web page clipping into Markdown.
- GitHub Actions workflow (`.github/workflows/test.yml`) for `conv2md.py` testing.
- Pre-commit hook configuration (`.pre-commit-config.yaml`).

### Changed
- Expanded `config.toml` with `[agent]`, `[naming]`, `[export]`, and `[webclip]` settings.
- Enhanced `Makefile` with targets (`audit`, `stats`, `reindex`, `clean-output`, `export-json`, `lint`, `help`).
- Updated `.gitignore` to cover build artifacts, output logs, and environment files.
- Updated `ROADMAP.md` tracking phases 0–20.

## [1.0.0] - 2026-04-29

### Added
- Initial release of `wiki-forge` template.
- Decoupled converter script (`conv2md.py` & `run_convert.sh`).
- Basic `AGENT.md` operating manual (macro-workflows: compile, consult, audit).
- Config-driven setup via `config.toml`.
- Docker support (`Dockerfile`, `docker-compose.yml`).
