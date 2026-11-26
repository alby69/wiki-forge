---
id: progetti-config
title: Progetti e configurazione
icon: ⚙️
order: 15
group: ⚙️ Progetti e Dev Mode
mode: both
keywords: [progetto, project, config, configurazione, impostazioni, wizard, onboarding, modello, llm, gguf, locale, cpu, cartelle, clone, archivia, cestino, esporta, importa]
context: [config, wizard]
---

## Cambiare progetto

Nella barra in alto il selettore **Progetto** elenca i progetti disponibili. Selezionandone uno:

- la vault si ricarica (note, grafo, file);
- la scelta viene **ricordata** al prossimo avvio;
- tutte le operazioni successive agiscono su quel progetto.

## Gestione progetti — Project Manager

Il pulsante **📁 Progetti** nella barra in alto apre il **Project Manager**, che
sostituisce i vecchi controlli nella Configurazione. Da qui puoi:

| Azione | Cosa fa |
|---|---|
| **Crea** | Nuovo progetto con `id` (lettere minuscole, numeri, `-`, `_`) e nome visualizzato. |
| **Clona** | Copia un progetto esistente, con inclusione opzionale di wiki, sorgenti, note, output e configurazione. |
| **Rinomina** | Cambia il **nome visualizzato** (`config.toml` e registry restano sincronizzati); l'id e il percorso non cambiano. |
| **Archivia / Ripristina** | Sposta il progetto sotto `.wiki-forge/archive/` e lo riporta indietro. |
| **Esporta / Importa** | Scarica o carica un bundle JSON con file e metadati. |
| **Elimina** | **Sposta nel cestino** (`.wiki-forge/trash/`) per impostazione predefinita: è recuperabile. |

Per un'eliminazione definitiva esiste un'azione separata in rosso che richiede
una conferma esplicita. Il progetto `default` non può essere eliminato.

## La finestra ⚙️ Config (Developer Mode)

Apre le impostazioni del progetto attivo, divise in schede:

| Scheda | Cosa configuri |
|---|---|
| **General** | Nome progetto, titolo, contesto |
| **Paths** | Cartelle (wiki, sources, raw, output) |
| **LLM** | Provider e modello usato dall'agente |
| **OKF** | Opzioni del formato OKF v0.2 |
| **Schema** | Schema tipizzato della wiki |

Le modifiche vengono scritte direttamente su `config.toml` (fonte unica di verità) tramite le API del backend. La creazione e la cancellazione di progetti **non** sono più qui: usa il Project Manager.

## Modelli GGUF locali (solo Admin)

Nella scheda **LLM & Agent** puoi caricare un file `.gguf` scaricato da Hugging Face. L'upload è chunked in base64 (512 KiB per chunk, sotto il limite JSON di 1 MiB del gateway; max 2 GiB via UI, 16 GiB via API con `WIKIFORGE_MAX_BODY_BYTES` più alto): il backend verifica il magic `GGUF`, salva il file in `models/`, registra dimensione e SHA256 in `.wiki-forge/llm/models.json` e attiva subito `[llm.local]` con `[agent.llm].provider = "local"`. Nessun riavvio è necessario. Il pulsante **Use** su un modello già registrato cambia il modello attivo; ricaricare lo stesso nome sovrascrive il file mantenendone l'attivazione.

Le operazioni Admin sono `projects.gguf.list`, `projects.gguf.uploadStart`, `projects.gguf.uploadChunk`, `projects.gguf.uploadFinalize` e `projects.gguf.activate`; passano tutte da `ApiStorage`, mai da `fetch` diretto nel frontend.

## Lingua e scorciatoie

- Il selettore **🇮🇹 IT / 🇬🇧 EN** nella barra in alto cambia la lingua dell'interfaccia.
- `Ctrl+K` apre la palette comandi, `F1` la guida contestuale, `Ctrl+Shift+D` passa da Focus a Developer Mode.

## L'Onboarding Wizard

- In **Developer Mode** col pulsante **🪄 Onboarding Wizard**, oppure con `/wizard` dalla chat.
- Tre passi: **scenario** (accademico, business...) → **modello LLM** → **caricamento iniziale** delle fonti.
- In chat, `/wizard` elenca gli scenari; `/wizard <scenario>` avvia direttamente quello scelto.

## Da dove parto se sono nuovo?

1. Resta in **Focus Mode** e segui i 4 passi (Carica → Importa → Compila → Chiedi).
2. Quando ti servono strumenti avanzati, passa a **Developer Mode** (badge o Ctrl+Shift+D).
3. La guida (**F1**) ti suggerisce sempre l'argomento giusto per ciò che stai facendo.

**Approfondisci:** `docs/guida/STARTUP.md` (progetti e cartelle), `docs/guida/USER_GUIDE.md` (wizard e configurazione), `docs/architettura/ARCHITECTURE.md` (`config.toml`).
