---
type: Playbook
title: "User Guide — Simple Focus Mode & Guided Procedures"
description: "Focus Mode provides a clean, 3-step interface for operators:"
resource: docs/guida/USER_GUIDE.md
tags: [scope/docs, layer/generated, area/guida, lang/it]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-26T00:00:00Z"
sources:
  - id: source-docs-guida-user-guide-md
    resource: docs/guida/USER_GUIDE.md
    title: "User Guide — Simple Focus Mode & Guided Procedures"
    author: human:alby69
---
# User Guide — Simple Focus Mode & Guided Procedures

## Focus Mode Overview
Focus Mode provides a clean, 3-step interface for operators:

1. **1. Carica Documenti**: Drag and drop PDF, EPUB, DOCX, or TXT sources into `sources/`.
2. **2. Compila Wiki**: Converts raw sources into interlinked OKF v0.2 Markdown notes.
3. **3. Chiedi alla Wiki**: Ask questions, request syntheses, or generate study materials.

Sign in before using Focus Mode: production forces authentication and RBAC,
requires a token unless an IdP or user store is configured, and has no default
`admin/admin` credentials. Sessions are persisted on the server via `StateStore`.

## Guided Wizards
Focus Mode includes a guided **Onboarding Wizard** (also available in chat as `/wizard [scenario]`) that walks you through setting up a new project step by step, and scenario presets can be selected in the wizard itself.

Backend progress for guided procedures is recorded in `.wiki-forge/procedures/wizard_state.json`, but the web UI has no resume button yet: after a page reload the wizard starts again from its first step.

## Local CPU-only Reasoning

A local SLM can replace cloud providers without removing them. Install
`llama-cpp-python` from `requirements.txt`, place a Q4_K_M `.gguf` model in
`models/` (the default is `deepseek-r1-distill-qwen-1.5b-q4_k_m.gguf`), then
check `[llm.local]` in `config/config.toml`: `enabled = true` registers the
engine and `n_gpu_layers = 0` keeps inference CPU-only. Set
`[agent.llm].provider = "local"` to activate it for chat and Review Studio, or
leave the provider empty to use it as the fallback when no cloud provider is
configured. The model is never loaded on startup; the first request reports a
clear error if the GGUF file is missing. Streamed `<think>...</think>` blocks
appear as collapsible traces in chat and critique output.

### Upload a GGUF from the UI (Admin)

1. Download a quantized model from Hugging Face, for example
   `huggingface-cli download <repo> <file>.Q4_K_M.gguf --local-dir /tmp/wf-models`.
   Prefer `Q4_K_M` for CPU-only inference; the file must keep a `.gguf` basename.
2. Open **⚙️ Config → LLM & Agent** in Developer Mode. The **Local GGUF (CPU-only)**
   section lists registered models and the active path from `config/config.toml`.
3.    Choose the downloaded `.gguf` in the file picker and press **Upload & activate**.
   The browser sends 512 KiB base64 chunks so each JSON request stays below the
   gateway's 1 MiB body limit; the UI accepts up to 2 GiB (4096 chunks). API
   clients can send larger chunks and up to 16 GiB when
   `WIKIFORGE_MAX_BODY_BYTES` is raised.
4. Wait for `Registered <name>; activating...`: the backend verifies the `GGUF`
   magic, computes SHA256, writes `models/<name>.gguf`, and sets
   `[agent.llm].provider = "local"` plus `[llm.local].model_path`.
5. Close the dialog and use the chat normally. The first request loads the model;
   `<think>` traces are collapsible. No restart is required.
6. To switch model, press **Use** on another registered row. Re-uploading the
   same basename replaces the file and keeps it active if it was active.

### Upload through the API (Admin)

All calls use `X-WikiForge-Token` when a gateway token is configured. The route
`:id` selects the API project scope; the model registry itself is installation-wide.

```bash
curl -fsS http://localhost:3001/api/projects/default/models/gguf \
  -H "X-WikiForge-Token: $WIKIFORGE_API_TOKEN" | jq .
```

Use this Python snippet for the full four-call upload/activation flow:

```python
import base64
import json
import os
import urllib.request

base = "http://localhost:3001/api/projects/default/models/gguf"
token = os.environ.get("WIKIFORGE_API_TOKEN", "")
headers = {"Content-Type": "application/json"}
if token:
    headers["X-WikiForge-Token"] = token
path = "/tmp/wf-models/model.Q4_K_M.gguf"
name = os.path.basename(path)
size = os.path.getsize(path)
chunk_bytes = 512 * 1024
chunks = (size + chunk_bytes - 1) // chunk_bytes

def call(action, payload=None):
    method = "GET" if payload is None else "POST"
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(base + action, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request) as response:
        return json.load(response)

started = call("/start", {"fileName": name, "size": size, "chunkCount": chunks})
upload_id = started["uploadId"]
with open(path, "rb") as model:
    for index in range(chunks):
        content = model.read(chunk_bytes)
        call("/chunk", {
            "uploadId": upload_id,
            "chunkIndex": index,
            "contentBase64": base64.b64encode(content).decode("ascii"),
        })
model = call("/finalize", {"uploadId": upload_id})["model"]
call("/activate", {"modelId": model["id"]})
print(json.dumps(model, indent=2))
```

