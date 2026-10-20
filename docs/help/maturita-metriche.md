---
id: maturita-metriche
title: Metriche e maturità
icon: 📊
order: 14
group: ⚙️ Progetti e Dev Mode
mode: both
keywords: [metriche, metrics, maturità, maturity, stats, statistiche, audit, punteggio, score, ke-maturity, indicatore]
context: []
---

## Perché misurare

Le metriche dicono **quanto è solida** la tua wiki: note complete, collegamenti, livello di maturità, coerenza dell'ontologia. Servono a decidere cosa curare prima.

## Dalla chat

| Comando | Cosa ottieni |
|---|---|
| `/maturity` | **Maturity Index (0-100)** delle note |
| `/ke-maturity` | Valutazione di maturità **Knowledge Engineering** |
| `/stats` | Statistiche globali (note, tag, collegamenti...) |
| `/audit` | Controlla link rotti, orfani, frontmatter |
| `/lint-frontmatter` | Valida il frontmatter OKF |
| `/schema-lint` | Valida lo schema tipizzato |
| `/ontology-check` | Coerenza ontologica e regole |
| `/neuro-check` | Controllo di coerenza neuro-simbolica |

## Da 🛠️ Tools (Developer Mode)

| Script | Uso |
|---|---|
| **Calculate Maturity Score** | Calcola gli score (0-100); parametri: `--write` (salva nel frontmatter), `--dry-run` (anteprima), `--min-score` (filtro) |
| **Global Wiki Statistics** | Ricalcola le statistiche e aggiorna `docs/METRICS.md` |
| **OKF Bundle Analytics** | Report per tipo, stato e trust tier |
| **KE Maturity Assessment** | Report di maturità KE (`output/ke_maturity_report.md`) |
| **Graph Louvain Analytics** | Comunità e insights dal grafo |
| **Ontology Rule Engine** | Violazioni delle regole (modalità `--strict`) |

## Il primo controllo rapido

Scrivi **`/stats`** poi **`/maturity`**: in due comandi capisci dimensioni e qualità. Per un quadro completo aggiungi **`/audit`** (struttura) e guarda `docs/METRICS.md`.

> Consiglio: usa il punteggio di maturità anche come **filtro per la tesi** (`min_maturity` in *Compile Thesis Draft*): nel documento finiscono solo le note mature.

**Approfondisci:** `docs/METRICS.md` (definizioni e valori correnti), `docs/OKF_SPEC.md` (campi maturity), `docs/THESIS_GUIDE.md` (uso del filtro in tesi).
