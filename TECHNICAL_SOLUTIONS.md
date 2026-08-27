# Analisi Tecnica e Architetture d'Uso: `wiki-forge` con LLM Locali e Training From-Scratch

Questo documento analizza la fattibilità dell'integrazione tra il progetto **`wiki-forge`** e modelli linguistici di piccole dimensioni (LLM locali o addestrati in casa come **nanoGPT** / **nanochat** di Andrej Karpathy). Viene presentata un'analisi teorica del problema e vengono dettagliate due soluzioni architetturali:
- **Soluzione A (Produzione / Usabilità reale)**: Architettura RAG locale con LLM pre-addestrati e `wiki-forge`.
- **Soluzione B (Scopo Didattico)**: Pipeline di addestramento *from-scratch* con `nanochat` per comprendere le dinamiche interne di un LLM.

---

## 1. Analisi di Fattibilità Tecnica e Concetti Fondamentali

### 1.1 Il Problema di Fondo: Memoria Parametrica vs. Memoria Non-Parametrica

Un errore comune nell'approccio ai Large Language Model (LLM) è considerare il *pre-training* o il *fine-tuning* su un corpus di documenti personalizzati come la creazione di una "memoria interrogabile" o un database ricercabile.

- **Memoria Parametrica (Pre-training e Fine-Tuning)**:
  La conoscenza risiede nei pesi (pesi/matrici di attenzione) della rete neurale. L'addestramento ottimizza il modello per la predizione statistica del token successivo (*Next-Token Prediction*). Il fine-tuning modifica lo stile, il formato o le associazioni probabilistiche, ma non garantisce il recupero fattuale preciso (*factual recall*).

- **Memoria Non-Parametrica (RAG e LLM-Wiki)**:
  La conoscenza risiede in documenti esterni (file Markdown, vector database). Il modello agisce come motore di ragionamento e sintesi: gli viene fornito il contesto al momento dell'inferenza (*in-context learning*) ed egli estrae le informazioni senza dover modificare i propri pesi.

### 1.2 Perché `nanoGPT` / `nanochat` non si integrano direttamente come "motore" di `wiki-forge`

1. **Scala dei dati (Data Scale)**:
   Modelli come `nanochat` richiedono miliardi di token di testo generico (es. *FineWeb*) solo per apprendere la struttura grammaticale, il ragionamento di base e la conoscenza generale del mondo. Pochi megabyte di documenti personali inseriti durante il training o il fine-tuning rappresentano un rumore statistico trascurabile che viene "annegato" dalla massa dei dati.

2. **Capacità Agenti e Instruction-Following**:
   `wiki-forge` richiede un LLM con forti capacità agentiche (descrittive nel file `AGENT.md`): deve comprendere istruzioni complesse, analizzare documenti in Markdown, creare collegamenti ipertestuali (`[[wikilinks]]`), estrarre entità senza allucinazioni ed eseguire operazioni di manutenzione (merge, split, audit). Modelli di dimensioni inferiori a ~3B-7B parametri addestrati da zero con risorse limitate non possiedono la capacità di ragionamento necessaria per fungere da agente per `wiki-forge`.

3. **Incompatibilità con l'Architettura `wiki-forge`**:
   `wiki-forge` non fa addestramento. È un compilatore ed un agente informativo basato su file Markdown. Si aspetta un modello di livello *frontier* (o un modello locale adeguato) accessibile via API o CLI.

---

## 2. Soluzione A — Operativa e di Produzione: RAG Locale + `wiki-forge`

### 2.1 Obiettivo
Ottenere un sistema locale, interrogabile, privato e privo di allucinazioni che gestisca i propri documenti attraverso la metodologia `wiki-forge`.

### 2.2 Stack Tecnologico
1. **Inference Engine Locale**:
   - **Ollama**, **llama.cpp** o **LM Studio**.
2. **Modelli Open-Weight Consigliati**:
   - **Llama 3.1 / 3.2 (8B / 3B)**
   - **Qwen 2.5 (7B / 14B)**
   - **Mistral 7B / Phi-4 (14B)**
   *Requisiti Hardware*: GPU consumer con 8-16 GB VRAM (es. RTX 3060/4060/4070) oppure Mac Apple Silicon serie M (M1/M2/M3/M4 con 16GB+ RAM unificata).
3. **Compilazione Wiki (`wiki-forge`)**:
   - Conversione sorgenti (PDF/EPUB/DOCX) via `conv2md.py` in `raw/`.
   - L'agente locale (es. via OpenCode, Claude Code o script wrapper con Ollama) legge `AGENT.md` ed esegue il workflow `compile` per generare gli articoli interconnessi in `wiki/`.
4. **Strato di Indicizzazione e Retrieval (Opzionale / Avanzato)**:
   - Modello di Embedding locale: `nomic-embed-text` o `bge-m3`.
   - Vector Database leggero: **ChromaDB** o **LanceDB**.
   - Gli articoli compilati della cartella `wiki/` vengono suddivisi in chunk ed indicizzati nel Vector DB per velocizzare il comando `consult` ed evitare di saturare la finestra di contesto.

```
+------------------+     conv2md.py      +--------------+
| Documenti Orig.  |  ---------------->  |  raw/ (.md)  |
| (sources/backup) |                     +--------------+
+------------------+                            |
                                                v
+------------------+    AGENT.md Schema   +--------------+
| Ollama / Local   |  <---------------->  |  wiki/ (.md) |  <--- Compilato dall'Agente
| LLM (7B - 14B)   |  (OpenCode / CLI)    +--------------+
+------------------+                            |
        ^                                       v
        | Vector Search                 +---------------+
        +-----------------------------> | Vector DB     | (Chroma / LanceDB)
                                        +---------------+
```

