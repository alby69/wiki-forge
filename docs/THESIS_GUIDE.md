# Guida Operativa — Wiki-Forge Thesis Edition

> **Un sistema cognitivo evolutivo per la costruzione dinamica e la redazione di una tesi di laurea.**

Wiki-Forge Thesis Edition trasforma la preparazione della tesi da un processo lineare tradizionale (lettura PDF → appunti → stesura capitoli) in una **Knowledge Base viva ed evolutiva** gestita insieme ad agenti LLM.

---

## 1. Il Paradigma: Tesi come Sistema Cognitivo Evolutivo

Anziché limitarsi a interrogare i documenti originali con RAG classico (risposta temporanea in chat), **ogni domanda posta all'LLM e ogni nuova riflessione generano una nuova pagina Wiki persistente**.

```
[Fonti / PDF]
      ↓
 [Sintesi & Concetti]
      ↓
   [Wiki Viva]
      ↓
 [Domande Nuove] ──→ [Nuove Sintesi] ──→ [Wiki Arricchita]
                                                ↓
                                    [Maturità Pagine (0-100)]
                                                ↓
                                      [Capitoli Tesi Draft]
                                                ↓
                                      [PDF Finale Stampabile]
```

La tesi PDF finale diviene così una **proiezione temporanea** di una conoscenza accumulata e strutturata.

---

## 2. Struttura del Vault Tesi

Il vault della tesi utilizza la seguente organizzazione raccomandata:

```
wiki/
├── /fonti/                    # Schede di sintesi delle fonti primarie (libri, paper)
├── /concetti/                 # Entità concettuali e nodi del knowledge graph (es. AI, HR, AGI)
├── /sintesi/                  # Risposte articolate e confronti generati dalle domande
├── /domande/                  # Log delle domande di ricerca poste all'LLM
└── /capitoli/                 # Draft dei capitoli veri e propri della tesi
```

---

## 3. Metadata e Frontmatter YAML

Ogni nota nel vault tesi include frontmatter OKF v0.2 esteso con campi di categorizzazione:

```yaml
---
id: sintesi-graeber-cristianini
tipo: sintesi             # sintesi | concetto | fonte | domanda | capitolo_tesi
titolo: "Confronto Cristianini vs Graeber su intelligenza emergente e lavoro"
stato: draft              # draft | review | maturo
maturita: 75              # Indice calcolato automaticamente (0-100)
copertura_fonti: 3
domande_risolte: 2
fonti:
  - cristianini-machina-sapiens
  - graeber-bullshit-jobs
domande_origine:
  - domanda-001
collegamenti:
  - concetto/ai
  - concetto/lavoro
created: 2026-09-14
updated: 2026-09-14
sources: []
---
```

---

## 4. Calcolo dell'Indice di Maturità

L'indice di maturità (0-100) valuta lo stato di completezza di una pagina o capitolo basandosi su:
- **Copertura fonti** (`copertura_fonti * 15`)
- **Domande risolte** (`domande_risolte * 5`)
- **Densità di collegamenti** (`collegamenti * 3`)
- **Bonus lunghezza testo** (`parole / 50`, fino a 20 punti)

Comando CLI per calcolare la maturità:
```bash
python3 scripts/maturity_calculator.py wiki --write
# Oppure tramite shortcut Makefile:
make maturity
```

Nelle chat agenti o Web UI:
```text
/maturity
```

---

## 5. Aggregazione Capitoli e Generazione PDF Stampabile

Quando la knowledge base ha raggiunto un livello di maturità adeguato, è possibile aggregare i capitoli e le sintesi mature in un unico documento di tesi e compilarlo in PDF:

### Generazione Markdown unificato
```bash
python3 scripts/generate_thesis.py --wiki-dir wiki --output output/thesis_compiled.md --min-maturity 50
# Oppure shortcut Makefile:
make thesis-compile
```

Nelle chat agenti o Web UI:
```text
/thesis-chapter
```

### Esportazione PDF via Pandoc
```bash
python3 scripts/export_thesis_pdf.py --input output/thesis_compiled.md --output output/thesis_final.pdf
# Oppure shortcut Makefile:
make thesis-pdf
```

---

## 6. Flusso di Lavoro Consigliato

1. **Ingestione**: Inserisci i PDF o EPUB delle fonti originali in `sources/` (o `backup/`) ed esegui `make convert` (o `/compile`).
2. **Interrogazione**: Poni domande complesse all'agente in chat. L'agente genera la risposta e la salva come nota in `wiki/sintesi/`.
3. **Interconnessione**: Collega le nuove sintesi ai concetti chiave (`[[concetto]]`) e aggiorna le fonti citate.
4. **Monitoraggio Maturità**: Esegui periodicamente `make maturity` per valutare la crescita qualitativa della wiki.
5. **Compilazione Tesi**: Genera i draft dei capitoli in `wiki/capitoli/` ed esporta la versione finale pronta per la stampa con `make thesis-pdf`.
