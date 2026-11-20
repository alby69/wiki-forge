# Piano di miglioramento Frontend: UI/UX, KISS/DRY e ciclo di vita dei progetti

> **Stato**: proposta (Fase 78 — da approvare).
> Questo documento è lo studio approfondito richiesto, non ancora un'implementazione.
> Ogni fase ha criteri di accettazione verificabili e può essere eseguita da sola.

---

## 1. Sintesi esecutiva

L'attuale frontend è funzionante ma è cresciuto per aggiunte successive, non per
progettazione. I tre problemi strutturali sono:

1. **Azioni duplicate**: Research e Studio compaiono sia nella barra globale sia
   nell'header della nota, con etichette e colori diversi ma lo stesso handler.
   Lo stesso catalogo di azioni è riscritto in **quattro** punti (header globale,
   header nota, menu contestuale, schede degli studio).
2. **Styling non sistemico**: circa **746 attributi `style=` inline** contro ~510
   classi, **962 colori esadecimali nei TS** (45 duplicati anche nel CSS) e le
   variabili di `theme.css` praticamente inutilizzate. Esistono interi file CSS
   morti (`chat-drawer.css`, quasi tutto `sidebar.css`).
3. **Accoppiamento forte**: `WikiForgeApp` istanzia 21 componenti con callback
   posizionali, `refreshAll()`/`selectNote()` fanno fan-out manuale, ci sono
   4 implementazioni duplicate di resizer, 3 listener `keydown` globali con una
   collisione reale (`Ctrl+Alt+D`) e due fonti di verità per il progetto attivo.

Sul versante progetti esistono solo **list / create / config GET+PUT / delete**;
mancano rename, clone/copia, archive/restore, export/import e una UI dedicata
(oggi si usano `prompt()`/`confirm()` dentro `ConfigManager`). La cancellazione
con `deleteFolder=true` usa `fs.rm` diretto, aggirando il layer `safeFs` già
presente con trash e restore.

**Obiettivo**: una UI coerente e professionale, con un design system minimale,
un registro unico delle azioni, componenti disaccoppiati e un ciclo di vita dei
progetti completo e sicuro. Tutto senza introdurre framework UI: vanilla
TypeScript + Vite, come da architettura attuale.

---

## 2. Audit dettagliato (stato attuale)

### 2.1 I pulsanti duplicati

| Azione | Barra globale | Header della nota | Handlers |
|---|---|---|---|
| Research | `Header.ts:165` — `🔎 Research` | `MarkdownEditor.ts:180` — `🔎 Ricerca` | Entrambi → `WikiForgeApp.openResearchStudio()` (`index.ts:318`, `:428`) |
| Studio | `Header.ts:167` — `📚 Studio` | `MarkdownEditor.ts:181` — `📚 Studio` | Entrambi → `openStudyStudio()` (`index.ts:324`, `:429`) |
| Review | assente | `MarkdownEditor.ts:179` — `🧐 Revisione` | `openReviewStudio()` |
| Cronologia | assente | `MarkdownEditor.ts:182` — `🕐 Cronologia` | `openVersionTimeline()` |
| Node Info | assente | `MarkdownEditor.ts:178` — `📊 Node Info` | `index.ts:560-564` |
| Save / Edit | assente | `MarkdownEditor.ts:185-188` | `saveCurrentContent()` / toggle mode |

Research e Studio sono duplicati **identici nella sostanza**: stessa icona,
stessa triple di colori (`rgba(56,189,248,.14)` / `#7dd3fc` / ... e
`rgba(245,158,11,.14)` / `#fcd34d` / ...), ma label IT/EN diverse, title diversi,
padding e raggio diversi. In più `ReviewContextMenu.ts:13-30` e le tabelle `TABS`
dei tre studio (`ReviewStudio.ts:20-25`, `ResearchStudio.ts:23-30`,
`StudyStudio.ts:24-32`) dichiarano autonomamente label, icone e scorciatoie:
**una rinomina richiede 4 modifiche**.

### 2.2 Styling