### 2.3 Vantaggi della Soluzione A
- **Aggiornabilità istantanea**: L'aggiunta di un nuovo documento richiede solo l'esecuzione di `compile` senza riaddestrare il modello.
- **Tracciabilità e Nessuna Allucinazione**: Le risposte citano le fonti esatte tramite `[[wikilinks]]` e rinviano ai file in `raw/`.
- **Efficienza Esecutiva**: Gira interamente su hardware consumer standard.

---

## 3. Soluzione B — Scopo Didattico: Addestramento From-Scratch con `nanochat`

### 3.1 Obiettivo
Comprendere il ciclo di vita completo di addestramento di un LLM generativo (dalla tokenizzazione all'inferenza con KV-cache) utilizzando il repository [`karpathy/nanochat`](https://github.com/karpathy/nanochat).

### 3.2 La Pipeline di Addestramento di `nanochat`

La pipeline di `nanochat` riflette il processo di sviluppo dei moderni modelli di frontiera (stile ChatGPT) ed è articolata nei seguenti 6 stadi:

```
[1. Tokenization] -> [2. Pretraining] -> [3. Midtraining] -> [4. SFT] -> [5. RL] -> [6. Inference Engine]
```

1. **Tokenizzazione (`tok_train.py`)**:
   Addestramento di un tokenizer BPE (Byte-Pair Encoding, vocabolario ~65k token) sul corpus di testo grezzo. Il testo viene convertito in token numerici efficienti.

2. **Pre-training (`base_train.py`)**:
   - **Corpus**: *FineWeb* (decine di miliardi di token dal web).
   - **Obiettivo**: Minimizzare la *cross-entropy loss* sulla predizione del token successivo.
   - **Architettura**: Transformer Causal Decoder-Only (definito in `gpt.py`).
   - **Risultato**: Un modello "base" che conosce la sintassi e la conoscenza generale del mondo, ma non sa conversare o rispondere a comandi.

3. **Mid-training**:
   Fase intermedia in cui il modello base viene esposto a dati con formattazione strutturata (es. conversazioni, sintassi di tool-use, codice) per preparare i pesi alla fase di instruction-following.

4. **Supervised Fine-Tuning - SFT (`chat_sft.py`)**:
   - **Corpus**: *SmolTalk* (dataset di dialoghi utente-assistente curati).
   - **Obiettivo**: Insegnare al modello il formato di risposta in chat, l'uso dei ruoli (`user`, `assistant`, `system`) e lo stile di risposta.

5. **Reinforcement Learning - RL (`chat_rl.py`)**:
   Affinamento del comportamento tramite algoritmi di RL (es. PPO / GRPO) su compiti con risposta verificabile (es. quesiti matematici GSM8K) per migliorare le capacità di ragionamento.

6. **Engine di Inferenza (`engine.py`, `chat_cli.py`)**:
   Servizio di inferenza ottimizzato con **KV-Cache** per la generazione di testo interattiva da riga di comando.

### 3.3 Gestione dei Parametri: Il Dial `--depth`
`nanochat` semplifica la configurazione del modello attraverso un unico parametro guida: `--depth` (numero di layer del Transformer). Tutte le altre variabili (larghezza delle matrici, learning rate, num heads, batch size) vengono calcolate automaticamente secondo principi di scaling compute-optimal.

Per test didattici locali veloci senza budget elevati:
- `--depth=12` (eseguibile in pochi minuti su singola GPU o Mac Apple Silicon per verificare la diminuzione della loss).

### 3.4 Limitazioni Hardware e Didattiche
- Per addestrare un modello realmente usabile (versione *speedrun* ~1.6B equivalenti), servono circa 3 ore su un cluster **8x NVIDIA H100** (~$100).
- Tentare di inserire i propri documenti aziendali o personali nel mix di dati durante il pretraining/midtraining non renderà il modello un'interfaccia affidabile per quei documenti: il modello mostrerà allucinazioni frequenti sui dettagli fattuali.

---

## 4. Matrice Comparativa delle Soluzioni

| Criterio | Soluzione A: `wiki-forge` + RAG Locale | Soluzione B: Training `nanochat` From-Scratch |
| :--- | :--- | :--- |
| **Scopo Primario** | Produzione, Gestione Conoscenza Personale | Didattico, Studio dell'Architettura LLM |
| **Tecnologia Chiave** | RAG, Markdown Interlinkati, `AGENT.md` | Transformer Pre-training, SFT, RL |
| **Gestione Conoscenza** | Non-parametrica (file esterni `wiki/`) | Parametrica (pesi neurali `.pt` / `.safetensors`) |
| **Accuratezza Fattuale** | Elevata (citazioni dirette delle fonti) | Bassa sui dettagli (tendenza ad allucinare) |
| **Costo Computazionale** | Minimo (inferenza locale su 1 GPU/Mac) | Elevato (richiede GPU multi-node per run completi) |
| **Aggiornamento Dati** | Immediato (basta aggiungere il file `.md`) | Richiede riaddestramento / fine-tuning |
| **Requisito Modello** | Modelli capaci di seguire istruzioni (7B+) | Modello generato durante il training |

---

## 5. Raccomandazione Finale

1. Per realizzare un **"LLM-Wiki" interrogabile sui propri documenti**, implementare la **Soluzione A**. Utilizzare `wiki-forge` unitamente ad Ollama (con un modello 7B-14B come Qwen 2.5 o Llama 3.1) per la compilazione e l'interrogazione tramite RAG.
2. Per **approfondire l'ingegneria dei modelli linguistici**, esplorare la **Soluzione B** eseguendo gli script di `nanochat` (partendo da `--depth=12`) per osservare come si comporta la loss durante la tokenizzazione e il pretraining su un corpus generico.
