---
type: Concept
title: 'Capitolo 3: Progettazione della Piattaforma di Gestione della Conoscenza Ibrida'
description: 'La stesura di una tesi magistrale rappresenta tradizionalmente un processo
  lineare e spesso frammentato: raccolta di PDF, appunti sparsi su ...'
status: stable
generated:
  by: process:migrate-script
  at: '2026-10-20T06:04:34Z'
verified: []
sources: []
---
## 1. Introduzione a Wiki-Forge come Piattaforma di Knowledge Engineering per la Ricerca Accademica
La stesura di una tesi magistrale rappresenta tradizionalmente un processo lineare e spesso frammentato: raccolta di PDF, appunti sparsi su diversi software, e una fase finale di stesura che richiede di memorizzare dove si trova ogni singolo concetto. I moderni sistemi di intelligenza artificiale basati su RAG (Retrieval-Augmented Generation) offrono un supporto alla rucerca eallo studio, ma generano risposte temporanee e talvolta parziali, costringendo l'utente a ricominciare da zero a ogni interrogazione.

Wiki-Forge propone un cambio di paradigma: trasforma lo studente da semplice "lettore" o "consultatore" a Knowledge Engineer (ingegnere della conoscenza). La piattaforma non si limita a rispondere alle domande, ma agisce come un assistente di ricerca attivo che costruisce, valida e mantiene una base di conoscenza persistente. Il risultato finale possiede una doppia natura:

1. Una Wiki Dinamica e Interconnessa: consultabile visivamente, interrogabile in tempo reale e continuamente arricchibile.

2. Un Documento Statico e Stampabile: un elaborato PDF, formattato secondo i canoni accademici, generato con un solo clic a partire dalla conoscenza cristallizzata.