## Markdown Editor & Toolbar
When editing notes, the editor view includes a built-in formatting toolbar:
- **Undo / Redo**: **↩️ Undo** and **↪️ Redo** buttons with dynamic state enabling/disabling, plus standard keyboard shortcuts (`Ctrl+Z` / `Ctrl+Y`).
- **Text Styling**: **B** (Bold `**text**`), *I* (Italic `*text*`), ~~S~~ (Strikethrough `~~text~~`), and `</>` (Inline Code `` `code` ``).
- **Structure**: Headers dropdown (H1, H2, H3), Bulleted Lists (`- `), Numbered Lists (`1. `), and Blockquotes (`> `).
- **Formatting & Alignment**: Text Color picker (`<span style="color: ...">`) and Text Alignment dropdown (`<div align="...">`).
- **Wikilink Autocomplete**: Type `[[` inside the editor to invoke automatic autocomplete for existing wiki notes.

## Review Studio
The editor header includes a **🧐 Revisione** button that opens the **Review Studio**, a single modal with four horizontal tabs:

| Tab | Purpose |
|---|---|
| **Verifica** | Note quality gate (links, OKF frontmatter, tags, sources, `stale_after`), verification history, and the human-review form (reviewer, `stable`, comment). |
| **Critica** | Adversarial critique with `fast` / `standard` / `deep` depth and selectable focus areas; structured findings, counter-arguments and recommended actions. Uses the configured LLM when available and a deterministic fallback otherwise. |
| **Digest** | Activity over the last N days (from `wiki/log.md`) grouped by day, plus freshness and link-health stats, next actions and a Markdown report. |
| **Confronta versioni** | Unified line-by-line diff against a local pre-write snapshot (both line-number columns), with one-click restore. |

Ways to open it:
- right-click a note in the left file tree and pick a tab from the review menu;
- click **🧐 Revisione** in the editor header;
- press `Ctrl+Alt+R` (Verifica), `Ctrl+Alt+C` (Critica), `Ctrl+Alt+D` (Digest) or `Ctrl+Alt+F` (Confronta versioni).

Review history is stored locally in `.wiki-forge/snapshots/<note-path>/` as a `.md` snapshot plus a `.json` sidecar (timestamp and reason). The last **25** snapshots per note are kept and the folder is gitignored. The chat `/verify` (alias `/human-review`) shares the exact same code path; `/digest`, `/adversarial-review` and `/diff` stay available as agent commands, while their Review Studio tabs are deterministic.

See [`TUTORIAL.md`](tutorial.md) §5.1 for trust tiers and [`mockups/`](../riferimenti/mockups.md) for the design preview.

## Research Studio
The **🔎 Research** button in the top bar and the **🔎 Ricerca** button in the editor header open the **Research Studio**, a single modal with six horizontal tabs matching the six query commands:

| Tab | Command | Purpose |
|---|---|---|
| **Consult** | `/consult` | Natural-language question: the most relevant notes become the model context and the answer cites sources with `[[wikilinks]]`. |
| **Ricerca** | `/search` | Case-insensitive full-text search over title, id, tags and body, ranked by relevance, with line numbers and one line of context. |
| **Backlink** | `/backlinks` | Notes that reference the selected one through `[[wikilinks]]`, with the first citing line. |
| **Correlate** | `/related` | Affine notes sharing tags/vocabulary that are **not linked yet** in either direction. |
| **Traccia** | `/trace` | Notes matching a claim, their outbound links, and the raw sources declared in frontmatter or `## Sources`, with the quoted passage. |
| **Deep Research** | `/deep-research` | Extended report saved to `output/research-*.md` plus a synthesis note in `wiki/synthesis/`, with source-attribution matrix and knowledge gaps. |

Ways to open it:
- click **🔎 Research** in the top bar or **🔎 Ricerca** in the editor header;
- right-click a note and pick **Backlink della nota** or **Correlazioni suggerite**;
- press `Ctrl+Alt+Q` (Consult), `Ctrl+Alt+S` (Ricerca), `Ctrl+Alt+B` (Backlink), `Ctrl+Alt+L` (Correlate), `Ctrl+Alt+T` (Traccia) or `Ctrl+Alt+H` (Deep Research);
- type one of the six commands in the chat: the matching tab opens with the query pre-filled.

