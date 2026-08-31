---
name: wiki-study
description: >
  Use when the user asks to generate a study guide, quiz, mind map, audio/podcast
  script, or quick note from the wiki-forge knowledge base — e.g. "quiz me on
  ai-tools", "make a study guide for the anthropology wiki", "turn this into a
  mindmap", "audio overview of chapter 3", "jot down a quick note".
triggers:
  commands: [study-guide, quiz, mindmap, audio-overview, note, promote-note]
reads:
  - config.toml
  - wiki/**/*.md
  - notes/*.md
writes:
  - output/study-guide-*.md
  - output/quiz-*.md
  - output/mindmap-*.md
  - output/audio-script-*.md
  - output/audio/*.mp3
  - notes/*.md
  - wiki/**/*.md
confirm_destructive: false
---

# Wiki Study & Synthesis Skill

### `note <text>`
**Scope:** Record a quick scratchpad note without indexing it into the formal `wiki/index.md`.
**Action:**
1. Append the dated note to `notes/quick-notes.md` (or create `notes/note-<slug>.md` if text is long).
2. The `notes/` directory is excluded from `wiki/index.md` until explicitly promoted.
**Output:** File path and confirmation of stored note.

### `audio-overview <article-path|wiki-name>`
**Scope:** Generate a 2-speaker conversational dialogue script (Host A / Host B podcast synthesis) from target wiki content.
**Action:**
1. Read target article(s) or thematic wiki notes.
2. Generate an engaging multi-turn dialogue script synthesizing key themes, saved in `output/audio-script-<name>.md`.
3. Check `[audio]` configuration in `config.toml`. If `provider = "none"` (default), report that script is generated and TTS is disabled. If a TTS provider is configured, trigger synthesis into `output/audio/<name>.mp3`.
**Output:** Dialogue script in `output/audio-script-<name>.md` and optional `.mp3` audio file.

### `promote-note <note-id> [wiki-name]`
**Scope:** Promote a scratchpad quick note into a full, structured wiki article.
**Action:**
1. Read the specified quick note from `notes/`.
2. Generate standard article structure with frontmatter, H1 title, summary, related wikilinks, and sources.
3. Save to `wiki/<wiki-name>/<note-id>.md` and update thematic and master indexes.
4. Mark or archive the quick note as promoted in `notes/`.
**Output:** Path of the newly created wiki article.

### `study-guide <wiki-name|article-path>`
**Scope:** Generate a structured study guide from target wiki articles.
**Action:**
1. Read target article(s) or all notes in the thematic wiki.
2. Generate structured synthesis containing: Executive Summary, Section Breakdown, Key Glossary/Terms, and 5-10 Self-Assessment Questions with Answers.
3. Save Markdown to `output/study-guide-<name>.md` with frontmatter pointing to source articles.
**Output:** File path `output/study-guide-<name>.md` and summary report.

### `mindmap <article-path>`
**Scope:** Generate a hierarchical mind map structure for a single article or topic.
**Action:**
1. Read the target article or topic notes.
2. Extract headings (`##`, `###`), key bullet points, and concept relationships.
3. Generate an indented tree Markdown representation and JSON node-link structure in `output/mindmap-<name>.md`.
**Output:** Markdown tree structure in `output/mindmap-<name>.md`.

### `quiz <wiki-name|article-path> [n-questions]`
**Scope:** Generate an interactive self-test quiz from target wiki content.
**Action:**
1. Read target article(s) or thematic wiki notes.
2. Generate structured Markdown quiz containing `[n-questions]` (default 5): Question, Multiple Choice Options (A/B/C/D), Correct Answer, Explanation, and Source Citation.
3. Save to `output/quiz-<name>.md`.
**Output:** File path `output/quiz-<name>.md` and preview of questions.
