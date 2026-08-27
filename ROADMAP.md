# ROADMAP — Build & Maintain the LLM Wiki Template

> A step-by-step implementation plan written for **non-technical users**.
> Each phase states *what* to do, *why*, and *how* (with the simplest possible
> commands). Progress is tracked in the status table below and updated as work
> advances.

---

## Progress dashboard

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 0 | Understand the LLM Wiki concept | ✅ Done | `docs/KARPATHY_LLM_WIKI.md`, `TUTORIAL.md` |
| 1 | Scaffold project & single config knob | ✅ Done | `config.toml` |
| 2 | Dependency setup (Docker + classic) | ✅ Done | `Dockerfile`, `docker-compose.yml`, `requirements.txt` |
| 3 | Source ingestion & conversion | ✅ Done | `conv2md.py`, `run_convert.sh` |
| 4 | Agent schema & COMPILE integration | ✅ Done | `AGENT.md` v1.0 |
| 5 | Compile the existing knowledge base | ✅ Done | Run `compile` on current `raw/` |
| 6 | Sources registry | ✅ Done | `SOURCES.md` |
| 7 | Daily use: Consult & Audit | ✅ Done | Three workflows tested |
| 8 | Documentation pass | ✅ Done | `README.md`, `TUTORIAL.md`, `ROADMAP.md` |
| 9 | Publish to GitHub | ✅ Done | Repo: `alby69/wiki-forge` |
| 10 | Reuse template | ✅ Done | Configured `config.toml`, modular structure |
| 11 | Command Reference system (v2.0) | ✅ Done | 15+ atomic commands in `AGENT.md` |
| 12 | TUTORIAL command cheat sheet | ✅ Done | §11-13 in `TUTORIAL.md` |
| 13 | Article template system | ✅ Done | `templates/article.md` standard template |
| 14 | Project hygiene files | ✅ Done | `.gitignore`, `CHANGELOG.md` |
| 15 | Enhanced Makefile | ✅ Done | Targets for `stats`, `audit`, `reindex`, `clean-output`, etc. |
| 16 | Web clipping support | ✅ Done | `clip2md.py` script |
| 17 | Multi-language wiki support | ✅ Done | `[i18n]` section in `config.toml` & `AGENT.md` guidelines |
| 18 | Metrics & analytics | ✅ Done | `wiki_stats.py` -> `METRICS.md` |
| 19 | Pre-commit hooks | ✅ Done | `.pre-commit-config.yaml` with frontmatter and link checks |
| 20 | CI/CD for conv2md.py | ✅ Done | `.github/workflows/test.yml` GitHub Actions workflow |

Legend: ✅ Done · 🔄 Ongoing · ⬜ Todo

---

## Phase 11 — Command Reference system (v2.0) ✅ Done

**Goal:** give the agent a rich, granular command set instead of 3 macro-workflows.

**Deliverables:**
- Rewrote `AGENT.md` with §5 "COMMAND REFERENCE" (15+ commands).
- Documented each command: syntax, scope, action, output, confirmation rules.
- Added orchestration section (§6) explaining how macro-workflows chain atomic commands.

---

## Phase 12 — TUTORIAL command cheat sheet ✅ Done

**Goal:** make the TUTORIAL a complete user reference, not just a concept guide.

**Deliverables:**
- §11: Command Cheat Sheet (daily / weekly / as-needed).
- §12: Troubleshooting (5 common problems + solutions).
- §13: Long-term care (monthly / quarterly / yearly checklist).

---

## Phase 13 — Article template system ✅ Done

**Goal:** standardize new article creation.

**Deliverables:**
- `templates/article.md` with standard frontmatter and structural placeholders.
- `new-article` command specification in `AGENT.md`.
- `template show` command in `AGENT.md` to view active template.

---

## Phase 14 — Project hygiene files ✅ Done

**Goal:** make the repo production-ready and version-tracked.

**Deliverables:**
- Updated `.gitignore` excluding venv, logs, build noise, and raw binaries.
- Created `CHANGELOG.md` following Semantic Versioning to track changes.

---

## Phase 15 — Enhanced Makefile ✅ Done

**Goal:** provide convenience targets for daily workflows and agent commands.

**New targets:**
- `make audit`
- `make stats`
- `make reindex`
- `make clean-output`
- `make export-json`
- `make lint`
- `make help`

---

## Phase 16 — Web clipping support ✅ Done

**Goal:** ingest web pages directly into raw/ format.

**Deliverables:**
- `clip2md.py` script for fetching URLs, stripping HTML noise, and saving as clean Markdown in `sources/web-clips/`.

---

## Phase 17 — Multi-language wiki support ✅ Done

**Goal:** support wikis in languages other than English.

**Deliverables:**
- `[i18n]` section added to `config.toml` (`default_language`, `supported_languages`, `fallback_language`).
- Extended `AGENT.md` and `TUTORIAL.md` instructions for multilingual content handling and synthesis.

---

## Phase 18 — Metrics & analytics ✅ Done

**Goal:** track wiki growth and health over time.

**Deliverables:**
- `wiki_stats.py` script to compute stats (articles, wikilinks, broken links, orphans, sources) and auto-generate `METRICS.md`.

---

## Phase 19 — Pre-commit hooks ✅ Done

**Goal:** prevent broken states or missing metrics from entering the repository.

**Deliverables:**
- `.pre-commit-config.yaml` file with trailing whitespace, EOF fixer, YAML validation, and `wiki-stats-check` hooks.

---

## Phase 20 — CI/CD for conv2md.py ✅ Done

**Goal:** ensure converter and scripts work across environments.

**Deliverables:**
- `.github/workflows/test.yml` GitHub Actions workflow testing Python 3.11/3.12, pandoc installation, `conv2md.py`, `wiki_stats.py`, and `clip2md.py`.