- CSS globale importato in `index.ts:1-10`: `theme.css`, `sidebar.css`,
  `chat-drawer.css`, `editor.css`, e i tre CSS degli studio. Nessun CSS modulare,
  nessuno scope, nessun sistema di utility.
- `theme.css:6-17` definisce già token (`--bg-primary`, `--bg-tertiary`,
  `--border-color`, `--text-primary`, ...): **0 usi di `var(--...)` nei TS**.
- Peggiori offender per inline style: `KEWorkbenchModal.ts` (108),
  `ConfigManager.ts` (68), `OnboardingWizard.ts` (53), `ToolsModal.ts` (47),
  `MarkdownEditor.ts` (39), `HelpPanel.ts` (39), `ContextPanel.ts` (33).
- `SimpleModeDashboard.ts:48-90` usa perfino `onmouseover="this.style..."` inline;
  `MainLayout.ts:78-85,162-171` e `KEWorkbenchModal.ts:209-228` cambiano i colori
  da JavaScript invece di usare `:hover`.
- CSS morto: `chat-drawer.css` (tutti i selettori), `sidebar.css` (5/6),
  `.editor-save-btn`, `.skeleton-loader`, `.wf-rs-kbd`.
- `research-studio.css:6-54` e `study-studio.css:6-52` sono lo **stesso blocco di
  override** di `.wf-rs-*`, solo con prefissi diversi.

### 2.3 Struttura e accoppiamento

- `MainLayout.ts:35-63` costruisce l'intero skeleton con stili inline; 4 resizer
  separati (`MainLayout.ts:98-172`, `Sidebar.ts:595-611`,
  `ChatDrawer.ts:287-312`, `KEWorkbenchModal.ts:188-241`) ripetono lo stesso
  pattern mousedown/mousemove/mouseup.
- Sola larghezza sidebar e larghezza chat vengono persistite; larghezza editor,
  ratio grafo e altezza context no.
- `index.ts:242-290`: tre `document.addEventListener('keydown')`. `Ctrl+Alt+D`
  è registrato due volte: `ReviewStudio.digest` (`index.ts:248`) e
  `openDocsWiki()` (`index.ts:267-271`) — alla pressione si aprono entrambi.
- `Header.ts:64-66` e `ChatDrawer.ts:63-65` si ri-renderizzano a **ogni**
  cambio dello store: il campo di input della chat e il dashboard Focus Mode
  vengono ricreati (perdita di stato durante la digitazione).
- `appStore.activeProjectId` (`appStore.ts:15,38-47,107-113`) e
  `ApiStorage.getActiveProjectId()` (`ApiStorage.ts:58-63`) usano la **stessa**
  chiave localStorage ma sono due source of truth; i setter dello store non
  vengono mai chiamati. `Header.setActiveNote()` (`Header.ts:89-92`) è dead code.
- `CommandPalette.ts` è completo ma mai istanziato.
- `MainLayout.ts:59-60` mostra un footer statico e falso
  (`Status: Connected | Vault: /wiki | Engine: Active`).

### 2.4 Accessibilità e i18n

- `index.html:2` dichiara `lang="en"` mentre l'UI è prevalentemente italiana.
- 92 dei 148 `<button>` (62%) non hanno né `title` né `aria-label`.
- `role="tablist"` senza gestione da tastiera né `role="tabpanel"`/`aria-controls`.
- `aria-expanded` mai usato per collapse/context/chat/maximize.
- Nessun focus trap nei modali; nessun `aria-live` su salvataggio e streaming.
- Etichette miste: `Research` vs `Ricerca`, `Save/Edit/Cancel` accanto a
  `Revisione/Cronologia`, `Project:` accanto a tooltip italiani.
- `alert()`, `confirm()`, `prompt()` in `index.ts:357-377`, `Sidebar.ts:416-481`,
  `ConfigManager.ts:328-349`, `VersionTimeline.ts:155`,
  `ChangesetReviewModal.ts:200-221`.

### 2.5 Gestione progetti — stato attuale

