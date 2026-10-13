# 📘 Workflow Integrato: Da NotebookLM a Wiki-Forge per la Tesi Magistrale

> **Stato**: Documento Vivente (Living Document)
> **Scopo**: Definire il processo operativo standard tramite Interfaccia Grafica (Web UI) per l'estrazione, normalizzazione, collegamento e sintesi delle fonti della tesi con l'architettura ibrida NotebookLM + Wiki-Forge.

---

## 🧠 1. Filosofia dell'Architettura: Due Livelli Complementari

Il progetto adotta un'architettura a due livelli per massimizzare sia la **profondità analitica** che la **persistenza strutturata** della conoscenza:

1. **🔬 NotebookLM (Il Laboratorio di Ricerca)**:
   - **Ruolo**: Motore di lettura, analisi RAG iniziale e generazione di sintesi strutturate da fonti primarie (libri, paper, trascrizioni).
   - **Vantaggio**: Eccelle nel comprendere il contesto specifico di un singolo corpus documentale e nel fornire citazioni puntuali ed ancorate alla fonte.
   - **Limite**: Non esegue retrieval simultaneo tra notebook indipendenti e non mantiene una memoria persistente a lungo termine.

2. **⚒️ Wiki-Forge Web UI (La Memoria Permanente e il "Meta-Cervello")**:
   - **Ruolo**: Knowledge Base dinamica consultabile visivamente, grafo della conoscenza interlinkato, motore di validazione e sistema di compilazione della tesi.
   - **Vantaggio**: Trasforma le sintesi in "unità cognitive" (note atomiche) collegabili, versionabili e interrogabili trasversalmente tramite GraphRAG e Competency Questions.
   - **Output**: Wiki interattiva interrogabile + Documento PDF finale della tesi pronto per la stampa.

---

## 🔄 2. Il Flusso Operativo in 5 Fasi nell'Interfaccia Grafica

### FASE 1: Normalizzazione nei Notebook Specialistici
Ogni ambito (es. Cristianini, Karpathy, HR, AI & Lavoro) ha il suo notebook dedicato. Invece di chiedere riassunti generici, si utilizza un **Prompt Strutturato di Knowledge Engineering** per garantire coerenza semantica e facilitare l'ingestione automatica nell'interfaccia grafica di Wiki-Forge.

**Prompt Standard da usare in ogni NotebookLM:**
```text
Agisci come un Knowledge Engineer accademico. Analizza tutte le fonti di questo notebook in funzione della tesi sull'impatto dell'Intelligenza Artificiale sul lavoro e sulle Risorse Umane.

Genera un unico documento Markdown strutturato con il seguente YAML frontmatter e sezioni:

---
title: "[Nome Autore/Tema] - Sintesi Strutturata"
author: "[Nome Autore o 'Tesi']"
type: "synthesis"
topics: ["AI", "HR", "Lavoro", "LLM", "Specifico"]
source_notebook: "[Nome del Notebook LM]"
status: "draft"
---

# 1. Concezione dell'Intelligenza Artificiale
# 2. Rapporto tra intelligenza umana e artificiale
# 3. Automazione, autonomia e capacità emergenti
# 4. Impatto sul lavoro: sostituzione vs trasformazione
# 5. Fiducia, controllo e responsabilità
# 6. Competenze umane: valore acquisito o perso
# 7. Conseguenze per organizzazioni e HR
# 8. Citazioni rilevanti (con riferimento alla fonte specifica)
# 9. Concetti chiave (lista di tag #)
# 10. Domande aperte per il confronto trasversale
```

### FASE 2: Ingestione nell'Interfaccia UI di Wiki-Forge
Le sintesi generate da NotebookLM vengono importate direttamente tramite l'interfaccia visiva di Wiki-Forge senza usare il terminale.

1. Copia la sintesi o salvala come file `.md`.
2. Nella Web UI di Wiki-Forge, clicca sul pulsante **📥 1. Carica** e trascina il file (oppure seleziona "Importa NotebookLM" dal menu **🛠️ Strumenti**).
3. Clicca sul pulsante **⚡ 2. Compila** per trasformare automaticamente la sintesi grezza in note atomiche collegate nel grafo.

### FASE 3: Costruzione del Grafo e Collegamento (Knowledge Engineering Visivo)
Wiki-Forge elabora il testo, estrae le entità e crea i collegamenti semantici basati sul contenuto.

