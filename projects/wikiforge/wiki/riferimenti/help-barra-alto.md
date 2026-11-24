---
type: Reference
title: "La barra in alto"
description: "Argomenti: barra, header, alta, pulsanti, menu, badge, progetto, vista, chat, aiuto, F1, sidebar, research, studio, study, file, template"
resource: docs/help/barra-alto.md
tags: [scope/docs, layer/generated, area/riferimenti, lang/it, help]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-19T00:00:00Z"
sources:
  - id: source-docs-help-barra-alto-md
    resource: docs/help/barra-alto.md
    title: "La barra in alto"
    author: human:alby69
---
## Di cosa è fatta la barra in alto

Da **sinistra a destra** trovi:

1. **`Wiki-Forge`** (logo testuale) — cliccandolo apri la pagina GitHub del progetto in una nuova scheda.
2. **Badge modalità** — 🌱 Focus Mode / 👑 Developer Mode: cliccalo per cambiare modalità (oppure **Ctrl+Shift+D**).
3. **Insegna fiducia della nota** — accanto al badge compare lo stato della nota aperta:
   - ✓ **Human-Reviewed** (verificata da un umano)
   - 🤖 **Machine-Confirmed** (confermata dall'agente)
   - **Unverified** (non ancora verificata)
4. **Selettore Project** — cambia il progetto wiki attivo; la busta si ricarica automaticamente.
5. **Riquadro viste** (al centro-destra): **🗂️ File · 📝 Editor · 📒 Note · 🕸️ Grafo · ◧ Divisione**, tutti dentro lo **stesso riquadro** (il File è il primo pulsante). **🗂️ File** mostra/nasconde il file manager a sinistra: premilo una volta per aprirlo, di nuovo per chiuderlo, come le altre viste; lo stato viene ricordato. **Split** ora mostra tre pannelli: **File · Editor · Grafo**. Vedi la voce *Viste* nella guida.
6. **Contesto della modalità**:
   - In **Focus Mode**: i 4 pulsanti **Carica · Importa · Compila · Chiedi**.
   - In **Developer Mode**: **Onboarding Wizard · KE Workbench · 🔎 Research · 📚 Studio · Tools · Config**.
7. **`⋯` (Altre azioni)** — menu con l'elenco **Personalizza barra**: clicca una riga per eseguire l'azione, spunta la casella per aggiungerla come pulsante. Include **📐 Template**, che apre la gestione grafica dei template (crea/modifica, predefinito e **Nuovo documento**), e **⚙️ Personalizza UI**, che apre pannelli, pin, densità e scorciatoie in base ai permessi (vedi *Personalizza UI, ruoli e permessi*).
8. **`?`** — apre questa **guida in-app** (anche col tasto **F1**, ovunque).
9. **💬 Agent Chat** — apre/chiude la finestra di chat con l'agente.

> **Nell'header dell'editor** trovi anche **🧐 Revisione** (apre la Review Studio a quattro schede), **🔎 Ricerca** (apre la Research Studio a sei schede), **📚 Studio** (apre la Study Studio a sette schede) e **🕐 Cronologia** (versioni e rollback). Le scorciatoie sono `Ctrl+Alt+R/C/D/F` per la Review Studio, `Ctrl+Alt+Q/S/B/L/T/H` per la Research Studio e `Ctrl+Alt+G/K/M/A` per la Study Studio; in alternativa usa il tasto destro su una nota.

## La barra laterale sinistra (file manager e tag cloud)

Sulla sinistra c'è la colonna con l'**albero dei file** della wiki e la **tag cloud**:

- Il pulsante **🗂️ File**, primo pulsante del riquadro viste in alto, **chiude e riapre la colonna** (come le altre viste). Sul bordo destro della colonna c'è anche il vecchio pulsante **`◀`** (o `▶` se chiusa): agisce sullo stesso stato, quindi i due controlli restano sincronizzati. La scelta viene ricordata.
- Il bordo stesso si può **trascinare** per ridimensionare (da 200 a 500 px).
- Il pulsante **➕ Nuovo file** in alto nella colonna apre la finestra di creazione documento con nome, percorso wiki modificabile e scelta del template.

## In basso (footer)

La riga in fondo mostra lo stato di connessione del backend (`Status: Connected | Vault: /wiki`). Se dice altro, il server non è raggiungibile — vedi *Problemi frequenti*.

**Approfondisci:** `docs/USER_GUIDE.md` (descrizione dell'interfaccia), `docs/TUTORIAL.md` §2 (viste e barre).