**Registry**: `config/projects.json` → array `{ id, name, path }`
(`default → "."`, `tesi → projects/tesi`, `wikiforge → projects/wikiforge`).
Il backend risolve i path in `agentServer.ts:1063-1073,1225-1259` con controllo
di containment; i file di configurazione stanno in `projects/<id>/config.toml`
(non in `<project>/config/config.toml`, come invece scrive
`docs/TECHNICAL_ARCHITECTURE.md:114`).

**API esistenti** (`agentServer.ts:2126-2209`):

| Metodo | Route | Note |
|---|---|---|
| GET | `/api/projects` | lista dal registry |
| POST | `/api/projects` | scaffold di 5 cartelle + config; nessun rollback |
| GET | `/api/projects/:id/config` | config.toml parsato |
| PUT | `/api/projects/:id/config` | **sostituisce** tutto il config; non aggiorna il nome nel registry |
| DELETE | `/api/projects/:id?deleteFolder=` | unregister + `fs.rm` diretto; non usa `safeFs` |

**Mancanti**: rename (id onome), clone/copia, archive/restore, export/import,
statistiche, active-project lato server, validazione schema in PUT, rollback
delle operazioni parziali, ripristino per delete "solo unregister".

**Riutilizzabili**: `safeFs.ts` ha già `atomicWriteFile()` (`:44-61`),
`softDelete()` con manifest JSONL (`:67-90`), `listTrash()` e
`restoreFromTrash()` (`:93-116`). `agentServer.ts:2858-2987` contiene handler di
scrittura **non scoped** duplicati che ommettono `projectId`: vanno rimossi prima
di aggiungere nuove API, per evitare scritture accidentali sulla root.

---

## 3. Principi guida

1. **Single source of truth**: azioni, progetto attivo, scorciatoie, token di
   stile e registry progetti hanno ciascuno un solo proprietario.
2. **KISS**: nessun framework UI, nessun router, nessuna libreria i18n. Primitive
   piccole e composabili; se una funzione non serve, si elimina (CommandPalette
   va collegata o rimossa).
3. **DRY**: un solo catalogo di azioni, un solo modal, un solo resizer helper,
   un solo project service (backend) e un solo project client (frontend).
4. **Disaccoppiamento**: i componenti ricevono dati + un oggetto di callback
   tipizzato e non conoscono altri componenti. La composizione resta in
   `WikiForgeApp`, che diventa un sottile controller.
5. **Progressività**: ogni fase lascia l'app funzionante e i test verdi.

---

## 4. Architettura target

```text
src/frontend/
  core/
    actions.ts            Catalogo unico: {id, label, icon, title, group,
                          shortcut, run(ctx)} — unica fonte per header,
                          header nota, menu contestuale, command palette
    shortcuts.ts          Registry scorciatoie + UNICO listener document
    events.ts             Tiny typed EventBus (project:changed, note:saved, ...)
    ui/
      button.ts           renderButton({variant, size, icon, label, ariaLabel})
      modal.ts            renderModal({title, body, footer}) + focus trap + Esc
      tabs.ts             renderTabs(items, active) + roving tabindex
      resizer.ts          bindResizer(el, {axis, min, max, onResize, persistKey})
  services/
    projectService.ts     Wrapper ApiStorage + eventi; unica source of truth
    notificationService.ts  Toast con aria-live, sostituisce alert/status sparsi
  components/
    ui/Header.ts          Solo azioni globali (vista, progetto, strumenti, aiuto, chat)
    editor/MarkdownEditor.ts  Solo azioni della nota (Note Info, Review, History, Save)
    projects/ProjectManagerModal.ts  Nuova UI completa del ciclo di vita
  styles/
    tokens.css            Tutte le variabili colore/spazio/raggio
    primitives.css        .wf-btn, .wf-modal, .wf-tabs, .wf-field, .wf-toast
    ...                   CSS di feature, senza stili inline nei TS
```

L'header della nota **non ripeterà** Research/Studio: quelle sono azioni globali.
Se serve contesto della nota, si apre lo studio con `{ noteId, tab }` tramite
il catalogo azioni (un solo `run(ctx)` che legge `ctx.noteId`).

