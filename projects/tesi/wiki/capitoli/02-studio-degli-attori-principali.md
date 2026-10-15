---
type: Concept
title: 'Capitolo 2: Studio degli Attori Principali del Settore AI'
description: 'Analisi degli attori tecnici dell''AI (Karpathy, Hinton, Anthropic) e prospettive critiche e sociologiche (Cristianini, Graeber)'
status: draft
tags:
  - thesis/chapter
  - topic/ai
  - topic/actors
  - status/draft
  - author/karpathy
  - author/cristianini
  - author/graeber
generated:
  by: process:jules-agent
  at: '2026-10-12T00:00:00Z'
verified:
  - by: human:autore
    at: '2026-10-12T00:00:00Z'
sources:
  - id: thesis-design-doc
    resource: raw/thesis-design-doc.md
    title: Documento di Progettazione della Tesi Magistrale
maturita: 90
copertura_fonti: 1
domande_risolte: 0
stato: draft
---

# Capitolo 2: Studio degli Attori Principali del Settore AI — Attori Tecnici e Prospettive Critiche

## 2.1 Attori Tecnici e Visioni dell'Infrastruttura Cognitiva
Come abbiamo visto analizzando i limiti dei sistemi convenzionali, l'interazione con un LLM "alla chatbot" è, per sua natura, un'esperienza effimera: ogni conversazione parte dal nulla, le risposte svaniscono alla chiusura della finestra e nulla di quanto prodotto viene conservato, collegato o reso interrogabile in modo cumulativo. È proprio da questo scenario — che nella prima parte della tesi abbiamo descritto come fragile e destinato a ripetere sempre gli stessi cicli domanda-risposta senza mai costruire capitale — che prende forma la riflessione di **Andrej Karpathy** (`[[autori/andrej-karpathy]]`), uno dei ricercatori più influenti del panorama AI contemporaneo.

Karpathy parte da un'osservazione tanto semplice quanto radicale: se l'LLM è destinato a diventare il nuovo *sistema operativo* con cui le persone e le organizzazioni gestiscono la conoscenza, allora non può rimanere confinato dentro una finestra di chat stazionaria. Il modello del "chatbot usa-e-getta" — per cui si pone una domanda, si riceve una risposta plausibile e poi si chiude tutto — è, in questa prospettiva, una fase transitoria, paragonabile ai primi anni del personal computer in cui si digitavano comandi senza ancora immaginare file, cartelle e documenti persistenti. L'alternativa che Karpathy teorizza è un vero e proprio salto di paradigma: l'agente LLM non fornisce solo delle risposte, ma **mantiene e fa evolvere nel tempo una wiki persistente in Markdown**, cioè un archivio vivo di note strutturate, interlinkate e leggibili dall'uomo, che cresce a ogni interazione anziché azzerarsi. La conoscenza smette di essere un prodotto effimero per diventare un bene permanente e accumulabile: ogni nuova fonte, ogni nuova domanda e ogni nuova sintesi arricchiscono un patrimonio che resta consultabile, revisionabile e condiviso.

In questo lavoro di tesi, tale principio viene tradotto in pratica attraverso la **Web UI di Wiki-Forge** descritta nel [[capitoli/03-progettazione-della-piattaforma|Capitolo 3]]. Il punto cruciale è che la visione di Karpathy non resta un esercizio teorico riservato a ingegneri e sviluppatori: l'operatore HR — tipicamente non tecnico, abituato a interfacce visive e non a righe di comando — guida l'agente in prima persona attraverso pulsanti e finestre (📥 Carica, ⚡ Compila, 💬 Chiedi), trasformando materiale di ricerca grezzo e frammentario in un capitale di conoscenza strutturato, navigabile e durable. È così che l'AI smette di essere un interlocutore temporaneo per diventare l'infrastruttura cognitiva su cui l'organizzazione costruisce, giorno dopo giorno, la propria memoria collettiva.
- **Geoffrey Hinton**: I rischi esistenziali, la convergenza tra reti neurali ed intelligenza biologica, l'insorgenza di sottobiettivi strumentali (`[[autori/geoffrey-hinton]]`).
- **Laboratori e Sviluppi Recenti (Anthropic, OpenAI, Dario Amodei)**: Le architetture agentiche, i modelli di ragionamento sequenziale e i workflow autonomi coordinati (`[[architetture-multi-agente]]`). Nei laboratori di frontiera, la ricerca si è progressivamente spostata dal semplice incremento di parametri dei singoli modelli verso l'orchestratore di *agentic workflows* e meccanismi di *multi-agent debate*, in cui più istanze agentiche collaborano o si verificano a vicenda per eseguire task ad alta complessità concettuale.

