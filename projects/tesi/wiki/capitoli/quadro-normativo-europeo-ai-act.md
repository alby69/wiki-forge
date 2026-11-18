---
type: Concept
title: 'Il Quadro Normativo Europeo: UE AI Act e Tutela del Lavoratore'
description: 'Analisi del Regolamento (UE) 2024/1689: approccio antropocentrico, piramide
  del rischio nel settore HR, obblighi di provider e deployer, supervisione umana,
  sanzioni e sovranità digitale.'
status: draft
tags:
- topic/ai
- topic/hr
- type/essay
- status/draft
generated:
  by: process:wiki-forge-compile
  at: '2026-11-18T13:48:15Z'
verified: []
sources:
- id: capitolo-5-ai-act
  resource: raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore
    nell'Era Algoritmica.md
  title: 'Capitolo 5: Il Quadro Normativo Europeo: L''UE AI Act e la Tutela del Lavoratore
    nell''Era Algoritmica'
  author: human:autore
  last_modified: '2026-11-18'
maturita: 40
copertura_fonti: 1
domande_risolte: 0
stato: draft
---
# Il Quadro Normativo Europeo: UE AI Act e Tutela del Lavoratore

Il capitolo ricostruisce il perimetro giuridico entro cui l'IA trasforma il lavoro nell'Unione Europea, assumendo il Regolamento (UE) 2024/1689 — **UE AI Act** — come riferimento organico. La tesi è che l'AI Act non sostituisca il diritto del lavoro esistente, ma vi aggiunga un livello di protezione "algoritmo-specifico" fondato su trasparenza, tracciabilità e supervisione umana, calibrando gli obblighi sulla base del rischio per i diritti fondamentali.

## Summary

- L'**UE AI Act** è il primo regolamento orizzontale e organico al mondo sull'IA: basato sugli artt. 114 e 16 TFUE, persegue un'IA antropocentrica e lascia impregiudicato il diritto del lavoro, integrandolo con garanzie di trasparenza, tracciabilità e sorveglianza umana.
- Il modello è **risk-based** e a quattro livelli; il settore HR è ritenuto intrinsecamente ad alto rischio per l'asimmetria economica e gerarchica tra datore di lavoro e lavoratore o candidato.
- L'**art. 5** vieta il riconoscimento delle emozioni sul luogo di lavoro e la categorizzazione biometrica basata su dati sensibili, con una deroga ristretta a finalità mediche o di sicurezza.
- L'**Allegato III** classifica come alto rischio recruiting e CV screening, decisioni su assunzione, carriera, promozioni e licenziamenti, nonché valutazione e monitoraggio delle prestazioni.
- La catena del valore distribuisce gli oneri tra **provider** (gestione del rischio, data governance, documentazione, marcatura CE) e **deployer** (uso conforme, sorveglianza umana, informazione preventiva, diritto alla spiegazione, FRIA); l'art. 25 trasforma il deployer in provider in caso di modifiche sostanziali.
- L'**art. 14** impone una sorveglianza umana effettiva e l'**art. 4** l'AI Literacy; l'analisi etica mostra i limiti dell'RLHF e fissa cinque garanzie: sicurezza, autonomia, trasparenza, equità, privacy.
- Il regime sanzionatorio arriva a **35 mln € o 7%** del fatturato mondiale per le pratiche vietate; il regolamento punta a un "effetto Bruxelles" e alla sovranità digitale, promuovendo sandbox normative e prove in condizioni reali secondo il principio **"regolare, non spegnere"**.

**Confidenza: Media** — sintesi ancorata a un'unica fonte primaria (capitolo 5); i riferimenti normativi andrebbero verificati sul testo consolidato del Regolamento e sui relativi atti di attuazione.

## Il Regolamento (UE) 2024/1689 e l'IA antropocentrica

L'AI Act è presentato come il primo regolamento orizzontale e organico al mondo dedicato all'intelligenza artificiale. Il suo fondamento giuridico risiede negli articoli 114 e 16 del Trattato sul Funzionamento dell'Unione Europea: l'obiettivo è armonizzare le legislazioni nazionali per garantire il funzionamento del mercato interno, assicurando al contempo un elevato livello di protezione della salute, della sicurezza e dei diritti fondamentali della Carta di Nizza.

