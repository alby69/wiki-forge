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
	@python3 wiki_stats.py

reindex:
	@echo "Run 'reindex' in your agent (AGENT.md §5.3)"

clean-output:
	rm -rf output/*

export-json:
	@echo "Run 'export json' in your agent (AGENT.md §5.5)"

lint:
	@echo "Run 'lint-frontmatter' in your agent (AGENT.md §5.3)"

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

okf-validate:
	@python3 scripts/okf_lint.py wiki/

okf-lint:
	@python3 scripts/okf_lint.py wiki/

okf-reindex:
	@python3 scripts/okf_reindex.py wiki/

okf-log:
	@python3 scripts/okf_log.py wiki/ "$(MSG)"

okf-stats:
	@python3 scripts/okf_stats.py wiki/

help:
	@echo "Available targets: convert, convert-docker, wizard, build, shell, audit, stats, reindex, okf-validate, okf-lint, okf-reindex, okf-log, okf-stats, study-guide, quiz, deep-research, mindmap, note, clean-output, export-json, lint, docs-sync, ui, ui-docker, ui-build, ui-preview, ui-test, ui-typecheck, help"

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
	python suggest_tags.py --all

tags-write:
	python suggest_tags.py --all --write

skills-link:
	@mkdir -p .claude/skills
	@for dir in skills/*/; do \
		skill_name=$$(basename $$dir); \
		if [ -d "$$dir" ]; then \
			rm -rf .claude/skills/$$skill_name; \
			cp -r "$$dir" .claude/skills/$$skill_name; \
		fi \
	done
	@echo "Linked skills into .claude/skills/"

.PHONY: convert convert-docker wizard build shell audit stats reindex okf-validate okf-lint okf-reindex okf-log okf-stats clean-output export-json lint docs-sync help ui ui-docker ui-build ui-preview ui-test ui-typecheck tags tags-write skills-link
