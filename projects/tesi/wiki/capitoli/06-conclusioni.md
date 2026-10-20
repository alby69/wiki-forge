---
type: Concept
title: 'Capitolo 6: Conclusioni'
description: Sintesi del percorso, prospettive future per le Risorse Umane e direzioni
  di ricerca
status: draft
tags:
- thesis/chapter
- topic/conclusions
- status/draft
- topic/hr
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
  author: process:conv2md
  last_modified: '2026-10-20T06:04:34Z'
maturita: 90
copertura_fonti: 1
domande_risolte: 0
stato: draft
---
# Capitolo 6: Conclusioni — Sintesi del Percorso e Prospettive Future per le Risorse Umane

## 6.1 Sintesi dei Risultati
La ricerca condotta in questo lavoro di tesi magistrale ha dimostrato la fattibilità e l'efficacia strategica di un modello ibrido di Knowledge Management basato sull'integrazione tra Google NotebookLM (fase di *Discovery*) e Wiki-Forge (fase di *Consolidation*).

L'adozione del formato Open Knowledge Format (OKF v0.2), della validazione ontologica W3C SHACL e dell'interrogazione GraphRAG consente di superare in modo radicale i limiti strutturali del RAG convenzionale (effimerità delle risposte, perdita delle relazioni e allucinazioni sui confronti). Inoltre, l'implementazione di un'interfaccia grafica (Web UI) incentrata sulla **Modalità Semplice (Focus Mode)** ha dimostrato che una complessa architettura di Knowledge Engineering può essere utilizzata in modo fluido ed autonomo da operatori non tecnici (HR Specialist, manager e tesisti), sintetizzando nel flusso operativo a tre fasi descritto nel [[capitoli/03-progettazione-della-piattaforma|Capitolo 3]] l'intero ciclo di costruzione e consultazione della base di conoscenza.

## 6.2 Il Futuro della Funzione HR: La Governance del Capitale Intellettuale
La funzione Risorse Umane si posiziona al centro della trasformazione digitale aziendale:
- **Da gestione amministrativa a Knowledge Curation**: L'HR Manager evolve in un **Knowledge Curation Officer (KCO)**, responsabile della definizione delle tassonomie aziendali, della qualità dei dati e della governance dell'intelligenza organizzativa.
- **Presidio etico e tutela delle persone**: L'infrastruttura di Knowledge Engineering, combinando la tracciabilità delle fonti (Trust Tiers) ed i vincoli di validazione (SHACL), agisce come un presidio strutturale contro la discriminazione algoritmica (*algorithmic bias*) e le allucinazioni nei processi di valutazione e selezione.
- **Valorizzazione del tempo umano**: Automatizzando la "routine igienica" della ricerca informativa e della prima sintetizzazione dei testi, il sistema libera risorse che il professionista HR può reindirizzare verso la cura delle relazioni interpersonali, lo sviluppo del talento ed il benessere organizzativo.

## 6.3 Sviluppi Futuri della Ricerca
- **Integrazione con i sistemi HRIS aziendali**: Estensione dell'architettura per dialogare direttamente con i software gestionali delle Risorse Umane (es. Workday, SAP SuccessFactors) mediante connettori semantici e API REST.
- **Agenti Autonomi di Manutenzione della Conoscenza (*Auto-Gardener*)**: Sperimentazione di routine automatizzate per l'identificazione preventiva di schede obsolete, link rotti e concetti duplicati su Knowledge Base di grandi dimensioni.
- **Estensione dei Framework di Competenza (ESCO/ISCO)**: Mappatura automatica delle note atomiche sui vocabolari europei standardizzati per facilitare la mobilità interna ed il reskilling continuo dei lavoratori.

## Collegamenti Correlati
- [[capitoli/00-frontespizio-e-sinossi|Frontespizio e Sinossi]]
- [[capitoli/01-introduzione|Capitolo 1: Introduzione]]
- [[capitoli/03-progettazione-della-piattaforma|Capitolo 3: Progettazione della Piattaforma]]
- [[capitoli/05-considerazioni-personali|Capitolo 5: Considerazioni Personali]]