La prospettiva è dichiaratamente **antropocentrica**: l'IA non è un fine a sé stante né un sostituto dell'autonomia e del giudizio umano, ma uno strumento al servizio della persona, destinato ad accrescerne il benessere e a supportarne le attività. Nel contesto occupazionale il Regolamento si pone in complementarietà con il diritto esistente: non incide sulle norme dell'Unione e nazionali in materia di diritto del lavoro, condizioni di impiego, salute e sicurezza, né sul diritto dei lavoratori e delle rappresentanze di essere informati e consultati. La novità è un livello aggiuntivo di protezione "algoritmo-specifico" che impone garanzie di trasparenza, tracciabilità e supervisione umana quando le decisioni aziendali sono mediate o delegate a sistemi automatizzati.

## La mappatura del rischio nel settore HR

Il modello regolatorio proporziona gli obblighi alla gravità e alla probabilità dei danni sui diritti fondamentali. Nel settore delle Risorse Umane il legislatore riconosce un rischio intrinsecamente elevato, determinato dalla **natura asimmetrica della relazione lavorativa**: chi cerca lavoro, una promozione o semplicemente la conservazione della propria occupazione si trova in una condizione di strutturale subordinazione economica e gerarchica. Tale vulnerabilità giustifica un presidio rafforzato.

| Livello di rischio | Esempi nel perimetro HR | Regime principale |
|---|---|---|
| Inaccettabile | Riconoscimento delle emozioni sul lavoro; categorizzazione biometrica basata su dati sensibili | Divieto assoluto (art. 5) |
| Alto rischio | CV screening, ranking dei candidati, decisioni su assunzione, carriera, promozioni e licenziamenti, monitoraggio delle prestazioni | Requisiti e obblighi dell'Allegato III |
| Limitato | Chatbot per il primo contatto con i candidati, assistenza ai dipendenti, deepfake e avatar per formazione o comunicazioni interne | Obblighi di trasparenza (art. 50) |
| Minimo o nullo | Filtri antispam, pianificazione automatica dei turni, gestionali di archiviazione documentale | Nessun vincolo cogente; codici di condotta volontari |

### Divieti assoluti: le pratiche vietate sul luogo di lavoro

L'articolo 5 sanziona il divieto assoluto di immissione sul mercato, messa in servizio o utilizzo di pratiche contrarie ai valori fondanti dell'Unione e alla dignità umana. In ambito occupazionale assumono rilievo centrale due divieti.

Il **riconoscimento delle emozioni nei luoghi di lavoro** (art. 5, par. 1, lett. f) vieta i sistemi volti a identificare o inferire lo stato emotivo o le intenzioni delle persone fisiche sul lavoro. La ratio combina la scarsa affidabilità scientifica degli strumenti, la loro natura invasiva della sfera psicologica e il rischio di trattamenti sfavorevoli o arbitrari. L'unica eccezione riguarda sistemi destinati a garanzie esclusivamente mediche o di sicurezza, come il rilevamento dell'affaticamento dei piloti.

La **categorizzazione biometrica basata su dati sensibili** (art. 5, par. 1, lett. g) vieta le inferenze su appartenenza sindacale, opinioni politiche, convinzioni religiose o filosofiche, razza, vita sessuale o orientamento sessuale. La norma impedisce la profilazione ideologica o discriminatoria di dipendenti e candidati.

### Sistemi ad alto rischio: i processi HR dell'Allegato III

L'Allegato III, punto 4, include espressamente nell'alto rischio i sistemi impiegati nell'occupazione, nella gestione dei lavoratori e nell'accesso al lavoro autonomo. Le applicazioni contemplate sono tre:

- **Reclutamento e selezione**: algoritmi per la pubblicazione mirata degli annunci, analisi e filtraggio automatico delle candidature (CV screening) e strumenti di valutazione attitudinale o psicometrica.
- **Decisioni su condizioni contrattuali e carriera**: sistemi usati per assumere, assegnare compiti sulla base di tratti o comportamenti individuali, decidere promozioni, condizioni di lavoro o risoluzione del rapporto.
- **Valutazione e monitoraggio delle prestazioni**: strumenti di monitoraggio algoritmico di prestazioni, condotta o produttività.

La motivazione è che questi sistemi influenzano in modo determinante prospettive di carriera, sostentamento economico e diritti fondamentali, con il rischio di perpetuare o amplificare modelli storici di discriminazione quando addestrati su dati distorti.

### Rischio limitato e rischio minimo

Il **rischio limitato** riguarda manipolazione o opacità nell'interazione uomo-macchina. L'articolo 50 impone obblighi di trasparenza informativa per chatbot di primo contatto o assistenza ai dipendenti e per sistemi che generano o manipolano contenuti sintetici, come deepfake o avatar virtuali usati nella formazione o nelle comunicazioni interne.

Il **rischio minimo o nullo** copre la maggioranza delle applicazioni sul mercato. L'AI Act non introduce vincoli cogenti, ma incoraggia codici di condotta etici. Nel perimetro HR rientrano strumenti amministrativi o di ottimizzazione logistica che non profilano il lavoratore né ne valutano l'operato, come filtri antispam, software di pianificazione dei turni e gestionali di routine.

## La catena del valore: provider, deployer e cambio di ruolo

Il Regolamento distingue lungo la catena del valore chi sviluppa la tecnologia e chi la impiega, distribuendo responsabilità e oneri di conformità.

### Gli oneri dei fornitori (provider)

Il **provider** sviluppa un sistema di IA e lo immette sul mercato. Per i software HR ad alto rischio deve garantire la conformità ex ante attraverso:

- **Sistema di gestione dei rischi** (art. 9): processo iterativo e continuo esteso all'intero ciclo di vita del sistema.
- **Governance e qualità dei dati** (art. 10): dataset pertinenti, rappresentativi ed esenti da errori, con esame e attenuazione delle distorsioni discriminatorie e prevenzione dei circuiti di feedback in cui l'output distorto alimenta l'addestramento futuro.
- **Documentazione tecnica e tracciabilità** (artt. 11 e 12): descrizione di architettura, logica algoritmica e metriche di accuratezza, unita alla registrazione automatica degli eventi (logging).
- **Trasparenza, marcatura CE e registrazione** (artt. 13, 43, 48 e 49): istruzioni chiare per il deployer, valutazione di conformità, apposizione della marcatura CE e registrazione nella banca dati pubblica dell'UE.

### Gli oneri degli utilizzatori (deployer e datori di lavoro)

Il **deployer** è il soggetto che utilizza il sistema sotto la propria autorità, come l'ufficio HR di un'azienda. Pur non sviluppando il codice, risponde della corretta gestione operativa:

- **Uso conforme e controllo dei dati di input** (art. 26): utilizzo secondo le istruzioni d'uso e garanzia che i dati immessi siano pertinenti e rappresentativi.
- **Sorveglianza umana effettiva** (art. 26, par. 2): sorveglianza affidata a persone competenti, formate e dotate di autorità, affinché le decisioni non siano mai totalmente delegate alla macchina.
- **Informazione preventiva e diritto alla spiegazione** (art. 26, par. 7 e art. 86): informazione preventiva delle rappresentanze dei lavoratori prima della messa in servizio e diritto dei soggetti interessati a spiegazioni chiare e significative sul ruolo del sistema e sui parametri considerati.
- **Valutazione d'impatto sui diritti fondamentali (FRIA)** (art. 27): obbligo per i deployer che sono enti pubblici o soggetti privati erogatori di servizi pubblici prima dell'uso di un sistema ad alto rischio.

### Il cambio di ruolo (art. 25)

L'articolo 25 introduce un principio di responsabilità sostanziale: il deployer assume la qualifica e gli obblighi del provider se appone il proprio nome o marchio sul sistema, se apporta una modifica sostanziale o se ne modifica la finalità prevista in modo da renderlo un sistema ad alto rischio.

