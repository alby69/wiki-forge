# TUTORIAL — Your "second brain" (an LLM Wiki), explained simply

*A guide for non-technical users. It explains, step by step, what this project
is, why it works, and how to use it day to day. No programming knowledge
required — you only ever edit one small settings file and drop files into a
folder.*

---

## 0. What is this project (in plain words)?

You are building a **digital second brain**: an orderly archive of your
materials (books, articles, notes) that an AI has *read, cleaned, and connected*
so you can ask it questions and get answers in seconds.

The idea comes from Andrej Karpathy's **LLM Wiki** pattern (see
`docs/KARPATHY_LLM_WIKI.md`). The core principle, in three folders and one
"manual" that tells the AI how to manage everything:

| In the idea file        | In this template            |
|-------------------------|-----------------------------|
| Claude Code / any agent | **your coding agent** (Claude Code, OpenCode, Codex, …) |
| `CLAUDE.md` (manual)    | **`AGENT.md`** (same role: instructions read at startup) |
| Obsidian (to read)      | files are Markdown, readable anywhere (incl. Obsidian) |
| Web Clipper (web → raw) | book/PDF conversion with **pandoc** + `conv2md.py` |
| Consult / Compile / Audit | the same three actions, defined in `AGENT.md` |

The result is identical in spirit: **you keep the sources, the AI cleans and
connects them; you ask, the AI answers.**

---

## 1. The three-folder structure

```
project/
├── sources/  (named backup/)  Your ORIGINAL files (PDF, EPUB) — untouched, keep safe
├── raw/                        The same files turned into plain text (Markdown)
├── wiki/                       The knowledge, organized and linked (written by the AI)
├── output/                     Temporary answers to your questions
└── (manuals & tools: AGENT.md, config.toml, conv2md.py, …)
```

- **`raw/` = the "in-tray"**: you put documents here to be processed. The AI
  doesn't write here; it only *ticks them off* when done (renaming with
  `_COMPILED`).
- **`wiki/` = the "whiteboard"**: the heart of the second brain. The AI writes
  clean articles and links them with `[[wikilinks]]`.
- **`output/` = the "scratchpad"**: answers to your questions land here. It is
  ephemeral — emptying it loses no knowledge.

> In the original idea these three folders are created by a prompt. Here they
> already exist as the project skeleton; the principle is exactly the same.

---

## 2. The AI's "manual": `AGENT.md`

The agent reads `AGENT.md` at every startup to know how to manage the knowledge
base. It is **prose, not code** — plain instructions in English:

1. **The AI's role**: "librarian" — ingest raw material, maintain the wiki,
   answer with traceable syntheses.
2. **The rules of the three folders** (`sources/` / `raw/` / `wiki/` / `output/`).
3. **The wiki structure**: a master `index.md`, then one folder per theme
   (`wiki/<topic>/`) with its own `index.md` and many articles.
4. **The three actions** you can ask for at any time: **Consult**, **Compile**,
   **Audit**.

> For non-technical users: `AGENT.md` is just a "instruction sheet" written in
> clear English. Every time you open the agent, it reads it and knows what to do.

---

## 3. Step 1 — Get documents into `raw/`

In the idea file, *Obsidian Web Clipper* captures web pages. Here the materials
are **books and papers**, so the work is:

1. Put the originals in `sources/` (currently `backup/`) so they stay safe.
2. Turn them into plain text (Markdown) with **`conv2md.py`**, which uses
   **pandoc** (the "book converter").
3. Start the conversion with one command: `bash run_convert.sh`
   (details in `README.md`).
4. The converted files appear in `raw/`, ready to be processed.

> The result is the same as the Clipper: having text files in `raw/`, not closed
> documents. The AI can read all of them.

---

## 4. Step 2 — **Compile** (the action that builds the wiki)

This is where the `compile` workflow from `AGENT.md` does its job. It is the
moment the AI takes the raw files in `raw/` and turns them into structured
knowledge. What happens, in order:

1. **Convert** (new in this template): the workflow first runs `conv2md.py` so
   any new sources become Markdown in `raw/`. You only drop files into
   `sources/`.
