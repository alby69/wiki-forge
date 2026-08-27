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
| 10 | Reuse template | 🔄 Ongoing | Change `config.toml`, copy repo |
| 11 | Command Reference system (v2.0) | ✅ Done | 15+ atomic commands in `AGENT.md` |
| 12 | TUTORIAL command cheat sheet | ✅ Done | §11-13 in `TUTORIAL.md` |
| 13 | Article template system | 🔄 Ongoing | `templates/article.md` standard template |
| 14 | Project hygiene files | 🔄 Ongoing | `.gitignore`, `CHANGELOG.md` |
| 15 | Enhanced Makefile | 🔄 Ongoing | Targets for `stats`, `audit`, `reindex`, `clean-output`, etc. |
| 16 | Web clipping support | 🔄 Ongoing | `clip2md.py` script |
| 17 | Multi-language wiki support | ⬜ Todo | `i18n` configuration |
| 18 | Metrics & analytics | 🔄 Ongoing | `wiki_stats.py` -> `METRICS.md` |
| 19 | Pre-commit hooks | 🔄 Ongoing | Frontmatter and link checks |
| 20 | CI/CD for conv2md.py | 🔄 Ongoing | GitHub Actions workflows |

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

## Phase 13 — Article template system 🔄 Ongoing

**Goal:** standardize new article creation.

**Deliverables:**
- `templates/article.md` with placeholders.
- `new-article` command that uses the template.
- `template show` command to display it.

---

## Phase 14 — Project hygiene files 🔄 Ongoing

**Goal:** make the repo production-ready.

**Deliverables:**
- Updated `.gitignore`.
- Created `CHANGELOG.md` tracking template versions.

---

## Phase 15 — Enhanced Makefile 🔄 Ongoing

**Goal:** provide more convenience shortcuts.

**New targets:**
- `make audit`
- `make stats`
- `make reindex`
- `make clean-output`
- `make export-json`
- `make lint`
- `make help`

---

## Phase 16 — Web clipping support 🔄 Ongoing

**Goal:** ingest web pages directly into raw/ format.

**Deliverables:**
- `clip2md.py` script for fetching URLs and converting to Markdown.

---

## Phase 17 — Multi-language wiki support ⬜ Todo

**Goal:** support wikis in languages other than English.

---

## Phase 18 — Metrics & analytics 🔄 Ongoing

**Goal:** track wiki growth and health over time.

**Deliverables:**
- `wiki_stats.py` script to generate `METRICS.md`.

---

## Phase 19 — Pre-commit hooks 🔄 Ongoing

**Goal:** prevent broken states from entering the repo.

**Deliverables:**
- `.pre-commit-config.yaml` file.

---

## Phase 20 — CI/CD for conv2md.py 🔄 Ongoing

**Goal:** ensure converter works across environments.

**Deliverables:**
- `.github/workflows/test.yml` GitHub Actions workflow.