## Supervisione umana, alfabetizzazione e limiti dell'allineamento

La disciplina giuridica si intreccia con la riflessione etica sull'allineamento e la governance dei sistemi intelligenti. Le tecnologie di apprendimento automatico non sono oracoli neutrali, ma infrastrutture socio-tecniche dotate di specifiche logiche operative.

### Human oversight e AI literacy

L'articolo 14 richiede che i sistemi ad alto rischio siano progettati per consentire un'efficace sorveglianza da parte di persone fisiche. Il supervisore deve comprendere i limiti del sistema, essere consapevole dell'**automation bias** — la tendenza a fidarsi acriticamente degli output — e poter interpretare i risultati, ignorare o ribaltare le raccomandazioni e interrompere il funzionamento mediante procedure di arresto sicuro (fail-safe / override).

Per evitare che la sorveglianza si riduca a un adempimento formale, l'articolo 4 introduce l'obbligo di **AI Literacy**: fornitori e deployer devono garantire un livello sufficiente di competenze del personale, affinché gli operatori comprendano il funzionamento tecnico degli strumenti e le conseguenze delle decisioni algoritmiche sui diritti dei soggetti interessati.

### I limiti dell'RLHF e le cinque garanzie fondamentali

L'analisi etica evidenzia i limiti delle prime tecniche di condizionamento etico, come il **Reinforcement Learning from Human Feedback (RLHF)**. L'RLHF non elimina informazioni pericolose o pregiudizi dai parametri profondi delle reti neurali: agisce come filtro superficiale, insegnando al modello a non esprimere certi pregiudizi senza rimuovere le correlazioni discriminatorie apprese. Poiché il bias è compresso e non eliminato, il sistema resta vulnerabile a manipolazioni del contesto — per esempio prompt costruiti per aggirare i filtri — e, nei modelli più avanzati, a rischi di inganno strategico come sandbagging o alignment faking.

Di fronte alla natura di "scatola nera", la riflessione etico-giuridica rifiuta l'alibi della non-spiegabilità e afferma il principio dell'**Ispezionabilità fin dalla Progettazione** (Auditable by Design). Nel rapporto tra agente artificiale e lavoratore individua cinque garanzie fondamentali:

1. **Sicurezza (Safety)**: protezione da danni psicologici o condizionamenti compulsivi, con costante reversibilità della scelta tecnologica.
2. **Rispetto dell'autonomia**: divieto di hyper-nudges e di profilazione psicometrica volta a condizionare subliminalmente la libera scelta.
3. **Trasparenza**: svelamento della natura artificiale dell'interlocutore e tracciabilità dei dati.
4. **Equità (Fairness)**: assenza di algorithmic bias derivanti da dati storici distorti che penalizzano i lavoratori per genere, età o etnia.
5. **Privacy e governance dei dati**: diritto del lavoratore di controllare la raccolta delle proprie tracce comportamentali.

## Sanzioni, sovranità digitale ed "effetto Bruxelles"

Il quadro sanzionatorio (artt. 99-101) è modellato sul GDPR, ma con tetti massimi più elevati. Le sanzioni si articolano in tre fasce.

| Violazione | Massimale pecuniario | Quota del fatturato mondiale annuo |
|---|---|---|
| Pratiche vietate (art. 5) | 35.000.000 EUR | 7% |
| Mancata conformità ai requisiti per i sistemi ad alto rischio | 15.000.000 EUR | 3% |
| Informazioni inesatte o fuorvianti | 7.500.000 EUR | 1% |

Per tutelare le PMI e le start-up, il regolamento applica il limite massimo in base alla cifra o alla percentuale inferiore. L'AI Act si inserisce inoltre nel quadro della **sovranità digitale europea**, intesa come capacità di mantenere il controllo autonomo su dati, infrastrutture e decisioni tecnologiche rispetto ad attori extra-UE. Analogamente al GDPR, si prevede un "effetto Bruxelles": il regolamento tende a imporsi come standard globale per la governance dell'IA affidabile (trustworthy AI).

## Sfide implementative e prospettive: "regolare, non spegnere"

