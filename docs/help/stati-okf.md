---
id: stati-okf
title: Stati e livelli di fiducia (OKF)
icon: 🏷️
order: 8
group: 📖 Uso quotidiano
mode: both
keywords: [stato, trust, fiducia, okf, verified, human-reviewed, machine-confirmed, unverified, verify, verifica, stale]
context: []
---

## I tre livelli di fiducia

Ogni nota ha un **livello di fiducia** (*trust tier*), visibile nella **barra in alto** accanto al badge di modalità quando la nota è aperta:

| Livello | Sigla | Significato |
|---|---|---|
| **Human-Reviewed** | 🟢 | Verificata da un essere umano — il livello più alto |
| **Machine-Confirmed** | 🔵 | Prodotta/confermata dall'agente, nessuna revisione umana |
| **Unverified** | ⚪ | Ancora nessuna conferma |

Il livello è **derivato solo dal campo `verified`** del frontmatter (non dallo `status`): se `verified` ha un autore (`human:...`) → 🟢, altrimenti → 🔵, se assente → ⚪.

## Come segnare una nota come verificata

Dalla chat:

```
/verify <nota> [reviewer=<id>] [stable]
```

- `<nota>` — id o titolo della nota.
- `reviewer=<id>` — chi verifica (es. `reviewer=mario`).
- `stable` — la revisione è considerata stabile (non scade).

`/human-review` è un alias identico di `/verify`. La nota passa a 🟢 **Human-Reviewed** e così appare anche nell'header.

## Gli altri stati (frontmatter OKF)

Oltre alla fiducia, le note OKF v0.2 portano nel frontmatter: `type` (tipo), `status` (es. draft/stable/deprecated), `version`, `maturity` e i **tag**. Lo **stato di obsolescenza** (`stale_after`) segnala quando una nota andrebbe riveduta.

## Verificare in loto la tua busta

- **`/lint-frontmatter`** (o script **Lint OKF Bundle** in 🛠️ Tools) — valida frontmatter e campi obbligatori.
- **`/audit`** — controlla link rotti, note orfane e problemi strutturali.
- **OKF Bundle Analytics** (🛠️ Tools) — report con conteggi per tipo, stato e trust tier.

**Approfondisci:** `docs/OKF_SPEC.md` (specifica completa OKF v0.2), `docs/TUTORIAL.md` §5.1 (fiducia e stati).
