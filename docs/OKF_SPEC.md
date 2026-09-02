# Open Knowledge Format (OKF) Specification v0.2

**Version:** 0.2
**Status:** Standard
**Repository:** https://github.com/GoogleCloudPlatform/open-knowledge-format

---

## 1. Overview

The Open Knowledge Format (OKF) is an open, vendor-neutral standard for organizing human and machine-generated knowledge bases ("LLM Wikis") as modular Markdown bundles. An OKF bundle represents a graph of knowledge where individual concepts are stored as Markdown documents (`.md`) enriched with structured YAML frontmatter metadata, cross-linked using standard relative Markdown links or wikilinks, and indexed through reserved structural files.

---

## 2. Bundle Anatomy

An OKF knowledge bundle consists of a directory tree with the following structure:

```
wiki/
├── index.md                  # Bundle-root reserved index
├── log.md                    # Chronological bundle change log
├── <topic-a>/                # Topic directory
│   ├── index.md              # Topic index
│   ├── log.md                # Topic change log (optional)
│   ├── concept-one.md        # Concept document
│   └── concept-two.md        # Concept document
└── <topic-b>/
    └── concept-three.md
```

### 2.1 Reserved Files
- `index.md`: Standard directory listing supporting progressive disclosure (§8). Must NOT contain frontmatter, with the sole exception of `okf_version: "0.2"` at the bundle root `wiki/index.md`.
- `log.md`: Chronological log of creation, updates, and deprecations (§9).

---

## 3. Frontmatter Schema & Metaprogramming

Every non-reserved Markdown document in an OKF bundle MUST contain a YAML frontmatter block enclosed between `---` delimiters.

```yaml
---
type: Concept                            # REQUIRED: Concept | Paper | Book | Tool | Process | Playbook | Reference | StudyGuide | Quiz
title: "LLM Wiki Pattern"                 # Display title (if omitted, derived from H1 or filename)
description: "Karpathy's LLM Wiki pattern" # One-line summary for snippets and index generation
resource: "https://example.com/spec"     # Optional canonical URI or source path
tags: [topic/ai, status/stable]          # Namespaced tag array
status: stable                           # draft | stable | deprecated (default: stable)
stale_after: 2027-12-31T00:00:00Z        # ISO 8601 expiry timestamp

generated:
  by: wiki-forge-agent/v2.7              # REQUIRED actor: <producer>/<version> | human:<id> | process:<id>
  at: 2026-09-02T12:00:00Z               # ISO 8601 UTC timestamp

verified:                                # List of verification events
  - by: human:alby69
    at: 2026-09-02T12:30:00Z

sources:                                 # Source provenance and credibility signals
  - id: raw-source-1
    resource: raw/source_COMPILED.md
    title: "Raw Source Material"
    author: process:conv2md
    last_modified: 2026-09-01T00:00:00Z
---
```

---

## 4. Required and Recommended Fields

| Field | Required / Recommended | Format / Description |
|---|---|---|
| `type` | **REQUIRED** | String from controlled vocabulary (`Concept`, `Paper`, `Book`, `Tool`, `Process`, `Playbook`, `Reference`, `StudyGuide`, `Quiz`, etc.) |
| `title` | Recommended | Human-readable document title. |
| `description` | Recommended | One-line concise summary. |
| `status` | Recommended | One of `draft`, `stable`, `deprecated`. Default is `stable`. |
| `stale_after` | Optional | ISO 8601 timestamp marking when content needs re-verification. |
| `generated` | Recommended | Object with `by` (actor) and `at` (ISO timestamp). |
| `verified` | Optional | List of verification objects with `by` and `at`. |
| `sources` | Recommended | List of source provenance objects with `id`, `resource`, `title`, `author`, `last_modified`. |

---

## 5. Actor Conventions

Actors in `generated.by`, `verified[].by`, and `sources[].author` MUST follow standard namespace conventions:
- `human:<id>` (e.g. `human:alby69`) for human authors and reviewers.
- `<producer>/<version>` (e.g. `wiki-forge-agent/v2.7`) for LLM agents.
- `process:<id>` (e.g. `process:conv2md`, `process:migrate-script`) for automated processes.

---

## 6. Trust Tiers

Trust levels are derived automatically from the `verified` array:
1. **unverified**: No `verified` entries present.
2. **machine-confirmed**: `verified` array contains entries, but none from a `human:*` actor.
3. **human-reviewed**: `verified` array contains at least one entry from a `human:<id>` actor.

---

## 7. Index Format (`index.md`)

`index.md` provides deterministic, human-and-agent navigable directories (§8):
- Section headings (`## Topics`, `## Recently Updated`).
- Relative Markdown links with concise summaries extracted from `description`.
- Bundle-root `index.md` MAY include frontmatter with `okf_version: "0.2"`.

---

## 8. Log Format (`log.md`)

`log.md` tracks chronological history (§9):
- Headings organized by ISO date (`## YYYY-MM-DD`).
- Bullet points with standard bold action keywords: `**Update**`, `**Creation**`, `**Deprecation**`, `**Initialization**`.

---

## 9. Interoperability & Link Tolerance

OKF consumers MUST tolerate broken links (stubs) gracefully (§11). Both standard relative Markdown links (`[Title](path.md)`) and Obsidian-style wikilinks (`[[wikilink]]`) are supported within wiki-forge, with standard Markdown relative links preferred in structural index sections.
