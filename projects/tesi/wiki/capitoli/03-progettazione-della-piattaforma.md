---
type: Concept
title: "Capitolo 3: Progettazione della Piattaforma di Gestione della Conoscenza Ibrida"
description: "Architettura ibrida tra NotebookLM (Discovery) e Wiki-Forge (Consolidation): modello SECI, LLM come Knowledge Engineer, Trust Tiers, SHACL e GraphRAG"
status: draft
maturita: 75
tags: [thesis/chapter, topic/architecture, topic/wiki-forge, topic/seci, status/draft]
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

## 3.4 Le Tre Tecnologie Abilitanti la Spirale SECI
L'integrazione tra l'LLM e la piattaforma si basa su tre pilastri tecnologici e metodologici che potenziano e rendono rigorose le diverse fasi della spirale della conoscenza:

### A. Esternalizzazione Affidabile tramite "Trust Tiers" (Tracciabilità delle Fonti)
Nella fase di Esternalizzazione, la trasformazione del know-how grezzo o degli appunti informali in conoscenza esplicita richiede garanzie di affidabilità. I **Trust Tiers** (livelli di fiducia: `unverified`, `machine-confirmed`, `human-reviewed`) assegnano uno stato di validazione trasparente a ogni affermazione o nota generata. Attraverso meccanismi di *source grounding* e ancoraggio puntuale al rigo di origine (`#L<start>-L<end>`), ogni concetto estratto dall'LLM resta collegato alla fonte primaria. Ciò elimina le allucinazioni e rende l'esternalizzazione tracciabile, verificabile e auditabile.

### B. Combinazione Rigorosa tramite "W3C SHACL" (Validazione Ontologica)
Durante la fase di Combinazione, le diverse tessere di conoscenza esplicita estratte dall'LLM devono convergere in un sistema coerente. Per evitare che l'agente introduca relazioni illogiche o ridondanti nel grafo, la piattaforma integra lo standard W3C **SHACL (Shapes Constraint Language)**. SHACL funge da "validatore di qualità ontologico" eseguendo vincoli definiti (`shapes.ttl`): verifica la correttezza delle tipologie di entità, la presenza di metadati obbligatori e la validità delle relazioni interconnesse. Questo trasforma l'LLM da semplice generatore di testo libero ad architetto di conoscenza strutturalmente valida e interoperabile.

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
