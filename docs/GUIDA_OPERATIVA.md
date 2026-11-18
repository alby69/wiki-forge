# 🧭 Wiki-Forge — Guida operativa

**A chi serve**: a chi vuole usare Wiki-Forge senza occuparsi della parte tecnica.
**Come si legge**: ogni sezione è un'attività; in fondo c'è il flusso di lavoro tipico da seguire dall'inizio alla fine.

---

## 1. In due parole

Wiki-Forge è una **wiki personale** che vive sul tuo computer e che viene **costruita e mantenuta da un agente IA**.

Tu porti il materiale (PDF, documenti, pagine web, appunti), l'agente lo trasforma in **note brevi e collegate tra loro**, e tu le leggi, le correggi, le interroghi e le esporti.

Niente va in cloud: la tua conoscenza resta in una cartella locale (*vault*).

### Le parole da conoscere

| Parola | In pratica |
|---|---|
| **Vault** | La tua raccolta di note |
| **Nota** | Un singolo articolo della wiki |
| **Fonte** | Il documento originale che hai caricato (non è ancora una nota) |
| **Compilazione** | Il passaggio che trasforma le fonti in note collegate |
| **Wikilink** | Il collegamento `[[nome-nota]]` tra due note |
| **Grafo** | La mappa visiva di tutte le note e dei loro collegamenti |
| **Fiducia (trust tier)** | Quanto una nota è affidabile: verificata da umano, confermata dall'agente, non verificata |
| **Review Studio** | La finestra di revisione con quattro schede: Verifica, Critica, Digest, Confronta versioni |
| **Research Studio** | La finestra di ricerca con sei schede: Consult, Ricerca, Backlink, Correlate, Traccia, Deep Research |
| **Study Studio** | La finestra di studio con sette schede: Guida, Quiz, Mindmap, Audio, Note, Promuovi, Tesi |

---

## 2. Le due modalità di lavoro

| Modalità | Quando usarla | Cosa vedi |
|---|---|---|
| 🌱 **Focus Mode** | Tutti i giorni, per il lavoro normale | 4 pulsanti: **Carica · Importa · Compila · Chiedi** |
| 👑 **Developer Mode** | Quando serve uno strumento in più: script, metriche, configurazione | **Onboarding Wizard · KE Workbench · Tools · Config** |

Si passa dall'una all'altra cliccando il **badge accanto al logo** (o con **Ctrl+Shift+D**), in qualsiasi momento.

> Regola semplice: **parti sempre in Focus Mode**. Passa a Developer Mode solo quando una sezione di questa guida dice esplicitamente di farlo.

---

## 3. Le attività, una per una

### Attività A — Preparare l'ambiente (una volta sola)

1. Avvia Wiki-Forge e verifica in basso che compaia `Status: Connected`.
2. Scegli il **progetto** dal menu in alto: ogni progetto è una wiki separata e la scelta viene ricordata.
3. Collega un **modello IA** (in Developer Mode → **Config → LLM**). Senza modello puoi caricare e leggere, ma non compilare né interrogare.

Se preferisci essere guidato, usa l'**Onboarding Wizard**: ti fa scegliere uno scenario (accademico, business…), il modello e il primo caricamento di documenti.

---

### Attività B — Portare materiale dentro

Hai tre strade, dalla più semplice:

| Strada | Come | Quando |
|---|---|---|
| **📥 Carica** | Trascini i file nella finestra | Più documenti insieme (PDF, EPUB, DOCX, MD, TXT) |
| **📝 Importa** | Scegli un singolo file Markdown e la cartella di destinazione | Hai già una nota pronta |
| **Caricamento da cartella** | Tasto destro su una cartella dell'albero a sinistra | Vuoi sistemare subito l'organizzazione |

In Developer Mode → **Tools** trovi le sorgenti particolari: **Web Clipper** (salva una pagina web come nota pulita), **Import NotebookLM Export**, **Voice & Multimedia Ingest** (trascrizioni audio), **Convert Sources to Markdown** (conversione in blocco con OCR).

