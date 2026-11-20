---
type: Concept
title: note architettura
description: 'Wiki-Forge applica il pattern **LLM Wiki**: l''LLM non risponde solo
  "al volo" sui PDF, ma costruisce e mantiene una wiki persistente di Mark...'
status: stable
generated:
  by: process:migrate-script
  at: '2026-11-20T09:35:27Z'
verified: []
sources: []
---
# note architettura

## Risposta

Wiki-Forge applica il pattern **LLM Wiki**: l'LLM non risponde solo "al volo" sui PDF, ma costruisce e mantiene una wiki persistente di Markdown intermedi; l'umano sceglie fonti, domande e verifiche, mentre l'agente fa estrazione, collegamento e bookkeeping [[karpathy-llm-wiki]]. La memoria è **non parametrica**: il sapere sta nei file `wiki/`, non nei pesi del modello [[technical-architecture]].

L'architettura è a **5 macro-componenti**: `wikiforge-ui` (SPA) → `wikiforge-api-gateway` (AgentServer Node) → `wikiforge-kg` (FastAPI Graph/GraphRAG via proxy `/api/v1/graph/*`) e `wikiforge-ingest` (conversione + coda SQLite SHA256), con `wikiforge-core` trasversale a ingest/KG/gateway [[technical-architecture]]. L'API espone REST/SSE, lancia script Python con contratto `--json-schema` e usa LLM multi-provider (OpenCode, Anthropic, OpenAI-compatible, Ollama) [[technical-architecture]][[changelog]].

Confidenza: **alta** sul quadro architetturale; **media** solo sul dettaglio hot-reload dell'API, perché [[technical-architecture]] indica `tsx watch` mentre [[ke-agent-scheduler-plan]] documenta `tsx` senza hot-reload in Docker.

## Passaggi chiave

- **Livelli**: fonti immutabili → testo convertito → wiki OKF v0.2 → output/Studi; il flusso operativo è *Carica → Compila → Rivedi → Usa → Verifica* [[tutorial]][[guida-operativa]][[thesis-guide]].
- **Ingestione**: conversione e coda persistente `.wiki-forge/ingest_queue.db`, con hash SHA256 per idempotenza; lo stato può comparire nei filename `_COMPILED.md` [[technical-architecture]][[audit-baseline]].
- **Compilazione e interrogazione**: l'agente genera frontmatter, wikilink, indice e log; Research/Review/Study Studio riusano endpoint deterministici, con fallback quando l'LLM manca [[tutorial]][[technical-architecture]][[changelog]].
- **Qualità e governance**: trust tier OKF, `okf_lint`/`okf_reindex`/`okf_log`/`okf_stats`, SHACL/RDF, snapshot e rollback dalla **Cronologia**/Review Studio [[technical-architecture]][[thesis-guide]][[tutorial]].
- **Automazione**: scheduler nel processo API con job TOML, Policy Agent consultivo fail-closed, step mutanti soggetti ad approvazione umana [[ke-agent-scheduler-plan]][[changelog]].
- **Baseline**: l'audit conferma albero repo e fasi 0–62 implementate, segnalando esplicitamente i confini (doppio runtime Python/Node, server locale, superficie di sicurezza) [[audit-baseline]].

## Fonti consultate

- [[karpathy-llm-wiki]]
- [[technical-architecture]]
- [[audit-baseline]]
- [[tutorial]]
- [[guida-operativa]]
- [[changelog]]
- [[ke-agent-scheduler-plan]]
- [[thesis-guide]]