1. **Compilazione ed Elaborazione**: Clicca **⚡ 2. Compila** (o invia `/compile` nella chat) per assicurarti che tutte le note siano processate e collegate nel grafo.
2. **Validazione**: Nella chat invia `/ontology-check` o `/schema-lint` per verificare che i concetti estratti rispettino la struttura ontologica della tesi.
3. **Arricchimento nell'Editor**: Naviga nel Vault Explorer. Se noti un collegamento mancante tra un concetto ed una teoria HR, aggiungilo direttamente nell'editor oppure scrivi `/note` nella chat per creare una nota di connessione esplicita.

### FASE 4: Interrogazione Trasversale (Il vero "Meta-Notebook")
Questa è la fase in cui il valore del sistema esplode. Invece di chiedere a un singolo notebook, interroghi l'intera Knowledge Base di Wiki-Forge direttamente dal pannello di chat **💬 3. Chiedi**.

Usa i comandi di consultazione avanzata:
- **`/consult`**: *"Confronta la concezione di 'capacità emergenti' in Cristianini con la visione di 'LLM come sistema operativo' di Karpathy, e deduci le implicazioni per le competenze HR."*
- **`/deep-research`**: *"Quali attività HR sembrano maggiormente automatizzabili secondo le caratteristiche degli LLM descritte da tutte le fonti presenti nel grafo?"*
- **`/validate-cq`** (Competency Questions): Verifica se le note attuali rispondono alle domande fondamentali della tesi (es. *"In che modo l'IA trasforma il ruolo del recruiter?"*).

### FASE 5: Scrittura e Compilazione della Tesi nell'Interfaccia Grafica
Quando le note raggiungono uno stato `stable` o `mature`:

1. **Aggregazione**: Nella chat **💬 3. Chiedi** invia il comando `/thesis-chapter` per aggregare tutte le note relative a un macro-tema (es. "Capitolo 2: L'Impatto degli LLM sul Lavoro Cognitivo") in un unico documento coerente e ben strutturato.
2. **Revisione Avversaria**: Invia `/adversarial-review` per far sì che l'agente identifichi punti deboli, contraddizioni logiche o mancanze di citazioni nel capitolo generato.
3. **Esportazione PDF in un clic**: Apri il menu **🛠️ Strumenti** nella barra superiore e clicca sul pulsante **Esporta PDF Tesi**. Il sistema genererà il documento PDF finale pronto per la stampa, con bibliografia e citazioni tracciate.

---

## 🛠️ 3. Checklist Operativa Settimanale per l'Operatore HR

- [ ] **Estrazione**: Ho generato la sintesi strutturata (con frontmatter YAML) dai nuovi materiali su NotebookLM?
- [ ] **Ingestione**: Ho caricato i nuovi file con **📥 1. Carica** e cliccato sul pulsante **⚡ 2. Compila**?
- [ ] **Collegamento**: Ho controllato la vista **🕸️ Graph** per assicurarmi che i nuovi concetti si leghino a quelli esistenti (es. HR ↔ AI)?
- [ ] **Interrogazione**: Ho lanciato almeno una domanda trasversale con `/consult` o `/deep-research` nella chat per testare la coerenza della tesi?
- [ ] **Maturità**: Ho usato `/maturity` o il pulsante "Calcola Maturità" per vedere quali sezioni della tesi sono ancora "stub" (abbozzate) e necessitano di approfondimento?

---

## 💡 4. Principi Guida per il Successo

1. **Non fondere le fonti primarie**: Mantieni i libri originali nei rispettivi NotebookLM. In Wiki-Forge carichi solo le *sintesi strutturate*. Questo preserva la provenienza ed evita l'allucinazione da mescolamento di contesti diversi.
2. **Il Frontmatter è legge**: L'intestazione YAML iniziale in ogni file Markdown è ciò che permette a Wiki-Forge di filtrare, ordinare e collegare semanticamente i contenuti.
3. **Pensa per "Unità Cognitive"**: Una nota in Wiki-Forge non è un capitolo, è un singolo concetto atomico (es. "Automazione delle competenze soft") che può essere riutilizzato e citato in più capitoli della tesi.
4. **Tracciabilità**: Ogni affermazione forte nella sintesi deve avere un riferimento alla fonte originale. Wiki-Forge supporta il tracciamento visivo delle affermazioni con il comando `/trace`.

---

> **🚀 Prossimo Passo Consigliato nell'Interfaccia**:
> 1. Apri il tuo notebook di **Cristianini** su NotebookLM.
> 2. Incolla il **Prompt Standard** riportato nella Fase 1.
> 3. Salva o copia il risultato.
> 4. Nella Web UI di Wiki-Forge, clicca sul pulsante **📥 1. Carica** (o "Importa NotebookLM" nel menu **🛠️ Strumenti**) e poi su **⚡ 2. Compila**.
> 5. Osserva come Wiki-Forge inizia a tessere visivamente la rete concettuale della tua tesi nel grafo interattivo.
