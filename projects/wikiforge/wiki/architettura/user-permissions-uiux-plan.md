---
type: Concept
title: "Piano UI/UX — utenti, permessi e frontend modulare"
description: "Questo documento integra docs/ROADMAP.md (Task 10–11, RBAC 5/5) e"
resource: docs/USER_PERMISSIONS_UIUX_PLAN.md
tags: [scope/docs, layer/generated, area/architettura, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-user-permissions-uiux-plan-md
    resource: docs/USER_PERMISSIONS_UIUX_PLAN.md
    title: "Piano UI/UX — utenti, permessi e frontend modulare"
    author: human:alby69
---
# Piano UI/UX — utenti, permessi e frontend modulare

> **Stato**: approvato; implementazione progressiva con verifica a ogni step.
> **Decisioni confermate** (2026-11-24): consegna = piano + implementazione;
> preferenze UI salvate **per utente sul server** con fallback locale;
> modello di permessi = **ruoli globali + contesto progetto**.

Questo documento integra `docs/ROADMAP.md` (Task 10–11, RBAC 5/5) e
`docs/ROADMAP_Q1_Q2_2027_PLAN.md` (track B chiuso). Il backend già applica RBAC
a 95 endpoint e il frontend filtra azioni, tab e pulsanti, ma la personalizzazione
è ancora incompleta: solo i pulsanti pinnati e la modalità Focus/Developer sono
persistenti, e le preferenze vivono in `localStorage` senza seguire l'utente.

---

## 1. Audit dello stato attuale (F0 ✅)

| Aspetto | Stato oggi | Gap per l'obiettivo |
| :--- | :--- | :--- |
| Identità | `GET /api/auth/me` server-derived, `AuthIdentityDto` con actor/roles/source | Non espone ruoli effettivi per progetto né azioni consentite: il frontend deve ricalcolare tutto |
| Ruoli | `OPERATION_MIN_ROLE` / `ACTION_MIN_ROLE` in `src/shared/auth/capabilities.ts` | Unica source of truth condivisa, ma usata in modo eterogeneo nei componenti |
| Progetti | ACL in `[enterprise.projectAcls]`, `effectiveRoles()` nel middleware B3 | Il frontend non sa quali progetti/ruoli sono effettivi per l'utente |
| Preferenze | `pinnedActionIds`, `filesVisible`, `viewMode`, `theme`, lingua in `appStore`/`localStorage` | Non seguono l'utente; nessuna validazione lato server; non visibili ad altri client |
| Azioni | Catalogo unico in `src/frontend/core/actions.ts` | Le regole di visibilità sono sparse in Header, Sidebar, studio, palette, scorciatoie |
| Modali utente | `UserManagerModal` con creazione, ruoli, active, delete | Non spiega i permessi, non protegge il proprio account, nessun feedback contestuale |
| Accessibilità | `aria-label` su parte dei pulsanti; `role=tablist` senza `tabpanel` | Mancano stati disabilitati spiegati e focus management coerente nei modali |

### Baseline di verifica (prima di ogni modifica)

- `npm run typecheck` → verde.
- `npm test` → **1 fallimento preesistente** in `tests/userManagement.test.ts`
  (assert sul mode bit `0o600`, non applicabile al filesystem Windows della macchina).
  Confronto: il resto dei test passa (505/507, 1 skipped).
- `PYTHONPATH=.:scripts python -m pytest tests/python/ -q` → **1 fallimento
  preesistente** (`pyshacl` non installato); 153 test passano.
- I gate devono restare a questo livello: nessun nuovo fallimento.

---

## 2. Principi e invarianti

1. **Server-derived**: identità, ruoli effettivi, progetti visibili e azioni consentite
   arrivano dal server; il body del client non può influenzarli (B1/B5/B7).
2. **Additività**: nessuna rottura di envelope, metodi pubblici o route esistenti;
   nuove route dichiarate solo in `contracts.ts` + `endpoints.ts`.
3. **Nessun `fetch` diretto nell'UI**: tutto passa da `core/apiBus.ts`.
4. **Fail-closed**: senza accessi attendibili l'UI mostra il gate di login e la
   superficie minimale Reader; le preferenze non valide vengono normalizzate.
5. **KISS/DRY**: un solo catalogo di azioni/pannelli, una sola fonte per i permessi,
   una sola store per le preferenze, un solo punto di salvataggio.
6. **Progressione**: ogni step lascia build, typecheck e test allo stato baseline.

---

## 3. Architettura target

```text
src/shared/api/
  types.ts          UiAccessDto, UiPreferencesDto, AuthIdentityDto invariato
  contracts.ts      ui.access, ui.preferences.get, ui.preferences.put
  endpoints.ts      tipi corrispondenti (IsExact verde)
src/shared/auth/
  capabilities.ts  OPERATION_MIN_ROLE / ACTION_MIN_ROLE + UI_PANEL ids
src/backend/server/auth/
  uiPreferencesStore.ts   file .wiki-forge/ui-preferences.json, chiave hash per actor
  uiModule.ts             access + get/put preferenze, normalizzazione rigorosa
src/frontend/
  core/uiAccess.ts        caricamento access + preferenze, selettori puri
  store/appStore.ts       slice access + preferenze, un solo punto di mutazione
  components/ui/CustomizeUiModal.ts  pannelli/barra/aspetto/scorciatoie
  components/ui/Header.ts filtra il catalogo con i selettori, apre il modale
```

Il modello a tre livelli è:

```text
ruolo globale (Reader/Contributor/KE/Admin)
        ∩ ACL progetto (projectAcls / folder scope)
        = ruoli effettivi
        → azioni/operazioni consentite → UI renderizzabile
```

Le preferenze sono semplici dati di presentazione (pin, pannelli, vista, tema,
densità, lingua). Non possono ampliare i permessi: il filtro per ruolo viene
applicato **dopo** il merge delle preferenze.

---

## 4. Step di implementazione

### F1 — Modello di accesso UI lato server

- **Obiettivo**: dare al frontend un unico DTO server-derived con ruoli effettivi,
  progetti visibili, azioni e operazioni consentite.
- **Modifiche**: `UiAccessDto` in `types.ts`; tre route addittive; `UiModule` che
  riutilizza `effectiveRoles`, `visibleProjectsFor`, `ACTION_MIN_ROLE`,
  `OPERATION_MIN_ROLE`; mappature RBAC `Reader` per tutte e tre.
- **Accettazione**: admin vede tutte le azioni; Reader no; con ACL progettuale
  ristretta il DTO riporta solo i progetti/ruoli effettivi; un corpo client con
  `actor`/`roles` fake non cambia il risultato.
- **Verifica**: `npm run typecheck`; test mirati (`uiAccess.test.ts`,
  `openapi.test.ts`, `rbacMiddleware.test.ts`).

### F2 — Store preferenze per utente

- **Obiettivo**: salvare le preferenze sul server, indicizzate da una chiave
  derivata dall'actor autenticato, con validazione e scrittura atomica.
- **Modifiche**: `uiPreferencesStore.ts` (`get`, `put`, normalizzazione, hash della
  chiave, `.wiki-forge/ui-preferences.json`); integrazione in `UiModule`.
- **Accettazione**: due utenti non condividono preferenze; valori sconosciuti
  vengono scartati; un file corrotto non blocca l'avvio; nessun segreto o actor
  in chiaro nel file; `PUT` non può scrivere le preferenze di un altro utente.
- **Verifica**: test dedicatati con `tmpDir`; `git diff --check`.

### F3 — Store e servizio frontend

- **Obiettivo**: una sola pipeline che carica accesso + preferenze, le applica
  allo store e le risalva quando cambiano.
- **Modifiche**: `core/uiAccess.ts`, slice `access` in `appStore`,
  `applyUiPreferences()`, `setHiddenPanel()`, `setDensity()`; hook in
  `WikiForgeApp.startup` dopo `refreshIdentity()`.
- **Accettazione**: login → preferenze dell'utente corrette; logout → preferenze
  locali di default; cambio progetto → categorie(filter) coerenti;nessun ciclo
  save/load.
- **Verifica**: test con store + apiBus mockati; `npm test`.

### F4 — Catalogo UI modulare e personalizzabile

- **Obiettivo**: rendere dichiarativa la superficie grafica, non hardcoded.
- **Modifiche**: `UI_PANELS` (files, editor, graph, context, chat, scratchpad) con
  `requiredOperation`; `CustomizeUiModal` con quattro sezioni (Layout, Barra,
  Aspetto, Scorciatoie); Header apre il modale e usa i selettori di `uiAccess`.
- **Accettazione**: un Reader non può pinnare azioni Contributor/KE/Admin; un
  pannello non consentito resta nascosto anche se salvato nelle preferenze;
  cambiare etichetta/icona di un'azione richiede una sola modifica; le
  scorciatoie mostrate sono quelle effettivamente registrate.
- **Verifica**: test DOM sul modale e sull'header; build verde.

### F5 — UX di gestione utenti e permessi

- **Obiettivo**: rendere comprensibili e sicure le operazioni sugli account.
- **Modifiche**: `UserManagerModal` con descrizione dei quattro ruoli, anteprima
  delle capacità, blocco della modifica/disattivazione del proprio account,
  conferma per delete già presente, messaggi coerenti IT/EN; `lang="it"` in
  `index.html` con selettore lingua che aggiorna anche le preferenze.
- **Accettazione**: l'utente corrente non può togliersi Admin né disattivarsi da
  UI; ogni ruolo mostra cosa può fare; nessun `alert/confirm/prompt` nuovo.
- **Verifica**: test sul modale; audit manuale di focus/aria-label.

### F6 — Documentazione, gate e collaudo

- Aggiornare `ROADMAP.md` (nuovo task Q4), `USER_GUIDE.md`,
  `docs/help/progetti-config.md` o nuova help `ui-personalizzazione.md`,
  `CHANGELOG.md`, `OPENAPI.md` (conteggio endpoint), `TECHNICAL_ARCHITECTURE.md`.
- Rigenerare la proiezione wiki da `docs/` (`docs_to_wiki.py`) e verificare drift.
- Gate completo: typecheck, test, build, Python test con PYTHONPATH,
  `gen_script_registry.py --check`, `check_docs_sync.py`, `okf_lint.py wiki`,
  `git diff --check`. Confronto con la baseline: zero nuovi fallimenti.

---

## 5. Dipendenze

```text
F0 ──> F1 ──> F2 ──> F3 ──> F4 ──> F5 ──> F6
```

F1 e F2 sono implementabili insieme (stesso modulo backend), ma vengono
verificati separatamente. F3 dipende dalle route F1/F2; F4 dipende da F3; F5
può partire dopo F3; F6 chiude tutto.

---

## 6. Rischi e mitigazioni

| Rischio | Mitigazione |
| :--- | :--- |
| Preferenze diventino un bypass RBAC | Filtro permessi applicato dopo il merge; il server non accetta idazione arbitraria |
| Endpoint non coperti da `IsExact` | Aggiornare `contracts.ts` e `endpoints.ts` nella stessa modifica; typecheck gate |
| Cambi identità non riflessi nella UI | `refreshIdentity()` e caricamento access nella stessa sequenza di startup |
| Preferenze perse su browser diverso | Server come fonte autoritativa; localStorage solo fallback offline |
| Regressione nei test B0/B7 | Nuove route addittive; envelope e campi esistenti invariati |
| File preferenze corrotto | Normalizzazione difensiva + default; nessuna eccezione verso l'utente |

---

## 7. Registro di avanzamento

| Step | Stato | Verifica |
| :--- | :--- | :--- |
| F0 | ✅ | Audit completato; baseline registrata (2 fallimenti ambientali preesistenti) |
| F1 | ✅ | `npm run typecheck` verde; 37/37 test mirati (`uiAccess`, `openapi`, `rbacMiddleware`) |
| F2 | ✅ | Stessa verifica di F1: isolation, normalizzazione, file corrotto, PUT/GET via API |
| F3 | ✅ | `npm run typecheck` verde; 5/5 test mirati (`uiAccessFrontend`), nessuna regressione nei test UI B7/B0 |
| F4 | ✅ | `npm run typecheck` verde; 3/3 test mirati (`customizeUiModal`), header/toolbar B7-green |
| F5 | ✅ | `npm run typecheck` verde; 15/15 test mirati (`userManagerRoles`, `userUi`, `customizeUiModal`, `uiAccessFrontend`); `lang="it"` già presente in `index.html` |
| F6 | ✅ | `npm run typecheck`/`npm run build` verdi; `npm test` 521 pass + 1 skip + 1 fallimento baseline (`userManagement`, permesso file Windows); pytest 153 pass + 1 fallimento baseline (`pyshacl` mancante); registry, docs/wiki sync, `okf_lint` (con UTF-8) e `git diff --check` verdi |