> ⚠️ I file caricati sono **solo fonti**: non diventano note finché non compili.

---

### Attività C — Trasformare le fonti in note (compilazione)

1. Clicca **⚡ Compila**.
2. Segui la barra di avanzamento: *conversione → creazione collegamenti → completato*.
3. Le nuove note compaiono nell'albero a sinistra, già collegate tra loro.

Dalla chat hai i comandi equivalenti:

| Comando | Serve per |
|---|---|
| `/compile` | Compilazione completa |
| `/ingest <file>` | Compilare un singolo file |
| `/recompile` | Ricompilare note già esistenti |
| `/convert-only` | Convertire senza pubblicare nella wiki |

**Consiglio**: la prima volta carica **poco materiale**. È molto più facile controllare il risultato e correggere la rotta prima di compilare centinaia di pagine.

---

### Attività D — Consultare e navigare

Le **4 viste** in alto a destra:

| Vista | A cosa serve |
|---|---|
| **📝 Editor** | Leggere e scrivere una nota con il massimo spazio |
| **📒 Scratchpad** | Appunti rapidi sopra l'editor |
| **🕸️ Graph** | Vedere la mappa dei collegamenti |
| **◧ Split** | Editor e grafo affiancati: la vista migliore per lavorare |

Strumenti di orientamento:

- **Albero dei file** a sinistra: l'organizzazione delle note.
- **Tag cloud** in basso a sinistra: clicca un tag per filtrare note e grafo.
- **Grafo**: clicca un nodo per aprire la nota; filtra per cartella/tag, ingrandisci e usa lo zoom-fit.
- **Pannello in basso** sulla nota aperta: metadati, **Backlink** (chi la cita) e **Outbound** (cosa cita).

Nella chat puoi semplicemente **fare domande in linguaggio naturale**: *«Quali note parlano di ontologie?»*, *«Riassumi la nota X»*.

Per cercare e interrogare la wiki in modo strutturato, usa la **Research Studio** (pulsante **🔎 Research** in alto o **🔎 Ricerca** nell'editor): le sei schede coprono **Consult** (domanda con citazioni), **Ricerca** (full-text con numeri di riga), **Backlink** (chi cita la nota), **Correlate** (connessioni mancanti), **Traccia** (note e fonti raw di un'affermazione) e **Deep Research** (report esteso salvato in `output/` e `wiki/synthesis/`). Scrivendo in chat `/consult`, `/search`, `/backlinks`, `/related`, `/trace` o `/deep-research` si apre la scheda corrispondente con la query già pronta.