```text
src/backend/server/
  projectService.ts       registry + validazione + path + scaffold + clone +
                          archive/restore + export/import + rollback, atomicWriteFile
  agentServer.ts          solo routing: ogni handler delega al projectService
```

---

## 5. Piano per fasi

### Fase 1 — Fondamenti visivi (S)

**Obiettivo**: design system minimale senza cambiare comportamenti.

- Creare `styles/tokens.css`: palette semantica (`--wf-bg`, `--wf-surface`,
  `--wf-border`, `--wf-text`, `--wf-accent`, `--wf-success`, `--wf-warning`,
  `--wf-danger`), scala spazi 4/8/12/16/24, raggi 4/6/8.
- Creare `styles/primitives.css`: `.wf-btn` con varianti `primary|secondary|ghost|
  danger` e taglie `sm|md`, `.wf-field`, `.wf-modal`, `.wf-tabs`, `.wf-toast`.
- Convertire i colori più frequenti (`#2d3748` ×102, `#94a3b8` ×63,
  `#334155` ×45, `#e2e8f0` ×43, `#3182ce` ×17) in token.
- Eliminare CSS morto: `chat-drawer.css`, 5/6 selettori di `sidebar.css`,
  `.editor-save-btn`, `.skeleton-loader`, `.wf-rs-kbd`.
- Unificare i due blocchi di override di research/study in un unico
  `.wf-modal--studio` con modificatori di colore.

**Accettazione**: `npm run build`, nessun cambio funzionale, conteggio `style=`
nei TS ridotto di almeno il 30%, zero hex duplicati tra TS e CSS.

### Fase 2 — Catalogo azioni e fine della duplicazione (M)

**Obiettivo**: rispondere direttamente al problema dei pulsanti ripetuti.

- `core/actions.ts` con registro unico. Ogni azione: `id`, `label`, `icon`,
  `title`, `group` (`global|note|studio`), `shortcut`, `context` flag, `run`.
- `Header.ts`, `MarkdownEditor.ts`, `ReviewContextMenu.ts` e `CommandPalette`
  renderizzano dallo stesso registro, filtrando per `group` e contesto.
- Header globale: compatto, con un menu "⋮ Altre azioni" per wizard/KE/
  changesets/wiki docs/tools/config; restano visibili solo vista, progetto,
  chat e aiuto.
- Header nota: rimuovere Research e Studio duplicati; tenere Node Info,
  Review, History e Save/Edit. Aggiungere un singolo pulsante "Apri studio"
  solo se il contesto nota è rilevante (usa la stessa azione globale).
- Unificare label e title in italiano coerente (`Ricerca`, `Studio`,
  `Revisione`, `Cronologia`) e mettere `aria-hidden` sulle emoji.

**Accettazione**: zero coppie azione/etichetta duplicate; cambiare label/icona
di `research` in un solo punto aggiorna header, menu e palette; test DOM che
verifica che `🔎 Ricerca` compaia una sola volta.

### Fase 3 — Disaccoppiamento e state (L)

**Obiettivo**: togliere il fan-out manuale e le doppie source of truth.

- Sostituire i callback posizionali di `MarkdownEditor` (9) e `ChatDrawer` (6)
  con un unico oggetto `callbacks: {...}` tipizzato.
- Introdurre `core/events.ts`; `WikiForgeApp` si iscrive a eventi invece di
  aggiornare 5 componenti in `refreshAll()`/`selectNote()`.
- `appStore` diventa l'unica fonte del progetto attivo; `ApiStorage` legge lo
  stato tramite un getter iniettato, non legge localStorage autonomamente.
- Rimuovere `Header.setActiveNote` (dead) oppure usarlo davvero per il badge;
  scegliere una sola implementazione del badge (quella in `TrustBadge.ts`).
- Evitare re-render globali: `Header` si aggiorna solo su cambio store
  rilevante; `ChatDrawer` non si ri-renderizza mentre si sta digitando.
- Estrarre `ui/resizer.ts` e usarlo nei 4 punti; persistere tutte le dimensioni.