In ambito Risorse Umane, l'applicazione di architetture multi-agente trasforma radicalmente i processi di selezione, valutazione del personale e audit organizzativo. A differenza di un LLM standard che si limita a riassumere passivamente un CV, una pipeline agentica avanzata può simulare una dialettica strutturata tra ruoli specializzati: ad esempio, un "agente reclutatore" (orientato al matching tecnico e all'aderenza alla job description) interagisce in parallelo con un "agente di compliance etica e D&I" (istruito a rilevare marcatori impliciti di bias o discriminazioni indirette). I due agenti analizzano il profilo candidale da prospettive complementari, generando un bilancio sintetico di punti di forza, criticità e rischi prima che la pratica venga sottoposta all'attenzione dell'HR Specialist.

Tale approccio sfrutta le [[capacita-emergenti-llm|capacità emergenti degli LLM]] mantenendo un elevato grado di ispezionabilità. Tuttavia, lo sviluppo di agenti autonomi in contesti organizzativi ad alto impatto sociale richiede rigorosi presidi di controllo per garantire che la delega di task operativi non sfoci in opacità decisionale, riaffermando il principio per cui l'autonomia agentica deve rimanere sempre subordinata alla validazione e alla responsabilità etica del curatore umano.

## 2.2 Prospettive Critiche, Umanistiche e Sociologiche
- **Nello Cristianini**: La "scorciatoia statistica", la definizione comportamentale dell'intelligenza, la valutazione della dignità umana nel lavoro e i limiti delle tecniche di de-biasing nei CV (`[[autori/nello-cristianini]]`). Cristianini evidenzia come i modelli apprendano pattern statistici dai dati storici senza comprendere le dinamiche sociali sottostanti, rendendo indispensabile un presidio di governance umana nei processi di selezione e gestione del personale.
- **David Graeber**: La teoria dei *Bullshit Jobs*, la distinzione tra lavoro igienico/burocratico e valore reale, le implicazioni dell'automazione sulle mansioni aziendali (`[[autori/david-graeber]]`). Graeber analizza come la burocratizzazione e la proliferazione di compiti privi di valore reale affliggano le organizzazioni moderne. L'adozione di un'infrastruttura di Knowledge Engineering permette di automatizzare la "routine igienica" (sintesi di documenti, prima catalogazione, tracciamento delle fonti), liberando tempo per il "lavoro di cura" e le relazioni umane nell'HR.

## 2.3 Tensioni Concettuali e Sintesi per la Gestione HR
Mappatura delle convergenze e divergenze tra la visione tecnocratica della produttività e le istanze sociologiche di tutela del lavoro e della dignità umana. La convergenza tra questi autori evidenzia che la tecnologia da sola non risolve le inefficienze organizzative se non è guidata da una chiara modellazione del dominio. La piattaforma Wiki-Forge opera come ponte tra queste due visioni: sfrutta le capacità degli LLM (ispirandosi al modello di Karpathy) ma ne imbriglia il comportamento tramite vincoli ontologici e presidi di revisione umana, garantendo il rispetto delle istanze etiche sollevate da Cristianini e Graeber.

## Collegamenti Correlati
- [[autori/andrej-karpathy|Andrej Karpathy]]
- [[autori/david-graeber|David Graeber]]
- [[autori/geoffrey-hinton|Geoffrey Hinton]]
- [[autori/nello-cristianini|Nello Cristianini]]
- [[bullshit-jobs-e-routine-igienica]]
- [[capacita-emergenti-llm]]
- [[capitoli/03-progettazione-della-piattaforma|Capitolo 3: Progettazione della Piattaforma]]
