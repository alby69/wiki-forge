# Versioning incrementale — proposta per WikiForge

Basato sulla lettera (tesi dinamica, LLM Wiki, tracciabilità fonti/elaborazioni).

## Stato attuale (ROADMAP)
Fasi 1-42 ✅ (template, OKF v0.2, agent, UI, CI). Fasi 36-37 ⬜ (badge UI, MCP).
**Nessun sistema di versioning incrementale della knowledge base.**

## Problema
La lettera richiede:
- modifica incrementale della base di conoscenza
- distinzione fonti originali / elaborazioni AI
- ritorno indietro (rollback) in caso di ripensamento
- tracciabilità nel tempo

WikiForge attuale: file Markdown in `wiki/` con git implicito ma senza snapshot semantici, rollback agent-driven, o storico delle elaborazioni.

## Soluzioni proposte (livello implementazione)

### A. Versioning git-semantico per note (livello: parziale / da fare)
- Ogni `compile` crea commit automatico con messaggio `compile: <nota> [source: ...]`
- Branch `draft/` per elaborazioni non confermate; `stable/` per confermate
- `make rollback note=<nota> to=<commit>` (nuovo target Makefile)
- Stato: non implementato; richiede script `scripts/versioning.py`

### B. Snapshot OKF con `generated` e `verified` (livello: parzialmente fatto)
- OKF v0.2 già in uso (fase 35 ✅); `generated` e `verified` esistono in frontmatter
- Estensione proposta: aggiungere `version`, `parent_commit` (hash git della fonte), `status` (draft/stable/deprecated) come campi obbligatori
- Stato: OKF base fatto; estensione versioning ⬜

### C. Registro `wiki/log.md` cronologico incrementale (livello: fatto base, estensione ⬜)
- `okf_log.py` già appende a `log.md` (fase 35 ✅)
- Proposta: ogni modifica a una nota genera voce in `log.md` con timestamp, azione (create/update/delete/rollback), attore (`human:<id>` o `process:<agent>`), nota coinvolta
- Stato: base OKF log ✅; log incrementale per note ⬜

### D. Branch per elaborazioni AI vs fonti (livello: ⬜)
- Cartelle `raw/` (fonti) e `wiki/` (elaborazioni) già separate
- Proposta: `wiki/versions/` con snapshot per nota (`<nota>.v1.md`, `.v2.md`) generati da `/compile` con hash della fonte `raw/`
- Stato: non implementato

### E. Rollback agent-driven (`/rollback`) (livello: ⬜)
- Nuovo comando agente in `AGENT.md`: `/rollback note=<nota> [to=version] [reason=...]`
- Implementa: copia versione precedente da `wiki/versions/` a `wiki/`, aggiorna `log.md`, aggiorna `index.md`
- Stato: non implementato

## Aggiornamento ROADMAP proposto
Aggiungere dopo fase 42 (o come fase 42b):

| # | Fase | Stato | Note |
|---|------|-------|-------|
| 42b | Versioning incrementale KB | ⬜ Todo | `scripts/versioning.py`, `wiki/versions/`, `/rollback`, log incrementale |

## Implementazione consigliata (ordine)
1. Estendere `okf_log.py` → log incrementale per nota (A, C)
2. Aggiungere `scripts/versioning.py` con snapshot e rollback (D, A)
3. Aggiornare `AGENT.md` con `/rollback` (E)
4. Aggiungere `make rollback` in Makefile (A)
5. Aggiornare `ROADMAP.md` con fase 42b

Questo mantiene la distinzione fonti/elaborazioni richiesta dalla lettera e rende la tesi dinamica verificabile nel tempo.

---
## Stato implementazione (aggiornato)
- A (versioning.py): ✅ implementato e pushato
- B (OKF metadati config): ✅ implementato
- C (okf_log.py esteso): ✅ implementato
- D (wiki/versions/): ✅ implementato
- E (/rollback AGENT.md): ✅ implementato
Sequenza completa. Commit finale disponibile su repo remoto.
