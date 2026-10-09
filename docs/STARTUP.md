# STARTUP — Da Wiki Esistente a Nuovo Progetto da Zero

> **Guida rapida** per ripulire la wiki attuale, configurare un nuovo progetto e importare file Markdown.
> Procedura in 3 fasi: **Pulizia → Configurazione → Importazione**.

---

## Fase 1 — Ripulire la wiki attuale

L'obiettivo è azzerare `wiki/`, `raw/` ed `output/` **senza perdere nulla**: lo stato corrente viene congelato in git e può essere ripristinato in qualsiasi momento.

### 1.1 Congela lo stato attuale

```bash
git status            # verifica cosa c'è da salvare
git add -A
git commit -m "backup wiki pre-reset"
```

### 1.2 Svuota le cartelle di lavoro

```bash
rm -rf wiki/* raw/* output/*
```

| Cartella | Ruolo | Perché svuotarla |
|---|---|---|
| `wiki/` | base di conoscenza strutturata | è la wiki da azzerare |
| `raw/` | inbox dei sorgenti convertiti | rimuove i file marcati `_COMPILED` |
| `output/` | sintesi e materiali effimeri | derivati della vecchia wiki |

> **Nota**: `backup/` (o la cartella `[paths].sources`) **non viene mai toccata**: contiene gli originali immutabili.

### 1.3 Rigenera gli indici

Chiedi all'agente: **`reindex`** — ricrea `wiki/index.md` vuoto e allinea gli indici tematici.

**Per annullare la pulizia:**
```bash
git checkout HEAD -- wiki raw output    # ripristina lo stato del commit di backup
```

---

## Fase 2 — Configurare il nuovo progetto

Modifica `config.toml`:

### 2.1 Identità del progetto

```toml
[project]
name = "mio-nuovo-progetto"
title = "Titolo del Nuovo Progetto"
context = "Descrizione sintetica del dominio, degli obiettivi e delle fonti."
language = "it"                    # en, it, es, fr, de
```

### 2.2 Percorsi

```toml
[paths]
sources = "backup"     # cartella dove metti i tuoi file originali (immutabile)
raw     = "raw"        # inbox di lavoro (generata da convert)
wiki    = "wiki"       # base di conoscenza
```

### 2.3 Vocabolario dei tag

Definisci i tag ammessi nel nuovo dominio:

```toml
[tags]
allowed = ["tag-uno", "tag-due", "tag-tre"]
```

### 2.4 Alternativa: wizard guidato

```bash
make wizard
```

Scegli lo scenario (`academic`, `business`, `research`, `creative`, `existing`) e procedi passo-passo.

---

## Fase 3 — Importare i file Markdown

### 3.1 Posiziona i file

Copia i tuoi `.md` nella cartella sorgenti (default `backup/`):

```bash
cp /percorso/dei/miei/file.md backup/
```

> I file in `backup/` sono l'**origine immutabile**: non modificarli mai direttamente.

### 3.2 Converti in `raw/`

```bash
make convert          # locale (Python + pandoc)
# oppure
docker compose run --rm wiki convert
```

I file `.md`/`.txt` sono copiati **invariati** in `raw/` (pass-through, vedi `scripts/conv2md.py`); PDF/EPUB/DOCX vengono convertiti in Markdown.

### 3.3 Compila nella wiki

Chiedi all'agente: **`compile`**

La procedura:
1. legge ogni file di `raw/` **senza** suffisso `_COMPILED`
2. classifica e decide la wiki tematica di destinazione
3. crea/aggiorna gli articoli in `wiki/` con frontmatter OKF v0.2 e collegamenti `[[wikilink]]`
4. aggiorna `wiki/index.md` e gli indici toccati
5. rinomina il file aggiungendo `_COMPILED` (es. `fonte.md` → `fonte_COMPILED.md`)

**Importazione singola** (un solo file, senza riscansione):

```
ingest backup/mio-file.md
```

**Reimportazione** di un file già compilato (dopo aggiornamento):

```
recompile backup/mio-file.md
```

---

## Riepilogo rapido

```bash
# 1. Pulizia
git add -A && git commit -m "backup wiki pre-reset"
rm -rf wiki/* raw/* output/*

# 2. Configurazione
$EDITOR config.toml          # [project], [paths], [tags]
# oppure: make wizard

# 3. Importazione
cp /percorso/file1.md /percorso/file2.md backup/
make convert
# poi in chat: compile
```

| Comando agente | Scopo |
|---|---|
| `compile` | processa tutti i file non compilati in `raw/` |
| `ingest <file>` | processa un singolo file |
| `recompile <file>` | riprocessa un file già `_COMPILED` |
| `reindex` | rigenera gli indici |
| `audit` | verifica salute della wiki (link rotti, orfani) |