2. **Read** every file in `raw/` that is *not* already processed.
3. **Classify** by theme (e.g. "anthropology" vs "AI").
4. **Write** articles into `wiki/`:
   - Each article has a simple lowercase-with-dashes name (`david-graeber.md`).
   - Each follows a fixed schema: frontmatter with *tags* and *sources*, title,
     2-4 line intro, **Summary**, sections, **Related** (linked to each other),
     **Sources** (pointer to the original in `raw/`).
5. **Link**: articles cite each other with `[[wikilinks]]`, building the
   "web of connections" from the idea file.
6. **Update indexes**: `index.md` per theme and the general `wiki/index.md`.
7. **Tick off**: each source in `raw/` is renamed with `_COMPILED` (e.g.
   `graeber-bullshit-jobs.md` → `graeber-bullshit-jobs_COMPILED.md`). The AI
   then knows it is done and won't redo it.

> This is exactly the behavior of the idea file: files in `raw/` change name
> ("compiled") and subfolders, articles, and indexes appear in `wiki/`.

You can repeat this step as many times as you add material.

---

## 5. Step 3 — **Consult** (ask questions)

This is the action *you* use. When you ask *"What will be the impact of AI on
work?"*, the AI:

1. Reads `wiki/index.md` to understand the themes.
2. Reads the `index.md` of the relevant themes.
3. Reads **only** the useful articles (not the whole wiki: saves time and tokens).
4. Answers by synthesizing and citing articles with `[[wikilinks]]`.

> Key benefit (also noted in the idea file): working on already-cleaned and
> linked files makes answers faster and more accurate than throwing the AI at
> raw documents.

---

## 6. Step 4 — **Audit** (health check)

The third `AGENT.md` action, equivalent to "check duplicates / broken links".
The AI inspects the wiki looking for:

- `[[…]]` links that point to non-existent pages;
- duplicate articles to merge;
- indexes out of sync with real files;
- concepts cited but lacking their own article.

> After an audit, all wikilinks should resolve and indexes stay aligned.

---

## 7. The extra of this template: `SOURCES.md`

Unlike the generic idea file, for a serious project we keep a **`SOURCES.md`**
at the root: the registry of every source that feeds the wiki, ordered by
author and by topic, with the link to the `raw/` file and the corresponding
wiki article. It is the bridge between the wiki's "web" and academic use
(citations, references). Regenerated for your own subject when you reuse the
template.

---

## 8. Recap of steps (repeat any time)

| # | Action            | Where      | Command / gesture              |
|---|-------------------|------------|--------------------------------|
| 1 | Keep originals safe | `sources/` | manual copy                    |
| 2 | Convert to text    | `raw/`     | `bash run_convert.sh`          |
| 3 | **Compile** to wiki | `wiki/`   | tell the agent: "compile"      |
| 4 | **Consult** / ask  | `output/` + answer | tell the agent your question |
| 5 | **Audit** coherence | `wiki/`  | tell the agent: "audit"        |
| 6 | Keep the sources registry | root | `SOURCES.md` (generated)   |

---

## 9. Practical tips (from the idea file, applied here)

- **Tell the AI what you are compiling**: when you launch Compile, add a sentence
  about the content (e.g. "these are Karpathy essays on LLMs and agents"). The AI
  works better.
- **Not everything is the AI's fault**: diagnose your results critically.
- **Privacy**: you can run everything locally. Your materials stay on your disk.
- **Performance**: the more files you add, the bigger the wiki grows. The indexes
  (`index.md`) exist precisely so the AI doesn't re-read everything each time —
  keep them updated.

---

## 10. Files worth knowing (and not fearing)

- **`AGENT.md`** — the AI's "manual". To change a rule (e.g. how to name
  articles), edit it here.
- **`config.toml`** — the single settings knob (title, context, folders, i18n/multi-language settings).
- **`README.md`** — minimal technical guide for conversion.
- **`conv2md.py`** + **`run_convert.sh`** — tools that turn books/PDFs into text.
- **`SOURCES.md`** — the registry of sources.
- **`wiki/index.md`** — the "front door": every Consult starts here.

