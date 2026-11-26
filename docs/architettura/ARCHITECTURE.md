# Architettura — Wiki-Forge v4.1

Questo è il documento tecnico canonico: parte dalla topologia, scende nei
componenti e chiude con i vincoli di sviluppo. Per il percorso didattico
 dall'utente allo sviluppatore vedi [`docs/README.md`](../README.md); per i
 miglioramenti aperti vedi [`ROADMAP.md`](../../ROADMAP.md).

## 1. Modello mentale: memoria parametrica e non parametrica

Wiki-Forge non addestra un modello: mantiene una **memoria non parametrica**
di note Markdown interconnesse (`wiki/`) e usa un LLM come **Knowledge
Engineer** che estrae, sintetizza e collega. La memoria parametrica (pesi del
modello) può cambiare stile e associazioni, ma non garantisce provenienza di
ogni affermazione; per questo le risposte importanti sono ancorate a note e
sorgenti citate.

Confronto sintetico con l'addestramento da zero (es. *nanochat*):

| Aspetto | Wiki-Forge (RAG + KB) | Addestramento da zero |
|---|---|---|
| Scopo | Knowledge Engineering e KB di produzione | Ricerca sull'architettura dei transformer |
| Dove sta la conoscenza | File Markdown esterni e indicizzabili | Pesi del modello |
| Precisione fattuale | Alta, con citazioni e anchor di riga | Bassa sui dettagli, soggetta ad allucinazioni |
| Aggiornamento | Aggiungi una nota ed esegui la compilazione | Richiede riaddestramento/SFT |
| Costo computazionale | Basso, anche su hardware consumer | Alto, richiede cluster multi-GPU |

## 2. Topologia e confini di runtime

```text
UI TypeScript/Vite ──HTTP/SSE──> Node API Gateway (:3001, kernel/modules/ports)
                                   ├─ API Contract Layer + OpenAPI /api/docs
                                   ├─ MessageBus + 20 moduli di dominio
                                   ├─ SafeFs, changeset store, snapshot store
                                   └─ proxy /api/v1/graph/* ──> Python FastAPI (:8000)
                                         ├─ health, procedure, SHACL/RDF
                                         └─ script Python e knowledge engineering
```

- **Sviluppo**: `docker-compose.yml` avvia `ui`, `api`, `kg-api`, `worker` e
  MCP; in locale `npm run dev:all` avvia gateway e UI insieme. `npm run dev`
  avvia solo Vite: il gateway deve restare in ascolto su `:3001`.
- **Produzione**: `Dockerfile.render` + `bin/render-start.sh` avviano un solo
  processo Node non-root che serve la SPA buildata da `dist/` e le API su
  `$PORT`, con health su `/api/healthz`, stato in
  `WIKIFORGE_STATE_DIR=/app/.wiki-forge/state`, nessuna variabile `VITE_*` a
  runtime e nessun default `admin/admin`. Compose mantiene `ui` solo per lo
  sviluppo (`WIKIFORGE_EMBED_SCHEDULER=false` quando gira il worker).

## 3. Componenti del backend

### 3.1 Contratto API, bus e moduli

`ROUTES` in `src/shared/api/contracts.ts` è l'unica sorgente di verità per
metodo, percorso, schemi, `operationId`, comando bus e ambito progetto. Da esso
derivano OpenAPI 3.1, il client tipizzato e il manifest generato
(`src/shared/api/generated/commandManifest.generated.ts`), consumato da CLI,
MCP e Swagger. Stato verificato: **105 route HTTP**, **158 handler bus** in
20 moduli, **51 comandi slash catalogati / 20 con case dedicato**, **113 tool
MCP**, **32 gap noti non bloccanti**, zero gap `route-without-bus`.
`npm run manifest:check` applica quest'ultima invariante. Dettagli in
[`OPENAPI.md`](OPENAPI.md) e nel manifest generato.

