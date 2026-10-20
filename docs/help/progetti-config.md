---
id: progetti-config
title: Progetti e configurazione
icon: ⚙️
order: 12
group: ⚙️ Progetti e Dev Mode
mode: both
keywords: [progetto, project, config, configurazione, impostazioni, wizard, onboarding, modello, llm, cartelle]
context: [config, wizard]
---

## Cambiare progetto

Nella barra in alto il menu **Project** elenca i progetti disponibili. Selezionandone uno:

- la busta si ricarica (note, grafo, file);
- la scelta viene **ricordata** al prossimo avvio;
- tutte le operazioni successive agiscono su quel progetto.

Per crearne uno nuovo o rinominarlo si usa la **Configurazione** (sotto) o la struttura a cartelle del progetto sul disco.

## La finestra ⚙️ Config (Developer Mode)

Apre le impostazioni del progetto attivo, divise in schede:

| Scheda | Cosa configuri |
|---|---|
| **General** | Nome progetto, titolo, contesto |
| **Paths** | Cartelle (wiki, sources, raw, output) |
| **LLM** | Provider e modello usato dall'agente |
| **OKF** | Opzioni del formato OKF v0.2 |
| **Schema** | Schema tipizzato della wiki |

Le modifiche vengono scritte direttamente su `config.toml` (fonte unica di verità) tramite le API del backend.

## L'Onboarding Wizard

- In **Developer Mode** col pulsante **🪄 Onboarding Wizard**, oppure con `/wizard` dalla chat.
- Tre passi: **scenario** (accademico, business...) → **modello LLM** → **caricamento iniziale** delle fonti.
- In chat, `/wizard` elenca gli scenari; `/wizard <scenario>` avvia direttamente quello scelto.

## Da dove parto se sono nuovo?

1. Resta in **Focus Mode** e segui i 4 passi (Carica → Importa → Compila → Chiedi).
2. Quando ti servono strumenti avanzati, passa a **Developer Mode** (badge o Ctrl+Shift+D).
3. La guida (**F1**) ti suggerisce sempre l'argomento giusto per ciò che stai facendo.

**Approfondisci:** `docs/STARTUP.md` (progetti e cartelle), `docs/USER_GUIDE.md` (wizard e configurazione), `docs/TECHNICAL_ARCHITECTURE.md` (`config.toml`).