Per studiare e ripassare, usa la **Study Studio** (pulsante **📚 Studio** in alto o nell'editor, `Ctrl+Alt+G/K/M/A`): **Guida**, **Quiz**, **Mindmap** e **Audio** generano materiale in `output/`, mentre **Note** e **Promuovi** gestiscono lo scratchpad.

---

### Attività E — Scrivere, correggere, annotare

1. Seleziona la nota → **Modifica** → formatta con la toolbar → **Salva**.
2. Collega le note scrivendo `[[nome-nota]]`: nella lettura diventano link cliccabili.
3. Usa la **cronologia** della nota per vedere le versioni precedenti e ripristinarle.
4. Apri **🧐 Revisione** (o fai **tasto destro** sulla nota) per verificare la qualità e confrontare le versioni nella **Review Studio**.
5. Scrivi appunti veloci con `/note <testo>` o dalla scheda **📝 Note** della Study Studio; quando un appunto è pronto, **promuovilo a nota** con `/promote-note`, il pulsante nello Scratchpad o la scheda **🚀 Promuovi**.

Le note sono **semplici file di testo**: puoi modificarle anche col tuo editor preferito, senza rompere nulla.

---

### Attività F — Controllare la qualità

Tre domande da porsi periodicamente: *le note sono complete? sono collegate? mi fido di quello che dicono?*

**Fiducia** — ogni nota ha un livello, visibile in alto accanto al badge di modalità:

| Livello | Significato |
|---|---|
| 🟢 **Human-Reviewed** | Verificata da una persona: il livello più alto |
| 🔵 **Machine-Confirmed** | Prodotta dall'agente, non ancora riletta |
| ⚪ **Unverified** | Nessuna conferma |

Per promuovere una nota: apri la **Review Studio** (pulsante **🧐 Revisione**, tasto destro sulla nota o `Ctrl+Alt+R`), controlla il quality gate e premi **Registra verifica**. In alternativa, dalla chat: `/verify <nota> reviewer=<nome>`.

La **Review Studio** riunisce quattro schede:

| Scheda | Cosa ci fai |
|---|---|
| **✓ Verifica** | Controlli qualità, storico verifiche, revisione umana (con `stable` e commento) |
| **⚡ Critica** | Revisione avversariale: contraddizioni, citazioni mancanti, azioni consigliate |
| **◷ Digest** | Ultimi giorni di attività, statistiche di salute e prossime azioni |
| **⇄ Confronta versioni** | Diff unificato riga per riga con uno snapshot precedente e ripristino |

Scorciatoie: `Ctrl+Alt+R` (Verifica), `Ctrl+Alt+C` (Critica), `Ctrl+Alt+D` (Digest), `Ctrl+Alt+F` (Confronta versioni).

**Controlli** — dalla chat, in ordine di importanza:

| Comando | Cosa ti dice |
|---|---|
| `/audit` | Link rotti, note orfane, problemi di struttura |
| `/stats` | Dimensioni e composizione della wiki |
| `/maturity` | Punteggio di maturità delle note (0–100) |
| `/lint-frontmatter` | Correttezza dei metadati delle note |
| `/ontology-check` · `/schema-lint` | Coerenza del modello concettuale |

> Il controllo rapido da fare sempre: **`/stats` + `/maturity` + `/audit`**. Bastano a capire dove intervenire.

---

### Attività G — Studiare, sintetizzare, produrre

Tutti questi comandi lavorano sulle note **già compilate** e si lanciano dalla chat. Le stesse operazioni sono disponibili in forma grafica nella **Study Studio** (pulsante **📚 Studio**, `Ctrl+Alt+G/K/M/A`), che mostra subito il risultato, le fonti e il file salvato:

| Comando | Risultato |
|---|---|
| `/consult <argomento>` | Sintesi multi-fonte con citazioni alle note |
| `/deep-research <domanda>` | Ricerca approfondita su una domanda |
| `/study-guide [argomento]` | Guida di studio strutturata |
| `/quiz [argomento]` | Quiz di autovalutazione |
| `/mindmap [argomento]` | Mappa concettuale |
| `/audio-overview [argomento]` | Copione audio tipo podcast |
| `/thesis-chapter [argomento]` | Capitolo di tesi dalle note mature |

Senza argomento lavorano su tutta la wiki; con l'argomento restringono il campo.

**Come ottenere buoni risultati**: sii specifico (`/quiz tipi di trust tier` funziona meglio di `/quiz`), e compila prima le note sull'argomento.

---

### Attività H — Esportare e condividere

| Cosa vuoi | Come |
|---|---|
| **Slide** | `/slides [argomento]` |
| **PDF della tesi** | Developer Mode → Tools → *Compile Thesis Draft*, poi *Export Thesis to PDF* (richiede Pandoc) |
| **Dati semantici** | `/export-semantic` (JSON-LD / Turtle) |
| **Backup umano** | Copia la cartella della wiki: è già composta di file Markdown |

---

### Attività I — Quando qualcosa non funziona

| Sintomo | Prima cosa da fare |
|---|---|
| La chat dice "offline" | Il server non è raggiunto: controlla il footer `Status: Connected` |
| La compilazione non crea note | Verifica che i file siano caricati e che il modello IA sia configurato |
| Il grafo è vuoto | Sei in vista Graph/Split? I filtri nascondono tutto? Prova `/reindex` |
| Un file non compare | Formato supportato? Le note arrivano solo **dopo** la compilazione |

Poi: **F1** apre la guida contestuale, e dal pannello puoi girare la domanda all'agente con **💬 Chiedi all'agente**.

---

## 4. Il flusso di lavoro tipico

### Il giro base (una sessione di lavoro)

```
  📥 CARICA            ⚡ COMPILA           ✏️ RIVEDI            💬 USA
  documenti      →     fonti diventano  →   correggi note   →    chiedi, studia,
  nel vault            note collegate       e collega            esporta
                                                 │
                                                 └──→ 🔁 ricompila / arricchisci
```

In pratica:

1. **Raccogli** il materiale di oggi e caricalo.
2. **Compila** e guarda cosa è nato.
3. **Rivedi**: apri le note nuove, correggi, aggiungi wikilink mancanti e controlla la qualità con la **Review Studio**.
4. **Usa** la wiki: fai domande, produci sintesi, esporta quello che ti serve.
5. **Verifica** (`/audit`) e segna come verificate le note di cui ti fidi.

### La cadenza consigliata

| Frequenza | Cosa fare | Perché |
|---|---|---|
| **Ogni sessione** | Carica → Compila → rileggi le note nuove → `/audit` | Chiudi il ciclo con materiale pulito |
| **Ogni settimana** | `/stats` + `/maturity`, rileggi le note 🔵 e verifica le migliori dalla **Review Studio** (o con `/verify`) | La wiki cresce senza perdere qualità |
| **Ogni mese** | `/ontology-check`, `/schema-lint`, riorganizza tag e cartelle, backup | Mantieni la struttura sana nel tempo |
| **Al bisogno** | `/consult`, `/deep-research`, `/quiz`, `/slides`, export tesi | Trasformi la conoscenza in un prodotto |

### Un esempio concreto (una settimana)

1. **Lunedì** — carichi 5 PDF sul tema, compili, ottieni ~20 note collegate. Ne rileggi 6 e correggi i titoli.
2. **Mercoledì** — carichi una pagina web col Web Clipper e un export NotebookLM; ricompili e vedi il grafo infoltirsi.
3. **Venerdì** — `/maturity` ti dice quali note sono deboli; ne riscrivi tre. Poi `/consult` sul tema della settimana e `/quiz` per autovalutarti.
4. **Fine mese** — `/thesis-chapter` aggrega le note mature, esporti il PDF e fai un backup della cartella.

---

## 5. Le sette buone pratiche

1. **Poco alla volta.** Compilazioni piccole e frequenti battono una grande compilazione caotica.
2. **Una nota, un concetto.** Se una nota parla di tre cose, probabilmente sono tre note da collegare.
3. **Collega sempre.** Una nota senza wikilink è difficile da ritrovare: `/audit` ti segnala le orfane.
4. **Verifica ciò che usi.** Se una nota finisce in una sintesi o in tesi, portala a 🟢 Human-Reviewed.
5. **Specifica nelle richieste.** Indicare l'argomento (o il nome della nota) migliora ogni risposta.
6. **Fidati del file, non dell'interfaccia.** Le note sono Markdown: puoi sempre aprirle, copiarle, versionarle.
7. **Guarda le metriche, non le sensazioni.** `/stats`, `/maturity` e `/audit` dicono oggettivamente dove curare.

---

## 6. Dove trovare aiuto

| Cosa | Dove |
|---|---|
| **Guida in-app contestuale** | Tasto **F1** o pulsante **?** |
| **Guida testuale** | `/help` oppure `/help <argomento>` in chat |
| **Approfondimenti** | Cartella `docs/`: `TUTORIAL.md` (passo-passo), `USER_GUIDE.md` (interfaccia), `WORKFLOW.md` (flusso esteso), `THESIS_GUIDE.md` (percorso tesi), `METRICS.md` (metriche) |
| **Segnalare un problema** | Link GitHub dal logo in alto |

---

**In sintesi**: *carica, compila, rivedi, usa, verifica.* Se tieni questo ritmo, la wiki cresce da sola e resta affidabile.