Questo approccio rispecchia il modello di creazione della conoscenza SECI di Nonaka e Takeuchi, digitalizzando il processo di esternalizzazione, combinazione e internalizzazione del sapere.  Nello specifico, questo celebre framework descrive un ciclo virtuoso in quattro fasi che la piattaforma supporta attivamente: la Socializzazione (l'assorbimento informale e la condivisione delle fonti primarie), l'Esternalizzazione (la traduzione delle idee tacite in concetti espliciti, come quando si trasformano appunti sparsi in note strutturate), la Combinazione (la sistematizzazione e il collegamento ipertestuale di questi elementi in una struttura organica, proprio come avviene nella costruzione del grafo della wiki) e, infine, l'Internalizzazione (l'assimilazione di questa conoscenza strutturata attraverso lo studio e la revisione, che la trasforma in competenza profonda e duratura dello studente.

---

## 2. Il Concetto Fondamentale: Da "Archivio Polveroso" a "Cervello Organizzativo Vivo"
Per comprendere Wiki-Forge, è utile un'analogia. 
Immaginiamo una **biblioteca tradizionale** (il modello attuale di molte aziende): i libri (documenti HR, contratti, policy) sono sugli scaffali. Se si fa una domanda, si deve cercare il libro giusto, sfogliarlo e sperare di trovare la risposta. Se il libro manca o è scritto male, la risposta non c'è.

Wiki-Forge trasforma questa biblioteca in un **assistente bibliotecario esperto e meticoloso** (definito nella tesi come *Knowledge Engineer*). Questo assistente non si limita a "cercare" i libri, ma:
1. Li legge.
2. Ne estrae i concetti fondamentali.
3. Crea delle schede collegate tra loro (un "grafo" della conoscenza).
4. Garantisce che ogni informazione sia verificata e tracciabile alla fonte.

Per massimizzare l'efficacia della ricerca, il workflow ideale adotta un'architettura a due stadi, che separa l'esplorazione dalla strutturazione:

- Il Laboratorio di Ricerca (es. NotebookLM): eccellente per l'ingestione iniziale di fonti primarie (libri, paper, trascrizioni), la generazione di riassunti contestuali e l'estrazione di citazioni puntuali. Tuttavia, soffre di "silos informativi": non collega nativamente concetti tra notebook diversi.

- Il Meta-Cervello (Wiki-Forge): riceve le sintesi strutturate dal laboratorio e le trasforma in "unità cognitive" atomiche (note Markdown). Qui, la conoscenza viene collegata semanticamente, validata e resa interrogabile trasversalmente, superando i limiti del RAG passivo.

---

## 3. L'interfaccia grafica e il funzionamento della piattaforma in tre passi

L'interfaccia della piattaforma è progettata per essere utilizzata da operatori HR o collaboratori aziendali senza competenze di programmazione. Uno dei punti di forza di Wiki-Forge è infatti l'astrazione della complessità tecnica: a partire dall'interfaccia grafica, l'utente viene accolto dalla Modalità Semplice (Focus Mode) che presenta poche funzioni, semplici ed intuitive. L'interazione si basa su tre pulsanti fondamentali, sempre visibili nella barra superiore centrale:

📥 1. Carica (Fase di Discovery): Apre una finestra in cui trascinare file PDF, EPUB, DOCX o TXT. Il sistema gestisce automaticamente il salvataggio nelle cartelle di lavoro, senza mai modificare o cancellare gli originali. In questa fase, il sistema si comporta come un lettore veloce che prende appunti grezzi.

⚡ 2. Compila (Fase di Consolidation): Il cuore pulsante della piattaforma. Con un clic, il sistema converte i documenti grezzi, estrae i concetti chiave, genera metadati strutturati (standard OKF v0.2) e crea automaticamente collegamenti ipertestuali ([[wikilink]]) tra le note atomiche (Atomic Notes). Queste ultime sono schede digitali cge cintegono ciascuna una ed una sola idea/concetto, scritta in modo chiaro e atonomo, corredata da tag e collegamenti. 
Infine, una barra di avanzamento fornisce un feedback visivo immediato.

💬 3. Chiedi (Fase di Internalizzazione): Apre un pannello di chat laterale per dialogare con l'assistente, richiedere sintesi, mappe concettuali o la stesura di paragrafi. L'utente può porre domande in linguaggio naturale (es. Quali sono gli obblighi di preavvisoin caso di dimissioni per un quadro?). La piattaforma non inventa le risposte, ma le costruisce collegando le note atomiche pertinenti e citando la fonte originale per permettere all'utente di verificare la correttezza con un click. 


---

## 4. Ambiente visivo di lavoro e Workflow in 5 fasi per lo studente

Il percorso dalla prima fonte al PDF finale è guidato da una procedura cronologica chiara, supportata da wizard interattivi.

Fase 1: Inizializzazione del Progetto
All'avvio, lo studente configura il progetto tramite il pannello ⚙️ Config (inserendo titolo, lingua e contesto). Attivando il wizard accademico (digitando /wizard academic nella chat), la piattaforma predispone automaticamente una struttura di cartelle nella barra laterale: fonti/, concetti/, sintesi/, domande/ e capitoli/.

Fase 2: Ingestione e Bonifica delle Fonti
Lo studente trascina i paper bibliografici nell'area 📥 1. Carica. Se dispone già di sintesi elaborate su strumenti esterni (come NotebookLM), può importarle direttamente selezionando "Importa NotebookLM" dal menu 🛠️ Strumenti. In questa fase, i documenti vengono convertiti in testo pulito e pronto per l'elaborazione.

Fase 3: Costruzione Incrementale del Grafo
Cliccando su ⚡ 2. Compila, l'assistente legge i testi, crea note atomiche e le interconnette. Lo studente può ora esplorare il grafo (🕸️ Graph) per verificare visivamente come i concetti si leghino tra loro. Nella chat (💬 3. Chiedi), può avviare interrogazioni trasversali avanzate:
/consult "Confronta la visione dell'automazione di Graeber con quella di Cristianini": genera una nuova nota di sintesi collegata a entrambi gli autori.
/trace "citazione specifica": verifica la tracciabilità di un'affermazione, rimandando esattamente al paragrafo e alla riga del documento sorgente originale, garantendo rigore accademico e prevenendo allucinazioni.

Fase 4: Sintesi, Studio e Valutazione della Maturità
Mentre la tesi prende forma, la piattaforma offre strumenti per valutare oggettivamente il lavoro svolto. Tramite il comando /maturity (o il pulsante "Calcola Maturità" nel menu strumenti), il sistema assegna un punteggio da 0 a 100 a ogni nota, basandosi su completezza, numero di fonti citate e densità di collegamenti. Questo aiuta lo studente a identificare a colpo d'occhio quali capitoli sono solidi (stable) e quali sono ancora abbozzati (stub) e necessitano di approfondimento. Strumenti come /mindmap o /quiz permettono inoltre di ripassare i concetti in modo attivo.

Fase 5: Compilazione e Generazione del PDF Finale
Quando le note raggiungono un livello di maturità adeguato, lo studente non deve copiare e incollare manualmente i testi. È sufficiente inviare il comando /thesis-chapter nella chat per aggregare le sezioni correlate in un documento unificato. Infine, aprendo il menu 🛠️ Strumenti e cliccando su Esporta PDF Tesi, la piattaforma compila l'intero progetto in un file thesis_final.pdf formattato, con bibliografia e citazioni tracciate, pronto per la consegna.

---

## 5. I Tre Pilastri di Affidabilità (Spiegati per le Risorse Umane)
In ambito HR, l'affidabilità e la tracciabilità sono non negoziabili. Wiki-Forge implementa tre meccanismi di controllo, spiegabili con analogie familiari:

1. **Trust Tiers (Livelli di Fiducia):** Funziona come il processo di "firma per visto" in un'azienda.
   - *Giallo (Non verificato):* Il documento è stato caricato, ma nessuno lo ha controllato.
   - *Blu (Verificato dalla macchina):* Il sistema ha controllato che la scheda sia compilata correttamente (es. tutti i campi obbligatori sono presenti).
   - *Verde (Verificato dall'umano):* Un responsabile HR o un giurista ha letto la scheda, l'ha approvata e "firmata" digitalmente. Solo le informazioni "verdi" hanno massima priorità nelle risposte.

2. **Validazione SHACL (Il "Controllo di Conformità" automatico):** Immaginiamo un modulo cartaceo per una richiesta di ferie che non può essere protocollato se manca la data o la firma. SHACL è l'equivalente digitale: impedisce al sistema di accettare una "Nota Atomica" se non rispetta le regole ontologiche definite (es. "ogni norma deve avere un riferimento alla fonte"). È un controllo di qualità deterministico, non lasciato al caso.

3. **GraphRAG (L'Investigatore Concettuale):** A differenza di una semplice ricerca per parole chiave (che trova la parola "licenziamento" ovunque), il GraphRAG segue le *relazioni*. Se chiedo informazioni sul licenziamento, il sistema sa che quel concetto è collegato a "procedura di contestazione", "tempi di preavviso" e "ruolo del sindacato", fornendo un quadro completo e non frammentato.

---

## 6. Un Cenno alla Modalità Sviluppatore (Developer Mode)
Sebbene la Focus Mode sia più che sufficiente per il ciclo di vita di una tesi, Wiki-Forge nasconde una potenza notevole per gli utenti tecnici. Attivando la Developer Mode (tramite toggle in alto a destra o scorciatoia Ctrl+Shift+D), l'interfaccia rivela il KE Workbench (Knowledge Engineer Workbench).
Senza entrare nel merito di implementazioni tecniche, questa modalità consente di:

- Validare la coerenza logica della base di conoscenza tramite regole formali (Ontology Design Patterns).
Esportare l'intero grafo in formati semantici standard W3C (come RDF o JSON-LD) per l'interoperabilità con altri sistemi aziendali.

- Valutare la maturità dell'intera piattaforma su sei dimensioni operative, garantendo che la conoscenza accumulata rispetti standard di qualità enterprise.

Questa dualità (semplicità per l'utente finale, robustezza per l'esperto) è ciò che rende la piattaforma scalabile: lo studente beneficia di un'esperienza fluida, sapendo che il sistema sottostante è governato da logiche di ingegneria della conoscenza di alto livello.


## 7. Esempi concreti in anbito HR

### Esempio A: Gestione del Passaggio di Consegne (Know-how in uscita)
* **Contesto:** Un responsabile del personale con 20 anni di esperienza va in pensione. Sa a memoria come gestire una complessa vertenza sindacale specifica del settore, ma non è mai stata scritta da nessuna parte.
* **Applicazione Wiki-Forge:** Durante gli ultimi mesi, il responsabile registra brevi note vocali o appunti grezzi nella piattaforma. Il sistema (Fase di Esternalizzazione) li trasforma in Note Atomiche strutturate ("Procedura vertenza sindacale X"). Quando il nuovo assunto arriva, interroga la piattaforma (Fase di Internalizzazione) e ricostruisce la prassi operativa, preservando il capitale intellettuale aziendale.

### Esempio B: Compliance e Aggiornamento Normativo
* **Contesto:** Viene modificato un articolo del D.Lgs. 81/2008 sulla sicurezza sul lavoro. L'azienda deve aggiornare il proprio manuale interno.
* **Applicazione Wiki-Forge:** L'esperto carica il nuovo testo di legge. Il sistema identifica le Note Atomiche collegate al vecchio articolo (grazie ai collegamenti del grafo) e le segnala nella *Review Queue* (Coda di Revisione) con un bollino giallo. Il responsabile HR valida le modifiche, che diventano "verdi" (human-reviewed), garantendo che il manuale sia sempre allineato alla normativa senza dover rileggere 200 pagine da zero.

---

## 7. Conclusioni
Wiki-Forge non è un semplice "chatbot" generico, il cui uso in ambito HR è sconsigliato per i rischi di allucinazione e mancanza di tracciabilità. È, come evidenziato nel corso del capitolo, un'**infrastruttura di conoscenza ibrida e governata**. 
Combina la potenza di sintesi dell'Intelligenza Artificiale con il rigore metodologico del *Knowledge Management* (Modello SECI) e i controlli di qualità tipici della gestione documentale giuridica (Trust Tiers e validazione ontologica). Il risultato è uno strumento che mette la tecnologia al servizio delle competenze umane, rendendo la conoscenza aziendale un asset vivo, verificabile e strategicamente utilizzabile.*

Più importante ancora, restituisce allo studente il controllo sul processo di ricerca: ogni interazione non è una domanda fine a se stessa, ma un mattone che costruisce un Secondo Cervello Digitale. La tesi cessa di essere un documento statico destinato a prendere polvere in un archivio, e diventa il "dump" strutturato di un sistema esperto, un patrimonio di conoscenza permanente che potrà essere riattivato, espanso e valorizzato in futuri articoli scientifici, dottorati o progetti professionali.



# Capitolo 3: Progettazione della Piattaforma di Gestione della Conoscenza Ibrida

## 3.1 Il Modello SECI di Nonaka & Takeuchi: Il Fondamento Teorico
Il modello SECI, sviluppato da Ikujiro Nonaka e Hirotaka Takeuchi nel 1995, costituisce il framework teorico di riferimento nel *Knowledge Management* per descrivere la dinamica con cui la conoscenza viene creata, trasformata e diffusa all'interno delle organizzazioni. Il modello si fonda sulla distinzione e sull'interazione continua tra due forme di conoscenza:
* **Conoscenza Tacita**: soggettiva, legata all'esperienza diretta, alle intuizioni, all'intuito pratico e al know-how individuale, complessa da formalizzare o codificare esplicitamente in parole.
* **Conoscenza Esplicita**: oggettiva, strutturata, formalizzata e facilmente trasmissibile, archiviabile e codificabile (es. documenti, manuali, database e grafi di conoscenza).

La creazione di valore e l'apprendimento organizzativo avvengono attraverso una "spirale" continua composta da quattro conversioni fondamentali (da cui l'acronimo **SECI**):
1. **S - Socializzazione (da Tacita a Tacita)**: condivisione diretta di esperienze, osservazione e pratica comune (es. affiancamento, mentoring, brainstorming non strutturato).
2. **E - Esternalizzazione (da Tacita a Esplicita)**: articolazione della conoscenza tacita in concetti espliciti, modelli, metafore, linee guida o documentazione scritta.
3. **C - Combinazione (da Esplicita a Esplicita)**: integrazione, riorganizzazione, sintesi e formalizzazione di diverse fonti esplicite in sistemi di conoscenza più complessi e strutturati.
4. **I - Internalizzazione (da Esplicita a Tacita)**: assimilazione della conoscenza esplicita da parte degli individui attraverso la consultazione, la pratica e l'applicazione operativa ("learning by doing"), riconvertendola in nuova sensibilità e competenza tacita.

## 3.2 L'Evoluzione dell'LLM: da "Assistente Conversazionale" a "Knowledge Engineer"
Un Large Language Model (LLM) utilizzato in modalità convenzionale agisce prevalentemente come assistente conversazionale: genera testo plausibile su base probabilistica, ma è privo di una rappresentazione logica rigorosa del dominio, non mantiene memoria persistente delle relazioni ed è soggetto al rischio di allucinazioni.

Il passaggio metodologico proposto in questo lavoro segna un salto di paradigma: l'LLM non si limita a rispondere a domande puntuali in modo effimero, ma assume il ruolo attivo di **Knowledge Engineer** (ingegnere della conoscenza). In questa veste, l'agente LLM orchestra e governa l'intero ciclo della spirale SECI, strutturando il flusso informativo in un'infrastruttura condivisa e verificabile.

## 3.3 Il Workflow Ibrido a Due Stadi (Discovery & Consolidation) e l'Interfaccia Grafica
Per concretizzare il ruolo dell'LLM come Knowledge Engineer garantendo al contempo l'usabilità ad un operatore non tecnico in ambito Risorse Umane, la piattaforma adotta un'architettura ibrida gestita interamente tramite l'interfaccia grafica Web UI:
1. **Stadio di Discovery (NotebookLM)**: dedicato all'ingestione rapida di fonti primarie eterogenee (PDF, trascrizioni, articoli di ricerca, policy). Questo livello consente la bonifica preliminare del testo, la produzione di sintesi esplorative, FAQ e sintesi audio (Audio Overview).
2. **Stadio di Consolidation (Wiki-Forge Web UI)**: gestisce l'importazione attraverso il pulsante visivo **📥 1. Carica** o il menu **🛠️ Strumenti** ("Importa NotebookLM"), la ristrutturazione atomica della conoscenza tramite il pulsante **⚡ 2. Compila** in note codificate secondo lo standard Open Knowledge Format (OKF v0.2), l'indicizzazione semantica e la connessione visiva in un Knowledge Graph aziendale persistente.

### 3.3.1 Il Ruolo Focale delle Note Atomiche (Atomic Notes)
Il passaggio dal livello di *Discovery* a quello di *Consolidation* rappresenta la transizione cruciale da una conoscenza **centrata sul documento** (file isolati, PDF, riassunti di capitolo) a una conoscenza **centrata sul concetto** (nodi interconnessi di un Knowledge Graph). Il pilastro concettuale di questa trasformazione è rappresentato dal paradigma delle **note atomiche** (*atomic notes*), con radici nel celebre metodo *Zettelkasten* di Niklas Luhmann.

Una nota atomica è un'unità minimale e indipendente di conoscenza digitale che rispetta quattro principi anatomici fondamentali:
1. **Singolarità dell'idea (Atomicità)**: Ogni nota racchiude *una e una sola* idea, concetto, fatto o argomento distintivo. Non costituisce un riassunto generico di un intero capitolo, ma l'estrazione formalizzata di un singolo pensiero chiave.
2. **Autonomia contestuale**: La nota è formulata per risultare pienamente intellegibile in modo autonomo, anche a distanza di tempo e senza la necessità di riaprire il documento sorgente. Il contesto indispensabile viene esplicitato nel corpo della nota stessa.
3. **Provenienza tracciabile**: Ciascuna nota contiene metadati YAML e riferimenti puntuali che rimandano direttamente alla fonte originale (es. "Estratto dal riassunto NotebookLM del documento X, pagina Y, rigo Z"), implementando concretamente la gerarchia dei *Trust Tiers*.
4. **Prontezza alla connessione**: La nota è scritta e strutturata con collegamenti interni (wikilink `[[...]]`) e tag semantici per agevolare l'integrazione immediata all'interno del grafo conoscitivo.

#### Il Ciclo di Trasformazione nell'Interfaccia Grafica
Nel workflow ibrido, le note atomiche vengono generate attraverso una sequenza a tre fasi gestibile visivamente:

* **Fase A — Discovery in NotebookLM (Lavorazione Grezza)**: NotebookLM analizza volumi elevati di fonti primarie e produce sintesi, FAQ e mappe concettuali. Pur essendo di alta qualità, questo output resta un'elaborazione "legata al singolo documento", ovvero una forma di conoscenza fluida, non strutturata e potenzialmente effimera.
* **Fase B — Estrazione ed Ingestione visiva**: L'operatore scarica le sintesi da NotebookLM e le carica in Wiki-Forge cliccando sul pulsante **📥 1. Carica** o utilizzando la funzione "Importa NotebookLM" presente nel menu **🛠️ Strumenti**.
* **Fase C — Compilazione Agentica in Wiki-Forge (La Cristallizzazione Atomica)**: Cliccando sul pulsante **⚡ 2. Compila**, l'agente LLM di Wiki-Forge non si limita ad archiviare il testo grezzo, ma esegue una vera e propria **decostruzione attiva**:
  1. *Scomposizione*: Un paragrafo complesso viene analizzato e suddiviso nei suoi concetti elementari.
  2. *Riformulazione*: Ciascun concetto viene riscritturato in una nota atomica standardizzata con un titolo univoco e descrittivo.
  3. *Tagging Semantico*: Vengono assegnati tag tassonomici (es. `#SECI`, `#RAG`, `#Limiti_RAG`) per abilitare ricerche e raggruppamenti multidimensionali.
  4. *Salvataggio e Connessione*: Le note vengono archiviate nel filesystem (`wiki/`) in formato Markdown/OKF v0.2, tessendo archi di relazione visibili nella **Graph View**.

#### Risoluzione dei Limiti Strutturali del RAG Tradizionale
Come dettagliato nel [[capitoli/01-introduzione|Capitolo 1]], la scomposizione della conoscenza in note atomiche risolve strutturalmente i limiti di effimerità e perdita di contesto del RAG tradizionale. Le note atomiche persistono in modo permanente nel filesystem (`wiki/`) come nodi espliciti interconnessi tramite wikilink e archi semantici, garantendo la conservazione delle relazioni logico-gerarchiche e consentendo l'accumulo progressivo di capitale intellettuale organizzativo.

#### Esempio Pratico nel Contesto della Tesi
Si consideri il seguente riassunto grezzo generato da NotebookLM a partire da una fonte sulla gestione del know-how:

> *"Il modello SECI di Nonaka e Takeuchi si basa sulla conversione tra conoscenza tacita ed esplicita. Un limite dei sistemi RAG attuali è che non supportano la fase di Combinazione, poiché i chunk recuperati non mantengono le relazioni logiche tra i concetti, a differenza di un Knowledge Graph."*

Invece di memorizzare il blocco di testo indistinto, la compilazione agentica di Wiki-Forge lo scompone e cristallizza in due note atomiche distinte e correlate:

**Nota Atomica 1:**
* **Titolo**: `Modello SECI: Conversione Tacito-Esplicito`
* **Contenuto**: Il modello SECI (Nonaka & Takeuchi, 1995) descrive la creazione della conoscenza aziendale come un ciclo continuo di conversione tra conoscenza tacita (esperienza soggettiva e know-how) ed esplicita (conoscenza codificata e formalizzata).
* **Tag**: `#SECI` `#Nonaka_Takeuchi` `#KnowledgeManagement`
* **Fonte**: `[[Paper_Nonaka_1995]]` (via NotebookLM)

**Nota Atomica 2:**
* **Titolo**: `Limite del RAG nella fase di Combinazione (SECI)`
* **Contenuto**: I sistemi RAG tradizionali falliscono nel supportare la fase di *Combinazione* del modello SECI. La scomposizione in chunk vettoriali distrugge i nessi logici e la gerarchia concettuale, impedendo la vera sintesi e riorganizzazione della conoscenza esplicita.
* **Tag**: `#RAG` `#Limiti_RAG` `#SECI_Combinazione`
* **Fonte**: `[[Analisi_Limiti_RAG]]` (via NotebookLM)
* **Relazioni**: Collegato a -> `[[Modello SECI: Conversione Tacito-Esplicito]]`

#### Collocazione nella Spirale SECI: Esternalizzazione e Combinazione
Nell'economia generale del sistema, lo stadio di compilazione delle note atomiche costituisce il momento operativo in cui si realizzano concretamente l'**Esternalizzazione** (fase E) e la **Combinazione** (fase C) della spirale SECI:
* **Esternalizzazione**: Le intuizioni, gli appunti informali e le elaborazioni dialogiche sorte durante l'esplorazione su NotebookLM vengono articolate in concetti espliciti, autonomi e rigorosamente tracciati.
* **Combinazione**: Le note atomiche così create non restano atomi isolati, ma vengono intrecciate nel Knowledge Graph, sintetizzando e riorganizzando diverse fonti di conoscenza esplicita in una rete concettuale coerente e interrogabile via GraphRAG.

### 3.3.2 Il Tagging Semantico come "Ponte Bilingue": Dai Metadati alla Struttura del Grafo
Un elemento centrale nella compilazione delle note atomiche è il **tagging semantico**. Lungi dall'essere un'etichetta decorativa o una semplice parola chiave testuale, il tag semantico funge da **"ponte bilingue"**: traduce l'intenzione e la categorizzazione concettuale dell'utente umano in metadati strutturati che la macchina può processare in modo deterministico. L'operatore può gestire i tag visivamente tramite la finestra **🏷️ Tag Manager**.

Nel workflow di Wiki-Forge, il tagging semantico opera sinergicamente a tre livelli architetturali distinti:

1. **Per l'Utente (Ricercatore / HR Manager): Orientamento Cognitivo e Serendipità**
   - **Ricerca Facettata (Filtraggio congiunto)**: Invece di affidarsi esclusivamente a ricerche testuali indefinite, l'utente può applicare filtri booleani e tassonomici incrociati dall'interfaccia.
   - **Mappatura Mentale e Clustering**: I tag riflettono visivamente l'emergere di cluster tematici nella vista **🕸️ Graph**.
   - **Serendipità Strutturata**: La navigazione per tag semantici fa emergere connessioni non evidenti a prima vista.

2. **Per l'LLM: Disambiguazione Contestuale e "Prompt Conditioning"**
   - **Disambiguazione del Contesto**: Di fronte a termini polisemici (es. la parola *"Rete"*), l'assegnazione del tag `#KnowledgeGraph` impone all'LLM di interpretare la voce come grafo di nodi e archi anziché come rete neurale o infrastruttura di rete dati.
   - **Iniezione Contestuale nei Prompt**: Durante le interrogarioni GraphRAG, i tag consentono di generare prompt fortemente condizionati.
   - **Ponderazione nel Retrieval**: Nel recupero ibrido, la presenza di tag rilevanti promuove in cima ai risultati le note concettualmente pertinenti.

3. **Per il Sistema GraphRAG: Trasformazione da Metadato a Struttura di Grafo**
   - **Nodo e Proprietà di Primo Livello**: In un Knowledge Graph, il tag si evolve da semplice stringa a nodo ontologico.
   - **Ibridazione della Ricerca (Hybrid Search)**: Permette di combinare la similarità vettoriale con query esatte.
   - **Attivazione di Regole di Validazione**: I tag costituiscono la condizione di innesco per i vincoli di governance.

Sotto il profilo del modello SECI, il tagging semantico abilita pienamente la fase di **Combinazione**: non si limita a sommare informazioni, ma le riorganizza secondo una griglia concettuale formale, trasformando la conoscenza esplicita grezza prodotta nella fase di Discovery in un **sistema di conoscenza esplicita interconnesso, validato e interrogabile**.

## 3.4 Le Tre Tecnologie Abilitanti la Spirale SECI
L'integrazione tra l'LLM e la piattaforma si basa su tre pilastri tecnologici e metodologici che potenziano e rendono rigorose le diverse fasi della spirale della conoscenza:

### A. Esternalizzazione Affidabile tramite "Trust Tiers" (Tracciabilità delle Fonti)
Nella fase di Esternalizzazione, la trasformazione del know-how grezzo o degli appunti informali in conoscenza esplicita richiede garanzie di affidabilità. I **Trust Tiers** (livelli di fiducia: `unverified`, `machine-confirmed`, `human-reviewed`) assegnano uno stato di validazione trasparente reso visibile da bollini colorati nell'editor e nella barra laterale. Attraverso il comando `/trace` nella chat o cliccando sui riferimenti, ogni concetto estratto resta collegato alla riga sorgente originale (`#L<start>-L<end>`).

#### Esempio Pratico di Workflow di Validazione dei Trust Tiers
Per comprendere concretamente la dinamica operativa con cui la tracciabilità viene garantita nell'interfaccia utente, si consideri la seguente sequenza di validazione passo-passo durante l'ingestione di un nuovo documento di policy aziendale sui contratti di lavoro:

1. **Ingestione ed Assegnazione del Livello Iniziale (`unverified` - 🟡)**:
   L'operatore HR carica un documento PDF contenente il nuovo regolamento interno aziendale tramite l'opzione **📥 1. Carica**. Il sistema archivia il file sorgente nella cartella `raw/` e genera una nota preliminare nel filesystem con frontmatter YAML contenente `verified: []` e la proprietà `trustTier: "unverified"`. Nella barra laterale e nell'editor della Web UI, la nota appare contrassegnata da un **bollino giallo**, ad indicare che il contenuto è stato importato ma non ha ancora subito alcuna verifica strutturale o sintattica.

2. **Compilazione Agentica e Riscontro Sintattico (`machine-confirmed` - 🔵)**:
   L'operatore attiva la funzione **⚡ 2. Compila**. L'agente LLM estrae le informazioni rilevanti decostruendole in note atomiche e collega ogni affermazione alla riga esatta del file sorgente (es. `raw/regolamento-contratti.md#L45-L52`). Contestualmente, il motore di linting OKF e il parser ontologico eseguono una verifica automatica sulla conformità della sintassi Markdown e dei wikilink. Se i controlli sintattici e i vincoli ontologici SHACL di base sono soddisfatti, il sistema aggiorna automaticamente lo stato a `machine-confirmed` (visualizzato con **bollino blu** nell'interfaccia), attestando che la nota è ben formata e correttamente ancorata alle citazioni di origine.

3. **Revisione Umana via Review Queue e Promozione (`human-reviewed` - 🟢)**:
   Nonostante la conformità sintattica, la decisione di integrare la norma nel patrimonio ufficiale aziendale richiede una validazione di merito. La nota compilata viene inviata alla finestra **📥 Review Queue** dell'interfaccia utente. L'HR Specialist (o il *Knowledge Curation Officer*) apre la scheda di revisione, analizza il testo estratto a fronte del frammento sorgente evidenziato tramite la funzione di ancoraggio puntuale, ed eventualmente apporta correzioni editoriali. Cliccando sul pulsante visivo **"Approva e Promuovi"** (o eseguendo il comando `/verify`), il sistema aggiorna il frontmatter con l'identificativo del revisore umano (es. `verified: [{by: "human:mario.rossi", at: "2026-10-12T10:30:00Z"}]`) e commuta il Trust Tier a `human-reviewed` (**bollino verde**). Da questo momento, la nota assume la massima priorità di recupero durante le interrogarioni GraphRAG e viene definitivamente incorporata nel Knowledge Graph accreditato.

### B. Combinazione Rigorosa e Governance Ontologica tramite Vincoli W3C SHACL
Durante la fase di **Combinazione**, la conoscenza esplicita decostruita e ricompilata dall'agente LLM non deve limitarsi a confluire in un archivio indistinto: deve integrarsi in modo coerente nel Knowledge Graph senza introdurre incoerenze o frammentazioni. Per garantire l'integrità strutturale della Knowledge Base, la piattaforma adotta lo standard **W3C SHACL (Shapes Constraint Language)**.

I vincoli W3C espressi in SHACL agiscono come un **"controllo di qualità automatico e deterministico"** dei dati.

#### 1. L'Analogia Concettuale: Il Modulo con Campi Obbligatori
In un sistema informativo aziendale o in una biblioteca, la compilazione di una scheda informativa richiede il rispetto di vincoli precisi (es. il campo *"Titolo"* è obbligatorio, *"Anno di pubblicazione"* deve essere un numero a quattro cifre, *"Tipo fonte"* deve appartenere a un vocabolario controllato). SHACL trasforma queste regole formali in **Forme** (*Shapes*, designate come `sh:Shape`) archiviate in file di configurazione ontologica (`shapes.ttl` in sintassi Turtle RDF).

#### 2. Definizione Tecnica delle Forme in `shapes.ttl`
Una forma SHACL descrive le condizioni di validità alle quali un nodo (es. una Nota Atomica) o le sue proprietà devono sottostare. Di seguito si riporta un frammento rappresentativo del file `shapes.ttl` implementato nel sistema per validare le note compilate dall'agente Wiki-Forge:

```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix tesi: <http://example.org/tesi/ontology#> .

# Definizione della "Forma" (NodeShape) per la validazione di una Nota Atomica
tesi:NotaAtomicaShape
    a sh:NodeShape ;
    sh:targetClass tesi:NotaAtomica ; # La regola si applica a tutte le istanze di Nota Atomica

    # VINCOLO 1: Cardinalità (Obbligatorietà del Titolo)
    sh:property [
        sh:path tesi:haTitolo ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Ogni nota atomica deve possedere esattamente un titolo univoco." ;
    ] ;

    # VINCOLO 2: Tipo di Dato Formale (Data Type)
    sh:property [
        sh:path tesi:dataCreazione ;
        sh:datatype xsd:date ;
        sh:message "La data di creazione deve rispettare tassativamente il formato ISO xsd:date (AAAA-MM-GG)." ;
    ] ;

    # VINCOLO 3: Insieme Chiuso di Valori Ammessi (Value Range / Vocabolario Controllato)
    sh:property [
        sh:path tesi:trustTier ;
        sh:in ( "unverified" "machine-confirmed" "human-reviewed" ) ;
        sh:message "Il Trust Tier deve corrispondere a uno dei livelli previsti dallo standard OKF." ;
    ] .
```

#### 3. Il Processo di Validazione Deterministico a Quattro Fasi e la Coda di Revisione UI
Il sistema di governance non si affida alla sola correttezza probabilistica dell'LLM, ma esegue una verifica automatizzata in quattro fasi:
1. **Input 1 — Data Graph (Grafo dei Dati)**: Il set di note atomiche prodotte dall'agente.
2. **Input 2 — Shapes Graph (Grafo delle Forme)**: Il file `shapes.ttl` contenente le regole ontologiche W3C.
3. **Elaborazione — Motore di Validazione SHACL**: Un motore di validazione dedicato esegue la verifica incrociata.
4. **Output — Validation Report e Gatekeeper**: Se una nota viola un vincolo, viene collocata nella finestra **📥 Review Queue** visibile nella Web UI, consentendo all'utente di approvarla, modificarla o rifiutarla prima della promozione nel grafo principale.

### C. Internalizzazione Potenziata tramite "GraphRAG" (Interrogazione Traversale nella Chat UI)
Per favorire l'Internalizzazione, l'operatore interroga la piattaforma dalla chat **💬 3. Chiedi** usando comandi come `/consult` e `/deep-research`. Il sistema **GraphRAG (Graph Retrieval-Augmented Generation)** naviga le relazioni a grafo multi-hop per fornire risposte argomentate, direttamente collegate alle righe sorgente.

## 3.5 Sintesi del Valore Aggiunto per l'Organizzazione
L'architettura descritta realizza un ecosistema di *Knowledge Management* di nuova generazione in cui:
* Il **modello SECI** fornisce il quadro teorico di riferimento su come la conoscenza si genera e si trasforma;
* L'**LLM** agisce come motore operativo (Knowledge Engineer) guidato visivamente dall'interfaccia utente;
* **Trust Tiers, SHACL e GraphRAG** costituiscono i binari tecnologici che assicurano rispettivamente **tracciabilità**, **correttezza ontologica** e **capacità analitica traversale**.

In questo modo, la funzione aziendale non adotta un banale chatbot usa-e-getta, bensì un'infrastruttura di conoscenza governata, scalabile e gestibile da operatori non tecnici.

## 3.6 Esportazione Accademica della Tesi in PDF
Quando il materiale accumulato ha raggiunto una maturità adeguata, l'operatore scrive il comando `/thesis-chapter` nella chat **💬 3. Chiedi** per aggregare i capitoli e clicca sul pulsante **Esporta PDF Tesi** nel menu **🛠️ Strumenti**. L'infrastruttura compila il documento unificato Markdown ed estrae il PDF pronto per la stampa e la presentazione accademica.

## Collegamenti Correlati
- [[capitoli/01-introduzione|Capitolo 1: Introduzione]]
- [[capitoli/02-studio-degli-attori-principali|Capitolo 2: Studio degli Attori Principali]]
- [[capitoli/04-mappatura-e-automazione-hr|Capitolo 4: Mappatura e Automazione HR]]
- [[capitoli/05-considerazioni-personali|Capitolo 5: Considerazioni Personali]]
- [[linee-guida-tesi-hr]]