`AgentServer.handleRequest()` risolve la route e Dispatcha sul `MessageBus`;
gli handler ricevono un `CommandContext` con `principal` sempre impostato e
restituiscono risultati `json`, `binary` o `sse`, senza toccare
`IncomingMessage`/`ServerResponse`. Il gateway è l'unico adapter HTTP, quindi
gli stessi comandi sono richiamabili da scheduler e test senza duplicare la
logica. Il bus emette audit `command:handled` / `command:failed` con correlation
id; il relay dell'outbox riporta le decisioni F6 nel flusso di approvazione.

### 3.2 Stato, sicurezza e scritture

- `src/backend/server/state/` fornisce `StateStore` (file, memoria o adapter
  HTTP) per sessioni, stato procedure, cursori e lease dello scheduler. Il
  scheduler usa un lock a lease, non più il vecchio lock PID.
- `safeFs.ts` scrive in modo atomico (file temporaneo + rename), sposta i file
  nel cestino `<progetto>/.wiki-forge/trash/` con manifest JSONL e offre
  ripristino. `changesetStore.ts` mette in stage le proposte LLM in
  `.wiki-forge/changesets/` finché un umano non le approva.
- I percorsi REST sono confinati a `wiki/` o `raw/`; l'HTML generato viene
  sanitizzato. Subprocessi usano un allowlist di variabili d'ambiente, timeout
  e output limitato.
- In produzione RBAC e auth sono forzati; il token è richiesto salvo IdP o user
  store configurati. CORS allowlist, body limit, correlation id,
  `/api/healthz`, `/api/readyz` e `/api/metrics` completano l'indurimento.

### 3.3 Servizi Python

Il servizio FastAPI autonomo espone `/api/v1/health` (risposta semplice `ok`)
e `/api/v1/graph/sync|validate|rag`; il gateway ne fa il proxy solo per le
route grafo. Il motore di salute aggregato (`api/health.py`) calcola uno score
0-100, il livello L1-L4 e le azioni successive scrivendo
`.wikiforge/STATUS.md` e `.wikiforge/metrics/history.jsonl`: questa è una
radice legacy separata da `.wiki-forge/` e la cosa è tracciata in ROADMAP.
Il Procedure Engine (`procedures.py`) esegue procedure TOML con DAG, pause
umane e criteri di uscita, persistendo in `.wikiforge/state/<run_id>.json`.
Il lock a lease appartiene allo scheduler Node, non al Procedure Engine.

### 3.4 Studio di revisione, ricerca e studio

| Console | Schede | Natura |
|---|---|---|
| **Review Studio** | Verifica, Critica, Digest, Confronta versioni | Quality gate, verifica umana e diff deterministici; critica con fallback deterministico. Sette endpoint `/api/notes/review/*`. |
| **Research Studio** | Consult, Ricerca, Backlink, Correlate, Traccia, Deep Research | Ricerca/backlink/correlate/trace deterministici; consult e deep research con LLM e fallback. Sette azioni API, incl. `research.promoteAnswer`. |
| **Study Studio** | Guida, Quiz, Mindmap, Audio, Note, Promuovi, Tesi | Sette builder deterministici in `studyHelpers.ts`; gli artefatti finiscono in `output/`, le note rapide in `notes/quick-notes.md`. |

Gli snapshot pre-scrittura vivono in `.wiki-forge/snapshots/<nota>/<timestamp>.md`
con sidecar JSON, 25 per nota, e sono condivisi tra Review Studio e
`VersionTimeline`. La cronologia git di `scripts/versioning.py` è un meccanismo
separato. Research e Studio sono azioni **globali**: non sono più duplicate
nell'header dell'editor, che mantiene solo Info, Revisione e Cronologia.

## 4. Componenti del frontend

L'editor è un guscio stabile (`MarkdownEditor.ts`) con adapter intercambiabile:
`CodeMirrorAdapter` (sorgente/fallback) e `milkdown/MilkdownAdapter` (Crepe
WYSIWYG, vanilla TS, nessun React). Il frontmatter OKF viene preservato
byte-per-byte e i wikilink sopravvivono alla serializzazione. Dettagli in
[`EDITOR_MIGRATION.md`](EDITOR_MIGRATION.md).

