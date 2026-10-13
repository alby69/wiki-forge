---
type: Concept
title: "Capitolo 3: Progettazione della Piattaforma di Gestione della Conoscenza Ibrida"
description: "Architettura ibrida tra NotebookLM (Discovery) e Wiki-Forge (Consolidation): modello SECI, note atomiche, LLM come Knowledge Engineer, Trust Tiers, SHACL e GraphRAG"
status: draft
maturita: 80
tags: [thesis/chapter, topic/architecture, topic/wiki-forge, topic/seci, topic/atomic-notes, status/draft]
generated:
  by: process:jules-agent
  at: "2026-10-12T00:00:00Z"
verified:
  - by: human:autore
    at: "2026-10-12T00:00:00Z"
sources:
  - id: thesis-design-doc
    resource: raw/thesis-design-doc.md
    title: "Documento di Progettazione della Tesi Magistrale"
---

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

## 3.3 Il Workflow Ibrido a Due Stadi (Discovery & Consolidation)
Per concretizzare il ruolo dell'LLM come Knowledge Engineer, la piattaforma adotta un'architettura ibrida strutturata su due stadi operativi complementari:
1. **Stadio di Discovery (NotebookLM)**: dedicato all'ingestione rapida di fonti primarie eterogenee (PDF, trascrizioni, articoli di ricerca, policy). Questo livello consente la bonifica preliminare del testo, la produzione di sintesi esplorative, FAQ e sintesi audio (Audio Overview).
2. **Stadio di Consolidation (Wiki-Forge)**: gestisce l'importazione automatizzata (tramite `notebooklm_import.py`), la ristrutturazione atomica della conoscenza in note codificate secondo lo standard Open Knowledge Format (OKF v0.2), l'indicizzazione semantica e la connessione in un Knowledge Graph aziendale persistente.

### 3.3.1 Il Ruolo Focale delle Note Atomiche (Atomic Notes)
Il passaggio dal livello di *Discovery* a quello di *Consolidation* rappresenta la transizione cruciale da una conoscenza **centrata sul documento** (file isolati, PDF, riassunti di capitolo) a una conoscenza **centrata sul concetto** (nodi interconnessi di un Knowledge Graph). Il pilastro concettuale di questa trasformazione è rappresentato dal paradigma delle **note atomiche** (*atomic notes*), con radici nel celebre metodo *Zettelkasten* di Niklas Luhmann.

Una nota atomica è un'unità minimale e indipendente di conoscenza digitale che rispetta quattro principi anatomici fondamentali:
1. **Singolarità dell'idea (Atomicità)**: Ogni nota racchiude *una e una sola* idea, concetto, fatto o argomento distintivo. Non costituisce un riassunto generico di un intero capitolo, ma l'estrazione formalizzata di un singolo pensiero chiave.
2. **Autonomia contestuale**: La nota è formulata per risultare pienamente intellegibile in modo autonomo, anche a distanza di tempo e senza la necessità di riaprire il documento sorgente. Il contesto indispensabile viene esplicitato nel corpo della nota stessa.
3. **Provenienza tracciabile**: Ciascuna nota contiene metadati YAML e riferimenti puntuali che rimandano direttamente alla fonte originale (es. "Estratto dal riassunto NotebookLM del documento X, pagina Y, rigo Z"), implementando concretamente la gerarchia dei *Trust Tiers*.
4. **Prontezza alla connessione**: La nota è scritta e strutturata con collegamenti interni (wikilink `[[...]]`) e tag semantici per agevolare l'integrazione immediata all'interno del grafo conoscitivo.

#### Il Ciclo di Trasformazione: da NotebookLM a Wiki-Forge
Nel workflow ibrido, le note atomiche vengono generate attraverso una sequenza a tre fasi che formalizza la transizione della conoscenza:

* **Fase A — Discovery in NotebookLM (Lavorazione Grezza)**: NotebookLM analizza volumi elevati di fonti primarie e produce sintesi, FAQ e mappe concettuali. Pur essendo di alta qualità, questo output resta un'elaborazione "legata al singolo documento", ovvero una forma di conoscenza fluida, non strutturata e potenzialmente effimera.
* **Fase B — Estrazione tramite `notebooklm_import.py` (Il Ponte)**: Lo script di importazione agisce da ponte tecnico, estraendo i testi elaborati da NotebookLM e separandoli dall'ambiente di chat chiuso per renderli disponibili al processo di compilazione.
* **Fase C — Compilazione Agentica in Wiki-Forge (La Cristallizzazione Atomica)**: In questa fase, l'agente LLM di Wiki-Forge non si limita ad archiviare il testo grezzo, ma esegue una vera e propria **decostruzione attiva**:
  1. *Scomposizione*: Un paragrafo complesso viene analizzato e suddiviso nei suoi concetti elementari.
  2. *Riformulazione*: Ciascun concetto viene riscritturato in una nota atomica standardizzata con un titolo univoco e descrittivo.
  3. *Tagging Semantico*: Vengono assegnati tag tassonomici (es. `#SECI`, `#RAG`, `#Limiti_RAG`) per abilitare ricerche e raggruppamenti multidimensionali.
  4. *Salvataggio e Connessione*: Le note vengono archiviate nel filesystem (`wiki/`) in formato Markdown/OKF v0.2, tessendo archi di relazione con le note preesistenti.

#### Risoluzione dei Limiti Strutturali del RAG Tradizionale
Le note atomiche rappresentano la risposta diretta ai due principali difetti del RAG convenzionale evidenziati nel [[capitoli/01-introduzione|Capitolo 1]]:

| Limite del RAG Tradizionale | Soluzione delle Note Atomiche in Wiki-Forge |
| :--- | :--- |
| **Risposte effimere** (nessun accumulo di capitale intellettuale) | Le note atomiche **persistono** nel filesystem (`wiki/`). Ogni estrazione e riflessione arricchisce in modo permanente la base di conoscenza della tesi o dell'organizzazione. |
| **Perdita di struttura logica** (chunking arbitrario che distrugge le relazioni) | Le note atomiche diventano **nodi espliciti**. Anziché affidarsi esclusivamente alla similarità vettoriale tra frammenti opachi, il sistema stabilisce **archi semantici e wikilink espliciti** tra le note (es. `[[Modello SECI]]` collegato a `[[Esternalizzazione]]`). |

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
Un elemento centrale nella compilazione delle note atomiche è il **tagging semantico**. Lungi dall'essere un'etichetta decorativa o una semplice parola chiave testuale, il tag semantico funge da **"ponte bilingue"**: traduce l'intenzione e la categorizzazione concettuale dell'utente umano in metadati strutturati che la macchina può processare in modo deterministico.

Nel workflow di Wiki-Forge, il tagging semantico opera sinergicamente a tre livelli architetturali distinti:

1. **Per l'Utente (Ricercatore / HR Manager): Orientamento Cognitivo e Serendipità**
   - **Ricerca Facettata (Filtraggio congiunto)**: Invece di affidarsi esclusivamente a ricerche testuali indefinite, l'utente può applicare filtri booleani e tassonomici incrociati (es. *"Mostrami tutte le note che possiedono sia il tag `#SECI` sia il tag `#limiti_RAG`"*).
   - **Mappatura Mentale e Clustering**: I tag riflettono visivamente l'emergere di cluster tematici nella wiki. Se il tag `#SHACL` co-occorre frequentemente con `#validazione` o `#governance`, il sistema evidenzia automaticamente l'opportunità di consolidare quella convergenza in un paragrafo o capitolo dedicato.
   - **Serendipità Strutturata**: La navigazione per tag semantici fa emergere connessioni non evidenti a prima vista (es. raccordi tra concetti di filosofia dell'informazione e pattern di ingegneria del software ontologica).

2. **Per l'LLM: Disambiguazione Contestuale e "Prompt Conditioning"**
   - **Disambiguazione del Contesto**: Di fronte a termini polisemici (es. la parola *"Rete"*), l'assegnazione del tag `#KnowledgeGraph` impone all'LLM di interpretare la voce come grafo di nodi e archi anziché come rete neurale o infrastruttura di rete dati, riducendo le allucinazioni semantiche.
   - **Iniezione Contestuale nei Prompt**: Durante le interrogarioni GraphRAG, i tag consentono di generare prompt fortemente condizionati (es. *"Basandoti unicamente sulle note con tag `#SECI` e `#Combinazione`, spiega come..."*), delimitando lo spazio di ricerca e riducendo il rumore informativo.
   - **Ponderazione nel Retrieval**: Nel recupero ibrido, la presenza di tag rilevanti conferisce un punteggio di incremento (*boost*) alla similarità vettoriale, promuovendo in cima ai risultati le note concettualmente pertinenti.

3. **Per il Sistema GraphRAG: Trasformazione da Metadato a Struttura di Grafo**
   - **Nodo e Proprietà di Primo Livello**: In un Knowledge Graph, il tag si evolve da semplice stringa a nodo ontologico o attributo di primo livello.
   - **Ibridazione della Ricerca (Hybrid Search)**: Permette di combinare la similarità vettoriale ("sfocata" e probabilistica) con query booleane o SPARQL/Cypher ("rigide" ed esatte). Ad esempio, consente di eseguire query complesse come: *"Trova i concetti vettorialmente vicini ad 'allucinazione', ma che siano obbligatoriamente collegati al nodo `#W3C_SHACL`"*.
   - **Attivazione di Regole di Validazione**: I tag costituiscono la condizione di innesco per i vincoli di governance (es. se una nota contiene il tag `#fonte_primaria`, il motore di validazione esige la presenza dei metadati `ha_url_origine` o `ha_autore`).

Sotto il profilo del modello SECI, il tagging semantico abilita pienamente la fase di **Combinazione**: non si limita a sommare informazioni, ma le riorganizza secondo una griglia concettuale formale, trasformando la conoscenza esplicita grezza prodotta nella fase di Discovery in un **sistema di conoscenza esplicita interconnesso, validato e interrogabile**.

## 3.4 Le Tre Tecnologie Abilitanti la Spirale SECI
L'integrazione tra l'LLM e la piattaforma si basa su tre pilastri tecnologici e metodologici che potenziano e rendono rigorose le diverse fasi della spirale della conoscenza:

### A. Esternalizzazione Affidabile tramite "Trust Tiers" (Tracciabilità delle Fonti)
Nella fase di Esternalizzazione, la trasformazione del know-how grezzo o degli appunti informali in conoscenza esplicita richiede garanzie di affidabilità. I **Trust Tiers** (livelli di fiducia: `unverified`, `machine-confirmed`, `human-reviewed`) assegnano uno stato di validazione trasparente a ogni affermazione o nota generata. Attraverso meccanismi di *source grounding* e ancoraggio puntuale al rigo di origine (`#L<start>-L<end>`), ogni concetto estratto dall'LLM resta collegato alla fonte primaria. Ciò elimina le allucinazioni e rende l'esternalizzazione tracciabile, verificabile e auditabile.

### B. Combinazione Rigorosa e Governance Ontologica tramite Vincoli W3C SHACL
Durante la fase di **Combinazione**, la conoscenza esplicita decostruita e ricompilata dall'agente LLM non deve limitarsi a confluire in un archivio indistinto: deve integrarsi in modo coerente nel Knowledge Graph senza introdurre incoerenze o frammentazioni. Nei database a grafo basati su RDF, la flessibilità nativa dei dati privi di uno schema rigido a priori rappresenta un punto di forza ma anche un rischio per la governance. Per garantire l'integrità strutturale della Knowledge Base, la piattaforma adotta lo standard **W3C SHACL (Shapes Constraint Language)**.

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

#### 3. Il Processo di Validazione Deterministico a Quattro Fasi
Il sistema di governance non si affida alla sola correttezza probabilistica dell'LLM, ma esegue una verifica automatizzata in quattro fasi:
1. **Input 1 — Data Graph (Grafo dei Dati)**: Il set di note atomiche in formato OKF/Markdown/RDF prodotte dall'agente.
2. **Input 2 — Shapes Graph (Grafo delle Forme)**: Il file `shapes.ttl` contenente le regole ontologiche W3C.
3. **Elaborazione — Motore di Validazione SHACL**: Un motore di validazione dedicato (es. `PySHACL` in ambito Python) esegue la verifica incrociata tra Data Graph e Shapes Graph.
4. **Output — Validation Report e Gatekeeper**: Viene generato un report di validazione (`sh:ValidationReport`). Se una nota viola un vincolo (es. l'LLM omette il `trustTier` o assegna una data in testo libero), la nota viene **bloccata** e collocata nella coda di revisione (`/api/reviews`), impedendone la promozione nel Knowledge Graph principale finché non viene corretta.

#### 4. Ruolo Strategico nella Prevenzione delle Allucinazioni Strutturali
L'integrazione dei vincoli W3C SHACL risolve criticità fondamentali per la stabilità dei sistemi basati su LLM e Knowledge Graph:
* **Antidoto alle Allucinazioni Strutturali**: Sebbene un LLM possa produrre inesattezze nel testo libero, i vincoli SHACL costituiscono un *firewall* strutturale impassibile, impedendo la creazione di nodi orfani, relazioni sintatticamente invalide o l'omissione di metadati di provenienza.
* **Preservazione dell'Integrità per GraphRAG**: Le query traversali complesse (es. *"Recupera le note collegate a fonti ad alto Trust Tier che analizzano i limiti del RAG"*) presuppongono l'esistenza rigorosa dei percorsi relazionali (`sh:path`). SHACL garantisce la presenza e la coerenza dei percorsi su cui viaggiano le query Cypher e SPARQL.
* **Codifica Informatica della Combinazione SECI**: I vincoli SHACL rappresentano la formalizzazione software del principio di Combinazione di Nonaka & Takeuchi, trasformando una raccolta disarticolata di documenti in una **base di conoscenza ingegnerizzata, coerente e auditabile**.

### C. Internalizzazione Potenziata tramite "GraphRAG" (Interrogazione Traversale)
Per favorire l'Internalizzazione, gli utenti dell'organizzazione devono poter recuperare in modo fluido ed esaustivo il sapere accumulato per risolvere problemi complessi. Il sistema **GraphRAG (Graph Retrieval-Augmented Generation)** supera i limiti del RAG vettoriale tradizionale (spesso cieco alle connessioni concettuali multi-hop). Sfruttando la struttura a grafo in cui i nodi rappresentano concetti/entità e gli archi esplicitano le relazioni, GraphRAG permette all'LLM di eseguire navigazioni traversali k-hop. Le risposte agli utenti risultano così contestualizzate, logicamente connesse e direttamente riconducibili alle fonti, accelerando il processo di apprendimento e assimilazione individuale.

## 3.5 Sintesi del Valore Aggiunto per l'Organizzazione
L'architettura descritta realizza un ecosistema di *Knowledge Management* di nuova generazione in cui:
* Il **modello SECI** fornisce il quadro teorico di riferimento su come la conoscenza si genera e si trasforma;
* L'**LLM** agisce come motore operativo (Knowledge Engineer) che guida ed esegue le fasi della spirale;
* **Trust Tiers, SHACL e GraphRAG** costituiscono i binari tecnologici che assicurano rispettivamente **tracciabilità**, **correttezza ontologica** e **capacità analitica traversale**.

In questo modo, la funzione aziendale non adotta un banale chatbot usa-e-getta, bensì un'infrastruttura di conoscenza governata, scalabile e in grado di valorizzare il patrimonio informativo nel tempo.

## 3.6 Analisi Critica delle Scelte Architetturali
* **Punti di Forza**: Superamento dei silos informativi, persistenza della conoscenza compilata, tracciabilità al rigo sorgente (`#L10-L25`), validazione formale automatizzata.
* **Punti di Debolezza e Mitigazioni**: Curva di apprendimento tecnica, necessità di governance *human-in-the-loop* per le decisioni critiche.

## Collegamenti Correlati
- [[capitoli/01-introduzione|Capitolo 1: Introduzione]]
- [[capitoli/04-mappatura-e-automazione-hr|Capitolo 4: Mappatura e Automazione HR]]
- [[capitoli/05-considerazioni-personali|Capitolo 5: Considerazioni Personali]]
- [[strumenti/index|Strumenti]]
- [[tools/index|Tools]]
- [[linee-guida-tesi-hr]]
