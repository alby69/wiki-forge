---
type: Concept
title: "Architetture Multi-Agente ed AI Workflows"
description: "Piattaforme agentiche avanzate, dibattito multi-agente e workflow autonomi coordinati per il dominio HR e il Knowledge Engineering"
status: draft
maturita: 90
tags: [topic/ai, topic/agents, topic/hr, status/draft]
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

# Architetture Multi-Agente ed AI Workflows

## Definizione e Concetto
Le **architetture multi-agente** (*multi-agent systems*) rappresentano l'evoluzione dalle interazioni monolitiche con modelli linguistici singoli verso network di agenti AI specializzati che collaborano, dibattono o si supervisionano a vicenda per portare a termine compiti complessi.

In un workflow agentico avanzato, ogni agente assume un ruolo distinto con prompt di sistema specifici, vincoli operativi ed eventuali accessi a strumenti esterni (*tool use*).

## Applicazione al Dominio HR
Nel contesto della gestione delle Risorse Umane, l'adozione di architetture multi-agente supera i limiti del semplice riassunto di documenti o dello screening lineare di CV:

1. **Simulazione e Valutazione Multi-Prospettiva**: Un'architettura multi-agente può orchestrare una simulazione strutturata tra un "Agente Reclutatore" (focalizzato sul matching delle competenze tecniche) ed un "Agente di Compliance Etica e D&I" (focalizzato sull'identificazione di bias di genere, età o estrazione socio-culturale).
2. **Debate e Consensus Model**: I diversi agenti analizzano il medesimo profilo candidale, evidenziando pro, contro e potenziali anomalie prima di generare un report sintetico destinato alla revisione dell'HR Specialist.
3. **Supervisione e Audit Interno**: Agenti verificatori controllano la conformità della nota prodotta rispetto ai vincoli ontologici SHACL e ai livelli di affidabilità (*Trust Tiers*).

## Vantaggi Organizzativi
* **Riduzione delle Allucinazioni**: Il confronto incrociato tra agenti riduce gli errori di interpretazione.
* **Separazione delle Responsabilità (Separation of Concerns)**: Consente di applicare regole rigorose di governance su specifici sotto-task.
* **Supporto alle Decisioni Umane**: Il sistema non sostituisce la decisione finale dell'HR Manager, ma gli fornisce un'analisi argomentata e bilanciata.

## Collegamenti Correlati
- [[capacita-emergenti-llm|Capacità Emergenti degli LLM]]
- [[competenze-e-hr|Competenze ed HR]]
- [[capitoli/02-studio-degli-attori-principali|Capitolo 2: Studio degli Attori Principali]]
- [[capitoli/03-progettazione-della-piattaforma|Capitolo 3: Progettazione della Piattaforma]]