Search, backlinks, related and trace are deterministic and work offline. Consult and deep research use the configured LLM and fall back to a deterministic, clearly labelled response when no provider is available; the deep-research report and synthesis note are written only when the backend responds.

See [`TUTORIAL.md`](tutorial.md) §2 for the tab table and [`ARCHITECTURE.md`](../architettura/architecture.md) §3.4 for the API.

## Study Studio
The **📚 Studio** button in the top bar (global action) opens the **Study Studio**, a single modal with seven horizontal tabs matching the 📚 study commands:

| Tab | Command | Purpose |
|---|---|---|
| **Guida** | `/study-guide` | Study guide with executive summary, per-note sections, glossary and self-assessment questions; `sources` uses real note paths. |
| **Quiz** | `/quiz` | Multiple-choice quiz with an exact count of 1–25 questions, correct answers and explanations. |
| **Mindmap** | `/mindmap` | Heading tree (`##`/`###`), outbound wikilinks and the JSON payload for the graph. |
| **Audio** | `/audio-overview` | Host A / Host B podcast script; MP3 synthesis stays off until an `[audio]` provider is configured. |
| **Note** | `/note` | Quick note in `notes/quick-notes.md` with a timestamp id, excluded from `wiki/index.md`. |
| **Promuovi** | `/promote-note` | Promotes the selected scratchpad entry into `wiki/<folder>/<slug>.md` and updates both indexes. |
| **Tesi** | `/thesis-chapter` | Aggregates `tipo: capitolo_tesi` notes and mature syntheses; also refreshes `output/thesis_compiled.md`. |

Ways to open it:
- click **📚 Studio** in the top bar;
- right-click a note and pick **Guida di studio**, **Quiz di autovalutazione**, **Mappa concettuale** or **Copione audio**;
- press `Ctrl+Alt+G` (Guida), `Ctrl+Alt+K` (Quiz), `Ctrl+Alt+M` (Mindmap) or `Ctrl+Alt+A` (Audio).

All seven tabs are deterministic: they use the same builders as the chat commands (`src/backend/server/studyHelpers.ts`, `POST /api/notes/study/*`) and need no LLM. Generated artefacts go to `output/`, quick notes to `notes/quick-notes.md`, and promoted articles to `wiki/`.

See [`TUTORIAL.md`](tutorial.md) §2/§4 for the tab table and [`ARCHITECTURE.md`](../architettura/architecture.md) §3.4 for the API.

## Top bar, languages and keyboard shortcuts (Fase 78)

- The top bar holds the project selector, a **language selector (🇮🇹 IT / 🇬🇧 EN)**,
  a single bordered **view control** whose segments are **🗂️ File**, **Editor**,
  **Note**, **Grafo**, **Divisione** (File is the first segment), the
  global **Research**, **Studio**, **Docs Wiki** and **Chat** buttons, plus a
  `⋯` overflow menu for the remaining actions. This whole view control and the
  `⋯` menu stay in the first row; the other pinned buttons stay to their right
  as long as they fit and move to a **centred second row** when the window gets
  narrow.
- **🗂️ File** shows/hides the left file manager with the same toggle semantics as
  the other views: press once to reveal it, press again to close it. The old
  `◀`/`▶` grip on the pane border works too and stays in sync. The state is
  persisted and shared with the File pane of the Split view.
- **Divisione / Split** is now three panes: **File · Editor · Grafo**. Entering
  Split reveals the file pane; a second click returns to the last single view.
- The `⋯` menu contains a single **Personalizza barra / Customize toolbar**
  list, one row per global action: **click the row** to run the action, **tick
  its checkbox** to also show it as a button in the main bar (untick to hide it).
  There is no second duplicate list. The choice is remembered across restarts
  and the default layout is unchanged. The **Docs Wiki** row appears only in
  Developer Mode. The list also includes **📐 Template**, which opens the
  graphical template manager (and can be pinned to the bar).
- Research and Studio are **global only**: the duplicated buttons were removed
  from the note header, which now shows only Node Info, Review, History and
  Save/Edit. The **Node Info** panel below the editor is **collapsed by default**:
  click **📊 Info nodo** to reveal it, click again to hide it.
- `Ctrl+K` opens the command palette (notes + actions), `F1` opens contextual
  help, `Ctrl+Shift+D` toggles Focus/Developer mode, `Ctrl+Alt+W` opens the
  docs wiki. Studio shortcuts: `Ctrl+Alt+G/K/M/A` (guide/quiz/mindmap/audio),
  Review shortcuts: `Ctrl+Alt+R/C/D/F`.
- Confirmation and input dialogs are styled and keyboard accessible; no native
  browser dialogs are used.

## Personalizzazione UI, ruoli e permessi

