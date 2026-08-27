# Changelog

All notable changes to the `wiki-forge` template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-27

### Added
- Complete Command Reference system in `AGENT.md` (v2.0) with 15+ atomic commands (`ingest`, `new-article`, `merge`, `split`, `stub`, `audit`, `reindex`, `stats`, `export`, `trace`, etc.).
- `TUTORIAL.md` additions: §11 Command Cheat Sheet, §12 Troubleshooting, and §13 Long-Term Care.
- Standard article template `templates/article.md`.
- `CHANGELOG.md` for release and version tracking.
- `wiki_stats.py` script for metrics calculation and `METRICS.md` generation.
- `clip2md.py` script for web page clipping into Markdown.
- GitHub Actions workflow (`.github/workflows/test.yml`) for `conv2md.py` testing.
- Pre-commit hook configuration (`.pre-commit-config.yaml`).

### Changed
- Expanded `config.toml` with `[agent]`, `[naming]`, `[export]`, and `[webclip]` settings.
- Enhanced `Makefile` with targets (`audit`, `stats`, `reindex`, `clean-output`, `export-json`, `lint`, `help`).
- Updated `.gitignore` to cover build artifacts, output logs, and environment files.
- Updated `ROADMAP.md` tracking phases 0–20.

## [1.0.0] - 2026-04-29

### Added
- Initial release of `wiki-forge` template.
- Decoupled converter script (`conv2md.py` & `run_convert.sh`).
- Basic `AGENT.md` operating manual (macro-workflows: compile, consult, audit).
- Config-driven setup via `config.toml`.
- Docker support (`Dockerfile`, `docker-compose.yml`).
