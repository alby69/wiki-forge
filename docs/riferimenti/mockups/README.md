# Mockup — Review Studio

Prototipo statico e interattivo della console di revisione descritta nella proposta.

## Anteprime

| Vista | File |
|---|---|
| Review Studio · Verifica umana | `review-studio.png` |
| Review Studio · Revisione critica | `review-critique.png` |
| Review Studio · Digest | `review-digest.png` |
| Review Studio · Confronta versioni | `review-diff.png` |
| Menu contestuale | `review-context-menu.png` |

Le anteprime sono generate dal file HTML con Edge headless (vedi in fondo).

## Come aprirlo

Apri `review-studio.html` con un browser (doppio clic). Non serve un server: il file è autosufficiente.

## Cosa provare

- **Review Studio** (vista iniziale): le 4 schede orizzontali in alto — *Verifica*, *Critica*, *Digest*, *Confronta versioni*. La scheda predefinita è *Verifica*.
- **Verifica**: quality gate della nota, storico verifiche, form con reviewer, `stable` e commento; premi **Registra verifica** per il toast di conferma.
- **Critica**: scegli profondità e focus, premi **Avvia revisione critica** per vedere progresso e finding strutturati.
- **Digest**: statistiche della settimana e timeline di verifiche, modifiche e snapshot.
- **Confronta versioni**: scegli uno snapshot e passa da *Affiancata* a *Unificata*; il pulsante di ripristino mostra il toast. (Il prototipo esplora entrambe le viste; l'app reale usa oggi la vista **Unificata**.)
- **Tasto destro** su un file nell'albero a sinistra: si apre il menu contestuale *Revisione e QA*; ogni voce apre la scheda corrispondente.
- **Pulsante `🧐 Revisione`** nell'header dell'editor e scorciatoie `Ctrl+Alt+R` (verifica), `Ctrl+Alt+C` (critica), `Ctrl+Alt+D` (digest), `Ctrl+Alt+F` (diff).
- **Barra in basso**: passa tra le due viste del mockup (`Review Studio` / `Menu contestuale`).

## Deep link per gli screenshot

- `review-studio.html` → scheda Verifica
- `review-studio.html#critique` → scheda Critica (con finding già visibili)
- `review-studio.html#digest` → scheda Digest
- `review-studio.html#diff` → scheda Confronta versioni
- `review-studio.html#menu` → menu contestuale aperto

## Rigenerare le anteprime

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$base = (Get-Location).Path.Replace('\','/')
$shots = @(
  @{ hash = '';          file = 'review-studio.png' },
  @{ hash = '#critique'; file = 'review-critique.png' },
  @{ hash = '#digest';   file = 'review-digest.png' },
  @{ hash = '#diff';     file = 'review-diff.png' },
  @{ hash = '#menu';     file = 'review-context-menu.png' }
)
foreach ($s in $shots) {
  & $edge --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 `
    --virtual-time-budget=1200 --run-all-compositor-stages-before-draw `
    --screenshot="$base/docs/riferimenti/mockups/$($s.file)" `
    "file:///$base/docs/riferimenti/mockups/review-studio.html$($s.hash)"
}
```

## Note

- I dati sono finti e servono solo a valutare densità, gerarchia e palette.
- Palette: `#0b1220` / `#0f172a` / `#1e293b`, testo `#e2e8f0`, accento **emerald** `#10b981`, poi amber/sky/violet per gli stati.
- Il prototipo non usa dipendenze esterne né font remoti.
- Uso nell'app reale: `docs/guida/TUTORIAL.md` §2 (Review Studio), guida in-app `docs/help/review-studio.md`.