The `⋯` menu also contains **⚙️ Personalizza UI / Customize UI** (global action `global:customize`, available to every signed-in role). It opens a modal with four sections:

| Section | What it controls |
|---|---|
| **Layout / Pannelli visibili** | Show or hide File, Graph, Info nodo, Chat and Note rapide. The Editor is essential and cannot be hidden. |
| **Barra / Mostra nella barra** | Pin allowed global actions next to the view control. A permission change removes a pin automatically; it never grants the action. |
| **Aspetto / Densità** | Choose Ampia/Compatta (Comfortable/Compact). |
| **Scorciatoie** | Review the shortcuts that are actually registered and allowed for the current roles. |

Preferences follow **your user**, not the browser: for managed local sessions they are stored on the server in `.wiki-forge/ui-preferences.json` under a key derived from `source:actor`. Anonymous/legacy sessions keep the previous local behaviour. The server never accepts an identity or role override in the preferences payload, and the RBAC filter is applied after preferences are merged. If the backend is unreachable, the last local copy is used until the next successful save.

The language selector (🇮🇹 IT / 🇬🇧 EN) in the top bar changes both the interface language and the `language` preference; on the next sign-in the server value is restored. All confirmation and input dialogs are in-app and keyboard accessible — no native `alert`, `confirm` or `prompt` is used.

In **Developer Mode**, the **👥 Utenti / User management** modal now includes a **Ruoli e permessi / Roles and permissions** guide. Each of the four roles shows a short description and a capability preview derived from the shared action/role matrix, together with the number of available actions. Project-level ACLs can still further restrict what a role can do.

Safety rule: the account matching the current local identity (`human:<username>`) is marked **Tu / You**. Its **Modifica / Edit** and **Elimina / Delete** buttons are disabled, the form never opens for it, and a save or delete attempted after an identity switch is refused. You therefore cannot remove your own Admin role, deactivate yourself or delete yourself from the UI.

## Templates and creating documents

The repository ships note templates in `templates/`: `article.md` (standard wiki
article), `thesis_capitolo.md`, `thesis_domanda.md`, `thesis_sintesi.md`
(thesis chapter / question / synthesis), and `reveal/template.md` with its
`index.html` shell for slide decks. `kg_sample.ttl` is a Turtle graph sample,
not a note template. They are Markdown skeletons with `{{PLACEHOLDER}}` slots:
copy them by hand, or — recommended — use the graphical workflow:

1. Click **📐 Template** in the `⋯` menu (or the pinned button). The **Template
   Manager** lists the built-ins adapted from those files with OKF v0.2
   frontmatter (`type`, `status: draft`, `generated.by/at`, `sources`), plus any
   templates you created yourself.
2. Optionally create your own template (**Nuovo template**: name, description,
   Markdown content) and use **Usa come predefinito** to choose the default.
   User templates are stored in the browser (`localStorage`), so they survive
   reloads but are not shared across machines or projects. Built-ins cannot be
   deleted or overwritten.
3. Click **➕ Nuovo file** in the left file tree (or **Nuovo documento** inside
   the Template Manager). The dialog asks for the **document name**, shows an
   **editable wiki path** prefilled with the selected folder (e.g. `guida`, or
   empty for `wiki/`), and lets you pick a template — the default one is
   preselected. A live **Anteprima** shows the content that will be written.
4. Confirm: `POST /api/wiki/file/create` writes the rendered content to
   `wiki/<path>/<name>.md`, the vault reloads and the new note opens in the
   editor. `{{TITLE}}`, `{{DATE}}`, `{{ID}}`, `{{AUTHOR}}`, `{{CHAPTER_NUMBER}}`
   and `{{SUBTITLE}}` are substituted automatically; descriptive placeholders
   such as `{{punto 1}}` are left for you to fill in.

Built-in templates come from the backend `templates.list` command through the
single `apiBus` facade. If the API is unavailable the canonical fallback is
reported explicitly as `api:error`; there is no local `FileStorage` fallback.

> **Chat commands:** `/template show` and `/new-article <nome>` are still listed
> in the command catalogue and in the `wiki-curate` / `wiki-onboarding` skills,
> but the chat router has no handler for them — they fall through to the LLM
> free-form path. Use the graphical UI above for reliable template-based
> creation. See [`help/chat-comandi.md`](../riferimenti/help-chat-comandi.md).

## Managing projects (Fase 78)

Open **📁 Projects** in the top bar to use the **Project Manager**. From there you
can create, clone, rename, archive/restore, export/import and delete wikis.
**Delete moves the project to the trash by default** (recoverable); a separate
danger action performs a permanent delete after an explicit confirmation. The
`default` project cannot be removed. See [`help/progetti-config.md`](../riferimenti/help-progetti-config.md).
