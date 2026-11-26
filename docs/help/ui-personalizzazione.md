---
id: ui-personalizzazione
title: Personalizza UI, ruoli e permessi
icon: ⚙️
order: 19
group: ⚙️ Impostazioni
mode: both
keywords: [personalizza, preferenze, UI, ruoli, permessi, RBAC, utenti, admin, reader, contributor, knowledge engineer, lingua, densità, pannelli, pin, scorciatoie]
context: []
---

## Cosa fa Personalizza UI

Nel menu `⋯` della Modalità Sviluppo trovi **⚙️ Personalizza UI** (anche in Modalità Focus se il tuo ruolo lo consente: è un'azione Reader). La modale ha quattro sezioni:

1. **Layout → Pannelli visibili**: scegli quali pannelli mostrare tra File, Grafo, Info nodo, Chat e Note rapide. **Editor** è essenziale e resta sempre visibile.
2. **Barra → Mostra nella barra**: spunta le azioni globali da pinare accanto al riquadro viste. Un'azione non consentita non compare e non può essere aggiunta: le preferenze non ampliano mai i permessi.
3. **Aspetto → Densità**: passa da **Ampia** a **Compatta**.
4. **Scorciatoie**: elenco delle combinazioni effettivamente registrate e permesse ai tuoi ruoli.

Le preferenze sono salvate **per utente sul server** in `.wiki-forge/ui-preferences.json` con una chiave derivata da `source:actor` (hash SHA-256). Se il server non è raggiungibile viene usata l'ultima copia locale; il ripristino avviene al primo salvataggio riuscito. Nelle sessioni legacy/anonime il comportamento resta quello storico.

## Lingua

Il selettore **🇮🇹 IT / 🇬🇧 EN** dell'header aggiorna sia l'interfaccia sia la preferenza `language`, che viene risalvata sul server. Al prossimo accesso la lingua scelta viene ripristinata.

## Ruoli e anteprima capacità

La modale **👥 Gestione utenti** (solo Admin) mostra una guida con quattro ruoli progressivi:

| Ruolo | In sintesi |
| :--- | :--- |
| **Reader** | Legge wiki, progetti, grafo, aiuto ed esportazioni; può personalizzare la propria UI. |
| **Contributor** | Modifica note, cartelle e template; usa chat, studio e changesets. |
| **KnowledgeEngineer** | Verifica e critica le revisioni, applica changesets, esegue script e usa il workbench KE. |
| **Admin** | Controlla progetti, configurazione, utenti e approvazioni: accesso completo. |

Per ogni ruolo l'anteprima mostra ✓/✕ su alcune capacità chiave e il conteggio delle azioni disponibili, calcolati dalla matrice condivisa `ACTION_MIN_ROLE`. Il contesto di progetto o cartella può limitare ulteriormente le azioni.

## Il proprio account

L'account che corrisponde all'identità locale corrente (`human:<username>`) è etichettato **Tu**. I pulsanti **Modifica** ed **Elimina** sono disabilitati: non puoi toglierti il ruolo Admin, disattivarti o eliminarti. Anche un tentativo di salvataggio dopo un cambio di identità viene bloccato. Tutte le conferme usano finestre in-app accessibili, mai `alert`, `confirm` o `prompt` del browser.

**Approfondisci:** `docs/guida/USER_GUIDE.md` (sezione *Personalizzazione UI, ruoli e permessi*), `docs/architettura/ARCHITECTURE.md` §4 (filtro RBAC), `docs/architettura/OPENAPI.md` (route `ui.*`).
