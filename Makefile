# Makefile — convenience shortcuts (enhanced)
#
#   make convert          Convert sources -> raw/ (local Python + pandoc)
#   make convert-docker   Convert sources -> raw/ (Docker, no local install)
#   make wizard           Run scenario-driven wizard script (local Python)
#   make build            Build the Docker image
#   make shell            Open a shell inside the Docker environment
#   make audit            Run wiki audit through the CLI
#   make stats            Generate wiki stats report through the CLI
#   make reindex          Run reindex through the CLI
#   make clean-output     Remove output/ directory contents
#   make export-json      Export projects through the CLI
#   make lint             Run wiki lint through the CLI
#   make docs-sync        Check docs/help, changelog and wiki projection sync
#   make docs-book        Build output/manuale-wiki-forge.md from the didactic path
#   make docs-book-check  Verify the printable manual is up to date
#   make verify           Run the full docs/Node/Python verification suite
#   make help             Display available target commands

convert:
	bash scripts/run_convert.sh

convert-docker:
	docker compose run --rm wiki convert

wizard:
	python3 scripts/wizard.py

build:
	docker compose build

shell:
	docker compose run --rm wiki shell

audit:
	@npm run wf -- --yes cmd audit

stats:
	@npm run wf -- ke run wiki_stats

reindex:
	@npm run wf -- --yes cmd reindex

clean-output:
	rm -rf output/*

export-json:
	@npm run wf -- api projects.export --body '{"params":{"id":"$(or $(PROJECT_ID),default)"}}' --output "$(or $(OUTPUT),projects-export.json)"

lint:
	@npm run wf -- --yes cmd audit

schema-lint:
	@npm run wf -- ke run schema_lint

schema-infer:
	@npm run wf -- ke run schema_infer

study-guide:
	@npm run wf -- study guide "$(or $(TOPIC),wiki-forge)"

quiz:
	@npm run wf -- study quiz "$(or $(TOPIC),wiki-forge)" --count "$(or $(COUNT),5)"

deep-research:
	@npm run wf -- --yes cmd deep-research "$(or $(QUESTION),wiki-forge)"

mindmap:
	@npm run wf -- study mindmap "$(or $(TARGET),index)"

note:
	@npm run wf -- study note "$(or $(TEXT),nota rapida)"

docs-sync:
	python3 scripts/check_docs_sync.py

docs-book:
	python3 scripts/docs_book.py

docs-book-check:
	python3 scripts/docs_book.py --check

# Effective OKF wiki directories: the template default wiki/, or (when the
# root wiki/ is absent, e.g. a fresh CI checkout) every populated project wiki.
OKF_WIKIS := $(if $(wildcard wiki),wiki,$(wildcard projects/*/wiki))

okf-validate:
	@echo "OKF validation targets: $(OKF_WIKIS)"; \
	fail=0; \
	for w in $(OKF_WIKIS); do \
	  echo "linting $$w/"; \
	  python3 scripts/okf_lint.py $$w/ || fail=1; \
	done; \
	if [ -z "$(OKF_WIKIS)" ]; then \
	  echo "No wiki directory found (create wiki/ or a project under projects/)." >&2; \
	  fail=1; \
	fi; \
	exit $$fail

okf-lint:
	@echo "OKF lint targets: $(OKF_WIKIS)"; \
	fail=0; \
	for w in $(OKF_WIKIS); do \
	  echo "linting $$w/"; \
	  python3 scripts/okf_lint.py $$w/ || fail=1; \
	done; \
	if [ -z "$(OKF_WIKIS)" ]; then \
	  echo "No wiki directory found (create wiki/ or a project under projects/)." >&2; \
	  fail=1; \
	fi; \
	exit $$fail

okf-reindex:
	@python3 scripts/okf_reindex.py wiki/

okf-log:
	@python3 scripts/okf_log.py wiki/ "$(MSG)"

okf-stats:
	@python3 scripts/okf_stats.py wiki/

ontology-check:
	@python3 scripts/ontology_rules.py wiki/

export-semantic:
	@python3 scripts/export_semantic.py --wiki-dir wiki --output-dir output

validate-cq:
	python3 scripts/cq_validator.py --wiki-dir wiki --output output/cq_validation_report.md

suggest-odp:
	python3 scripts/odp_suggester.py --wiki-dir wiki

neuro-check:
	python3 scripts/neuro_symbolic_check.py --wiki-dir wiki --output output/neuro_symbolic_report.md

ke-maturity:
	python3 scripts/ke_maturity.py --wiki-dir wiki --output output/ke_maturity_report.md

maturity:
	python3 scripts/maturity_calculator.py wiki

thesis-compile:
	python3 scripts/generate_thesis.py --wiki-dir wiki --output output/thesis_compiled.md

thesis-pdf:
	python3 scripts/export_thesis_pdf.py --input output/thesis_compiled.md --output output/thesis_final.pdf

mcp-serve:
	npm run mcp -- --http --port 8080

# A2/A3 — runtime boundary: the Node API serves the built SPA and proxies
# /api/v1/graph/* to the standalone Python KG API; Vite is dev-only.
api:
	npm run api

worker:
	@npm run worker

worker-docker:
	docker compose up worker

worker-deploy:
	docker compose up -d worker

kg-api:
	python3 -m uvicorn src.backend.wikiforge.api.api_server:app --host 0.0.0.0 --port 8000

dev-all:
	npm run dev:all

help:
	@echo "Available targets: convert, convert-docker, wizard, build, shell, audit, stats, reindex, schema-lint, schema-infer, okf-validate, okf-lint, okf-reindex, okf-log, okf-stats, ontology-check, export-semantic, validate-cq, suggest-odp, neuro-check, ke-maturity, maturity, thesis-compile, thesis-pdf, study-guide, quiz, deep-research, mindmap, note, clean-output, export-json, lint, docs-sync, docs-book, docs-book-check, mcp-serve, api, worker, worker-docker, worker-deploy, kg-api, dev-all, help"

ui:
	npm run dev

ui-docker:
	docker compose up ui

ui-build:
	npm run build

ui-preview:
	npm run preview

ui-test:
	npm run test

ui-typecheck:
	npm run typecheck

verify:
	npm run verify

tags:
	python3 scripts/suggest_tags.py --all

tags-write:
	python3 scripts/suggest_tags.py --all --write

skills-link:
	@mkdir -p .claude/skills
	@for dir in skills/*/; do \
		skill_name=$$(basename $$dir); \
		if [ -d "$$dir" ]; then \
			rm -rf .claude/skills/$$skill_name; \
			ln -sf ../../skills/$$skill_name .claude/skills/$$skill_name; \
		fi \
	done
	@echo "✅ Symlinked skills into .claude/skills/ (Single Source of Truth - DRY/KISS compliant)"

.PHONY: convert convert-docker wizard build shell audit stats reindex schema-lint schema-infer okf-validate okf-lint okf-reindex okf-log okf-stats ontology-check export-semantic validate-cq suggest-odp neuro-check ke-maturity maturity thesis-compile thesis-pdf clean-output export-json lint docs-sync docs-book docs-book-check mcp-serve api worker worker-docker worker-deploy kg-api dev-all help ui ui-docker ui-build ui-preview ui-test ui-typecheck verify tags tags-write skills-link
