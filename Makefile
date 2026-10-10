# Makefile — convenience shortcuts (enhanced)
#
#   make convert          Convert sources -> raw/ (local Python + pandoc)
#   make convert-docker   Convert sources -> raw/ (Docker, no local install)
#   make wizard           Run scenario-driven wizard script (local Python)
#   make build            Build the Docker image
#   make shell            Open a shell inside the Docker environment
#   make audit            Reminder for agent audit command
#   make stats            Generate wiki stats report
#   make reindex          Reminder for agent reindex command
#   make clean-output     Remove output/ directory contents
#   make export-json      Reminder for agent export command
#   make lint             Reminder for agent lint command
#   make help             Display available target commands

convert:
	bash run_convert.sh

convert-docker:
	docker compose run --rm wiki convert

wizard:
	python3 scripts/wizard.py

build:
	docker compose build

shell:
	docker compose run --rm wiki shell

audit:
	@echo "Run 'audit' in your agent (AGENT.md §5.3)"

stats:
	@python3 scripts/wiki_stats.py

reindex:
	@echo "Run 'reindex' in your agent (AGENT.md §5.3)"

clean-output:
	rm -rf output/*

export-json:
	@echo "Run 'export json' in your agent (AGENT.md §5.5)"

lint:
	@echo "Run 'lint-frontmatter' in your agent (AGENT.md §5.3)"

schema-lint:
	@python3 scripts/schema_lint.py

schema-infer:
	@python3 scripts/schema_infer.py

study-guide:
	@echo "Run '/study-guide <topic>' in chat drawer or agent CLI"

quiz:
	@echo "Run '/quiz <topic>' in chat drawer or agent CLI"

deep-research:
	@echo "Run '/deep-research <question>' in chat drawer or agent CLI"

mindmap:
	@echo "Run '/mindmap <article-path>' in chat drawer or agent CLI"

note:
	@echo "Run '/note <text>' in chat drawer or agent CLI"

docs-sync:
	python3 scripts/check_docs_sync.py

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
	python3 src/server/mcp_server.py --http --port 8080

help:
	@echo "Available targets: convert, convert-docker, wizard, build, shell, audit, stats, reindex, schema-lint, schema-infer, okf-validate, okf-lint, okf-reindex, okf-log, okf-stats, ontology-check, export-semantic, validate-cq, suggest-odp, neuro-check, ke-maturity, maturity, thesis-compile, thesis-pdf, study-guide, quiz, deep-research, mindmap, note, clean-output, export-json, lint, docs-sync, mcp-serve, help"

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

.PHONY: convert convert-docker wizard build shell audit stats reindex schema-lint schema-infer okf-validate okf-lint okf-reindex okf-log okf-stats ontology-check export-semantic validate-cq suggest-odp neuro-check ke-maturity maturity thesis-compile thesis-pdf clean-output export-json lint docs-sync mcp-serve help ui ui-docker ui-build ui-preview ui-test ui-typecheck tags tags-write skills-link