---

---

## 11. The optional Web UI (browser viewer)

If you don't want to install Obsidian, the template ships with a small **web
viewer** you can open in any browser.

1. Install the UI tools once:
   ```bash
   npm install
   ```
2. Launch it:
   ```bash
   npm run dev
   ```
   This opens **http://localhost:5173** automatically.

What you see:
- **Left — Vault:** every note grouped by folder, with a tag cloud and a search box.
- **Center — Editor:** the selected note's Markdown text.
- **Right — Context:** backlinks, outbound links, and tags of the selected note.
- **Graph:** a node-link map of how notes connect via `[[wikilinks]]`; use the
  search box and "minimum connections" control above it to focus the view.

The viewer reads the real `wiki/` and `raw/` folders and draws the graph from
their links. It is **read-only / explore-only**: to change a note, tell the
agent (`compile`, or edit the file directly) — the viewer just helps you look.

Alternatives: `npm run build` produces a static `dist/` folder you can host
anywhere; `npm run preview` serves that build locally.

---

## 12. Command Cheat Sheet

> Quick reference of every command you can type to the agent.
> Grouped by how often you'll use them.

### Daily commands
| Command | When to use | Example |
|---------|-------------|---------|
| `compile` | You dropped new files in `sources/` and want the wiki updated | `compile` |
| `consult "..."` | You have a question and want an answer from the wiki | `consult "What did Karpathy say about agents?"` |
| `search <term>` | You know a concept exists but can't find the article | `search "LLM-OS"` |
| `help` | You forgot a command | `help` |

### Weekly maintenance
| Command | When to use |
|---------|-------------|
| `audit` | General health check (do this every 5-10 new articles) |
| `audit links` | You renamed an article and suspect broken links |
| `reindex` | You moved/renamed articles manually |
| `stats` | You want a snapshot of wiki growth |

### As-needed commands
| Command | When to use | Requires confirmation? |
|---------|-------------|----------------------|
| `merge <a> <b>` | Two articles cover the same topic | ✅ Always |
| `split <art> <heading>` | One article grew too long | ✅ Always |
| `stub <concept>` | You want to create a placeholder for a future article | ❌ No |
| `prune` | Remove empty/orphan articles | ✅ Always |
| `sources regenerate` | After adding many articles, rebuild the bibliography | ❌ No |
| `export json` | You want to back up or share the wiki structure | ❌ No |
| `trace "claim"` | You want to verify where a claim comes from | ❌ No |

---

## 12. Troubleshooting

### "The agent says it can't find raw files"
- Check that `config.toml` exists and has the correct `paths.raw` value.
- Run `bash run_convert.sh` manually first to ensure conversion worked.
- If using Docker, run `docker compose run --rm wiki convert`.

### "Links are broken after I renamed an article"
1. Run `audit links` to find all broken links.
2. Run `reindex` to regenerate indexes.
3. If the old name still appears in many places, consider creating a redirect stub.

### "The compile is too slow / uses too many tokens"
- Use `ingest <file>` instead of `compile` to process one file at a time.
- Ensure files in `raw/` are already renamed with `_COMPILED` to avoid re-processing.

### "I have two articles about the same thing"
- Run `audit duplicates` to confirm.
- Then run `merge <article-1> <article-2>`. The agent will ask for confirmation.

### "The agent created an article in the wrong wiki"
- Manually move the file to the correct `wiki/<name>/` folder.
- Then run `reindex` to fix the indexes.
- Update `wiki/index.md` if you created a new thematic wiki.

---

## 13. Keeping your wiki healthy over time

### Monthly
- Run `audit` and address any broken links or orphans.
- Run `sources regenerate` to keep the bibliography current.
- Review `stats` to see which areas of your wiki are growing and which are neglected.

### Quarterly
- Run `audit duplicates` to catch topic drift.
- Review `wiki/index.md` — does it still reflect your knowledge structure?
- Export a backup with `export json` or `export obsidian-vault`.

### Yearly
- Archive old `output/` files.
- Consider splitting overgrown wikis into sub-wikis.
- Update `config.toml` if your project context has evolved.