La costruzione di un ecosistema di IA affidabile richiede il superamento di barriere tecniche, organizzative e culturali. Le sfide principali sono tre:

- **Trasparenza e "scatola nera"**: la complessità dell'apprendimento profondo rende difficile tradurre correlazioni statistiche in spiegazioni logiche; gli obblighi dell'articolo 86 spingono le aziende HR a sviluppare interfacce di interpretabilità capaci di chiarire le metriche chiave.
- **Prevenzione degli algorithmic bias**: dati storici aziendali rischiano di cristallizzare discriminazioni passate; un algoritmo di reclutamento addestrato su una popolazione storicamente omogenea tenderà a penalizzare i profili difformi.
- **Cybersicurezza specifica per l'IA**: i sistemi ad alto rischio vanno protetti da minacce dedicate come data poisoning, model poisoning e attacchi antagonistici volti a falsare la valutazione del personale.

Poiché la società e l'economia dipendono strutturalmente dagli intermediari digitali, l'ipotesi di sospendere o "staccare la spina" alle tecnologie algoritmiche appare irrealistica e dannosa. La prospettiva dell'AI Act è **"regolare, non spegnere"**: indirizzare lo sviluppo entro binari etici. A questo scopo il regolamento prevede gli **Spazi di Sperimentazione Normativa** (Regulatory Sandboxes, art. 57), ambienti controllati istituiti dagli Stati membri per testare soluzioni innovative sotto la vigilanza delle autorità, e le **Prove in Condizioni Reali** (art. 60), subordinate al consenso informato e a garanzie di reversibilità delle decisioni. In conclusione, l'efficienza algoritmica non può prescindere dal rispetto della dignità della persona: nei contesti lavorativi la tecnologia deve restare uno strumento subordinato alla supervisione e alla responsabilità umana.

## Related

- [[governance-controllo-responsabilita]]
- [[attivita-hr-automazione-e-bias-algoritmico]]
- [[competenze-e-hr]]
- [[sostituzione-o-trasformazione]]
- [[concezioni-dell-ia]]
- [[geopolitica-ia-poli-us-eu-cn]]
- [[linee-guida-tesi-hr]]
- [[stefano-gatti]]
- [[david-graeber]]

## Sources

- [Capitolo 5 — Introduzione e perimetro giuridico](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L1-L18>) — Dal mercato del lavoro all'UE AI Act come quadro organico.
- [Capitolo 5 — Regolamento e IA antropocentrica](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L20-L47>) — Artt. 114 e 16 TFUE, complementarietà con il diritto del lavoro e protezione algoritmo-specifica.
- [Capitolo 5 — Approccio risk-based e asimmetria lavorativa](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L49-L61>) — Rischio intrinsecamente elevato nel settore HR.
- [Capitolo 5 — Pratiche vietate](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L63-L88>) — Art. 5: riconoscimento delle emozioni e categorizzazione biometrica sensibile.
- [Capitolo 5 — Sistemi ad alto rischio](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L90-L116>) — Allegato III, punto 4: recruiting, carriera, prestazioni e rischio di discriminazione.
- [Capitolo 5 — Rischio limitato e minimo](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L118-L142>) — Trasparenza art. 50, chatbot, deepfake e strumenti amministrativi.
- [Capitolo 5 — Catena del valore](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L144-L213>) — Oneri di provider e deployer, FRIA e cambio di ruolo ex art. 25.
- [Capitolo 5 — Supervisione umana ed etica](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L215-L284>) — Human oversight, AI Literacy, limiti dell'RLHF, Auditable by Design e cinque garanzie.
- [Capitolo 5 — Sanzioni e sovranità digitale](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L288-L322>) — Artt. 99-101, regola per le PMI, effetto Bruxelles e trustworthy AI.
- [Capitolo 5 — Sfide e prospettive](<raw/5_ Il Quadro Normativo Europeo_ L'UE AI Act e la Tutela del Lavoratore nell'Era Algoritmica.md#L324-L370>) — Scatola nera, bias, cybersicurezza, "regolare, non spegnere", sandbox e prove reali.