**Accettazione**: nessun componente fa `querySelector` su un altro componente;
`grep -c "addEventListener('keydown'"` = 1; test che cambio progetto aggiorni
tutti i consumer senza chiamate esplicite a `refreshAll()`.

### Fase 4 — Scorciatoie, accessibilità, i18n (M)

- `core/shortcuts.ts`: un solo listener, risolve la collisione `Ctrl+Alt+D`,
  permette di elencare le scorciatoie nella guida.
- `index.html` → `lang="it"`; `aria-label`, `aria-expanded`, `role="tabpanel"`,
  roving tabindex, focus trap nei modali, `aria-live` su save/chat.
- Sostituire `alert`/`confirm`/`prompt` con `notificationService` e modali.
- `strings.ts` con dizionario italiano (struttura pronta per l'inglese) per
  eliminare il mixing IT/EN.

**Accettazione**: audit axe (o script dedicato) senza errori critici; zero chiamate a
`window.alert|confirm|prompt` nel frontend.

### Fase 5 — Project service backend (L)

**Obiettivo**: ciclo di vita completo, sicuro e riutilizzabile.

- Nuovo `src/backend/server/projectService.ts` che centralizza tutte le
  operazioni oggi sparse in `agentServer.ts:1225-1330`.
- Validazione centralizzata: id `[a-z0-9_-]`, nome non vuoto, path sempre
  sotto `rootDir`, rifiuto di `default` per operazioni distruttive.
- Operazioni:

  | Operazione | API | Comportamento |
  |---|---|---|
  | Lista | `GET /api/projects?includeArchived=` | aggiunge `archived`, `createdAt`, `sourceProjectId` (optionali) |
  | Crea | `POST /api/projects` | scaffold + config; **rollback** di cartelle/registry in caso di errore |
  | Rinomina | `PATCH /api/projects/:id` | cambia `name`/`title`, aggiorna config e registry con atomicWrite |
  | Clone | `POST /api/projects/:id/clone` | `{id, name, include}`; `fs.cp` con filter che esclude `.wiki-forge/`, `trash/`, `snapshots/`, `*.db`, `node_modules/`; nuovo registry entry; rollback |
  | Archivia | `POST /api/projects/:id/archive` | `softDelete` in `<root>/.wiki-forge/archive/` + flag `archived` |
  | Ripristina | `POST /api/projects/:id/restore` | rimuove flag e riporta la cartella al path originale |
  | Elimina | `DELETE /api/projects/:id?mode=unregister|trash|permanent` | default `trash` via `safeFs.softDelete`; `permanent` richiede conferma esplicita |
  | Esporta | `GET /api/projects/:id/export` | bundle zip/tar + manifest con versione, id, timestamp |
  | Importa | `POST /api/projects/import` | valida manifest, path containment, crea progetto da bundle |
  | Statistiche | `GET /api/projects/:id/stats` | conteggi note/sources/assets e dimensione |

- `PUT config`: merge invece di sostituzione, validazione schema e sincronizza
  il nome nel registry.
- Rimuovere gli handler duplicati non scoped `agentServer.ts:2858-2987`.
- Aggiungere `.gitignore` per `.wiki-forge/archive/` e per i trash annidati.

**Accettazione**: test TS per ogni_endpoint (clone con/esclusioni, archive→restore,
delete trash vs permanent, export→import round-trip, traversal rifiutato,
rollback su errore); test Python `test_project_scope.py` ancora verde.

### Fase 6 — Project Manager UI (M)

**Obiettivo**: sostituire `prompt()`/`confirm()` con un'interfaccia vera.

- Nuovo `components/projects/ProjectManagerModal.ts` basato su `ui/modal.ts`:
  tabella progetti (nome, id, percorso, #note, stato), azioni inline
  (Apri, Rinomina, Clona, Esporta, Archivia/Ripristina, Elimina), form inline
  con validazione, stati di busy, feedback via toast.
- Pulsante "📁 Progetti" nell'header globale (azionale dal catalogo);
  `ConfigManager` perde la barra progetto parziale e mantiene solo la
  configurazione del progetto attivo.
- `services/projectService.ts` lato frontend: unica API usata da header, config,
  research scope e project manager; emette `project:changed`.
- Dopo clone/delete dell'attivo, selezione automatica di un progetto valido e
  reload coerente.

**Accettazione**: nessun `prompt/confirm` nella UI progetti; creare, clonare,
rinominare, archiviare, ripristinare, esportare e cancellare tutto da modale;
test di integrazione che clona un progetto e verifica che i file esclusi non
siano presenti.

### Fase 7 — Chiusura (S)

- Aggiornare `ARCHITECTURE.md`, `TECHNICAL_ARCHITECTURE.md`, `USER_GUIDE.md`,
  `docs/help/progetti-config.md` (oggi afferma erroneamente che il rename
  esiste), `CHANGELOG.md`, `ROADMAP.md`.
- Rigenerare la wiki da `docs/` (`python scripts/docs_to_wiki.py`).
- Validazione completa: `npx tsc --noEmit`, `npm test`, `npm run build`,
  `pytest tests/python/`, `python scripts/docs_to_wiki.py --check`.
- Verifica manuale in browser: header, editor, modali, resizer, progetti.

---

## 6. Ordinamento consigliato e dipendenze

```text
Fase 1 (token) ──┬─> Fase 2 (azioni) ──> Fase 4 (a11y/i18n)
                 └─> Fase 3 (coupling) ─┘
Fase 5 (backend progetti) ──> Fase 6 (UI progetti)
Fase 7 (docs) dopo tutte
```

Fase 2 e Fase 3 possono essere eseguite in parallelo su file diversi; Fase 5 è
indipendente dalle prime quattro e può partire subito se si vuole dare
priorità alle funzionalità progetto.

---

## 7. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Refactor UI produce regressioni visive | Fase 1 solo CSS; snapshot visivi o confronto build; ogni fase lascia i test verdi |
| Re-render header/chat perde stato | Test che digitano nella chat durante un cambio store |
| Clone copia runtime state o supera root | `filter` esplicito + `resolveProjectRoot` + containment test |
| Delete distrugge wiki versionata | Default `trash`, `permanent` solo con conferma; `softDelete` riutilizzato |
| Registry corrotto da write parziale | `atomicWriteFile` + rollback su create/clone/import |
| Rename id rompe riferimenti esistenti | Fase 5 rinomina solo il **nome visualizzato**; il rename dell'id resta fuori dal primo rilascio e va pianificato con migrazione dei riferimenti |
| Collisioni scorciatoie non rilevate | Registry unico con rilevamento duplicati a runtime (warning in dev) |

---

## 8. Cosa NON fare

- Non introdurre React/Vue/Svelte: il progetto è vanilla TS per scelta architetturale.
- Non riscrivere gli studio: li si fa usare dalle primitive comuni, basta.
- Non aggiungere i18n complete: un dizionario `strings.ts` con IT/EN è sufficiente.
- Non spostare i progetti fuori da `projects/`: il containment è un'invariante.
- Non toccare `projects/wikiforge/wiki/architettura/note_architettura.md` (file
  utente preservato): le note senza provenance `process:docs-to-wiki` sono
  escluse dal controllo di drift, che ora passa anche con `docs_to_wiki.py --check`.

---

## 9. Decisioni da confermare prima dell'implementazione

1. **Lingua UI**: italiano ovunque (consigliato, richiede `lang="it"`) oppure
   bilinguala con selettore?
2. **Icone**: mantenere le emoji attuali per compatibilità, o passare a SVG
   inline con `aria-hidden` (più professionali, più lavoro)?
3. **Header nota**: rimuovere del tutto Research/Studio dall'header nota
   (consigliato: sono globali) oppure mantenerli come scorciatoia contestuale
   con link all'azione globale?
4. **Delete progetto**: default su `trash` (consigliato) o `unregister`?
5. **Rename id**: solo nome visualizzato ora, oppure anche id con migrazione?
6. **Priorità**: implementare prima UI/UX (Fasi 1-4) o project lifecycle (Fase 5-6)?