Fondamentali trasversali, tutti in `src/frontend/core/`: catalogo azioni
unico (`actions.ts`), registro scorciatoie (`shortcuts.ts`, un solo listener
globalmente; `Ctrl+Alt+D` = Digest, `Ctrl+Alt+W` = Wiki Docs), event bus
tipizzato (`events.ts`), `apiBus` come unico ingresso API (`apiBus.ts`),
dizionario IT/EN (`i18n/strings.ts`), resizer condiviso (`ui/resizer.ts`),
toast e dialog accessibili (`notificationService.ts`) e `appStore` come
sorgente del progetto attivo. `ApiStorage` è una facciata su `apiBus` senza
fallback `FileStorage`.

Il ciclo di vita dei progetti è servito da `projectService.ts`: creazione,
clone, rename, archiviazione, import/export JSON e cancellazione con cestino
predefinito. La UI corrispondente è `ProjectManagerModal.ts`; `ConfigManager`
non duplica più la gestione progetti.

## 5. Knowledge Engineering, semantica e automazione

- **KE Workbench**: otto use case guidati (schema, ontologia, competency
  questions, neuro-symbolico/ODP, export semantico, maturità, docs-wiki drift,
  program change). Maturità L1-L4: seeded → structured → connected → trusted;
  il gate L4 richiede zero CQ gap e note `stable` verificate umanamente.
- **OKF v0.2**: frontmatter con `type`, `status`, provenance e trust tier;
  strumenti `okf_lint.py`, `okf_reindex.py`, `okf_log.py`, `okf_stats.py`.
  Lo standard upstream è stato spostato: vedi la nota di versione in
  [`OKF_SPEC.md`](../standard/OKF_SPEC.md).
- **Grafo**: SHACL, RDF/Turtle, Cypher Neo4j e pipeline GraphRAG stateful;
  la sincronizzazione inversa DB → vault produce changeset, non scritture
  dirette. Dettagli in [`GRAPH_RAG.md`](GRAPH_RAG.md).
- **Automazione**: la classificazione di sicurezza dei 29 script è solo in
  `SCRIPT_SCHEMAS` Python → registry TS generato → catalogo generato; i job
  mutanti richiedono approvazione F6 e `auto_apply = false`. Il Policy Agent è
  consultivo e fail-closed. Vedi
  [`SCRIPT_AUTOMATION_REFERENCE.md`](../riferimenti/SCRIPT_AUTOMATION_REFERENCE.md).

## 6. Documentazione come wiki

`docs/` è la sorgente canonica; `scripts/docs_to_wiki.py` proietta i documenti
in `projects/wikiforge/wiki/` come bundle OKF con provenienza, lingua del
sorgente e indici deterministici. Le note in `sintesi/` sono scritte a mano e
non vengono mai sovrascritte. La promozione di una risposta e le modifiche al
programma richiedono entrambe un revisore umano. Regole e comandi in
[`SELF_WIKI.md`](../standard/SELF_WIKI.md).

## 7. Regole di sviluppo (KISS/DRY)

1. Conversione formato (`conv2md.py`) ed arricchimento LLM (`enrich_cot.py`)
   restano separati.
2. Niente `except Exception:` generici: usare la gerarchia `WikiForgeError`.
3. I form UI non hardcodedano parametri: leggono il registry generato da
   `SCRIPT_SCHEMAS`; dopo una modifica eseguire
   `python3 scripts/gen_script_registry.py --check`.
4. Ogni nuovo esportatore di grafo estende `BaseGraphExporter` per riusare il
   parsing di frontmatter e wikilink.

## 8. Verifica operativa

```bash
npm run typecheck
npm run manifest:check
npm run build
python3 scripts/check_docs_sync.py
python3 scripts/docs_to_wiki.py --check
npm test
python3 -m pytest tests/python
git diff --check
```

I conteggi storici pre-disaccoppiamento (95 endpoint/90 comandi) non sono più
quelli correnti: la baseline verificata è nella sezione 3.1 e in
[`COMMAND_MANIFEST.md`](../riferimenti/COMMAND_MANIFEST.md).
