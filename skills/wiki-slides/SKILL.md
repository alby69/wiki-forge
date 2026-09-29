---
name: wiki-slides
description: >
  Use when the user wants to convert notes, thesis chapters, or compiled syntheses into
  reveal.js presentation slide decks — e.g. "generate slides", "/slides note=wiki/thesis.md",
  "create presentation deck for defense".
triggers:
  commands: [slides, generate-slides]
reads:
  - config.toml
  - wiki/**/*.md
  - templates/reveal/*
writes:
  - output/slides_*.md
  - output/slides_*.html
confirm_destructive: false
---

# Wiki Presentation Slides Skill (`/slides` / `/generate-slides`)

### `slides [note=<path>] [template=reveal]`
**Scope:** Converts a mature note or compiled thesis chapter (e.g. `maturity: 100`) into a structured Markdown presentation slide deck compatible with reveal.js (`templates/reveal/`).

**Steps:**
1. **Source Selection:** Identify target note or thesis chapter (`note=<path>`).
2. **Slide Structuring:**
   - Divide content into concise slides separated by `---` (horizontal slides) and `--` (vertical sub-slides).
   - Format slide headers, high-impact bullet points, speaker notes (`Note:`), and Mermaid diagrams.
3. **Template Integration:** Combine slide Markdown with `templates/reveal/template.md` or `templates/reveal/index.html`.
4. **Offline Export:** Write standalone presentation Markdown to `output/slides_<slug>.md` and HTML deck to `output/slides_<slug>.html`.

**Output:** HTML slide deck ready for offline presentation / thesis defense.
