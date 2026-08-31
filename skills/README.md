# Wiki-Forge Agent Skills

This directory contains modular, self-contained Agent Skill packages for `wiki-forge`.
Each skill defines a specific area of capability using YAML frontmatter metadata and clear instructions.

## Skill Index

| Skill Directory | Description & Scope | Primary Commands Covered |
|---|---|---|
| [`skills/wiki-ingest/`](./wiki-ingest/SKILL.md) | Ingestion and conversion of raw source materials into Markdown wiki pages | `compile`, `convert-only`, `ingest`, `recompile` |
| [`skills/wiki-curate/`](./wiki-curate/SKILL.md) | Article creation, merging, splitting, stubbing, and tag management | `new-article`, `merge`, `split`, `stub`, `retag` |
| [`skills/wiki-audit/`](./wiki-audit/SKILL.md) | Knowledge base health checks, broken link audit, reindexing, and frontmatter linting | `audit`, `reindex`, `prune`, `lint-frontmatter` |
| [`skills/wiki-query/`](./wiki-query/SKILL.md) | Querying, searching, claim tracing, and deep multi-source research reports | `consult`, `search`, `backlinks`, `related`, `trace`, `deep-research` |
| [`skills/wiki-study/`](./wiki-study/SKILL.md) | NotebookLM-inspired study guides, quizzes, mind maps, audio scripts, and scratchpad notes | `study-guide`, `quiz`, `mindmap`, `audio-overview`, `note`, `promote-note` |
| [`skills/wiki-onboarding/`](./wiki-onboarding/SKILL.md) | Scenario wizard orchestration, KB statistics, exports, tag suggestions, and help | `/wizard`, `stats`, `export`, `diff`, `template show`, `sources regenerate`, `tag-suggest`, `help` |

## Rationale: Progressive Disclosure

Loading all command definitions in every session incurs unnecessary token overhead. By decoupling commands into focused skill files:
1. The agent loads the lightweight router (`AGENT.md`) at session startup.
2. When a specific command or topic is triggered, the matching skill file under `skills/` is loaded on demand.
3. This reduces token consumption by **75–85%** per workflow session while preserving full capability and consistency across agent platforms (Claude Code, OpenCode, OpenAI Codex, Gemini CLI, Google Jules).

## Multi-Agent Compatibility & Claude Code Integration

The `skills/` directory is shared across all agent configurations. Per-agent files (`CLAUDE.md`, `AGENTS.md`, `OPENCODE.md`, `GEMINI.md`, `JULES.md`) point to `AGENT.md` as the router, while all skill packages reside centrally in `skills/`.

### Claude Code Support (`.claude/skills/`)
Claude Code natively discovers project skills placed in `.claude/skills/`. Run `make skills-link` (or `make skills-link` during setup) to populate `.claude/skills/` from `skills/`:
```bash
make skills-link
```
This copies/syncs `skills/*` into `.claude/skills/*`, enabling immediate automatic trigger resolution when running Claude Code sessions.
